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
    // ==========================================================================
    // 1. DATA LOADING WITH EMBEDDED FALLBACK FOR HOSTED ENVIRONMENTS
    // ==========================================================================
    const DEFAULT_STATIONS_FALLBACK = {
        "Asyut": {
            "name_ar": "أسيوط", "name_en": "Asyut", "lat": 27.18, "lng": 31.18, "region_ar": "صعيد مصر — الوادي القبلي",
            "soil_type_ar": "تربة طمية رسوبية خصبة", "primary_agriculture_ar": "الرمان المنفلوطي، القمح، القطن جيزة 95",
            "confidence": "94.6%", "historical_pdsi": [-1.2, -1.5, -1.8, -2.1, -1.9, -1.7, -1.4, -1.6, -1.8, -2.0, -1.7, -1.78],
            "forecast_series": [-1.85, -1.92, -2.05, -2.15, -2.20, -2.10, -1.98, -1.90, -1.82, -1.75, -1.70, -1.65]
        },
        "Minya": {
            "name_ar": "المنيا", "name_en": "Minya", "lat": 28.11, "lng": 30.75, "region_ar": "مصر الوسطى — وادي النيل",
            "soil_type_ar": "تربة طينية رسوبية", "primary_agriculture_ar": "بنجر السكر، القمح، البصل الذهبي",
            "confidence": "95.1%", "historical_pdsi": [-0.9, -1.1, -1.3, -1.5, -1.4, -1.3, -1.2, -1.4, -1.5, -1.6, -1.5, -1.45],
            "forecast_series": [-1.50, -1.58, -1.65, -1.72, -1.78, -1.70, -1.62, -1.55, -1.48, -1.42, -1.38, -1.35]
        },
        "Sohag": {
            "name_ar": "سوهاج", "name_en": "Sohag", "lat": 26.56, "lng": 31.69, "region_ar": "جنوب الصعيد — الوادي",
            "soil_type_ar": "تربة طمية نيلية", "primary_agriculture_ar": "البصل التصديري، السمسم البلدي، القمح",
            "confidence": "93.8%", "historical_pdsi": [-1.5, -1.8, -2.0, -2.2, -2.1, -1.9, -1.8, -2.0, -2.1, -2.3, -2.2, -2.10],
            "forecast_series": [-2.15, -2.25, -2.35, -2.42, -2.48, -2.40, -2.30, -2.22, -2.15, -2.08, -2.02, -1.98]
        },
        "Qena": {
            "name_ar": "قنا", "name_en": "Qena", "lat": 26.16, "lng": 32.72, "region_ar": "جنوب الصعيد — ثنية قنا",
            "soil_type_ar": "تربة رملية طمية", "primary_agriculture_ar": "شتلات القصب المطور، الذرة الرفيعة، النخيل",
            "confidence": "94.2%", "historical_pdsi": [-1.8, -2.0, -2.2, -2.4, -2.3, -2.2, -2.0, -2.2, -2.4, -2.5, -2.4, -2.35],
            "forecast_series": [-2.40, -2.50, -2.60, -2.68, -2.75, -2.65, -2.55, -2.45, -2.38, -2.30, -2.25, -2.20]
        },
        "Luxor": {
            "name_ar": "الأقصر", "name_en": "Luxor", "lat": 25.68, "lng": 32.64, "region_ar": "أقصى جنوب الصعيد",
            "soil_type_ar": "تربة صحراوية جافة رسوبية", "primary_agriculture_ar": "الطماطم المجففة شمسياً، النخيل، القصب",
            "confidence": "92.9%", "historical_pdsi": [-2.0, -2.3, -2.5, -2.7, -2.6, -2.5, -2.3, -2.5, -2.7, -2.8, -2.7, -2.60],
            "forecast_series": [-2.65, -2.75, -2.85, -2.92, -2.98, -2.88, -2.78, -2.70, -2.62, -2.55, -2.50, -2.45]
        },
        "Aswan": {
            "name_ar": "أسوان", "name_en": "Aswan", "lat": 24.09, "lng": 32.90, "region_ar": "الحدود الجنوبية — بحيرة ناصر",
            "soil_type_ar": "تربة صحراوية رملية", "primary_agriculture_ar": "الكركديه الأسواني، النخيل، القصب بالتنقيط",
            "confidence": "91.5%", "historical_pdsi": [-2.2, -2.5, -2.7, -2.9, -2.8, -2.7, -2.5, -2.7, -2.9, -3.0, -2.9, -2.85],
            "forecast_series": [-2.90, -3.02, -3.12, -3.20, -3.25, -3.15, -3.05, -2.95, -2.88, -2.80, -2.75, -2.70]
        },
        "BeniSuef": {
            "name_ar": "بني سويف", "name_en": "BeniSuef", "lat": 29.07, "lng": 31.10, "region_ar": "شمال الصعيد — وادي النيل",
            "soil_type_ar": "طمية نيلية غنية", "primary_agriculture_ar": "القمح، بنجر السكر، النباتات الطبية",
            "confidence": "96.0%", "historical_pdsi": [-0.7, -0.9, -1.0, -1.2, -1.1, -1.0, -0.9, -1.0, -1.1, -1.3, -1.2, -1.15],
            "forecast_series": [-1.20, -1.28, -1.35, -1.42, -1.48, -1.40, -1.32, -1.25, -1.18, -1.12, -1.08, -1.05]
        },
        "Fayoum": {
            "name_ar": "الفيوم", "name_en": "Fayoum", "lat": 29.31, "lng": 30.84, "region_ar": "منخفض الفيوم — بحيرة قارون",
            "soil_type_ar": "تربة طينية رسوبية", "primary_agriculture_ar": "القمح، بنجر السكر، الأعشاب العطرية",
            "confidence": "95.5%", "historical_pdsi": [-0.5, -0.7, -0.8, -1.0, -0.9, -0.8, -0.7, -0.8, -0.9, -1.1, -1.0, -0.95],
            "forecast_series": [-1.00, -1.08, -1.15, -1.22, -1.28, -1.20, -1.12, -1.05, -0.98, -0.92, -0.88, -0.85]
        }
    };

    const DEFAULT_CROPS_FALLBACK = [
        { "id": "pomegranate", "name_ar": "الرمان المنفلوطي", "name_en": "Manfaluti Pomegranate", "category_ar": "فاكهة تصديرية", "icon": "🍎", "min_pdsi": -3.5, "max_pdsi": 0.5, "drought_tolerance_ar": "عالي التحمل", "water_need_m3_feddan": "2800 - 3400", "irrigation_method_ar": "تنقيط مع تغطية عضوية", "governorates": ["Asyut", "Minya", "Sohag"], "description_ar": "أشهر محاصيل أسيوط التصديرية. يتكيف مع الجو الجاف الحار والنقص المائي." },
        { "id": "wheat_resilient", "name_ar": "القمح (سخا 95 ومصر 3)", "name_en": "Resilient Wheat", "category_ar": "حبوب استراتيجية", "icon": "🌾", "min_pdsi": -2.5, "max_pdsi": 2.0, "drought_tolerance_ar": "متحمل للجفاف", "water_need_m3_feddan": "2200 - 2600", "irrigation_method_ar": "تسوية بالليزر أو رش", "governorates": ["Asyut", "Minya", "BeniSuef", "Sohag", "Qena", "Fayoum"], "description_ar": "أصناف حديثة موفرة تستهلك مياهاً أقل بنسبة 25% وتتحمل درجات الحرارة." },
        { "id": "cotton_giza95", "name_ar": "القطن (جيزة 95)", "name_en": "Egyptian Cotton Giza 95", "category_ar": "محاصيل صناعية", "icon": "☁️", "min_pdsi": -2.0, "max_pdsi": 2.0, "drought_tolerance_ar": "متحمل للحرارة", "water_need_m3_feddan": "3200 - 3700", "irrigation_method_ar": "تنقيط ليلي مطور", "governorates": ["Asyut", "BeniSuef", "Minya", "Sohag"], "description_ar": "صنف مخصص للصعيد بتبكير في النضج ومقاومة عالية للإجهاد الحراري." },
        { "id": "cumin_herbs", "name_ar": "الكمون والنباتات الطبية", "name_en": "Cumin & Herbs", "category_ar": "محاصيل تصديرية", "icon": "🌿", "min_pdsi": -3.5, "max_pdsi": 0.5, "drought_tolerance_ar": "عالي التحمل", "water_need_m3_feddan": "1200 - 1600", "irrigation_method_ar": "تنقيط فائق الدقة", "governorates": ["Asyut", "Minya", "BeniSuef", "Fayoum"], "description_ar": "احتياج مائي ضئيل جداً وعائد تصديري مرتفع لكل متر مكعب ماء." },
        { "id": "hibiscus_aswan", "name_ar": "الكركديه الأسواني", "name_en": "Aswan Hibiscus", "category_ar": "محاصيل طبية", "icon": "🌺", "min_pdsi": -4.5, "max_pdsi": 0.0, "drought_tolerance_ar": "فائق التحمل", "water_need_m3_feddan": "1400 - 1800", "irrigation_method_ar": "تنقيط مقنن", "governorates": ["Aswan", "Luxor", "Qena"], "description_ar": "العلامة المسجلة لأسوان. يتحمل أقصى درجات الحرارة والجفاف." },
        { "id": "date_palm_barhi", "name_ar": "نخيل التمر والبرحي", "name_en": "Date Palms", "category_ar": "بساتين استراتيجية", "icon": "🌴", "min_pdsi": -5.0, "max_pdsi": 1.0, "drought_tolerance_ar": "فائق التحمل", "water_need_m3_feddan": "3200 - 4200", "irrigation_method_ar": "تنقيط عميق", "governorates": ["Aswan", "Luxor", "Qena", "Asyut"], "description_ar": "نظام جذري متعمق يتحمل أقسى موجات الجفاف والحرارة بالصعيد." },
        { "id": "sugar_cane_drip", "name_ar": "شتلات القصب بالتنقيط", "name_en": "Drip Sugarcane", "category_ar": "محاصيل سكرية", "icon": "🎋", "min_pdsi": -2.0, "max_pdsi": 2.0, "drought_tolerance_ar": "متوسط بالتنقيط", "water_need_m3_feddan": "5000 - 6200", "irrigation_method_ar": "تنقيط مع شتلات معتمدة", "governorates": ["Aswan", "Luxor", "Qena"], "description_ar": "يوفر 40% من مياه الغمر ويرفع الإنتاجية لـ 60 طناً للفدان." },
        { "id": "sorghum_giza15", "name_ar": "الذرة الرفيعة (جيزة 15)", "name_en": "Grain Sorghum", "category_ar": "حبوب صيفية", "icon": "🌽", "min_pdsi": -5.0, "max_pdsi": -0.5, "drought_tolerance_ar": "فائق التحمل", "water_need_m3_feddan": "1800 - 2200", "irrigation_method_ar": "أنبوب مبوب أو تنقيط", "governorates": ["Aswan", "Luxor", "Qena", "Sohag", "Asyut"], "description_ar": "البديل الاستراتيجي للذرة الشامية صيفاً. يتكيف مع حرارة +45°م." },
        { "id": "sun_dried_tomato", "name_ar": "الطماطم المجففة شمسياً", "name_en": "Sun-Dried Tomatoes", "category_ar": "خضر تصديرية", "icon": "🍅", "min_pdsi": -3.0, "max_pdsi": 1.0, "drought_tolerance_ar": "عالي بالتنقيط", "water_need_m3_feddan": "2200 - 2700", "irrigation_method_ar": "ري بالتنقيط مقنن", "governorates": ["Luxor", "Qena", "Aswan"], "description_ar": "تستغل الأقصر سطوع الشمس والحرارة الجافة لتجفيف طماطم التصدير." },
        { "id": "onions_drought", "name_ar": "البصل الذهبي التصديري", "name_en": "Golden Onions", "category_ar": "خضر تصديرية", "icon": "🧅", "min_pdsi": -2.5, "max_pdsi": 1.5, "drought_tolerance_ar": "عالي التحمل", "water_need_m3_feddan": "2000 - 2500", "irrigation_method_ar": "رش حديث أو تنقيط", "governorates": ["Sohag", "BeniSuef", "Asyut", "Minya"], "description_ar": "تنتج سوهاج البصل الذهبي عالي الجودة الذي يستهلك مياهاً معتدلة." },
        { "id": "sesame_baladi", "name_ar": "السمسم البلدي عالي الزيت", "name_en": "Baladi Sesame", "category_ar": "محاصيل زيتية", "icon": "🌰", "min_pdsi": -3.5, "max_pdsi": 0.5, "drought_tolerance_ar": "عالي التحمل", "water_need_m3_feddan": "1500 - 1900", "irrigation_method_ar": "تنقيط أو رش خفيف", "governorates": ["Sohag", "Qena", "Asyut", "Minya"], "description_ar": "محصول صيفي سريع النمو يزدهر بنسبة زيت تتجاوز 52%." },
        { "id": "sugar_beet_resilient", "name_ar": "بنجر السكر الموفر", "name_en": "Sugar Beet", "category_ar": "محاصيل سكرية", "icon": "🥔", "min_pdsi": -2.0, "max_pdsi": 2.0, "drought_tolerance_ar": "متحمل للجفاف", "water_need_m3_feddan": "2800 - 3400", "irrigation_method_ar": "رش محوري أو تنقيط", "governorates": ["Minya", "BeniSuef", "Fayoum", "Asyut", "Qena"], "description_ar": "البديل المستدام لقصب السكر؛ يوفر أكثر من 55% من المياه." }
    ];

    async function loadData() {
        try {
            const [stationsRes, cropsRes] = await Promise.all([
                fetch('data/stations_timeseries.json').catch(() => null),
                fetch('data/crops_knowledge_base.json').catch(() => null)
            ]);

            if (stationsRes && stationsRes.ok && cropsRes && cropsRes.ok) {
                const stationsData = await stationsRes.json();
                const cropsData = await cropsRes.json();
                appData.stations = stationsData.stations;
                appData.elbeltagi_table2 = stationsData.elbeltagi_table2;
                appData.crops = cropsData.crops;
            } else {
                console.warn("Using embedded fallback dataset for hosted environment...");
                appData.stations = DEFAULT_STATIONS_FALLBACK;
                appData.crops = DEFAULT_CROPS_FALLBACK;
            }
        } catch (err) {
            console.warn("Using embedded fallback dataset due to fetch error:", err);
            appData.stations = DEFAULT_STATIONS_FALLBACK;
            appData.crops = DEFAULT_CROPS_FALLBACK;
        }

        initSatelliteMap();
        updateAllViews();
        populateRoiScenarios();
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

    function updateReportDynamicHeader() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const liveDateStr = `${year}/${month}/${day}`;

        const reportDateEl = document.getElementById('report-issue-date');
        const reportGovEl = document.getElementById('report-target-gov');
        const st = appData.stations[activeGov];

        if (reportDateEl) reportDateEl.textContent = liveDateStr;
        if (reportGovEl && st) reportGovEl.textContent = currentLang === 'en' ? st.name_en : st.name_ar;
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
        if (typeof updateChatbotContext === 'function') updateChatbotContext();
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
                ? `${st.name_en} — PDSI Drought Trajectory & CNN-Transformer Forecast`
                : `${st.name_ar} — مسار الجفاف وتنبؤات موديل CNN-Transformer (4-Category AI Engine)`;
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

        // Strict governorate priority mapping to guarantee distinct, dynamic regional recommendations
        const govPriorityCrops = {
            'Aswan': ['hibiscus_aswan', 'date_palm_barhi', 'sugar_cane_drip', 'sorghum_giza15'],
            'Luxor': ['sun_dried_tomato', 'date_palm_barhi', 'sugar_cane_drip', 'sorghum_giza15'],
            'Asyut': ['pomegranate', 'wheat_resilient', 'cotton_giza95', 'cumin_herbs'],
            'Minya': ['sugar_beet_resilient', 'wheat_resilient', 'onions_drought', 'pomegranate'],
            'Sohag': ['onions_drought', 'sesame_baladi', 'wheat_resilient', 'pomegranate'],
            'Qena': ['sugar_cane_drip', 'sorghum_giza15', 'sesame_baladi', 'date_palm_barhi'],
            'BeniSuef': ['wheat_resilient', 'sugar_beet_resilient', 'onions_drought', 'cotton_giza95'],
            'Fayoum': ['wheat_resilient', 'sugar_beet_resilient', 'cumin_herbs', 'onions_drought']
        };

        // Determine Calendar Season from Horizon Month (1 to 12)
        const selectedMonthNum = currentHorizon > 12 ? (currentHorizon % 12 || 12) : currentHorizon;
        const isWinterSeason = [11, 12, 1, 2, 3, 4].includes(selectedMonthNum);
        const isSummerHeatSeason = [5, 6, 7, 8, 9, 10].includes(selectedMonthNum);

        const winterCropIds = ['wheat_resilient', 'sugar_beet_resilient', 'cumin_herbs', 'onions_drought', 'sun_dried_tomato'];
        const summerCropIds = ['sorghum_giza15', 'hibiscus_aswan', 'sesame_baladi', 'date_palm_barhi', 'sugar_cane_drip', 'cotton_giza95', 'pomegranate'];

        // Dynamic Spatio-Temporal Multi-Criteria Scoring Algorithm
        let cropScores = appData.crops.map(crop => {
            let score = 0;
            
            // 1. Regional Governorate Match (+15 pts)
            if (crop.governorates && crop.governorates.includes(activeGov)) {
                score += 15;
            }

            // 2. Signature Crop Priority Match (+20 pts)
            const priorityIds = govPriorityCrops[activeGov] || [];
            if (priorityIds.includes(crop.id)) {
                const priorityRank = priorityIds.indexOf(crop.id);
                score += (20 - priorityRank * 3);
            }

            // 3. Dynamic Horizon Date & Calendar Season Alignment (+15 pts)
            if (isWinterSeason && winterCropIds.includes(crop.id)) {
                score += 15;
            } else if (isSummerHeatSeason && summerCropIds.includes(crop.id)) {
                score += 15;
            }

            // 4. Horizon Predicted Drought Severity (PDSI) Stress Adaptation (+10 pts)
            if (forecastPdsi <= -2.0 && crop.min_pdsi <= -3.0) {
                score += 10;
            }

            return { crop, score };
        });

        // Sort by highest dynamic score
        cropScores.sort((a, b) => b.score - a.score);

        // Always select top 4 dynamic crops for current governorate + horizon date
        const finalCrops = cropScores.slice(0, 4).map(item => item.crop);

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
        const txtLauncherTitle = document.getElementById('txt-launcher-title');
        const txtLauncherSub = document.getElementById('txt-launcher-sub');
        const btnTabHome = document.getElementById('btn-tab-home');
        const btnTabReports = document.getElementById('btn-tab-reports');
        const txtChatHeaderTitle = document.getElementById('txt-chat-header-title');
        const txtChatStatus = document.getElementById('txt-chat-status');
        const cropsHubTitle = document.getElementById('crops-hub-title');
        const cropsHubDesc = document.getElementById('crops-hub-desc');
        const txtCropsHubBtn = document.getElementById('txt-crops-hub-btn');
        const txtBtnChatSend = document.getElementById('txt-btn-chat-send');
        const chatInputEl = document.getElementById('chat-input');
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
            if (btnTabHome) btnTabHome.innerHTML = '<span>الرئيسية</span>';
            if (btnTabDash) btnTabDash.innerHTML = '<span>المراقبة والتنبؤ</span> <span class="tab-badge badge-live">● LIVE</span>';
            if (btnTabCrops) btnTabCrops.innerHTML = '<span>المرشد الذكي</span> <span class="tab-badge badge-ai">AI</span>';
            if (btnTabRoi) btnTabRoi.innerHTML = '<span>حاسبة الجدوى</span>';
            if (btnTabReports) btnTabReports.innerHTML = '<span>التقارير</span>';
            if (appSloganHeader) appSloganHeader.textContent = 'نستبق الجفاف.. لأمان النيل ونماء الأرض';
            if (heroSloganBadge) heroSloganBadge.innerHTML = '<span>🌱 نستبق الجفاف.. لأمان النيل ونماء الأرض</span>';
            if (footerSloganBar) footerSloganBar.textContent = 'NileGuard AI Platform · « نستبق الجفاف.. لأمان النيل ونماء الأرض » · Arab Republic of Egypt 2026';
            if (bulletinSloganText) bulletinSloganText.textContent = 'منظومة NileGuard · « نستبق الجفاف.. لأمان النيل ونماء الأرض »';

            // Chatbot Widget Arabic
            if (txtLauncherTitle) txtLauncherTitle.textContent = 'المستشار الزراعي الذكي';
            if (txtLauncherSub) txtLauncherSub.textContent = '✨ Gemini AI Active';
            if (txtChatHeaderTitle) txtChatHeaderTitle.textContent = 'NileGuard مستشارك الزراعي الذكي';
            if (txtChatStatus) txtChatStatus.textContent = 'محرك Gemini الذكي نشط';
            if (cropsHubTitle) cropsHubTitle.textContent = 'المساعد الزراعي الذكي المباشر (Powered by Gemini AI Engine)';
            if (cropsHubDesc) cropsHubDesc.textContent = 'استشر الذكاء الاصطناعي التوليدي في التوصيات المحصولية، جداول الري، واستراتيجيات التكيف مع الجفاف لمحافظتك.';
            if (txtCropsHubBtn) txtCropsHubBtn.textContent = '💬 فتح المحادثة الفورية مع المستشار الذكي';
            if (txtBtnChatSend) txtBtnChatSend.textContent = 'إرسال';
            if (chatInputEl) chatInputEl.placeholder = 'اكتب سؤالك الزراعي هنا...';
            if (cropCountBadge) cropCountBadge.textContent = '4 محاصيل موصى بها';

            const chatWelcomeBubble = document.getElementById('chat-welcome-bubble');
            if (chatWelcomeBubble) {
                chatWelcomeBubble.innerHTML = 'أهلاً بك! أنا مستشارك الزراعي الذكي لمنظومة <strong>NileGuard</strong>. يمكنك سؤالي عن أنسب المحاصيل للمحافظة المحددة حالياً، أو استفسارات الري والتسميد وتأثير مؤشر الجفاف على أراضيك الزراعية. كيف يمكنني مساعدتك؟';
            }
            
            const promptChipsAr = [
                "ما هي أفضل أصناف القمح المقاومة للجفاف في محافظة أسيوط؟",
                "كيف أتعامل مع نقص مياه الري في الصعيد خلال الصيف؟",
                "ما هي مواعيد وطرق ري الرمان المنفلوطي في أسيوط؟",
                "ما هو البديل الموفر للمياه لقصب السكر في الأقصر وقنا؟"
            ];
            const promptLabelsAr = [
                "🌾 أصناف القمح المقاومة؟",
                "💧 التعامل مع نقص مياه الري؟",
                "🍎 ري وزراعة الرمان؟",
                "🥔 بدائل قصب السكر؟"
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

            // References Arabic
            const txtRefSectionTitle = document.getElementById('txt-ref-section-title');
            const txtRefSectionSub = document.getElementById('txt-ref-section-sub');
            const ref1Tag = document.getElementById('ref-1-tag');
            const ref1Title = document.getElementById('ref-1-title');
            const ref1Desc = document.getElementById('ref-1-desc');
            const ref2Tag = document.getElementById('ref-2-tag');
            const ref2Title = document.getElementById('ref-2-title');
            const ref2Desc = document.getElementById('ref-2-desc');
            const ref3Tag = document.getElementById('ref-3-tag');
            const ref3Title = document.getElementById('ref-3-title');
            const ref3Desc = document.getElementById('ref-3-desc');
            const ref4Tag = document.getElementById('ref-4-tag');
            const ref4Title = document.getElementById('ref-4-title');
            const ref4Desc = document.getElementById('ref-4-desc');

            if (txtRefSectionTitle) txtRefSectionTitle.textContent = 'المراجع والدراسات العلمية الرسمية المعتمدة (Certified Official References)';
            if (txtRefSectionSub) txtRefSectionSub.textContent = 'مصادر بيانات المقننات المائية، توصيات مركز البحوث الزراعية، ومعايير حساب الجدوى الاقتصادية والوفر المائي';
            if (ref1Tag) ref1Tag.textContent = '01. المقننات المائية القومية (MWRI)';
            if (ref1Title) ref1Title.textContent = 'الدليل القومي للمقننات المائية المقررة لمحافظات مصر';
            if (ref1Desc) ref1Desc.textContent = 'وزارة الموارد المائية والري — الهيئة العامة لترشيد المياه وشبكات الري بالصعيد (2022-2024).';
            if (ref2Tag) ref2Tag.textContent = '02. الأصناف والتوصيات (ARC)';
            if (ref2Title) ref2Title.textContent = 'النشرات الفنية لأصناف المحاصيل المقاومة للجفاف';
            if (ref2Desc) ref2Desc.textContent = 'مركز البحوث الزراعية — معاهد المحاصيل الحقلية والبساتين (القمح سخا 95، بدائل القصب، والرمان).';
            if (ref3Tag) ref3Tag.textContent = '03. كفاءة الري والتسعير (WMRI)';
            if (ref3Title) ref3Title.textContent = 'دراسات كفاءة الري بالتنقيط وحاسبة الوفر المائي';
            if (ref3Desc) ref3Desc.textContent = 'معهد بحوث إدارة المياه وتقييم كفاءة الري (WMRI) + ميزانية الطاقة والتسميد (2.2 جنيه/م³).';
            if (ref4Tag) ref4Tag.textContent = '04. نماذج FAO والاستهلاك المنزلي';
            if (ref4Title) ref4Title.textContent = 'FAO Irrigation Paper 56 & HCWW Index';
            if (ref4Desc) ref4Desc.textContent = 'منظومة FAO لمعدلات البخر-نتح ET0 + معايير الشركة القابضة لحساب الأسر المستفيدة (400 م³/أسرة/سنة).';

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
            if (btnTabHome) btnTabHome.innerHTML = '<span>Home</span>';
            if (btnTabDash) btnTabDash.innerHTML = '<span>Monitoring & Risk</span> <span class="tab-badge badge-live">● LIVE</span>';
            if (btnTabCrops) btnTabCrops.innerHTML = '<span>AI Advisor</span> <span class="tab-badge badge-ai">AI</span>';
            if (btnTabRoi) btnTabRoi.innerHTML = '<span>Agri-ROI Calculator</span>';
            if (btnTabReports) btnTabReports.innerHTML = '<span>Reports</span>';
            if (appSloganHeader) appSloganHeader.textContent = 'Ahead of Drought: Securing the Nile, Sustaining the Land';
            if (heroSloganBadge) heroSloganBadge.innerHTML = '<span>🌱 Ahead of Drought: Securing the Nile, Sustaining the Land</span>';
            if (footerSloganBar) footerSloganBar.textContent = 'NileGuard AI Platform · "Ahead of Drought: Securing the Nile, Sustaining the Land" · Arab Republic of Egypt 2026';
            if (bulletinSloganText) bulletinSloganText.textContent = 'NileGuard System · "Ahead of Drought: Securing the Nile, Sustaining the Land"';

            // Chatbot Widget English
            if (txtLauncherTitle) txtLauncherTitle.textContent = 'AI Agronomic Advisor';
            if (txtLauncherSub) txtLauncherSub.textContent = '✨ Gemini AI Active';
            if (txtChatHeaderTitle) txtChatHeaderTitle.textContent = 'NileGuard AI Agronomic Advisor';
            if (txtChatStatus) txtChatStatus.textContent = 'Gemini AI Engine Active';
            if (cropsHubTitle) cropsHubTitle.textContent = 'Live Agricultural AI Assistant (Powered by Gemini AI Engine)';
            if (cropsHubDesc) cropsHubDesc.textContent = 'Ask Generative AI for customized crop varieties, precision irrigation quotas, and climate adaptation strategies.';
            if (txtCropsHubBtn) txtCropsHubBtn.textContent = '💬 Open Live AI Chatbot Assistant';
            if (txtBtnChatSend) txtBtnChatSend.textContent = 'Send';
            if (chatInputEl) chatInputEl.placeholder = 'Ask your agricultural question here (e.g. wheat varieties, irrigation quotas)...';
            if (cropCountBadge) cropCountBadge.textContent = '4 Recommended Crops';

            const chatWelcomeBubbleEn = document.getElementById('chat-welcome-bubble');
            if (chatWelcomeBubbleEn) {
                chatWelcomeBubbleEn.innerHTML = 'Welcome! I am your <strong>NileGuard</strong> AI Agronomic Advisor. Ask me about resilient crop selections for the active governorate, precision irrigation, or how forecasted Palmer drought indices impact your farmland. How can I assist you?';
            }

            const promptChipsEn = [
                "What are the best drought-tolerant wheat varieties in Asyut?",
                "How to manage summer irrigation water deficits in Upper Egypt?",
                "What are the planting and irrigation schedules for Manfaluti pomegranate?",
                "What are the water-saving alternatives to sugarcane in Luxor and Qena?"
            ];
            const promptLabelsEn = [
                "🌾 Resilient Wheat Varieties?",
                "💧 Managing Water Deficits?",
                "🍎 Pomegranate Irrigation?",
                "🥔 Sugarcane Alternatives?"
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

            // References English
            const txtRefSectionTitleEn = document.getElementById('txt-ref-section-title');
            const txtRefSectionSubEn = document.getElementById('txt-ref-section-sub');
            const ref1TagEn = document.getElementById('ref-1-tag');
            const ref1TitleEn = document.getElementById('ref-1-title');
            const ref1DescEn = document.getElementById('ref-1-desc');
            const ref2TagEn = document.getElementById('ref-2-tag');
            const ref2TitleEn = document.getElementById('ref-2-title');
            const ref2DescEn = document.getElementById('ref-2-desc');
            const ref3TagEn = document.getElementById('ref-3-tag');
            const ref3TitleEn = document.getElementById('ref-3-title');
            const ref3DescEn = document.getElementById('ref-3-desc');
            const ref4TagEn = document.getElementById('ref-4-tag');
            const ref4TitleEn = document.getElementById('ref-4-title');
            const ref4DescEn = document.getElementById('ref-4-desc');

            if (txtRefSectionTitleEn) txtRefSectionTitleEn.textContent = 'Certified Official Scientific References & Citations';
            if (txtRefSectionSubEn) txtRefSectionSubEn.textContent = 'Official citations for crop water quotas, ARC agronomic advisories, and economic ROI metrics.';
            if (ref1TagEn) ref1TagEn.textContent = '01. National Water Quotas (MWRI)';
            if (ref1TitleEn) ref1TitleEn.textContent = 'National Irrigation Water Quotas Manual for Egyptian Governorates';
            if (ref1DescEn) ref1DescEn.textContent = 'Ministry of Water Resources & Irrigation (MWRI) — Upper Egypt Water Efficiency Authority (2022–2024).';
            if (ref2TagEn) ref2TagEn.textContent = '02. Crop Varieties & Advisories (ARC)';
            if (ref2TitleEn) ref2TitleEn.textContent = 'Technical Advisories for Drought-Tolerant Cultivars';
            if (ref2DescEn) ref2DescEn.textContent = 'Agricultural Research Center (ARC) — Field Crops & Horticulture Institutes (Sakha 95 Wheat, Sugarcane Alternatives).';
            if (ref3TagEn) ref3TagEn.textContent = '03. Irrigation Efficiency & Pricing (WMRI)';
            if (ref3TitleEn) ref3TitleEn.textContent = 'Drip Irrigation Efficiency & Economic ROI Studies';
            if (ref3DescEn) ref3DescEn.textContent = 'Water Management Research Institute (WMRI) + Pumping Energy & Fertilizer Runoff Cost Model (2.2 EGP/m³).';
            if (ref4TagEn) ref4TagEn.textContent = '04. FAO Models & Household Index';
            if (ref4TitleEn) ref4TitleEn.textContent = 'FAO Irrigation Paper 56 & HCWW Household Index';
            if (ref4DescEn) ref4DescEn.textContent = 'UN FAO ET0 Evapotranspiration Framework + Holding Company (HCWW) Household Water Equivalent (400 m³/family/year).';

            // SDGs English
            if (sdg15Title) sdg15Title.textContent = 'Life on Land & Anti-Desertification';
            if (sdg15Desc) sdg15Desc.textContent = 'Land reclamation and preserving agricultural lands in Upper Egypt and the Nile Basin from degradation.';
            if (sdg6Title) sdg6Title.textContent = 'Clean Water & Sustainable Sanitation';
            if (sdg6Desc) sdg6Desc.textContent = 'Proactive water deficit forecasting, optimizing canal network flows, and modernizing irrigation.';
            if (sdg2Title) sdg2Title.textContent = 'Zero Hunger & Food Security';
            if (sdg2Desc) sdg2Desc.textContent = 'Protecting strategic crop yields and guiding farmers toward heat-resistant crops.';
            if (sdg13Title) sdg13Title.textContent = 'Climate Action & Adaptation';
            if (sdg13Desc) sdg13Desc.textContent = 'Building high-resolution early warning climate systems to adapt to extreme droughts.';
        }

        updateChatbotContext();
    }

    // Live Theme Switcher Controller (Version A: Classic vs Version B: Aerial Live Satellite)
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeLabel = document.getElementById('theme-label');
    let isAerialTheme = false;

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            isAerialTheme = !isAerialTheme;
            if (isAerialTheme) {
                document.body.classList.add('theme-aerial');
                if (themeLabel) {
                    themeLabel.textContent = currentLang === 'ar' ? '📜 النسخة الكلاسيكية (Version A)' : '📜 Classic Theme (Version A)';
                }
            } else {
                document.body.classList.remove('theme-aerial');
                if (themeLabel) {
                    themeLabel.textContent = currentLang === 'ar' ? '🛰️ النسخة الفضائية (Version B)' : '🛰️ Live Satellite (Version B)';
                }
            }
        });
    }

    // Tab Navigation Controller
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // Home CTAs & Navigation Actions
    const btnHeroCtaDash = document.getElementById('btn-hero-cta-dash');
    const btnHeroCtaRoi = document.getElementById('btn-hero-cta-roi');
    const btnHomeRecDetails = document.getElementById('btn-home-rec-details');
    const btnOpenBulletinReports = document.getElementById('btn-open-bulletin-reports');
    const btnTabDash = document.getElementById('btn-tab-dash');
    const btnTabRoi = document.getElementById('btn-tab-roi');
    const btnTabCrops = document.getElementById('btn-tab-crops');

    if (btnHeroCtaDash && btnTabDash) {
        btnHeroCtaDash.addEventListener('click', () => btnTabDash.click());
    }
    if (btnHeroCtaRoi && btnTabRoi) {
        btnHeroCtaRoi.addEventListener('click', () => btnTabRoi.click());
    }
    if (btnHomeRecDetails && btnTabCrops) {
        btnHomeRecDetails.addEventListener('click', () => btnTabCrops.click());
    }
    if (btnOpenBulletinReports && bulletinModal) {
        btnOpenBulletinReports.addEventListener('click', () => {
            bulletinModal.style.display = 'flex';
        });
    }

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

            // Invalidate Leaflet Map & Chart Size on tab activation
            if (targetTab === 'tab-dashboard') {
                if (leafletMap) {
                    setTimeout(() => { leafletMap.invalidateSize(); }, 50);
                    setTimeout(() => { leafletMap.invalidateSize(); }, 250);
                }
                if (forecastChart) {
                    setTimeout(() => { forecastChart.resize(); }, 100);
                }
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

    async function fetchCnnTransformerInference(govKey, horizonMonth) {
        try {
            const response = await fetch('http://localhost:8000/api/v1/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    governorate: govKey,
                    horizon_month: parseInt(horizonMonth || currentHorizon)
                })
            });
            const data = await response.json();
            if (data.status === "success" && appData.stations[govKey]) {
                appData.stations[govKey].forecast_series = data.forecast_12m_series;
            }
        } catch (err) {
            console.warn("FastAPI offline, using cached series:", err);
        }
    }

    if (btnRunSim) {
        btnRunSim.addEventListener('click', async () => {
            btnRunSim.style.transform = 'scale(0.97)';
            if (btnSimText) btnSimText.textContent = currentLang === 'en' ? 'Inferring via CNN-Transformer API...' : 'جارٍ الاستدلال عبر نموذج CNN-Transformer...';
            
            await fetchCnnTransformerInference(activeGov, currentHorizon);
            
            setTimeout(() => {
                btnRunSim.style.transform = 'none';
                if (btnSimText) btnSimText.textContent = currentLang === 'en' ? 'Run CNN-Transformer AI' : 'تنفيذ الاستدلال الذكي (CNN-Transformer)';
                updateAllViews();
            }, 350);
        });
    }

    // ==========================================================================
    // 8. FLOATING AI AGRONOMIC CHATBOT CONTROLLER
    // ==========================================================================
    const btnChatbotLauncher = document.getElementById('btn-chatbot-launcher');
    const floatingChatbotWindow = document.getElementById('floating-chatbot-window');
    const btnMinimizeChat = document.getElementById('btn-minimize-chat');
    const btnCloseChat = document.getElementById('btn-close-chat');
    const btnOpenChatbotHub = document.getElementById('btn-open-chatbot-hub');
    const chatActiveGovLabel = document.getElementById('chat-active-gov-label');
    const chatGovNameBold = document.getElementById('chat-gov-name-bold');
    const chatActivePdsiPill = document.getElementById('chat-active-pdsi-pill');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const chatChips = document.querySelectorAll('.chat-chip');

    function openChatbot() {
        if (floatingChatbotWindow) {
            floatingChatbotWindow.classList.add('active');
            updateChatbotContext();
            if (chatInput) setTimeout(() => chatInput.focus(), 300);
        }
    }

    function closeChatbot() {
        if (floatingChatbotWindow) {
            floatingChatbotWindow.classList.remove('active');
        }
    }

    function toggleChatbot() {
        if (floatingChatbotWindow) {
            if (floatingChatbotWindow.classList.contains('active')) {
                closeChatbot();
            } else {
                openChatbot();
            }
        }
    }

    function updateChatbotContext() {
        if (!appData || !appData.stations) return;
        const st = appData.stations[activeGov];
        if (!st) return;
        const horizonIdx = Math.min(currentHorizon - 1, st.forecast_series.length - 1);
        const pdsiVal = st.forecast_series[horizonIdx];

        if (chatGovNameBold) {
            chatGovNameBold.textContent = currentLang === 'ar' ? st.name_ar : st.name_en;
        }
        if (chatActiveGovLabel) {
            chatActiveGovLabel.innerHTML = currentLang === 'ar'
                ? `📍 المحافظة الحالية: <strong id="chat-gov-name-bold">${st.name_ar}</strong>`
                : `📍 Active Governorate: <strong id="chat-gov-name-bold">${st.name_en}</strong>`;
        }
        if (chatActivePdsiPill) {
            chatActivePdsiPill.textContent = `PDSI: ${pdsiVal.toFixed(2)}`;
        }
    }

    if (btnChatbotLauncher) {
        btnChatbotLauncher.addEventListener('click', toggleChatbot);
    }
    if (btnOpenChatbotHub) {
        btnOpenChatbotHub.addEventListener('click', openChatbot);
    }
    if (btnMinimizeChat) {
        btnMinimizeChat.addEventListener('click', closeChatbot);
    }
    if (btnCloseChat) {
        btnCloseChat.addEventListener('click', closeChatbot);
    }

    function appendChatMessage(sender, htmlContent) {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chatbot-msg-bubble msg-${sender}`;
        if (sender === 'user') {
            msgDiv.innerHTML = `
                <div class="chatbot-bubble-text">
                    ${htmlContent}
                </div>
                <div style="font-size: 1.15rem;">🧑‍🌾</div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div style="font-size: 1.15rem;">🤖</div>
                <div class="chatbot-bubble-text">
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
        typingDiv.className = 'chatbot-msg-bubble msg-ai';
        typingDiv.innerHTML = `
            <div style="font-size: 1.15rem;">🤖</div>
            <div class="chatbot-bubble-text" style="color: var(--text-muted); font-size: 0.76rem; font-family: var(--font-mono); display: flex; align-items: center; gap: 0.4rem;">
                <span>${currentLang === 'en' ? 'Analyzing query & climate data...' : 'جارٍ تحليل الاستفسار والبيانات المناخية...'}</span>
                <span class="sync-dot" style="display: inline-block;"></span>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        setTimeout(() => {
            const el = document.getElementById(typingId);
            if (el) el.remove();

            let answer = "";
            const q = query.toLowerCase().trim();

            // Greeting keywords
            const isGreeting = /^(hi|hello|hey|أهلا|اهلاً|أهلاً|مرحبا|مرحباً|سلام|السلام عليكم|ازيك|صباح الخير|مساء الخير)$/i.test(q) || q.startsWith('hi ') || q.startsWith('hello ') || q.startsWith('أهلا') || q.startsWith('سلام');
            
            // Thanks keywords
            const isThanks = /^(شكرا|شكراً|ثانكس|تسلم|تسلم ايدك|ممتاز|شكرا جزيلا|thanks|thank you|great|awesome)$/i.test(q);
            
            // Identity/Help keywords
            const isHelp = q.includes('مين انت') || q.includes('من أنت') || q.includes('وظيفتك') || q.includes('مين حضرتك') || q.includes('who are you') || q.includes('what is nileguard') || q.includes('مساعدة') || q.includes('help');

            if (currentLang === 'en') {
                if (isGreeting) {
                    answer = `Hello! 👋 I am your <strong>NileGuard AI Advisor</strong> for <strong>${st.name_en}</strong> (PDSI Drought Forecast = ${pdsiVal.toFixed(2)}).<br><br>How can I help you today? You can ask me about:<br>• Resilient wheat & crop varieties<br>• Irrigation schedules & water saving<br>• Sugarcane & pomegranate recommendations`;
                } else if (isThanks) {
                    answer = `You're very welcome! 🌾 I am always here to help you optimize irrigation and boost crop resilience across Upper Egypt. Let me know if you have any more questions!`;
                } else if (isHelp) {
                    answer = `I am <strong>NileGuard AI Advisor</strong> — an intelligent agronomic system powered by satellite TerraClimate data.<br><br>I provide actionable advice on crop selection, deficit irrigation, and water conservation for 8 Upper Egypt governorates.`;
                } else if (q.includes('wheat') || q.includes('sakha') || q.includes('misr')) {
                    answer = `🌾 <strong>Wheat Cultivation Advisories for ${st.name_en} (PDSI = ${pdsiVal.toFixed(2)}):</strong><br>• <strong>Resilient Varieties:</strong> Sakha 95, Misr 3, Sids 14.<br>• <strong>Planting Window:</strong> Nov 15 – Dec 5.<br>• <strong>Water Need:</strong> 2,400 m³/feddan with laser land leveling.`;
                } else if (q.includes('sugar') || q.includes('cane') || q.includes('beet')) {
                    answer = `🥔 <strong>Sugarcane Alternatives for ${st.name_en}:</strong><br>• <strong>Sugar Beet:</strong> Saves >70% water (3,200 m³/feddan).<br>• <strong>Drip Seedling Sugarcane:</strong> Reduces water use to 6,000 m³/feddan.`;
                } else if (q.includes('pomegranate') || q.includes('manfalut')) {
                    answer = `🍎 <strong>Manfaluti Pomegranate in ${st.name_en}:</strong><br>• Quota: 2,800–3,200 m³/feddan.<br>• Apply mulching and early morning drip cycles to prevent fruit cracking.`;
                } else if (q.includes('irrigation') || q.includes('water') || q.includes('deficit')) {
                    answer = `💧 <strong>Irrigation Action Plan for ${st.name_en} (PDSI = ${pdsiVal.toFixed(2)}):</strong><br>1. Night/early morning drip irrigation (cuts evaporation by 25%).<br>2. Regulated deficit irrigation during non-critical growth stages.<br>3. Pipeline conveyance instead of open ditches.`;
                } else {
                    answer = `🌾 <strong>Agronomic Guidance for ${st.name_en} (PDSI = ${pdsiVal.toFixed(2)}):</strong><br>• <strong>Soil Type:</strong> ${st.soil_type_en}.<br>• <strong>Key Crops:</strong> ${st.primary_agriculture_en}.<br>• Recommend drip irrigation with supplemental potassium to mitigate heat stress.`;
                }
            } else {
                if (isGreeting) {
                    answer = `أهلاً بك! 👋 أنا مستشارك الزراعي الذكي لمحافظة <strong>${st.name_ar}</strong> (مؤشر التنبؤ بالجفاف PDSI = ${pdsiVal.toFixed(2)}).<br><br>كيف يمكنني مساعدتك اليوم؟ يمكنك سؤالي عن:<br>• أفضل أصناف القمح المقاومة للجفاف<br>• جداول الري بالتنقيط وترشيد المياه<br>• بدائل قصب السكر وبساتين الرمان`;
                } else if (isThanks) {
                    answer = `العفو! 🌿 أنا دائمًا في خدمتك لحماية المحاصيل وترشيد مياه الري بمحافظة <strong>${st.name_ar}</strong>. يسعدني الإجابة عن أي استفسار آخر!`;
                } else if (isHelp) {
                    answer = `أنا <strong>مستشار NileGuard الذكي</strong> — منظومة ذكاء اصطناعي مناخية تعتمد على بيانات TerraClimate الفضائية والنماذج القومية للمقننات المائية.<br><br>أقدم لك توصيات دقيقة لزراعة المحاصيل والري المناسب لمحافظات صعيد مصر.`;
                } else if (q.includes('قمح') || q.includes('wheat') || q.includes('سخا') || q.includes('مصر 3')) {
                    answer = `🌾 <strong>توصيات القمح لمحافظة ${st.name_ar} (مؤشر PDSI = ${pdsiVal.toFixed(2)}):</strong><br>• <strong>الأصناف المقاومة:</strong> سخا 95، مصر 3، سدس 14.<br>• <strong>ميعاد الزراعة:</strong> من 15 نوفمبر حتى 5 ديسمبر لتفادي الإجهاد الحراري.<br>• <strong>المقنن المائي:</strong> 2,400 م³/فدان مع التسوية الدقيقة بالليزر.`;
                } else if (q.includes('قصب') || q.includes('سكر') || q.includes('بديل')) {
                    answer = `🥔 <strong>بدائل قصب السكر الموفرة بـ ${st.name_ar}:</strong><br>• <strong>بنجر السكر:</strong> يوفر أكثر من 70% من المياه (3,200 م³/فدان مقابل 10,500 م³ للقصب التقليدي).<br>• <strong>شتلات القصب بالتنقيط:</strong> خفض الاستهلاك إلى 6,000 م³/فدان مع زيادة نسبة السكر.`;
                } else if (q.includes('رمان') || q.includes('منفلوط')) {
                    answer = `🍎 <strong>بساتين الرمان المنفلوطي بـ ${st.name_ar}:</strong><br>• الاحتياج المائي: 2,800 - 3,200 م³/فدان.<br>• يوصى بالتغطية العضوية (Mulching) والري الفجري لتجنب تشقق الثمار.`;
                } else if (q.includes('نقص') || q.includes('مياه') || q.includes('ري') || q.includes('ترشيد')) {
                    answer = `💧 <strong>خطة ترشيد مياه الري بـ ${st.name_ar} (مؤشر بالمر = ${pdsiVal.toFixed(2)}):</strong><br>1. الري الليلي/الفجري لتقليل الفاقد بالتبخير بنسبة 25%.<br>2. تطبيق الري الناقص المنظم (RDI) في المراحل غير الحرجة.<br>3. التحول للأنبوب المبوب والري بالتنقيط.`;
                } else if (q.includes('أسيوط') || q.includes('المنيا') || q.includes('سوهاج') || q.includes('قنا') || q.includes('الأقصر') || q.includes('أسوان') || q.includes('بني سويف') || q.includes('الفيوم')) {
                    answer = `📍 <strong>بيانات محافظة ${st.name_ar}:</strong><br>• <strong>مؤشر الجفاف PDSI:</strong> ${pdsiVal.toFixed(2)}.<br>• <strong>طبيعة التربة:</strong> ${st.soil_type_ar}.<br>• <strong>المحاصيل الرئيسية:</strong> ${st.primary_agriculture_ar}.<br>• <strong>التوصية:</strong> الري بالتنقيط مع الإضافة البوتاسية لزيادة مقاومة الإجهاد الحراري.`;
                } else {
                    answer = `🌿 <strong>مستشار NileGuard الذكي (${st.name_ar}):</strong><br>رداً على استفسارك؛ تؤكد التنبؤات المناخية لمحافظة <strong>${st.name_ar}</strong> (مؤشر PDSI = ${pdsiVal.toFixed(2)}) أهمية الالتزام بالمقننات المائية المعتمدة والتحول للري الحديث لضمان أعلى إنتاجية وأعلى وفر مائي.`;
                }
            }

            appendChatMessage('ai', answer);
        }, 550);
    }

    if (chatChips) {
        chatChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                openChatbot();
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
