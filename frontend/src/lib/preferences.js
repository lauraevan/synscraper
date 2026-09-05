export const SITE_THEMES = [
  { id: "synflix", name: "SynFlix", accent: "#ffd400", description: "The original yellow and cinema-black look." },
  { id: "aqua", name: "Aqua", accent: "#54e7f1", description: "Cool cyan highlights with a deep ocean background." },
  { id: "autumn", name: "Autumn", accent: "#ff9d42", description: "Warm amber, rust, and dark brown surfaces." },
  { id: "cherri", name: "Cherri", accent: "#ff5d8f", description: "Cherry pink with a rich plum-black backdrop." },
  { id: "evergreen", name: "Evergreen", accent: "#64d98b", description: "Forest green accents and mossy dark surfaces." },
  { id: "rose", name: "Rose", accent: "#ff91ad", description: "Soft rose highlights with a muted wine tint." },
  { id: "violet", name: "Violet", accent: "#a78bfa", description: "Bright violet over a cool ink-black theme." },
  { id: "purple", name: "Purple", accent: "#8b5cf6", description: "Deeper purple controls and aubergine surfaces." },
  { id: "red", name: "Red", accent: "#ff4d55", description: "Bold streaming-red accents on near-black." },
  { id: "monochrome", name: "Monochrome", accent: "#f4f4f4", description: "Clean grayscale with no color distraction." },
  { id: "noir", name: "Noir", accent: "#c8c8c8", description: "Crushed blacks, silver accents, minimal color." },
  { id: "teal", name: "Teal", accent: "#35d0ba", description: "Muted teal with deep blue-green surfaces." },
];

export const PLAYER_THEMES = [
  { id: "classic", name: "Classic", accent: "#ffffff", description: "Original monochrome SynPlayer chrome." },
  ...SITE_THEMES.filter((theme) => theme.id !== "synflix"),
  { id: "synflix", name: "SynFlix", accent: "#ffd400", description: "Match the original SynFlix yellow." },
];

export const DEFAULT_PREFERENCES = {
  siteTheme: "synflix",
  siteMode: "dark",
  siteDensity: "comfortable",
  siteCorners: "round",
  siteAmbient: true,
  showRowSubtitles: true,
  siteMotion: "full",
  siteContrast: "normal",
  siteScale: "normal",
  playerTheme: "classic",
  playerCorners: "round",
  playerGlass: "glass",
  playerDensity: "comfortable",
  playerMotion: "full",
  playerContrast: "normal",
  playerTitle: true,
  playerAccentStrength: "normal",
};

const STORAGE_KEY = "synflix-preferences-v1";
let systemModeListenerInstalled = false;

export const getPreferences = () => {
  if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_PREFERENCES, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

const resolveSiteMode = (mode) => {
  if (mode !== "system") return mode === "light" ? "light" : "dark";
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

const installSystemModeListener = () => {
  if (systemModeListenerInstalled || typeof window === "undefined" || !window.matchMedia) return;
  const query = window.matchMedia("(prefers-color-scheme: light)");
  const sync = () => {
    const current = getPreferences();
    if (current.siteMode === "system") applyPreferences(current);
  };
  if (query.addEventListener) query.addEventListener("change", sync);
  else if (query.addListener) query.addListener(sync);
  systemModeListenerInstalled = true;
};

export const applyPreferences = (prefs = getPreferences()) => {
  if (typeof document === "undefined") return prefs;
  const root = document.documentElement;
  root.dataset.siteTheme = prefs.siteTheme;
  root.dataset.siteModePreference = prefs.siteMode;
  root.dataset.siteMode = resolveSiteMode(prefs.siteMode);
  root.dataset.siteDensity = prefs.siteDensity;
  root.dataset.siteCorners = prefs.siteCorners;
  root.dataset.siteAmbient = prefs.siteAmbient ? "on" : "off";
  root.dataset.siteSubtitles = prefs.showRowSubtitles ? "on" : "off";
  root.dataset.siteMotion = prefs.siteMotion;
  root.dataset.siteContrast = prefs.siteContrast;
  root.dataset.siteScale = prefs.siteScale;
  root.dataset.playerTheme = prefs.playerTheme;
  root.dataset.playerCorners = prefs.playerCorners;
  root.dataset.playerGlass = prefs.playerGlass;
  root.dataset.playerDensity = prefs.playerDensity;
  root.dataset.playerMotion = prefs.playerMotion;
  root.dataset.playerContrast = prefs.playerContrast;
  root.dataset.playerTitle = prefs.playerTitle ? "on" : "off";
  root.dataset.playerAccentStrength = prefs.playerAccentStrength;
  installSystemModeListener();
  return prefs;
};

export const savePreferences = (next) => {
  const merged = { ...DEFAULT_PREFERENCES, ...next };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("synflix-preferences", { detail: merged }));
  }
  applyPreferences(merged);
  return merged;
};

export const resetPreferences = () => savePreferences(DEFAULT_PREFERENCES);

export const preferenceStorageKey = STORAGE_KEY;
