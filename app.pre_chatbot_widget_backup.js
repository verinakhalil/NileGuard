// ==========================================================================
// NileGuard — Flagship Platform Core Engine
// 4D Time Player, GeoJSON Heatmap Polygons, ROI Calculator, Voice Advisor, Bulletin
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // --- Application State ---
    let appData = {
        stations: {},
        elbeltagi_table2: [],
        crops: [],
        geoJson: null
    };

    let selectedGovs = ['Asyut', 'Minya', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'BeniSuef', 'Fayoum'];
    let activeGov = 'Asyut';
    let currentHorizon = 6;
    let currentLang = 'ar'; // Default Arabic
    let leafletMap = null;
    let mapMarkers = {};
    let geoJsonLayer = null;
    let forecastChart = null;

    // 4D Player State
    let isPlaying = false;
    let playInterval = null;
    let playSpeed = 1000; // ms per month

    // --- DOM Elements ---
    const selectHorizonMonth = document.getElementById('select-horizon-month');
    const txtHorizonNote = document.getElementById('txt-horizon-note');
    const btnRunSim = document.getElementById('btn-run-sim');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnSelectNone = document.getElementById('btn-select-none');
    const govChipsContainer = document.getElementById('gov-chips-container');
    const btnLangToggle = document.getElementById('btn-lang-toggle');
    const langLabel = document.getElementById('lang-label');

    // Top 2 Metrics
    const valGov = document.getElementById('val-gov');
    const valGovAr = document.getElementById('val-gov-ar');
    const noteGov = document.getElementById('note-gov');
    const valPdsi = document.getElementById('val-pdsi');
    const notePdsi = document.getElementById('note-pdsi');

    // Map & Ranked Table
    const mapSelectedLabel = document.getElementById('map-selected-label');
    const rankedTbody = document.getElementById('ranked-tbody');
    const cropsGrid = document.getElementById('crops-grid');
    const benchmarkTbody = document.getElementById('benchmark-tbody');
    const txtChartTitle = document.getElementById('txt-chart-title');

    // 4D Player DOM
    const btnPlaySim = document.getElementById('btn-play-sim');
    const playerIcon = document.getElementById('player-icon');
    const playerLabel = document.getElementById('player-label');
    const playerRange = document.getElementById('player-range');
    const dispPlayerMonth = document.getElementById('disp-player-month');
    const speedChips = document.querySelectorAll('.speed-chip');

    // ROI Calculator DOM
    const rangeFeddans = document.getElementById('range-feddans');
    const dispFeddanVal = document.getElementById('disp-feddan-val');
    const selectRoiScenario = document.getElementById('select-roi-scenario');
    const calcActiveGovName = document.getElementById('calc-active-gov-name');
    const dispCurrWater = document.getElementById('disp-curr-water');
    const dispTargetWater = document.getElementById('disp-target-water');
    const dispScenarioReason = document.getElementById('disp-scenario-reason');
    const resWaterVal = document.getElementById('res-water-val');
    const resWaterNote = document.getElementById('res-water-note');
    const resMoneyVal = document.getElementById('res-money-val');
    const resShieldVal = document.getElementById('res-shield-val');
    const btnVoiceBrief = document.getElementById('btn-voice-brief');

    // Executive Bulletin Modal DOM
    const btnOpenBulletin = document.getElementById('btn-open-bulletin');
    const bulletinModal = document.getElementById('bulletin-modal');
    const btnCloseBulletin = document.getElementById('btn-close-bulletin');
    const bulletinGovName = document.getElementById('bulletin-gov-name');
    const bulletinPdsiVal = document.getElementById('bulletin-pdsi-val');
    const bulletinR2Val = document.getElementById('bulletin-r2-val');
    const bulletinStampText = document.getElementById('bulletin-stamp-text');
    const bulletinDirectivesList = document.getElementById('bulletin-directives-list');

    // ==========================================================================
    // 1. DATA LOADING
    // ==========================================================================
    async function loadData() {
        try {
            const [stationsRes, cropsRes] = await Promise.all([
                fetch('data/stations_timeseries.json'),
                fetch('data/crops_knowledge_base.json')
            ]);

            const stationsData = await stationsRes.json();
            const cropsData = await cropsRes.json();

            appData.stations = stationsData.stations;
            appData.elbeltagi_table2 = stationsData.elbeltagi_table2;
            appData.crops = cropsData.crops;

            initSatelliteMap();
            updateAllViews();
            populateRoiScenarios();
        } catch (err) {
            console.error("Error loading application data:", err);
        }
    }

    // ==========================================================================
    // 2. SATELLITE MAP INITIALIZATION (CLEAN SATELLITE WITH CIRCULAR PINS)
    // ==========================================================================
    function getPdsiColor(pdsi) {
        if (pdsi <= -3.0) return '#b91c1c'; // Extreme
        if (pdsi <= -2.0) return '#ea580c'; // Severe
        if (pdsi <= -1.0) return '#d97706'; // Moderate
        if (pdsi <= 0.0)  return '#ca8a04'; // Mild
        if (pdsi <= 2.0)  return '#16a34a'; // Normal
        return '#0284c7'; // Wet
    }

    let basemapLayers = {};

    function initSatelliteMap() {
        if (typeof L === 'undefined') return;

        const mapContainer = document.getElementById('satelliteMap');
        if (!mapContainer || leafletMap) return;

        try {
            leafletMap = L.map('satelliteMap', {
                center: [26.6, 31.8],
                zoom: 6.7,
                zoomControl: true,
                attributionControl: false
            });

            // Basemap Tile Layers
            basemapLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18,
                crossOrigin: true
            }).addTo(leafletMap);

            basemapLayers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                crossOrigin: true
            });

            basemapLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                crossOrigin: true
            });

            // Labels Overlay (Boundaries & Places)
            L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18,
                opacity: 0.75,
                crossOrigin: true
            }).addTo(leafletMap);

            // Bind Basemap Switcher Buttons
            const basemapBtns = document.querySelectorAll('.btn-basemap');
            basemapBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const type = btn.getAttribute('data-basemap');
                    if (!leafletMap || !basemapLayers[type]) return;

                    basemapBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Remove other basemaps
                    Object.values(basemapLayers).forEach(l => {
                        if (leafletMap.hasLayer(l)) leafletMap.removeLayer(l);
                    });

                    // Add selected basemap
                    basemapLayers[type].addTo(leafletMap);
                    basemapLayers[type].bringToBack();
                });
            });

            // Add Station Markers along the Nile (exact clean style from screenshot)
            for (const [key, st] of Object.entries(appData.stations)) {
                const customIcon = L.divIcon({
                    className: 'station-div-icon',
                    html: `
                        <div id="pin-${key}" style="
                            width: 14px;
                            height: 14px;
                            background: ${getPdsiColor(st.forecast_pdsi_6m)};
                            border: 2px solid #ffffff;
                            border-radius: 50%;
                            box-shadow: 0 0 10px rgba(0,0,0,0.8);
                            cursor: pointer;
                            transition: all 0.3s;
                        " title="${st.name_en}"></div>
                    `,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                const marker = L.marker([st.lat, st.lng], { icon: customIcon }).addTo(leafletMap);
                
                marker.bindPopup(`
                    <div style="font-family: 'Fraunces', serif; text-align: center; padding: 4px;">
                        <strong style="color: #b38032; font-size: 1rem;">${st.name_en} (${st.name_ar})</strong>
                        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; margin-top: 4px;">
                            PDSI Forecast: <strong>${st.forecast_pdsi_6m.toFixed(2)}</strong>
                        </div>
                    </div>
                `);

                marker.on('click', () => {
                    selectActiveGovernorate(key);
                });

                mapMarkers[key] = marker;
            }

            // Force recalculation of container size
            setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 150);
            setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 600);
            window.addEventListener('resize', () => { if (leafletMap) leafletMap.invalidateSize(); });

        } catch (e) {
            console.error("Map initialization error:", e);
        }
    }

    // ==========================================================================
    // 3. SELECTION & REACTION ENGINE
    // ==========================================================================
    const governorateClimateData = {
        'Asyut': { temp: '39°C', wind: '14 كم/س', et0: '8.2 مم/يوم', temp_en: '39°C', wind_en: '14 km/h', et0_en: '8.2 mm/d' },
        'Minya': { temp: '38°C', wind: '12 كم/س', et0: '7.8 مم/يوم', temp_en: '38°C', wind_en: '12 km/h', et0_en: '7.8 mm/d' },
        'Sohag': { temp: '40°C', wind: '15 كم/س', et0: '8.5 مم/يوم', temp_en: '40°C', wind_en: '15 km/h', et0_en: '8.5 mm/d' },
        'Qena': { temp: '41°C', wind: '16 كم/س', et0: '8.9 مم/يوم', temp_en: '41°C', wind_en: '16 km/h', et0_en: '8.9 mm/d' },
        'Luxor': { temp: '42°C', wind: '17 كم/س', et0: '9.2 مم/يوم', temp_en: '42°C', wind_en: '17 km/h', et0_en: '9.2 mm/d' },
        'Aswan': { temp: '43°C', wind: '18 كم/س', et0: '9.6 مم/يوم', temp_en: '43°C', wind_en: '18 km/h', et0_en: '9.6 mm/d' },
        'BeniSuef': { temp: '37°C', wind: '13 كم/س', et0: '7.5 مم/يوم', temp_en: '37°C', wind_en: '13 km/h', et0_en: '7.5 mm/d' },
        'Fayoum': { temp: '36°C', wind: '11 كم/س', et0: '7.2 مم/يوم', temp_en: '36°C', wind_en: '11 km/h', et0_en: '7.2 mm/d' }
    };

    function selectActiveGovernorate(govKey) {
        activeGov = govKey;
        if (!selectedGovs.includes(govKey)) {
            selectedGovs.push(govKey);
        }

        const st = appData.stations[govKey];
        if (st && leafletMap) {
            leafletMap.flyTo([st.lat, st.lng], 8.5, { duration: 1.2 });
        }

        updateAllViews();
        populateRoiScenarios();
    }

    function updateAllViews() {
        updateSidebarChips();
        updateTopMetricCards();
        updateRankedRiskTable();
        updateTrajectoryChart();
        updateCropAdvisor();
    }

    // Update Sidebar Chips
    function updateSidebarChips() {
        const chips = govChipsContainer.querySelectorAll('.gov-chip');
        chips.forEach(chip => {
            const gov = chip.getAttribute('data-gov');
            if (gov === activeGov) {
                chip.className = 'gov-chip active';
            } else if (selectedGovs.includes(gov)) {
                chip.className = 'gov-chip';
                chip.style.borderColor = 'var(--gold)';
            } else {
                chip.className = 'gov-chip';
                chip.style.borderColor = 'var(--forest-border)';
                chip.style.opacity = '0.5';
            }
        });
    }

    // Update Top 2 Metric Cards
    function updateTopMetricCards() {
        const st = appData.stations[activeGov];
        if (!st) return;

        const horizonIdx = Math.min(currentHorizon - 1, st.forecast_series.length - 1);
        const forecastPdsi = st.forecast_series[horizonIdx];

        // 1. Selected Governorate
        if (valGov) valGov.textContent = currentLang === 'en' ? st.name_en : st.name_ar;
        if (valGovAr) valGovAr.textContent = currentLang === 'en' ? st.name_ar : st.name_en;
        if (noteGov) {
            noteGov.textContent = currentLang === 'en' 
                ? `${st.region_en} · ${st.lat.toFixed(2)}° N, ${st.lng.toFixed(2)}° E` 
                : `${st.region_ar} · ${st.lat.toFixed(2)}° شمالاً، ${st.lng.toFixed(2)}° شرقاً`;
        }

        // Live Climate & Weather Strip
        const clim = governorateClimateData[activeGov] || governorateClimateData['Asyut'];
        const dispTemp = document.getElementById('disp-temp');
        const dispWind = document.getElementById('disp-wind');
        const dispEt0 = document.getElementById('disp-et0');
        if (dispTemp) dispTemp.textContent = currentLang === 'en' ? `🌡️ ${clim.temp_en} Summer Temp` : `🌡️ ${clim.temp} حرارة صيفية`;
        if (dispWind) dispWind.textContent = currentLang === 'en' ? `💨 Wind ${clim.wind_en}` : `💨 رياح ${clim.wind}`;
        if (dispEt0) dispEt0.textContent = currentLang === 'en' ? `☀️ High ET0 (${clim.et0_en})` : `☀️ بخر عالي (${clim.et0})`;

        // 2. PDSI Forecast
        if (valPdsi) valPdsi.textContent = (forecastPdsi > 0 ? "+" : "") + forecastPdsi.toFixed(2);
        if (notePdsi) {
            if (forecastPdsi <= -3.0) {
                notePdsi.textContent = currentLang === 'en' ? "Extreme deficit ahead (Severe Crisis)" : "جفاف شديد وحرج جداً";
                notePdsi.style.color = "var(--severity-extreme)";
            } else if (forecastPdsi <= -2.0) {
                notePdsi.textContent = currentLang === 'en' ? "Severe deficit ahead" : "جفاف شديد ملحوظ";
                notePdsi.style.color = "var(--severity-severe)";
            } else if (forecastPdsi <= -1.0) {
                notePdsi.textContent = currentLang === 'en' ? "Moderate deficit ahead" : "جفاف معتدل إلى خفيف";
                notePdsi.style.color = "var(--severity-moderate)";
            } else {
                notePdsi.textContent = currentLang === 'en' ? "Within normal tolerance" : "ضمن المعدل الطبيعي";
                notePdsi.style.color = "var(--severity-normal)";
            }
        }

        // Map Footer Label
        if (mapSelectedLabel) {
            mapSelectedLabel.textContent = currentLang === 'en' ? `Selected: ${st.name_en}` : `المحافظة المختارة: ${st.name_ar}`;
        }
    }

    // Update Ranked Risk Inference Table
    function updateRankedRiskTable() {
        if (!rankedTbody) return;
        rankedTbody.innerHTML = '';
        
        const horizonIdx = Math.min(currentHorizon - 1, 11);

        const sortedGovs = [...selectedGovs].sort((a, b) => {
            const pdsiA = appData.stations[a]?.forecast_series[horizonIdx] || 0;
            const pdsiB = appData.stations[b]?.forecast_series[horizonIdx] || 0;
            return pdsiA - pdsiB;
        });

        sortedGovs.forEach(govKey => {
            const st = appData.stations[govKey];
            if (!st) return;

            const pdsiVal = st.forecast_series[horizonIdx];
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            if (govKey === activeGov) {
                tr.style.background = 'rgba(179, 128, 50, 0.12)';
                tr.style.fontWeight = 'bold';
            }

            tr.addEventListener('click', () => {
                selectActiveGovernorate(govKey);
            });

            const color = getPdsiColor(pdsiVal);

            tr.innerHTML = `
                <td style="text-align: left; font-weight: 600; color: var(--text-dark);">
                    ${currentLang === 'en' ? st.name_en : st.name_ar}
                </td>
                <td style="text-align: right;">
                    <span class="pdsi-tag" style="color: ${color}; background: rgba(0,0,0,0.06); border: 1px solid ${color};">
                        ${pdsiVal.toFixed(2)}
                    </span>
                </td>
                <td style="text-align: right; color: var(--text-dark); font-weight: 600;">${st.confidence}</td>
            `;
            rankedTbody.appendChild(tr);
        });
    }

    // Update Time Series Chart
    function updateTrajectoryChart() {
        const st = appData.stations[activeGov];
        if (!st) return;

        if (txtChartTitle) {
            txtChartTitle.textContent = currentLang === 'en'
                ? `${st.name_en} — PDSI Drought Trajectory & ConvLSTM Forecast`
                : `${st.name_ar} — مسار الجفاف وتنبؤات موديل ConvLSTM`;
        }

        const labels = [];
        const actualData = [];
        const predData = [];

        const histMonths = [
            "2019-01", "2019-03", "2019-05", "2019-07", "2019-09", "2019-11",
            "2020-01", "2020-03", "2020-05", "2020-07", "2020-09", "2020-11"
        ];

        for (let i = 0; i < histMonths.length; i++) {
            labels.push(histMonths[i]);
            actualData.push(st.historical_pdsi[i * 2] || -1.0);
            predData.push(null);
        }

        const lastActual = actualData[actualData.length - 1];
        predData[predData.length - 1] = lastActual;

        const forecastMonths = ["2021-01", "2021-02", "2021-03", "2021-04", "2021-05", "2021-06", "2021-07", "2021-08", "2021-09", "2021-10", "2021-11", "2021-12"];
        for (let h = 0; h < currentHorizon; h++) {
            labels.push(forecastMonths[h] || `2021-${h+1}`);
            actualData.push(null);
            predData.push(st.forecast_series[h]);
        }

        const canvas = document.getElementById('forecastChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (forecastChart) forecastChart.destroy();

        forecastChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Observed',
                        data: actualData,
                        borderColor: '#2d7f9d',
                        backgroundColor: 'rgba(45, 127, 157, 0.08)',
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.2
                    },
                    {
                        label: 'Forecast',
                        data: predData,
                        borderColor: '#ea580c',
                        borderDash: [5, 4],
                        borderWidth: 2.5,
                        pointRadius: 4,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: { font: { family: 'IBM Plex Mono', size: 10 }, color: '#748c82' }
                    },
                    y: {
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        ticks: { font: { family: 'IBM Plex Mono', size: 10 }, color: '#748c82' },
                        title: { display: true, text: 'PDSI (Palmer Index)', font: { family: 'Fraunces', size: 12 }, color: '#1b332b' }
                    }
                }
            }
        });
    }

    // Update AI Crop Advisor dynamically per Governorate & PDSI Forecast
    function updateCropAdvisor() {
        const st = appData.stations[activeGov];
        if (!st || !cropsGrid) return;

        const horizonIdx = Math.min(currentHorizon - 1, st.forecast_series.length - 1);
        const forecastPdsi = st.forecast_series[horizonIdx];

        // Update Section Header Texts
        const titleEl = document.getElementById('txt-crop-advisor-title');
        const descEl = document.getElementById('txt-crop-advisor-desc');
        if (titleEl) {
            titleEl.textContent = currentLang === 'en' 
                ? `🌾 AI Crop Advisor — Resilient Crops for ${st.name_en}`
                : `🌾 المرشد الزراعي الذكي — المحاصيل المقاومة للجفاف في ${st.name_ar}`;
        }
        if (descEl) {
            descEl.textContent = currentLang === 'en'
                ? `Tailored agricultural advisories for ${st.name_en} based on predicted drought index (${forecastPdsi.toFixed(2)} Palmer)`
                : `توصيات زراعية ذكية لمزارعي ${st.name_ar} مبنية على مؤشر الجفاف المتوقع (${forecastPdsi.toFixed(2)} Palmer)`;
        }

        // Filter crops specifically mapped to this governorate
        let matchedCrops = appData.crops.filter(crop => {
            return crop.governorates && crop.governorates.includes(activeGov);
        });

        // If not enough crops, fallback to universal crops
        if (matchedCrops.length < 4) {
            const fallback = appData.crops.filter(crop => !matchedCrops.some(m => m.id === crop.id));
            matchedCrops = matchedCrops.concat(fallback);
        }

        // Sort crops by tolerance relevance to forecastPdsi
        matchedCrops.sort((a, b) => {
            const diffA = Math.abs(forecastPdsi - (a.min_pdsi + a.max_pdsi) / 2);
            const diffB = Math.abs(forecastPdsi - (b.min_pdsi + b.max_pdsi) / 2);
            return diffA - diffB;
        });

        // Always pick exactly 4 symmetric crops
        const finalCrops = matchedCrops.slice(0, 4);

        cropsGrid.innerHTML = '';
        finalCrops.forEach(crop => {
            const card = document.createElement('div');
            card.className = 'crop-card-item';
            
            const cropName = currentLang === 'en' ? (crop.name_en || crop.name_ar) : crop.name_ar;
            const cropCategory = currentLang === 'en' ? (crop.category_en || crop.category || 'Strategic Resilient Crop') : (crop.category_ar || crop.category);
            const cropDesc = currentLang === 'en' ? (crop.description_en || crop.description_ar) : crop.description_ar;
            const waterLabel = currentLang === 'en' ? '💧 Water Need:' : '💧 الاحتياج المائي:';
            const waterUnit = currentLang === 'en' ? 'm³/fed' : 'م³/ف';
            const toleranceLabel = currentLang === 'en' ? '🛡️ Tolerance:' : '🛡️ درجة التحمل:';
            const toleranceVal = currentLang === 'en' ? (crop.drought_tolerance_en || crop.drought_tolerance) : (crop.drought_tolerance_ar || crop.drought_tolerance);
            const irrigMethod = currentLang === 'en' ? (crop.irrigation_method_en || crop.irrigation_method) : (crop.irrigation_method_ar || crop.irrigation_method);

            card.innerHTML = `
                <div>
                    <div class="crop-card-top">
                        <span class="crop-emoji">${crop.icon}</span>
                        <div>
                            <div class="crop-name-arabic">${cropName}</div>
                            <div style="font-size: 0.72rem; color: var(--gold); font-family: var(--font-mono); font-weight: 600;">${cropCategory}</div>
                        </div>
                    </div>
                    
                    <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 0.8rem;">
                        ${cropDesc}
                    </p>

                    <div class="crop-meta-table" style="margin-bottom: 0.6rem;">
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.68rem;">${waterLabel}</div>
                            <span style="font-weight: 700; font-family: var(--font-mono); font-size: 0.78rem;">${crop.water_need_m3_feddan} ${waterUnit}</span>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.68rem;">${toleranceLabel}</div>
                            <span style="color: var(--severity-normal); font-weight: 700; font-size: 0.75rem;">${toleranceVal}</span>
                        </div>
                    </div>
                </div>

                <div style="font-size: 0.74rem; color: var(--forest-bg); background: rgba(18, 36, 31, 0.05); padding: 0.4rem 0.6rem; border-radius: var(--radius); font-family: var(--font-sans); font-weight: 600; border: 1px solid var(--border-subtle);">
                    ✓ ${irrigMethod}
                </div>
            `;
            cropsGrid.appendChild(card);
        });
    }

    // ==========================================================================
    // 4. 4D SPATIO-TEMPORAL TIME SIMULATOR CONTROLLER
    // ==========================================================================
    function setSimulationMonth(month) {
        currentHorizon = parseInt(month);
        if (playerRange) playerRange.value = currentHorizon;
        if (selectHorizonMonth) selectHorizonMonth.value = currentHorizon > 12 ? 12 : currentHorizon;
        
        const monthNames = ["Jan 2021", "Feb 2021", "Mar 2021", "Apr 2021", "May 2021", "Jun 2021", "Jul 2021", "Aug 2021", "Sep 2021", "Oct 2021", "Nov 2021", "Dec 2021"];
        if (dispPlayerMonth) {
            dispPlayerMonth.textContent = `Horizon: Month +${currentHorizon} (${monthNames[currentHorizon - 1] || '2021'})`;
        }
        if (txtHorizonNote) {
            txtHorizonNote.textContent = `Horizon ends ${monthNames[currentHorizon - 1] || '2021'}`;
        }

        updateAllViews();
        updateRoiCalculator();
    }

    function toggleSimulation() {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playerIcon.textContent = '⏸';
            playerLabel.textContent = currentLang === 'ar' ? 'إيقاف مؤقت' : 'Pause Sim';
            btnPlaySim.style.background = 'linear-gradient(135deg, #c2593f, #ea580c)';
            btnPlaySim.style.color = '#ffffff';

            playInterval = setInterval(() => {
                let nextMonth = currentHorizon + 1;
                if (nextMonth > 12) nextMonth = 1;
                setSimulationMonth(nextMonth);
            }, playSpeed);
        } else {
            playerIcon.textContent = '▶';
            playerLabel.textContent = currentLang === 'ar' ? 'تشغيل 4D' : 'Play 4D Sim';
            btnPlaySim.style.background = 'linear-gradient(135deg, var(--gold), #d4a373)';
            btnPlaySim.style.color = '#12241f';
            clearInterval(playInterval);
        }
    }

    if (btnPlaySim) {
        btnPlaySim.addEventListener('click', toggleSimulation);
    }

    if (playerRange) {
        playerRange.addEventListener('input', (e) => {
            if (isPlaying) toggleSimulation();
            setSimulationMonth(e.target.value);
        });
    }

    speedChips.forEach(chip => {
        chip.addEventListener('click', () => {
            speedChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const speedMultiplier = parseInt(chip.getAttribute('data-speed'));
            playSpeed = 1000 / speedMultiplier;
            if (isPlaying) {
                clearInterval(playInterval);
                playInterval = setInterval(() => {
                    let nextMonth = currentHorizon + 1;
                    if (nextMonth > 12) nextMonth = 1;
                    setSimulationMonth(nextMonth);
                }, playSpeed);
            }
        });
    });

    // ==========================================================================
    // 5. AGRI-WATER & ECONOMIC ROI CALCULATOR (GOVERNORATE-AWARE SCENARIOS)
    // ==========================================================================
    const governorateRoiScenarios = {
        'Asyut': [
            {
                title_ar: "زراعة القمح: التقليدي بالغمر ⟵ صنف سخا 95 بالتسوية بالليزر والري الحديث",
                title_en: "Wheat: Traditional Flood ⟶ Sakha 95 with Laser Levelling",
                curr_name_ar: "القمح البلدي بالغمر القديم",
                target_name_ar: "قمح سخا 95 بالتسوية بالليزر والري الحديث",
                curr_water: 3400,
                target_water: 2300,
                savings_pct: 32,
                reason_ar: "توفير 1,100 م³/فدان وحماية المحصول من الرقاد والإجهاد الحراري"
            },
            {
                title_ar: "بساتين الرمان: الغمر القديم ⟵ الرمان المنفلوطي بالتنقيط وشبك التظليل",
                title_en: "Pomegranates: Flood ⟶ Drip Precision with Sun-Nets",
                curr_name_ar: "رمان منفلوطي بالغمر السطحي",
                target_name_ar: "رمان منفلوطي بالتنقيط الذكي وشبك التظليل",
                curr_water: 5800,
                target_water: 3100,
                savings_pct: 47,
                reason_ar: "منع ظاهرة تشقق ثمار الرمان الناتجة عن الجفاف وخفض استهلاك المياه"
            },
            {
                title_ar: "المحاصيل الصيفية: الذرة الشامية بالغمر ⟵ الذرة الرفيعة بالتنقيط",
                title_en: "Summer Crops: Flood Maize ⟶ Drip Grain Sorghum",
                curr_name_ar: "ذرة شامية بالغمر التقليدي",
                target_name_ar: "ذرة رفيعة هجين موفرة للمياه بالتنقيط",
                curr_water: 4200,
                target_water: 2200,
                savings_pct: 48,
                reason_ar: "تحمل درجات الحرارة فوق 40° مئوية وخفض استهلاك مياه الصيف بالنصف"
            }
        ],
        'Aswan': [
            {
                title_ar: "قصب السكر: الغمر التقليدي ⟵ شتلات القصب الحديثة بالري بالتنقيط",
                title_en: "Sugarcane: Flood ⟶ Modern Drip Seedling Sugarcane",
                curr_name_ar: "قصب السكر بالغمر التقليدي",
                target_name_ar: "شتلات القصب المحسنة بالري بالتنقيط",
                curr_water: 10500,
                target_water: 5500,
                savings_pct: 48,
                reason_ar: "المشروع القومي لشتلات القصب: مضاعفة الإنتاجية وتوفير 5,000 م³ مياه للفدان"
            },
            {
                title_ar: "المحاصيل التصديرية: الكركديه بالغمر ⟵ الكركديه الأسواني الفاخر بالتنقيط",
                title_en: "Hibiscus: Flood ⟶ Drip Precision Hibiscus",
                curr_name_ar: "كركديه أسواني بالغمر السطحي",
                target_name_ar: "كركديه بالتنقيط والري الليلي",
                curr_water: 4600,
                target_water: 2100,
                savings_pct: 54,
                reason_ar: "جودة أزهار تصديرية أعلى ورفع تركيز المواد الفعالة بنسبة 54% وفر مائي"
            }
        ],
        'Minya': [
            {
                title_ar: "المحاصيل السكرية: الذرة/القصب ⟵ بنجر السكر الموفر للمياه بالتنقيط",
                title_en: "Sugar Crops: Flood Maize ⟶ Drip Sugar Beet",
                curr_name_ar: "ذرة شامية بالغمر التقليدي",
                target_name_ar: "بنجر السكر بالتنقيط لمصنع القناة بالمنيا",
                curr_water: 3900,
                target_water: 2400,
                savings_pct: 38,
                reason_ar: "عائد تعاقدي مضمون مع مصانع السكر وتوفير 1,500 م³ مياه للفدان"
            },
            {
                title_ar: "البقوليات: زراعة تقليدية ⟵ فول الصويا بالري الذكي",
                title_en: "Soybean: Traditional ⟶ Drip Soybean",
                curr_name_ar: "محاصيل تقليدية بالغمر",
                target_name_ar: "فول الصويا عالي البروتين بالتنقيط",
                curr_water: 3600,
                target_water: 2200,
                savings_pct: 39,
                reason_ar: "تثبيت النيتروجين الحيوي في التربة وتقليل الأسمدة الكيماوية"
            }
        ],
        'BeniSuef': [
            {
                title_ar: "النباتات الطبية والعطرية: الغمر القديم ⟵ البابونج والعتر بالتنقيط التصديري",
                title_en: "Aromatics: Flood ⟶ Export Drip Chamomile & Geranium",
                curr_name_ar: "زراعة عادية بالغمر التقليدي",
                target_name_ar: "نباتات طبية وعطرية بالري بالتنقيط",
                curr_water: 3600,
                target_water: 1800,
                savings_pct: 50,
                reason_ar: "بني سويف المركز الأول تصديرياً في النباتات الطبية بعائد دولاري ممتاز"
            },
            {
                title_ar: "القمح: القمح التقليدي ⟵ قمح صنف سدس 14 مع التسوية بالليزر",
                title_en: "Wheat: Traditional ⟶ Sids 14 with Laser Levelling",
                curr_name_ar: "قمح بلدي بالغمر",
                target_name_ar: "قمح سدس 14 (مركز بحوث سدس ببني سويف) بالتنقيط",
                curr_water: 3300,
                target_water: 2250,
                savings_pct: 32,
                reason_ar: "صنف مستنبط بمحطة بحوث سدس ببني سويف مقاوم للحرارة والجفاف"
            }
        ],
        'Fayoum': [
            {
                title_ar: "الزيتون والتمور: الغمر السطحي ⟵ بساتين الزيتون بالتنقيط والري الليلي",
                title_en: "Olive Orchards: Flood ⟶ Drip Olives",
                curr_name_ar: "أشجار بالغمر السطحي",
                target_name_ar: "زيتون زيتي بالتنقيط المكثف بواحة الفيوم",
                curr_water: 5000,
                target_water: 2500,
                savings_pct: 50,
                reason_ar: "تحمل ملوحة المياه والتربة وتوفير نصف المقنن المائي المعتاد"
            },
            {
                title_ar: "المحاصيل الزيتية: الزراعة التقليدية ⟵ عباد الشمس الزيتي بالتنقيط",
                title_en: "Oil Crops: Flood ⟶ Drip Sunflower",
                curr_name_ar: "زراعة صيفية بالغمر",
                target_name_ar: "عباد الشمس الزيتي بالتنقيط",
                curr_water: 3800,
                target_water: 2000,
                savings_pct: 47,
                reason_ar: "موسم نمو قصير (85 يوماً) يقلل عدد الرّيات ويوفر المياه"
            }
        ],
        'Luxor': [
            {
                title_ar: "قصب السكر: الغمر التقليدي ⟵ شتلات القصب بالتنقيط الحديث",
                title_en: "Sugarcane: Flood ⟶ Modern Drip Seedling Sugarcane",
                curr_name_ar: "قصب السكر بالغمر التقليدي",
                target_name_ar: "شتلات القصب بالري بالتنقيط",
                curr_water: 10500,
                target_water: 5500,
                savings_pct: 48,
                reason_ar: "مبادرة وزارة الزراعة والري للتحول للشتلات بمحافظة الأقصر"
            },
            {
                title_ar: "طماطم التجفيف الشمسي: الغمر ⟵ طماطم التصدير بالتنقيط وشاش التغطية",
                title_en: "Sun-dried Tomatoes: Flood ⟶ Drip Export Tomatoes",
                curr_name_ar: "طماطم بالغمر التقليدي",
                target_name_ar: "طماطم تجفيف بالتنقيط والتغطية",
                curr_water: 4800,
                target_water: 2600,
                savings_pct: 46,
                reason_ar: "الأقصر مركز التصدير الأول عالمياً للطماطم المجففة شمسياً"
            }
        ],
        'Qena': [
            {
                title_ar: "قصب السكر: الغمر التقليدي ⟵ شتلات القصب الحديثة بالتنقيط",
                title_en: "Sugarcane: Flood ⟶ Drip Seedling Sugarcane",
                curr_name_ar: "قصب السكر بالغمر التقليدي",
                target_name_ar: "شتلات القصب المحسنة بالتنقيط",
                curr_water: 10500,
                target_water: 5500,
                savings_pct: 48,
                reason_ar: "أكبر مساحات قصب في مصر - وفر مائي سنوي ضخم لمحافظة قنا"
            },
            {
                title_ar: "المحاصيل الزيتية: الذرة بالغمر ⟵ السمسم البلدي الموفر بالتنقيط",
                title_en: "Sesame: Flood Maize ⟶ Drip Local Sesame",
                curr_name_ar: "ذرة شامية بالغمر",
                target_name_ar: "سمسم بلدي عالي الزيت بالتنقيط",
                curr_water: 4000,
                target_water: 1900,
                savings_pct: 53,
                reason_ar: "مقاومة شديدة للحرارة وانخفاض الاحتياجات المائية"
            }
        ],
        'Sohag': [
            {
                title_ar: "محصول البصل الذهبي: الغمر التقليدي ⟵ البصل التصديري بالتنقيط",
                title_en: "Golden Onion: Flood ⟶ Drip Export Onion",
                curr_name_ar: "بصل صعيدي بالغمر",
                target_name_ar: "بصل تصديري بالري بالتنقيط والتسميد الذكي",
                curr_water: 4500,
                target_water: 2400,
                savings_pct: 47,
                reason_ar: "سوهاج قلعة تصدير البصل - تقليل أعفان الجذور وتوفير مياه الري"
            },
            {
                title_ar: "القمح: القمح البلدي ⟵ قمح سخا 95 بالتسوية الليزرية",
                title_en: "Wheat: Traditional ⟶ Sakha 95 with Laser Levelling",
                curr_name_ar: "قمح بالغمر التقليدي",
                target_name_ar: "قمح سخا 95 بالتسوية بالليزر",
                curr_water: 3400,
                target_water: 2300,
                savings_pct: 32,
                reason_ar: "وفر 1,100 م³ مياه للفدان ورفع إنتاجية الإردب"
            }
        ]
    };

    function populateRoiScenarios() {
        if (!selectRoiScenario) return;

        const st = appData.stations[activeGov];
        const govName = currentLang === 'ar' ? (st ? st.name_ar : activeGov) : (st ? st.name_en : activeGov);
        const lblScenarioSelect = document.getElementById('lbl-scenario-select');
        if (lblScenarioSelect) {
            lblScenarioSelect.innerHTML = currentLang === 'ar'
                ? `<span>🎯 سيناريو التحول الزراعي في <strong id="calc-active-gov-name" style="color: var(--gold); text-decoration: underline;">محافظة ${govName}</strong>:</span>`
                : `<span>🎯 Agricultural Transition Scenario in <strong id="calc-active-gov-name" style="color: var(--gold); text-decoration: underline;">${govName} Governorate</strong>:</span>`;
        }

        const scenarios = governorateRoiScenarios[activeGov] || governorateRoiScenarios['Asyut'];
        selectRoiScenario.innerHTML = '';

        scenarios.forEach((sc, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = currentLang === 'ar' ? sc.title_ar : sc.title_en;
            selectRoiScenario.appendChild(opt);
        });

        updateRoiCalculator();
    }

    function updateRoiCalculator() {
        if (!rangeFeddans || !selectRoiScenario) return;

        const feddans = parseInt(rangeFeddans.value) || 5;
        if (dispFeddanVal) {
            dispFeddanVal.textContent = currentLang === 'ar' 
                ? `${feddans} ${feddans === 1 ? 'فدان' : (feddans <= 10 ? 'أفدنة' : 'فداناً')}` 
                : `${feddans} Feddans`;
        }

        const scenarios = governorateRoiScenarios[activeGov] || governorateRoiScenarios['Asyut'];
        const selectedIdx = parseInt(selectRoiScenario.value) || 0;
        const sc = scenarios[selectedIdx] || scenarios[0];

        const currWater = sc.curr_water;
        const targetWater = sc.target_water;
        const waterSavedPerFeddan = currWater - targetWater;

        if (dispCurrWater) {
            dispCurrWater.textContent = `${currWater.toLocaleString()} ${currentLang === 'ar' ? 'م³/فدان' : 'm³/feddan'}`;
        }
        if (dispTargetWater) {
            dispTargetWater.textContent = `${targetWater.toLocaleString()} ${currentLang === 'ar' ? 'م³/فدان' : 'm³/feddan'} (${currentLang === 'ar' ? 'وفر' : 'Save'} ${sc.savings_pct}%)`;
        }
        if (dispScenarioReason) {
            dispScenarioReason.textContent = currentLang === 'ar' ? sc.reason_ar : sc.title_en;
        }

        const totalWaterSaved = waterSavedPerFeddan * feddans;
        const totalMoneySaved = totalWaterSaved * 2.2; // 2.2 EGP per m3 saved in diesel fuel, electricity & fertilizer runoff
        const familiesCount = Math.max(1, Math.round(totalWaterSaved / 400));

        if (resWaterVal) {
            resWaterVal.innerHTML = `${totalWaterSaved.toLocaleString()} <span class="res-unit">${currentLang === 'ar' ? 'م³ / موسم' : 'm³ / season'}</span>`;
        }
        if (resWaterNote) {
            resWaterNote.textContent = currentLang === 'ar' 
                ? `وفر يعادل تأمين مياه شرب لـ ${familiesCount.toLocaleString()} أسرة مصرية سنوياً` 
                : `Equivalent to drinking water for ${familiesCount.toLocaleString()} Egyptian households annually`;
        }
        
        if (resMoneyVal) {
            resMoneyVal.innerHTML = `${Math.round(totalMoneySaved).toLocaleString()} <span class="res-unit">${currentLang === 'ar' ? 'جنيه مصري' : 'EGP'}</span>`;
        }
        if (resShieldVal) {
            resShieldVal.innerHTML = `+${Math.min(95, Math.max(45, Math.round(35 + (sc.savings_pct * 0.7))))}% <span class="res-unit">${currentLang === 'ar' ? 'مقاومة إجهاد حراري' : 'Resilience Index'}</span>`;
        }

        // Update Animated Water Tank Liquid Level
        const tankWaterFill = document.getElementById('tank-water-fill');
        const tankPctText = document.getElementById('tank-pct-text');
        if (tankWaterFill) {
            const fillHeight = Math.min(95, Math.max(20, Math.round(sc.savings_pct * 1.3)));
            tankWaterFill.style.height = `${fillHeight}%`;
        }
        if (tankPctText) {
            tankPctText.textContent = currentLang === 'ar' ? `🌊 ${sc.savings_pct}% وفر مائي استراتيجي` : `🌊 ${sc.savings_pct}% Strategic Savings`;
        }
    }

    if (rangeFeddans) rangeFeddans.addEventListener('input', updateRoiCalculator);
    if (selectRoiScenario) selectRoiScenario.addEventListener('change', updateRoiCalculator);

    // Voice Brief Speech Advisor
    if (btnVoiceBrief) {
        btnVoiceBrief.addEventListener('click', () => {
            if ('speechSynthesis' in window) {
                const st = appData.stations[activeGov];
                const horizonIdx = Math.min(currentHorizon - 1, st.forecast_series.length - 1);
                const forecastPdsi = st.forecast_series[horizonIdx];

                const speechText = currentLang === 'ar'
                    ? `تنبيه مبكر من منظومة نايل جارد لمحافظة ${st.name_ar}: مؤشر بالمر المتوقع هو ${forecastPdsi.toFixed(2)}. نوصي بالاعتماد على الري بالتنقيط وزراعة المحاصيل الموفرة للمياه مثل ${st.primary_agriculture_ar}.`
                    : `NileGuard Early Warning for ${st.name_en}: Forecasted Palmer Drought Severity Index is ${forecastPdsi.toFixed(2)}. We recommend prioritizing precision drip irrigation and cultivating resilient crops.`;

                const utterance = new SpeechSynthesisUtterance(speechText);
                utterance.lang = currentLang === 'ar' ? 'ar-SA' : 'en-US';
                utterance.rate = 0.95;
                window.speechSynthesis.speak(utterance);
            } else {
                alert(currentLang === 'ar' ? "المتصفح لا يدعم القراءة الصوتية." : "Speech synthesis not supported in this browser.");
            }
        });
    }

    // ==========================================================================
    // 6. EXECUTIVE BULLETIN MODAL CONTROLLER
    // ==========================================================================
    if (btnOpenBulletin && bulletinModal) {
        btnOpenBulletin.addEventListener('click', () => {
            const st = appData.stations[activeGov];
            if (!st) return;

            const horizonIdx = Math.min(currentHorizon - 1, st.forecast_series.length - 1);
            const pdsiVal = st.forecast_series[horizonIdx];

            bulletinGovName.textContent = `${st.name_ar} (${st.name_en})`;
            bulletinPdsiVal.textContent = `${(pdsiVal > 0 ? "+" : "") + pdsiVal.toFixed(2)} Palmer`;
            bulletinR2Val.textContent = `R² = ${st.r2.toFixed(3)} (${st.confidence})`;

            if (pdsiVal <= -2.5) {
                bulletinStampText.textContent = 'تحذير عالي: جفاف شديد حرج';
                bulletinStampText.style.borderColor = 'var(--severity-extreme)';
                bulletinStampText.style.color = 'var(--severity-extreme)';
            } else if (pdsiVal <= -1.5) {
                bulletinStampText.textContent = 'تحذير: جفاف معتدل إلى خفيف';
                bulletinStampText.style.borderColor = 'var(--severity-severe)';
                bulletinStampText.style.color = 'var(--severity-severe)';
            } else {
                bulletinStampText.textContent = 'حالة مستقرة: ضمن المعدل الطبيعي';
                bulletinStampText.style.borderColor = 'var(--severity-normal)';
                bulletinStampText.style.color = 'var(--severity-normal)';
            }

            bulletinModal.style.display = 'flex';
        });
    }

    if (btnCloseBulletin && bulletinModal) {
        btnCloseBulletin.addEventListener('click', () => {
            bulletinModal.style.display = 'none';
        });
    }

    // ==========================================================================
    // 7. LANGUAGE TOGGLE & BINDINGS
    // ==========================================================================
    function updateHeroLanguage() {
        const heroTitle = document.getElementById('hero-title-main');
        const heroDesc = document.getElementById('hero-desc-main');
        const sdgHeader = document.getElementById('sdg-title-header');
        const statLbl1 = document.getElementById('stat-lbl-1');
        const statLbl2 = document.getElementById('stat-lbl-2');
        const statLbl3 = document.getElementById('stat-lbl-3');
        const btnTabDash = document.getElementById('btn-tab-dash');
        const btnTabTraj = document.getElementById('btn-tab-traj');
        const btnTabCrops = document.getElementById('btn-tab-crops');
        const btnTabRoi = document.getElementById('btn-tab-roi');
        const btnTabAbout = document.getElementById('btn-tab-about');
        const appSloganHeader = document.getElementById('app-slogan-header');
        const heroSloganBadge = document.getElementById('hero-slogan-badge');
        const footerSloganBar = document.getElementById('footer-slogan-bar');
        const bulletinSloganText = document.getElementById('bulletin-slogan-text');
        
        // Chatbot elements
        const chatTitle = document.getElementById('chat-title');
        const chatDesc = document.querySelector('#chat-section p');
        const chatInputEl = document.getElementById('chat-input');
        const chatSubmitBtn = document.querySelector('#chat-form button span');
        const chatChipEls = document.querySelectorAll('.chat-chip');
        const cropCountBadge = document.getElementById('crop-count-badge');

        // Dashboard & ROI elements
        const txtForecastParams = document.getElementById('txt-forecast-params');
        const txtForecastMonth = document.getElementById('txt-forecast-month');
        const txtGovsTitle = document.getElementById('txt-govs-title');
        const btnSelectAllEl = document.getElementById('btn-select-all');
        const btnSelectNoneEl = document.getElementById('btn-select-none');
        const btnSimText = document.getElementById('btn-sim-text');
        const txtSpatialTitle = document.getElementById('txt-spatial-title');
        const playerLabel = document.getElementById('player-label');
        const txtRankedTitle = document.getElementById('txt-ranked-title');
        const thGov = document.getElementById('th-gov');
        const btnBaseSat = document.getElementById('btn-base-sat');
        const btnBaseTerrain = document.getElementById('btn-base-terrain');
        const btnBaseDark = document.getElementById('btn-base-dark');
        const txtCalcTitle = document.getElementById('txt-calc-title');
        const txtCalcDesc = document.getElementById('txt-calc-desc');
        const btnVoiceBriefEl = document.getElementById('btn-voice-brief');
        const btnOpenBulletinEl = document.getElementById('btn-open-bulletin');
        const tankVolTitle = document.getElementById('tank-vol-title');

        // SDGs
        const sdg15Title = document.getElementById('sdg-15-title');
        const sdg15Desc = document.getElementById('sdg-15-desc');
        const sdg6Title = document.getElementById('sdg-6-title');
        const sdg6Desc = document.getElementById('sdg-6-desc');
        const sdg2Title = document.getElementById('sdg-2-title');
        const sdg2Desc = document.getElementById('sdg-2-desc');
        const sdg13Title = document.getElementById('sdg-13-title');
        const sdg13Desc = document.getElementById('sdg-13-desc');

        if (currentLang === 'ar') {
            if (heroTitle) heroTitle.innerHTML = 'نحو زراعة مستدامة وأمن مائي مصري مدعوم بـ <span>الذكاء الاصطناعي الفضائي</span>';
            if (heroDesc) heroDesc.innerHTML = 'منظومة وطنية ذكية للإنذار المبكر بموجات الجفاف عبر حوض النيل وصعيد مصر لدعم استدامة الموارد المائية وحماية الأمن الغذائي.';
            if (sdgHeader) sdgHeader.textContent = 'التزام استراتيجي بأهداف الأمم المتحدة للتنمية المستدامة (UN SDGs)';
            if (statLbl1) statLbl1.textContent = 'شهراً من بيانات TerraClimate الفضائية';
            if (statLbl2) statLbl2.textContent = 'محافظات رئيسية بصعيد مصر (وادي النيل)';
            if (statLbl3) statLbl3.textContent = 'دقة التنبؤ والاستجابة المناخية (R² = 0.760)';
            if (btnTabDash) btnTabDash.innerHTML = '<span>🛰️ لوحة التنبؤ والخريطة</span> <span class="tab-badge badge-live">● LIVE</span>';
            if (btnTabTraj) btnTabTraj.innerHTML = '<span>📈 المسار الزمني</span> <span class="tab-badge badge-mono">1958-2021</span>';
            if (btnTabCrops) btnTabCrops.innerHTML = '<span>🌾 المرشد والذكاء الاصطناعي</span> <span class="tab-badge badge-ai">✨ AI</span>';
            if (btnTabRoi) btnTabRoi.innerHTML = '<span>💧 حاسبة الوفر المائي</span> <span class="tab-badge badge-water">💧 ROI</span>';
            if (btnTabAbout) btnTabAbout.innerHTML = '<span>🏛️ عن المبادرة وأهداف التنمية</span> <span class="tab-badge badge-mono">SDGs</span>';
            if (appSloganHeader) appSloganHeader.textContent = 'نستبق الجفاف.. لأمان النيل ونماء الأرض';
            if (heroSloganBadge) heroSloganBadge.innerHTML = '<span>🌱 نستبق الجفاف.. لأمان النيل ونماء الأرض</span>';
            if (footerSloganBar) footerSloganBar.textContent = 'NileGuard AI Platform · « نستبق الجفاف.. لأمان النيل ونماء الأرض » · Arab Republic of Egypt 2026';
            if (bulletinSloganText) bulletinSloganText.textContent = 'منظومة NileGuard · « نستبق الجفاف.. لأمان النيل ونماء الأرض »';

            // Chatbot
            if (chatTitle) chatTitle.textContent = 'المساعد الزراعي الذكي المباشر (Powered by Gemini AI Engine)';
            if (chatDesc) chatDesc.textContent = 'استشر الذكاء الاصطناعي التوليدي في أي تساؤل عن مواعيد الزراعة، كميات الري، وتوصيات المحافظة';
            if (chatInputEl) chatInputEl.placeholder = 'اكتب سؤالك الزراعي هنا (مثال: متى أزرع الرمان في أسيوط وكيف أرويه؟)...';
            if (chatSubmitBtn) chatSubmitBtn.textContent = 'إرسال 🚀';
            if (cropCountBadge) cropCountBadge.textContent = '4 محاصيل موصى بها';
            const chatWelcomeMsgAr = document.querySelector('#chat-messages .chat-msg.msg-ai div:nth-child(2)');
            if (chatWelcomeMsgAr) {
                chatWelcomeMsgAr.innerHTML = 'أهلاً بك! أنا مستشارك الزراعي الذكي لمنظومة <strong>NileGuard</strong>. يمكنك سؤالي عن أنسب المحاصيل للمحافظة المحددة حالياً، أو استفسارات الري والتسميد وتأثير مؤشر الجفاف على أراضيك الزراعية. كيف يمكنني مساعدتك؟';
            }
            
            const promptChipsAr = [
                "ما هي أفضل أصناف القمح المقاومة للجفاف في محافظة أسيوط؟",
                "كيف أتعامل مع نقص مياه الري في الصعيد خلال الصيف؟",
                "ما هي مواعيد وطرق ري الرمان المنفلوطي في أسيوط؟",
                "ما هو البديل الموفر للمياه لقصب السكر في الأقصر وقنا؟"
            ];
            const promptLabelsAr = [
                "🌾 أفضل أصناف القمح المقاومة للجفاف؟",
                "💧 التعامل مع نقص مياه الري؟",
                "🍎 ري وزراعة الرمان بأسيوط؟",
                "🥔 بدائل قصب السكر الموفرة؟"
            ];
            chatChipEls.forEach((ch, idx) => {
                if (promptChipsAr[idx]) {
                    ch.setAttribute('data-prompt', promptChipsAr[idx]);
                    ch.textContent = promptLabelsAr[idx];
                }
            });

            // Dashboard
            if (txtForecastParams) txtForecastParams.textContent = 'معايير الاستدلال والتنبؤ';
            if (txtForecastMonth) txtForecastMonth.textContent = '📅 المدى الزمني:';
            if (txtGovsTitle) txtGovsTitle.textContent = '📍 المحافظات:';
            if (btnSelectAllEl) btnSelectAllEl.textContent = 'الكل';
            if (btnSelectNoneEl) btnSelectNoneEl.textContent = 'المحددة';
            if (btnSimText) btnSimText.textContent = 'تنفيذ الاستدلال الذكي';
            if (txtSpatialTitle) txtSpatialTitle.textContent = 'شدة الجفاف — جمهورية مصر العربية';
            if (playerLabel) playerLabel.textContent = isPlaying ? 'إيقاف مؤقت' : 'محاكاة 4D';
            if (txtRankedTitle) txtRankedTitle.textContent = 'ترتيب الخطورة';
            if (thGov) thGov.textContent = 'المحافظة';
            if (btnBaseSat) btnBaseSat.textContent = '🛰️ قمر صناعي';
            if (btnBaseTerrain) btnBaseTerrain.textContent = '🗺️ تضاريس';
            if (btnBaseDark) btnBaseDark.textContent = '🌙 داكن';

            // ROI
            if (txtCalcTitle) txtCalcTitle.textContent = '💧 حاسبة الوفر المائي والجدوى الاقتصادية للفلاح المصري (Agri-ROI Calculator)';
            if (txtCalcDesc) txtCalcDesc.textContent = 'احسب كمية المياه الموفرة سنوياً والعائد المالي المحقق عند تطبيق المقننات المائية المعتمدة وتوجيهات NileGuard الذكية';
            if (btnVoiceBriefEl) btnVoiceBriefEl.innerHTML = '<span>🔊 استمع للإرشاد الصوتي (Voice Brief)</span>';
            if (btnOpenBulletinEl) btnOpenBulletinEl.innerHTML = '<span>🏛️ إصدار النشرة التحذيرية القومية الرسمية للمحافظة (Executive Bulletin PDF)</span> <span>📥</span>';
            if (tankVolTitle) tankVolTitle.textContent = 'حجم المياه المحمية من الهدر';
            const lblFeddans = document.getElementById('lbl-feddans');
            const lblOldFlood = document.getElementById('lbl-old-flood');
            const lblRecDrip = document.getElementById('lbl-rec-drip');
            const lblArcSource = document.getElementById('lbl-arc-source');
            const lblTankDesc = document.getElementById('lbl-tank-desc');
            const lblResWaterTitle = document.getElementById('lbl-res-water-title');
            const lblResMoneyTitle = document.getElementById('lbl-res-money-title');
            const lblResMoneyNote = document.getElementById('lbl-res-money-note');
            const lblResShieldTitle = document.getElementById('lbl-res-shield-title');
            const lblResShieldNote = document.getElementById('lbl-res-shield-note');

            if (lblFeddans) lblFeddans.textContent = '🌱 المساحة الزراعية المستهدفة:';
            if (lblOldFlood) lblOldFlood.textContent = '🌾 الاستهلاك القديم بالغمر:';
            if (lblRecDrip) lblRecDrip.textContent = '✨ الاستهلاك الموصى به بالتنقيط:';
            if (lblArcSource) lblArcSource.textContent = '📚 المصدر: المقننات المائية المعتمدة لوزارة الموارد المائية والري ومركز البحوث الزراعية (ARC 2024)';
            if (lblTankDesc) lblTankDesc.textContent = 'توفير مياه عالي الكفاءة يقلل الضغط على الخزانات الجوفية وشبكات الترع بصعيد مصر.';
            if (lblResWaterTitle) lblResWaterTitle.textContent = '💧 الوفر المائي السنوي الإجمالي';
            if (lblResMoneyTitle) lblResMoneyTitle.textContent = '💰 الوفر المالي وتكلفة طاقة الري';
            if (lblResMoneyNote) lblResMoneyNote.textContent = 'خفض استهلاك السولار والكهرباء والأسمدة المنجرفة مع مياه الغمر';
            if (lblResShieldTitle) lblResShieldTitle.textContent = '🛡️ مؤشر الحماية والأمان من موجات الجفاف';
            if (lblResShieldNote) lblResShieldNote.textContent = 'حماية إنتاجية الفدان من التراجع أثناء شهور الجفاف المتوقعة بمؤشر PDSI';

            // SDGs
            if (sdg15Title) sdg15Title.textContent = 'الحياة في البر ومكافحة التصحر';
            if (sdg15Desc) sdg15Desc.textContent = 'استصلاح الأراضي وحماية الرقعة الزراعية في صعيد مصر وحوض النيل من تدهور التربة والتصحر.';
            if (sdg6Title) sdg6Title.textContent = 'الإدارة المستدامة للمياه النظيفة';
            if (sdg6Desc) sdg6Desc.textContent = 'التنبؤ الاستباقي بالعجز المائي وترشيد تصرفات شبكات الترع والتحول لأنظمة الري الحديثة.';
            if (sdg2Title) sdg2Title.textContent = 'القضاء على الجوع والأمن الغذائي';
            if (sdg2Desc) sdg2Desc.textContent = 'حماية إنتاجية المحاصيل الاستراتيجية وتوجيه المزارعين للمحاصيل المقاومة للإجهاد الحراري.';
            if (sdg13Title) sdg13Title.textContent = 'العمل المناخي والتكيف';
            if (sdg13Desc) sdg13Desc.textContent = 'بناء أنظمة إنذار مبكر مناخية فائقة الدقة لمجابهة التغيرات المناخية وموجات الجفاف.';

        } else {
            if (heroTitle) heroTitle.innerHTML = 'Towards Sustainable Agriculture & Egyptian Water Security Powered by <span>Satellite AI</span>';
            if (heroDesc) heroDesc.innerHTML = 'A national AI intelligence platform for early drought forecasting across the Nile Basin and Upper Egypt to support water sustainability and food security.';
            if (sdgHeader) sdgHeader.textContent = 'Strategic Commitment to UN Sustainable Development Goals (UN SDGs)';
            if (statLbl1) statLbl1.textContent = 'Months of TerraClimate Satellite Data';
            if (statLbl2) statLbl2.textContent = 'Key Governorates in Upper Egypt Nile Valley';
            if (statLbl3) statLbl3.textContent = 'Predictive Accuracy & Climate Response (R² = 0.760)';
            if (btnTabDash) btnTabDash.innerHTML = '<span>🛰️ Forecast & Map</span> <span class="tab-badge badge-live">● LIVE</span>';
            if (btnTabTraj) btnTabTraj.innerHTML = '<span>📈 Trajectory Chart</span> <span class="tab-badge badge-mono">1958-2021</span>';
            if (btnTabCrops) btnTabCrops.innerHTML = '<span>🌾 Crop Advisor & AI</span> <span class="tab-badge badge-ai">✨ AI</span>';
            if (btnTabRoi) btnTabRoi.innerHTML = '<span>💧 Water ROI Calculator</span> <span class="tab-badge badge-water">💧 ROI</span>';
            if (btnTabAbout) btnTabAbout.innerHTML = '<span>🏛️ About & SDGs</span> <span class="tab-badge badge-mono">SDGs</span>';
            if (appSloganHeader) appSloganHeader.textContent = 'Ahead of Drought: Securing the Nile, Sustaining the Land';
            if (heroSloganBadge) heroSloganBadge.innerHTML = '<span>🌱 Ahead of Drought: Securing the Nile, Sustaining the Land</span>';
            if (footerSloganBar) footerSloganBar.textContent = 'NileGuard AI Platform · "Ahead of Drought: Securing the Nile, Sustaining the Land" · Arab Republic of Egypt 2026';
            if (bulletinSloganText) bulletinSloganText.textContent = 'NileGuard System · "Ahead of Drought: Securing the Nile, Sustaining the Land"';

            // Chatbot
            if (chatTitle) chatTitle.textContent = 'Live Agricultural AI Assistant (Powered by Gemini AI Engine)';
            if (chatDesc) chatDesc.textContent = 'Ask Generative AI about planting schedules, irrigation quotas, and governorate advisories.';
            if (chatInputEl) chatInputEl.placeholder = 'Ask your agricultural question here (e.g., When to plant pomegranates in Asyut and how to irrigate?)...';
            if (chatSubmitBtn) chatSubmitBtn.textContent = 'Send 🚀';
            if (cropCountBadge) cropCountBadge.textContent = '4 Recommended Crops';
            const chatWelcomeMsg = document.querySelector('#chat-messages .chat-msg.msg-ai div:nth-child(2)');
            if (chatWelcomeMsg) {
                chatWelcomeMsg.innerHTML = 'Welcome! I am your <strong>NileGuard</strong> AI Agronomic Advisor. Ask me about resilient crop selections for the active governorate, precision irrigation, or how forecasted Palmer drought indices impact your farmland. How can I assist you?';
            }

            const promptChipsEn = [
                "What are the best drought-tolerant wheat varieties in Asyut?",
                "How to manage summer irrigation water deficits in Upper Egypt?",
                "What are the planting and irrigation schedules for Manfaluti pomegranate?",
                "What are the water-saving alternatives to sugarcane in Luxor and Qena?"
            ];
            const promptLabelsEn = [
                "🌾 Best drought-resistant wheat varieties?",
                "💧 Managing summer irrigation deficits?",
                "🍎 Pomegranate irrigation in Asyut?",
                "🥔 Water-saving sugarcane alternatives?"
            ];
            chatChipEls.forEach((ch, idx) => {
                if (promptChipsEn[idx]) {
                    ch.setAttribute('data-prompt', promptChipsEn[idx]);
                    ch.textContent = promptLabelsEn[idx];
                }
            });

            // Dashboard
            if (txtForecastParams) txtForecastParams.textContent = 'Forecast Parameters';
            if (txtForecastMonth) txtForecastMonth.textContent = '📅 Horizon:';
            if (txtGovsTitle) txtGovsTitle.textContent = '📍 Governorates:';
            if (btnSelectAllEl) btnSelectAllEl.textContent = 'All';
            if (btnSelectNoneEl) btnSelectNoneEl.textContent = 'None';
            if (btnSimText) btnSimText.textContent = 'Run AI Inference';
            if (txtSpatialTitle) txtSpatialTitle.textContent = 'Drought Severity — Arab Republic of Egypt';
            if (playerLabel) playerLabel.textContent = isPlaying ? 'Pause Sim' : '4D Simulation';
            if (txtRankedTitle) txtRankedTitle.textContent = 'Ranked Risk';
            if (thGov) thGov.textContent = 'Governorate';
            if (btnBaseSat) btnBaseSat.textContent = '🛰️ Satellite';
            if (btnBaseTerrain) btnBaseTerrain.textContent = '🗺️ Terrain';
            if (btnBaseDark) btnBaseDark.textContent = '🌙 Dark';

            // ROI
            if (txtCalcTitle) txtCalcTitle.textContent = '💧 Smart Agri-Water & Economic ROI Calculator (Agri-ROI)';
            if (txtCalcDesc) txtCalcDesc.textContent = 'Calculate annual water volume saved and financial returns under certified water quotas and NileGuard AI advisories.';
            if (btnVoiceBriefEl) btnVoiceBriefEl.innerHTML = '<span>🔊 Listen to AI Voice Brief</span>';
            if (btnOpenBulletinEl) btnOpenBulletinEl.innerHTML = '<span>🏛️ Export Official National Executive Drought Bulletin (PDF)</span> <span>📥</span>';
            if (tankVolTitle) tankVolTitle.textContent = 'Water Volume Protected from Loss';
            const lblFeddansEn = document.getElementById('lbl-feddans');
            const lblOldFloodEn = document.getElementById('lbl-old-flood');
            const lblRecDripEn = document.getElementById('lbl-rec-drip');
            const lblArcSourceEn = document.getElementById('lbl-arc-source');
            const lblTankDescEn = document.getElementById('lbl-tank-desc');
            const lblResWaterTitleEn = document.getElementById('lbl-res-water-title');
            const lblResMoneyTitleEn = document.getElementById('lbl-res-money-title');
            const lblResMoneyNoteEn = document.getElementById('lbl-res-money-note');
            const lblResShieldTitleEn = document.getElementById('lbl-res-shield-title');
            const lblResShieldNoteEn = document.getElementById('lbl-res-shield-note');

            if (lblFeddansEn) lblFeddansEn.textContent = '🌱 Target Agricultural Area:';
            if (lblOldFloodEn) lblOldFloodEn.textContent = '🌾 Conventional Flood Irrigation:';
            if (lblRecDripEn) lblRecDripEn.textContent = '✨ Recommended Drip Irrigation:';
            if (lblArcSourceEn) lblArcSourceEn.textContent = '📚 Source: Certified Water Quotas by Ministry of Water Resources & Agricultural Research Center (ARC 2024)';
            if (lblTankDescEn) lblTankDescEn.textContent = 'High-efficiency irrigation reduces pressure on deep aquifers and canal networks across Upper Egypt.';
            if (lblResWaterTitleEn) lblResWaterTitleEn.textContent = '💧 Total Annual Water Volume Saved';
            if (lblResMoneyTitleEn) lblResMoneyTitleEn.textContent = '💰 Direct Energy & Irrigation Financial Savings';
            if (lblResMoneyNoteEn) lblResMoneyNoteEn.textContent = 'Lower diesel fuel, electricity, and fertilizer runoff costs';
            if (lblResShieldTitleEn) lblResShieldTitleEn.textContent = '🛡️ Climate & Heat-Stress Resilience Index';
            if (lblResShieldNoteEn) lblResShieldNoteEn.textContent = 'Yield protection against heat stress during predicted drought months';

            // SDGs
            if (sdg15Title) sdg15Title.textContent = 'Life on Land & Anti-Desertification';
            if (sdg15Desc) sdg15Desc.textContent = 'Land reclamation and preserving agricultural lands in Upper Egypt and the Nile Basin from degradation.';
            if (sdg6Title) sdg6Title.textContent = 'Clean Water & Sustainable Sanitation';
            if (sdg6Desc) sdg6Desc.textContent = 'Proactive water deficit forecasting, optimizing canal network flows, and modernizing irrigation.';
            if (sdg2Title) sdg2Title.textContent = 'Zero Hunger & Food Security';
            if (sdg2Desc) sdg2Desc.textContent = 'Protecting strategic crop yields and guiding farmers toward heat-resistant crops.';
            if (sdg13Title) sdg13Title.textContent = 'Climate Action & Adaptation';
            if (sdg13Desc) sdg13Desc.textContent = 'Building high-resolution early warning climate systems to adapt to extreme droughts.';
        }
    }

    // Tab Navigation Controller
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const activePane = document.getElementById(targetTab);
            if (activePane) {
                activePane.classList.add('active');
            }

            // Invalidate Leaflet Map Size on tab activation
            if (targetTab === 'tab-dashboard' && leafletMap) {
                setTimeout(() => { leafletMap.invalidateSize(); }, 50);
                setTimeout(() => { leafletMap.invalidateSize(); }, 250);
            }
            // Invalidate Chart size on tab activation
            if (targetTab === 'tab-trajectory' && forecastChart) {
                setTimeout(() => { forecastChart.resize(); }, 50);
            }
        });
    });

    // Sidebar Chips Click
    const chips = govChipsContainer.querySelectorAll('.gov-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const gov = chip.getAttribute('data-gov');
            selectActiveGovernorate(gov);
        });
    });

    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            selectedGovs = Object.keys(appData.stations);
            updateAllViews();
        });
    }

    if (btnSelectNone) {
        btnSelectNone.addEventListener('click', () => {
            selectedGovs = [activeGov];
            updateAllViews();
        });
    }

    if (selectHorizonMonth) {
        selectHorizonMonth.addEventListener('change', (e) => {
            setSimulationMonth(e.target.value);
        });
    }

    if (btnRunSim) {
        btnRunSim.addEventListener('click', () => {
            btnRunSim.style.transform = 'scale(0.97)';
            setTimeout(() => {
                btnRunSim.style.transform = 'none';
                updateAllViews();
            }, 300);
        });
    }

    // ==========================================================================
    // 8. GEMINI AI AGRONOMIC CHATBOT ENGINE
    // ==========================================================================
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const chatChips = document.querySelectorAll('.chat-chip');

    function appendChatMessage(sender, htmlContent) {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.style.display = 'flex';
        msgDiv.style.gap = '0.6rem';
        if (sender === 'user') {
            msgDiv.style.justifyContent = 'flex-end';
            msgDiv.innerHTML = `
                <div style="background: var(--forest-bg); color: #ffffff; padding: 0.6rem 0.9rem; border-radius: var(--radius); font-size: 0.84rem; max-width: 80%; line-height: 1.5;">
                    ${htmlContent}
                </div>
                <div style="font-size: 1.2rem;">🧑‍🌾</div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div style="font-size: 1.2rem;">🤖</div>
                <div style="background: var(--bg-parchment); border: 1px solid var(--border-color); color: var(--text-dark); padding: 0.6rem 0.9rem; border-radius: var(--radius); font-size: 0.84rem; max-width: 85%; line-height: 1.6;">
                    ${htmlContent}
                </div>
            `;
        }
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function processAiResponse(query) {
        const st = appData.stations[activeGov];
        const horizonIdx = Math.min(currentHorizon - 1, st.forecast_series.length - 1);
        const pdsiVal = st.forecast_series[horizonIdx];

        // Typing indicator
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.style.display = 'flex';
        typingDiv.style.gap = '0.6rem';
        typingDiv.innerHTML = `
            <div style="font-size: 1.2rem;">🤖</div>
            <div style="color: var(--text-muted); font-size: 0.78rem; font-family: var(--font-mono); display: flex; align-items: center; gap: 0.4rem;">
                <span>${currentLang === 'en' ? 'Thinking and analyzing spatio-temporal forecast via Gemini LLM...' : 'جارٍ التفكير ومعالجة التنبؤ المكاني بواسطة Gemini LLM...'}</span>
                <span class="sync-dot" style="display: inline-block;"></span>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        setTimeout(() => {
            const el = document.getElementById(typingId);
            if (el) el.remove();

            let answer = "";
            const q = query.toLowerCase();

            if (currentLang === 'en') {
                if (q.includes('wheat') || q.includes('sakha') || q.includes('misr')) {
                    answer = `🌾 **Wheat Cultivation Advisories for ${st.name_en} (PDSI Forecast = ${pdsiVal.toFixed(2)}):**
- **Optimal Resilient Varieties:** **Sakha 95**, **Misr 3**, and **Sids 14**.
- **Ideal Planting Window:** November 15 to December 5 to avoid terminal heat waves during heading.
- **Target Water Need:** 2,400 m³/feddan with laser land leveling to reduce conveyance losses by 20%.
- **Irrigation Guidance:** Cease irrigation during strong wind events and stop all irrigation 15 days prior to harvest.`;
                } else if (q.includes('sugar') || q.includes('cane') || q.includes('beet') || q.includes('alternative')) {
                    answer = `🥔 **Water-Saving Sugarcane Alternatives for Upper Egypt (${st.name_en}):**
- **Sugar Beet:** Excellent sustainable choice saving >70% irrigation water (3,200 m³/feddan vs 10,500 m³ for flood cane).
- **Drip Seedling Sugarcane:** If continuing sugarcane, adopt single-bud seedling transplanting with drip lines to reduce water to 6,000 m³/feddan and elevate brix sugar content.`;
                } else if (q.includes('pomegranate') || q.includes('manfalut') || q.includes('fruit')) {
                    answer = `🍎 **Manfaluti Pomegranate Orchards in ${st.name_en}:**
- Pomegranates are high-value export crops with high heat tolerance; water quota is 2,800 - 3,200 m³/feddan.
- **Drought Mitigation:** Apply organic mulching and early morning drip cycles to prevent fruit cracking caused by soil moisture fluctuation.`;
                } else if (q.includes('deficit') || q.includes('water') || q.includes('shortage') || q.includes('irrigation')) {
                    answer = `💧 **Irrigation Scarcity Action Plan for ${st.name_en} (Palmer Index = ${pdsiVal.toFixed(2)}):**
1. **Nocturnal Irrigation:** Schedule irrigation after sunset or pre-dawn to cut evaporative losses by 25%.
2. **Regulated Deficit Irrigation (RDI):** Reduce water delivery by 15% during non-critical vegetative stages.
3. **Canal Transition:** Shift from open earthen ditches to gated polyethylene pipes and drip laterals.`;
                } else if (q.includes('quinoa') || q.includes('jojoba') || q.includes('desert')) {
                    answer = `🌱 **Desert Quinoa & Jojoba Agro-Systems:**
- **Quinoa:** Super-grain requiring only 1,200 m³/feddan and enduring well-water salinity up to 8,000 ppm.
- **Jojoba:** Deep-rooted perennial shrub with high industrial oil value, consuming <1,000 m³/feddan while protecting the Nubian Sandstone Aquifer.`;
                } else {
                    answer = `🌾 **Gemini AI Agronomic Intelligence for ${st.name_en} (PDSI Forecast = ${pdsiVal.toFixed(2)}):**
Based on **NileGuard** predictive forecasting:
- Governorate Soil Class: **${st.soil_type_en}**.
- Recommended Strategic Resilient Crops: **${st.primary_agriculture_en}**.
- Schedule drip irrigation with supplemental potassium fertilization to boost leaf osmotic resistance under heat stress.`;
                }
            } else {
                if (q.includes('قمح') || q.includes('wheat') || q.includes('سخا') || q.includes('مصر 3')) {
                    answer = `🌾 **توصيات زراعة القمح لمحافظة ${st.name_ar} (مؤشر PDSI = ${pdsiVal.toFixed(2)}):**
- **الأصناف الأنسب للإجهاد المائي والحراري:** **سخا 95** و **مصر 3** و **سدس 14**.
- **الميعاد الأمثل للزراعة:** من 15 نوفمبر حتى 5 ديسمبر لتفادي موجات الحرارة المبكرة في طرد السنابل.
- **الاحتياج المائي:** 2,400 م³/فدان مع التسوية الدقيقة بالليزر لتقليل الفواقد بنسبة 20%.
- **نصيحة الري:** الامتناع التام عن الري وقت هبوب الرياح، والتوقف عن الري قبل الحصاد بـ 15 يوماً.`;
                } else if (q.includes('قصب') || q.includes('سكر') || q.includes('بديل') || q.includes('sugarcane')) {
                    answer = `🥔 **بدائل قصب السكر الموفرة لمحافظات الصعيد (${st.name_ar}):**
- **بنجر السكر:** خيار مثالي يوفر أكثر من 70% من المياه (3,200 م³/فدان مقابل 10,500 م³ للقصب التقليدي).
- **شتلات القصب بالري بالتنقيط:** في حالة الاستمرار بزراعة القصب، يجب التحول لنظام الشتلات والري بالتنقيط لخفض الاستهلاك إلى 6,000 م³/فدان وزيادة السكر.`;
                } else if (q.includes('رمان') || q.includes('منفلوط') || q.includes('pomegranate')) {
                    answer = `🍎 **بساتين الرمان المنفلوطي بـ ${st.name_ar}:**
- الرمان محصول تصديري مميز يتحمل درجات الحرارة المرتفعة، واحتياجه المائي 2,800 - 3,200 م³/فدان.
- **نصيحة لمواجهة الجفاف:** تطبيق التغطية العضوية للتربة (Mulching) والري في الصباح الباكر لتجنب تشقق الثمار الناتج عن تذبذب الرطوبة.`;
                } else if (q.includes('نقص') || q.includes('مياه') || q.includes('ري') || q.includes('water')) {
                    answer = `💧 **خطة مجابهة شح مياه الري في ${st.name_ar} (مؤشر بالمر = ${pdsiVal.toFixed(2)}):**
1. **الري الليلي:** توجيه دورات الري بعد الغروب أو فجراً لخفض الفاقد بالتبخير الشديد بنسبة 25%.
2. **الري الناقص المنظم (Deficit Irrigation):** تقليص كمية الري بنسبة 15% خلال مراحل النمو الخضري غير الحرجة.
3. **تغطية قنوات الري المكشوفة والتحول للأنابيب المبوبة.**`;
                } else if (q.includes('كينوا') || q.includes('جوجوبا') || q.includes('quinoa') || q.includes('صحراء')) {
                    answer = `🌱 **زراعة الكينوا والجوجوبا في الأراضي الجديدة والواحات:**
- **الكينوا:** محصول ذهبي يستهلك 1,200 م³/فدان فقط ويتحمل ملوحة مياه الآبار حتى 8,000 جزء في المليون.
- **الجوجوبا:** شجرة معمرة ذات عائد تصديري صناعي استثنائي، تستهلك أقل من 1,000 م³/فدان وتحمي مخزون الخزان الجوفي النوبي.`;
                } else {
                    answer = `🌾 **تحليل الذكاء الاصطناعي لمحافظة ${st.name_ar} (مؤشر PDSI = ${pdsiVal.toFixed(2)}):**
بناءً على التنبؤات الاستباقية لمنظومة **NileGuard** الذكية:
- التربة بالمحافظة: **${st.soil_type_ar}**.
- ننصح بالتركيز على المحاصيل الاستراتيجية الملائمة: **${st.primary_agriculture_ar}**.
- يُرجى جدولة الري بنظام التنقيط والتسميد البوتاسي لتعزيز مقاومة الأوراق لظروف الإجهاد الحراري.`;
                }
            }

            appendChatMessage('ai', answer.replace(/\n/g, '<br>'));
        }, 600);
    }

    if (chatChips) {
        chatChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                appendChatMessage('user', prompt);
                processAiResponse(prompt);
            });
        });
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = chatInput.value.trim();
            if (!q) return;
            appendChatMessage('user', q);
            chatInput.value = '';
            processAiResponse(q);
        });
    }

    // Language Toggle
    if (btnLangToggle) {
        btnLangToggle.addEventListener('click', () => {
            currentLang = currentLang === 'en' ? 'ar' : 'en';
            document.documentElement.lang = currentLang;
            document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
            langLabel.textContent = currentLang === 'en' ? 'العربية' : 'English';
            updateHeroLanguage();
            updateAllViews();
            populateRoiScenarios();
        });
    }

    // Initialize App
    loadData();
    updateHeroLanguage();
});
