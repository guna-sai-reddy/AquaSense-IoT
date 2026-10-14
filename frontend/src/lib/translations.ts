export type Language = "en" | "te" | "hi" | "es";

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🌾" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
];

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Brand & App
    appName: "AquaSense-IoT",
    appSubtitle: "Precision Irrigation",
    appHeaderTag: "Precision Agriculture Operations",
    
    // Navigation
    navOverview: "Overview",
    navFields: "Fields",
    navSoilMoisture: "Soil Moisture",
    navIrrigation: "Irrigation Advisory",
    navPredictions: "Prediction History",
    navWeather: "Weather & ET₀",
    navWaterBudget: "Water Savings ROI",
    navEvaluation: "Research Evaluation",
    navAdmin: "Admin Panel",
    navSystemHealth: "System Health",
    navAccount: "Account",
    
    // Actions & Buttons
    logout: "Logout",
    login: "Sign In",
    save: "Save",
    cancel: "Cancel",
    refresh: "Refresh",
    installApp: "Install App",
    installing: "Installing...",
    appInstalled: "Installed",
    triggerPrediction: "Forecast 24h Moisture",
    viewDetails: "View Details",
    search: "Search",
    searchPlaceholder: "Search plots, tools, guides... (Ctrl+K)",
    filter: "Filter",
    calculate: "Calculate Savings",

    // Notifications
    notifications: "Notifications",
    markAllRead: "Mark all as read",
    noNotifications: "No unread alerts",
    clearAll: "Clear all",
    testAlert: "Send Test Alert",

    // System Status
    backendOnline: "Backend Online",
    backendOffline: "Backend Offline",
    checkingStatus: "Checking Status",
    offlineMode: "Offline Mode Active",

    // Themes
    theme: "Theme",
    modeLight: "Light",
    modeDark: "Dark",
    paletteEmerald: "Emerald Leaf",
    paletteOcean: "Ocean Water",
    paletteAmber: "Harvest Amber",

    // Languages
    selectLanguage: "Language",

    // Agronomic & Metrics
    activeFields: "Active Fields",
    avgSoilMoisture: "Avg Soil Moisture",
    pendingIrrigations: "Irrigation Needed",
    weatherET0: "Daily Reference ET₀",
    rootZoneMoisture: "Root-Zone Moisture (7-28 cm)",
    surfaceMoisture: "Surface Moisture (0-7 cm)",
    deepMoisture: "Deep Moisture (28-100 cm)",
    fieldCapacity: "Field Capacity (FC)",
    wiltingPoint: "Wilting Point (WP)",
    depletionFraction: "Depletion Fraction (p)",
    currentDepletion: "Root Zone Depletion (Dr)",
    readilyAvailableWater: "Readily Available Water (RAW)",
    totalAvailableWater: "Total Available Water (TAW)",

    // Advisories
    statusOptimal: "Optimal Moisture",
    statusIrrigate: "Irrigate Immediately",
    statusPostpone: "Postpone Irrigation",
    statusWaterlogged: "Waterlogging Warning",
    statusInvestigate: "Sensor Check Required",

    // Common Footer / Operator
    fieldOperator: "Field Operator",
    superuser: "Superuser",
  },
  te: {
    // Brand & App
    appName: "ఆక్వాసెన్స్-IoT",
    appSubtitle: "ఖచ్చితమైన నీటిపారుదల",
    appHeaderTag: "ఖచ్చితమైన వ్యవసాయ కార్యకలాపాలు",
    
    // Navigation
    navOverview: "అవలోకనం",
    navFields: "పొలాలు",
    navSoilMoisture: "నేల తేమ",
    navIrrigation: "నీటిపారుదల సలహా",
    navPredictions: "తేమ అంచనాల చరిత్ర",
    navWeather: "వాతావరణం & బాష్పోత్సేకం (ET₀)",
    navWaterBudget: "నీటి ఆదా & ఖర్చు కాలిక్యులేటర్",
    navEvaluation: "పరిశోధన మూల్యాంకనం",
    navAdmin: "అడ్మిన్ ప్యానెల్",
    navSystemHealth: "సిస్టమ్ ఆరోగ్యం",
    navAccount: "ఖాతా",
    
    // Actions & Buttons
    logout: "లాగ్ అవుట్",
    login: "సైన్ ఇన్",
    save: "భద్రపరచు",
    cancel: "రద్దు చేయి",
    refresh: "తాజాకరించు",
    installApp: "యాప్ ఇన్‌స్టాల్ చేయండి",
    installing: "ఇన్‌స్టాల్ అవుతోంది...",
    appInstalled: "ఇన్‌స్టాల్ చేయబడింది",
    triggerPrediction: "24 గంటల తేమ అంచనా",
    viewDetails: "వివరాలు చూడండి",
    search: "వెతకండి",
    searchPlaceholder: "పొలాలు, సాధనాలు వెతకండి... (Ctrl+K)",
    filter: "ఫిల్టర్ చేయండి",
    calculate: "ఆదాను లెక్కించండి",

    // Notifications
    notifications: "నోటిఫికేషన్‌లు",
    markAllRead: "అన్నీ చదివినట్లు గుర్తించు",
    noNotifications: "కొత్త హెచ్చరికలు లేవు",
    clearAll: "అన్నీ తీసివేయి",
    testAlert: "పరీక్ష హెచ్చరికను పంపు",

    // System Status
    backendOnline: "సర్వర్ ఆన్‌లైన్",
    backendOffline: "సర్వర్ ఆఫ్‌లైన్",
    checkingStatus: "స్థితిని తనిఖీ చేస్తోంది",
    offlineMode: "ఆఫ్‌లైన్ మోడ్ చురుకుగా ఉంది",

    // Themes
    theme: "రంగు థీమ్",
    modeLight: "లైట్ మోడ్",
    modeDark: "డార్క్ మోడ్",
    paletteEmerald: "ఎమరాల్డ్ ఆకుపచ్చ",
    paletteOcean: "సముద్ర నీలం",
    paletteAmber: "పంట అంబర్",

    // Languages
    selectLanguage: "భాష",

    // Agronomic & Metrics
    activeFields: "క్రియాశీల పొలాలు",
    avgSoilMoisture: "సగటు నేల తేమ",
    pendingIrrigations: "నీటి అవసరం ఉన్న పొలాలు",
    weatherET0: "రోజువారీ బాష్పోత్సేకం (ET₀)",
    rootZoneMoisture: "వేరు మండల తేమ (7-28 సెం.మీ)",
    surfaceMoisture: "ఉపరితల తేమ (0-7 సెం.మీ)",
    deepMoisture: "లోతైన తేమ (28-100 సెం.మీ)",
    fieldCapacity: "ఫీల్డ్ కెపాసిటీ (FC)",
    wiltingPoint: "వాడిపోయే స్థానం (WP)",
    depletionFraction: "క్షీణత భిన్నం (p)",
    currentDepletion: "వేరు మండల తేమ క్షీణత (Dr)",
    readilyAvailableWater: "సులభంగా లభించే నీరు (RAW)",
    totalAvailableWater: "మొత్తం అందుబాటులో ఉన్న నీరు (TAW)",

    // Advisories
    statusOptimal: "సరైన తేమ స్థాయి",
    statusIrrigate: "వెంటనే నీరు పెట్టండి",
    statusPostpone: "నీటిపారుదల వాయిదా వేయండి",
    statusWaterlogged: "నీరు నిల్వ ఉన్న ప్రమాదం",
    statusInvestigate: "సెన్సార్ తనిఖీ అవసరం",

    // Common Footer / Operator
    fieldOperator: "ఫీల్డ్ ఆపరేటర్",
    superuser: "ముఖ్య నిర్వాహకుడు",
  },
  hi: {
    // Brand & App
    appName: "एक्वासेंस-IoT",
    appSubtitle: "सटीक सिंचाई प्रबंधन",
    appHeaderTag: "सटीक कृषि संचालन",
    
    // Navigation
    navOverview: "अवलोकन",
    navFields: "खेत",
    navSoilMoisture: "मृदा नमी",
    navIrrigation: "सिंचाई सलाह",
    navPredictions: "पूर्वानुमान इतिहास",
    navWeather: "मौसम और वाष्पोत्सर्जन (ET₀)",
    navWaterBudget: "जल बचत और लागत कैलकुलेटर",
    navEvaluation: "अनुसंधान मूल्यांकन",
    navAdmin: "व्यवस्थापक पैनल",
    navSystemHealth: "सिस्टम स्वास्थ्य",
    navAccount: "खाता",
    
    // Actions & Buttons
    logout: "लॉग आउट",
    login: "साइन इन",
    save: "सहेजें",
    cancel: "रद्द करें",
    refresh: "ताज़ा करें",
    installApp: "ऐप इंस्टॉल करें",
    installing: "इंस्टॉल हो रहा है...",
    appInstalled: "इंस्टॉल किया गया",
    triggerPrediction: "24 घंटे का नमी पूर्वानुमान",
    viewDetails: "विवरण देखें",
    search: "खोजें",
    searchPlaceholder: "खेत, उपकरण खोजें... (Ctrl+K)",
    filter: "फ़िल्टर",
    calculate: "बचत की गणना करें",

    // Notifications
    notifications: "सूचनाएं",
    markAllRead: "सभी पढ़े हुए के रूप में चिह्नित करें",
    noNotifications: "कोई नई सूचना नहीं",
    clearAll: "सभी साफ़ करें",
    testAlert: "परीक्षण अलर्ट भेजें",

    // System Status
    backendOnline: "सर्वर ऑनलाइन",
    backendOffline: "सर्वर ऑफलाइन",
    checkingStatus: "स्थिति जांची जा रही है",
    offlineMode: "ऑफलाइन मोड सक्रिय",

    // Themes
    theme: "थीम",
    modeLight: "लाइट मोड",
    modeDark: "डार्क मोड",
    paletteEmerald: "पन्ना हरा",
    paletteOcean: "समुद्री जल",
    paletteAmber: "फसल अंबर",

    // Languages
    selectLanguage: "भाषा",

    // Agronomic & Metrics
    activeFields: "सक्रिय खेत",
    avgSoilMoisture: "औसत मृदा नमी",
    pendingIrrigations: "सिंचाई की आवश्यकता",
    weatherET0: "दैनिक संदर्भ वाष्पोत्सर्जन (ET₀)",
    rootZoneMoisture: "जड़ क्षेत्र नमी (7-28 सेमी)",
    surfaceMoisture: "सतह की नमी (0-7 सेमी)",
    deepMoisture: "गहरी नमी (28-100 सेमी)",
    fieldCapacity: "क्षेत्र क्षमता (FC)",
    wiltingPoint: "मुरझाने का बिंदु (WP)",
    depletionFraction: "कमी अंश (p)",
    currentDepletion: "जड़ क्षेत्र नमी की कमी (Dr)",
    readilyAvailableWater: "आसानी से उपलब्ध जल (RAW)",
    totalAvailableWater: "कुल उपलब्ध जल (TAW)",

    // Advisories
    statusOptimal: "इष्टतम नमी",
    statusIrrigate: "तुरंत सिंचाई करें",
    statusPostpone: "सिंचाई स्थगित करें",
    statusWaterlogged: "जलभराव की चेतावनी",
    statusInvestigate: "सेंसर जांच आवश्यक",

    // Common Footer / Operator
    fieldOperator: "फील्ड ऑपरेटर",
    superuser: "मुख्य व्यवस्थापक",
  },
  es: {
    // Brand & App
    appName: "AquaSense-IoT",
    appSubtitle: "Riego de Precisión",
    appHeaderTag: "Operaciones de Agricultura de Precisión",
    
    // Navigation
    navOverview: "Visión General",
    navFields: "Campos",
    navSoilMoisture: "Humedad del Suelo",
    navIrrigation: "Asesoría de Riego",
    navPredictions: "Historial de Predicción",
    navWeather: "Clima y Evapotranspiración",
    navWaterBudget: "Ahorro de Agua y Costos",
    navEvaluation: "Evaluación Científica",
    navAdmin: "Panel de Administrador",
    navSystemHealth: "Salud del Sistema",
    navAccount: "Cuenta",
    
    // Actions & Buttons
    logout: "Cerrar Sesión",
    login: "Iniciar Sesión",
    save: "Guardar",
    cancel: "Cancelar",
    refresh: "Actualizar",
    installApp: "Instalar App",
    installing: "Instalando...",
    appInstalled: "Instalado",
    triggerPrediction: "Predecir Humedad 24h",
    viewDetails: "Ver Detalles",
    search: "Buscar",
    searchPlaceholder: "Buscar parcelas, herramientas... (Ctrl+K)",
    filter: "Filtrar",
    calculate: "Calcular Ahorro",

    // Notifications
    notifications: "Notificaciones",
    markAllRead: "Marcar todas como leídas",
    noNotifications: "No hay alertas pendientes",
    clearAll: "Borrar todo",
    testAlert: "Enviar Alerta de Prueba",

    // System Status
    backendOnline: "Servidor Conectado",
    backendOffline: "Servidor Desconectado",
    checkingStatus: "Comprobando Estado",
    offlineMode: "Modo Fuera de Línea",

    // Themes
    theme: "Tema de Color",
    modeLight: "Modo Claro",
    modeDark: "Modo Oscuro",
    paletteEmerald: "Verde Esmeralda",
    paletteOcean: "Azul Océano",
    paletteAmber: "Ámbar Cosecha",

    // Languages
    selectLanguage: "Idioma",

    // Agronomic & Metrics
    activeFields: "Campos Activos",
    avgSoilMoisture: "Humedad Media del Suelo",
    pendingIrrigations: "Riego Requerido",
    weatherET0: "Evapotranspiración Diaria (ET₀)",
    rootZoneMoisture: "Humedad Zona Radicular (7-28 cm)",
    surfaceMoisture: "Humedad Superficial (0-7 cm)",
    deepMoisture: "Humedad Profunda (28-100 cm)",
    fieldCapacity: "Capacidad de Campo (FC)",
    wiltingPoint: "Punto de Marchitez (WP)",
    depletionFraction: "Fracción de Agotamiento (p)",
    currentDepletion: "Agotamiento Radicular (Dr)",
    readilyAvailableWater: "Agua Fácilmente Disponible (RAW)",
    totalAvailableWater: "Agua Total Disponible (TAW)",

    // Advisories
    statusOptimal: "Humedad Óptima",
    statusIrrigate: "Regar Inmediatamente",
    statusPostpone: "Posponer Riego",
    statusWaterlogged: "Alerta de Encharcamiento",
    statusInvestigate: "Inspección de Sensor Requerida",

    // Common Footer / Operator
    fieldOperator: "Operador de Campo",
    superuser: "Superusuario",
  },
};
