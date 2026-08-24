"""
nileguard_architecture.py

NileGuard v7 — Single-Step PDSI Forecasting Model Architecture
================================================================
Pipeline:
    Climate Tensor -> Multi-Scale CNN -> Feature Fusion ->
    Spatio-Temporal Attention -> Divided Space-Time Transformer Encoder ->
    Regression Head -> Next-Month PDSI Map

This module contains ONLY the `nn.Module` definitions, extracted from the
training notebook (NileGuard_v7_SingleStep.ipynb) and cleaned up for reuse
in a deployment context (no training/loss/dataset code here — see
`nileguard_preprocessing.py` for saving artifacts and `nileguard_api.py`
for serving them).

Forward contract (unchanged from training):
    input  : (B, lookback, C, H, W)   float32
    output : (B, H, W)                float32, NORMALIZED (z-score) PDSI.
             Callers must denormalize with the governorate's stored
             target_mean / target_std (see NileGuardScaler).

Each of Upper Egypt's 8 governorates has its OWN model instance, because
each governorate has a different bounding-box crop (H, W) and lookback
window — see LOOKBACK_MAP / GOV_BBOXES in the training notebook. This file
defines the architecture class only; per-governorate instances are built
at load time using the hyperparameters stored alongside each checkpoint.
"""

import math

import torch
import torch.nn as nn
import torch.nn.functional as F


# =============================================================================
# Positional Encoding
# =============================================================================
class TemporalPositionalEncoding(nn.Module):
    """Standard sinusoidal positional encoding, broadcast over the second-to-
    last dimension so it works whether tokens are (B, T, d) or (B, S, T, d)."""

    def __init__(self, d_model: int, max_len: int):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))  # (1, max_len, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:, : x.size(-2), :]


# =============================================================================
# Multi-Scale CNN
# =============================================================================
class MultiScaleConvBlock(nn.Module):
    """
    Multi-Scale CNN block: three parallel branches (3x3, 5x5, dilated-3x3
    with dilation=2), each Conv2d -> BatchNorm2d -> GELU, concatenated and
    fused with a 1x1 convolution (-> BatchNorm2d -> GELU), with a residual
    connection (1x1-projected if channel counts differ). All branches use
    `same`-style padding so spatial resolution is never reduced, giving the
    encoder both small localized drought pockets and broader regional
    context in a single layer.
    """

    def __init__(self, in_channels: int, out_channels: int, dropout: float):
        super().__init__()
        branch_channels = out_channels // 3
        remainder = out_channels - branch_channels * 3  # give any remainder to the 3x3 branch

        self.branch3 = nn.Sequential(
            nn.Conv2d(in_channels, branch_channels + remainder, kernel_size=3, padding=1),
            nn.BatchNorm2d(branch_channels + remainder),
            nn.GELU(),
        )
        self.branch5 = nn.Sequential(
            nn.Conv2d(in_channels, branch_channels, kernel_size=5, padding=2),
            nn.BatchNorm2d(branch_channels),
            nn.GELU(),
        )
        self.branch_dilated = nn.Sequential(
            nn.Conv2d(in_channels, branch_channels, kernel_size=3, padding=2, dilation=2),
            nn.BatchNorm2d(branch_channels),
            nn.GELU(),
        )

        self.fuse = nn.Sequential(
            nn.Conv2d(out_channels, out_channels, kernel_size=1),
            nn.BatchNorm2d(out_channels),
            nn.GELU(),
        )
        self.drop = nn.Dropout2d(dropout)
        self.skip = (
            nn.Conv2d(in_channels, out_channels, kernel_size=1)
            if in_channels != out_channels else nn.Identity()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = self.skip(x)
        branches = torch.cat([self.branch3(x), self.branch5(x), self.branch_dilated(x)], dim=1)
        out = self.drop(self.fuse(branches))
        return F.gelu(out + identity)


class FeatureFusionModule(nn.Module):
    """
    Learnable Feature Fusion block applied after the Multi-Scale CNN stack,
    before Spatio-Temporal Attention. Combines a LOCAL branch (depthwise 3x3
    conv, preserves fine spatial detail cheaply) with a GLOBAL branch
    (global-average-pooled context, broadcast back as a per-channel gate),
    blended by a learnable sigmoid gate.
    """

    def __init__(self, channels: int, dropout: float):
        super().__init__()
        self.local_branch = nn.Sequential(
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, groups=channels),  # depthwise
            nn.Conv2d(channels, channels, kernel_size=1),                              # pointwise
            nn.BatchNorm2d(channels),
            nn.GELU(),
        )
        self.global_branch = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(channels, channels, kernel_size=1),
            nn.GELU(),
            nn.Conv2d(channels, channels, kernel_size=1),
            nn.Sigmoid(),
        )
        self.fusion_gate = nn.Parameter(torch.tensor(0.0))  # sigmoid(0) = 0.5 initial balance
        self.drop = nn.Dropout2d(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        local_feats = self.local_branch(x)
        global_gate = self.global_branch(x)                       # (B, C, 1, 1)
        locally_fused = local_feats * global_gate + x * (1.0 - global_gate)
        gate = torch.sigmoid(self.fusion_gate)
        out = gate * locally_fused + (1.0 - gate) * x
        return self.drop(out)


# =============================================================================
# Spatio-Temporal Attention
# =============================================================================
class SpatioTemporalAttention(nn.Module):
    """
    Dedicated Spatio-Temporal Attention module sitting between the CNN
    (Multi-Scale CNN + Feature Fusion) and the Transformer encoder. Jointly
    learns:

        1. Channel attention  (SE-style)
        2. Spatial attention  (CBAM-style: avg+max pooled -> 7x7 conv -> sigmoid)
        3. Temporal attention (softmax-normalized per-frame weight across
           the lookback window)

    applied sequentially with independent learnable scalar gates
    (`gate_c`, `gate_s`, `gate_t`).

    `self.last_spatial_attn` caches the most recent spatial attention map,
    (B, T, H, W) — useful for attention-based explainability visualizations.
    """

    def __init__(self, channels: int, reduction: int = 8, dropout: float = 0.1):
        super().__init__()
        hidden = max(channels // reduction, 4)

        self.channel_fc = nn.Sequential(
            nn.Linear(channels, hidden), nn.GELU(),
            nn.Linear(hidden, channels), nn.Sigmoid(),
        )
        self.spatial_conv = nn.Conv2d(2, 1, kernel_size=7, padding=3)
        self.temporal_fc = nn.Sequential(
            nn.Linear(channels, hidden), nn.GELU(),
            nn.Linear(hidden, 1),
        )

        self.gate_c = nn.Parameter(torch.tensor(0.0))
        self.gate_s = nn.Parameter(torch.tensor(0.0))
        self.gate_t = nn.Parameter(torch.tensor(0.0))
        self.drop = nn.Dropout(dropout)
        self.last_spatial_attn = None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, C, H, W)
        B, T, C, H, W = x.shape
        xf = x.reshape(B * T, C, H, W)

        # ---- 1. Channel attention ----
        channel_pooled = xf.mean(dim=(2, 3))                              # (B*T, C)
        channel_weight = self.channel_fc(channel_pooled).view(B * T, C, 1, 1)
        gate_c = torch.sigmoid(self.gate_c)
        xc = xf * (1.0 - gate_c) + xf * channel_weight * gate_c

        # ---- 2. Spatial attention ----
        avg_map = xc.mean(dim=1, keepdim=True)
        max_map, _ = xc.max(dim=1, keepdim=True)
        spatial_weight = torch.sigmoid(self.spatial_conv(torch.cat([avg_map, max_map], dim=1)))  # (B*T,1,H,W)
        gate_s = torch.sigmoid(self.gate_s)
        xs = xc * (1.0 - gate_s) + xc * spatial_weight * gate_s
        self.last_spatial_attn = spatial_weight.reshape(B, T, H, W).detach()

        # ---- 3. Temporal attention ----
        xs_t = xs.reshape(B, T, C, H, W)
        frame_descriptor = xs_t.mean(dim=(3, 4))                          # (B, T, C)
        temporal_scores = self.temporal_fc(frame_descriptor)              # (B, T, 1)
        temporal_weight = torch.softmax(temporal_scores, dim=1).unsqueeze(-1).unsqueeze(-1)  # (B, T, 1, 1, 1)
        gate_t = torch.sigmoid(self.gate_t)
        # scale by T so the average re-weighting factor stays ~1 (softmax sums to 1 over T)
        out = xs_t * (1.0 - gate_t) + xs_t * (temporal_weight * T) * gate_t

        return self.drop(out)


# =============================================================================
# Divided Space-Time Transformer Block
# =============================================================================
class DividedSpaceTimeBlock(nn.Module):
    """
    One block of factorized (divided) space-time self-attention, Pre-LN
    throughout. Operates on tokens of shape (B, S, T, d_model): S spatial
    tokens x T lookback timesteps.

        1. Temporal self-attention (per spatial token, across T)
        2. Spatial self-attention  (per timestep, across S)
        3. Pre-LN feed-forward
    """

    def __init__(self, d_model: int, nhead: int, dim_feedforward: int, dropout: float):
        super().__init__()
        self.temporal_norm = nn.LayerNorm(d_model)
        self.temporal_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.spatial_norm = nn.LayerNorm(d_model)
        self.spatial_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.ff_norm = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, dim_feedforward), nn.GELU(), nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
        )
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, S, T, D)
        B, S, T, D = x.shape

        # ---- Temporal self-attention (per spatial token), Pre-LN ----
        residual = x
        xt = self.temporal_norm(x).reshape(B * S, T, D)
        attn_out, _ = self.temporal_attn(xt, xt, xt, need_weights=False)
        x = residual + self.drop(attn_out.reshape(B, S, T, D))

        # ---- Spatial self-attention (per timestep), Pre-LN ----
        residual = x
        xs = self.spatial_norm(x).permute(0, 2, 1, 3).reshape(B * T, S, D)
        attn_out, _ = self.spatial_attn(xs, xs, xs, need_weights=False)
        attn_out = attn_out.reshape(B, T, S, D).permute(0, 2, 1, 3)
        x = residual + self.drop(attn_out)

        # ---- Pre-LN feed-forward ----
        residual = x
        x = residual + self.drop(self.ff(self.ff_norm(x)))
        return x


# =============================================================================
# Full Model: NileGuardSpatioTemporalTransformer
# =============================================================================
class NileGuardSpatioTemporalTransformer(nn.Module):
    """
    Pipeline: Climate Tensor -> Multi-Scale CNN -> Feature Fusion ->
    Spatio-Temporal Attention -> (pool to spatial token grid) -> Divided
    Space-Time Transformer Encoder -> Regression Head -> Next-Month PDSI Map.

    `lookback`, `height`, `width` are supplied at __init__ time so the
    positional encoding buffer, pooling target, and every sequence-length
    assertion are dynamically sized per governorate (each governorate has a
    different bounding-box crop and lookback window).

    Forward contract: (B, lookback, C, H, W) -> (B, H, W), a single
    next-month PDSI map, NORMALIZED (z-score) — denormalize with the
    governorate's stored target_mean / target_std before use.
    """

    def __init__(
        self,
        lookback: int,
        in_channels: int,
        height: int,
        width: int,
        d_model: int = 64,
        nhead: int = 4,
        num_spatiotemporal_layers: int = 2,
        dim_feedforward: int = 128,
        pool_out: tuple = (6, 4),
        dropout: float = 0.2,
        decoder_channels: int = 32,
        verbose: bool = False,
    ):
        super().__init__()
        self.lookback = lookback
        self.C, self.H, self.W = in_channels, height, width
        self.d_model = d_model
        self.verbose = verbose
        self._shapes_printed = False

        # Pooling target can't exceed the actual spatial size (small
        # governorates have tiny bounding boxes) — clamp.
        pool_h = min(pool_out[0], height)
        pool_w = min(pool_out[1], width)
        self.pool_out = (pool_h, pool_w)
        self.S = pool_h * pool_w

        # ---- Multi-Scale CNN + Feature Fusion: full spatial resolution is
        #      preserved throughout (no pooling here).
        self.spatial_encoder = nn.Sequential(
            MultiScaleConvBlock(in_channels, 32, dropout),
            MultiScaleConvBlock(32, d_model, dropout),
            FeatureFusionModule(d_model, dropout),
        )  # -> (B*T, d_model, H, W)

        # ---- Spatio-Temporal Attention ----
        self.st_attention = SpatioTemporalAttention(d_model, dropout=dropout)

        # ---- Pool to a small spatial TOKEN GRID for the Transformer ----
        self.pool = nn.AdaptiveAvgPool2d(output_size=self.pool_out)

        self.spatial_pos_embed = nn.Parameter(torch.randn(1, self.S, 1, d_model) * 0.02)
        self.temporal_pos_encoding = TemporalPositionalEncoding(d_model, max_len=lookback)
        self.input_dropout = nn.Dropout(dropout)

        self.st_blocks = nn.ModuleList([
            DividedSpaceTimeBlock(d_model, nhead, dim_feedforward, dropout)
            for _ in range(num_spatiotemporal_layers)
        ])
        self.final_norm = nn.LayerNorm(d_model)  # required by Pre-LN stacks

        # ---- Attention pooling over the lookback window, per spatial token
        self.temporal_attn_scorer = nn.Linear(d_model, 1)

        # ---- Lightweight regression head ----
        self.decoder_channels = decoder_channels
        self.decoder_proj = nn.Linear(d_model, decoder_channels)
        self.decoder_refine = nn.Sequential(
            nn.GELU(),
            nn.Conv2d(decoder_channels, decoder_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(decoder_channels),
            nn.GELU(),
            nn.Dropout2d(dropout),
            nn.Conv2d(decoder_channels, 1, kernel_size=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, lookback, C, H, W)
        expected = (self.lookback, self.C, self.H, self.W)
        assert x.shape[1:] == expected, (
            f"Input shape mismatch: got {tuple(x.shape)}, expected (Batch, {expected})"
        )
        B, T = x.shape[0], self.lookback

        if self.verbose and not self._shapes_printed:
            print(f"    [shape] input                 : {tuple(x.shape)}  (B, T, C, H, W)")

        xf = x.reshape(B * T, self.C, self.H, self.W)
        feats = self.spatial_encoder(xf)                         # (B*T, d_model, H, W)
        if self.verbose and not self._shapes_printed:
            print(f"    [shape] multi-scale CNN+fusion: {tuple(feats.shape)}  (B*T, d_model, H, W)")

        feats = feats.reshape(B, T, self.d_model, self.H, self.W)
        feats = self.st_attention(feats)                         # (B, T, d_model, H, W)
        if self.verbose and not self._shapes_printed:
            print(f"    [shape] spatio-temporal attn  : {tuple(feats.shape)}")

        feats = feats.reshape(B * T, self.d_model, self.H, self.W)
        feats = self.pool(feats)                                 # (B*T, d_model, ph, pw)
        ph, pw = self.pool_out
        feats = feats.reshape(B, T, self.d_model, ph * pw)       # (B, T, d_model, S)
        tokens = feats.permute(0, 3, 1, 2)                       # (B, S, T, d_model)
        if self.verbose and not self._shapes_printed:
            print(f"    [shape] spatial token grid    : {tuple(tokens.shape)}  (B, S, T, d_model)")

        tokens = tokens + self.spatial_pos_embed
        tokens = self.temporal_pos_encoding(tokens)
        tokens = self.input_dropout(tokens)

        for block in self.st_blocks:
            tokens = block(tokens)
        tokens = self.final_norm(tokens)                         # (B, S, T, d_model)
        if self.verbose and not self._shapes_printed:
            print(f"    [shape] after space-time attn : {tuple(tokens.shape)}")

        attn_scores = self.temporal_attn_scorer(tokens)           # (B, S, T, 1)
        attn_weights = torch.softmax(attn_scores, dim=2)
        pooled = (tokens * attn_weights).sum(dim=2)               # (B, S, d_model)
        if self.verbose and not self._shapes_printed:
            print(f"    [shape] temporal-pooled grid  : {tuple(pooled.shape)}  (B, S, d_model)")

        grid = self.decoder_proj(pooled)                          # (B, S, decoder_channels)
        grid = grid.permute(0, 2, 1).reshape(B, self.decoder_channels, ph, pw)
        grid = F.interpolate(grid, size=(self.H, self.W), mode="bilinear", align_corners=False)
        out = self.decoder_refine(grid).squeeze(1)                # (B, H, W)
        if self.verbose and not self._shapes_printed:
            print(f"    [shape] output prediction     : {tuple(out.shape)}")
            self._shapes_printed = True

        return out


# =============================================================================
# Helper: build a model instance directly from a saved checkpoint dict
# =============================================================================
def build_model_from_hyperparams(hyperparams: dict, verbose: bool = False) -> NileGuardSpatioTemporalTransformer:
    """
    Reconstructs a `NileGuardSpatioTemporalTransformer` from the hyperparameter
    dict stored inside a `.pth` checkpoint (see `nileguard_preprocessing.py`).
    Keeps model instantiation in one place so the API and any offline
    evaluation scripts can't drift out of sync with the architecture.
    """
    return NileGuardSpatioTemporalTransformer(
        lookback=hyperparams["lookback"],
        in_channels=hyperparams["in_channels"],
        height=hyperparams["height"],
        width=hyperparams["width"],
        d_model=hyperparams.get("d_model", 64),
        nhead=hyperparams.get("nhead", 4),
        num_spatiotemporal_layers=hyperparams.get("num_spatiotemporal_layers", 2),
        dim_feedforward=hyperparams.get("dim_feedforward", 128),
        pool_out=tuple(hyperparams.get("pool_out", (6, 4))),
        dropout=hyperparams.get("dropout", 0.2),
        decoder_channels=hyperparams.get("decoder_channels", 32),
        verbose=verbose,
    )
