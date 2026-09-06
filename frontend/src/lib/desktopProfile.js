const PROFILES_KEY = "synflix_desktop_profiles";
const ACTIVE_KEY = "synflix_desktop_active_profile";
const PREFS_KEY = "synflix_desktop_preferences";

const starterProfiles = [
  { id: "main", name: "My Profile", avatar: "spark", createdAt: Date.now() },
];

const emit = (name, detail) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
};

const safeParse = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

export const getDesktopProfiles = () => {
  if (typeof window === "undefined") return starterProfiles;
  const saved = safeParse(window.localStorage.getItem(PROFILES_KEY), null);
  if (Array.isArray(saved) && saved.length) return saved;
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(starterProfiles));
  return starterProfiles;
};

export const getActiveDesktopProfileId = () => {
  if (typeof window === "undefined") return "main";
  const profiles = getDesktopProfiles();
  const saved = window.localStorage.getItem(ACTIVE_KEY);
  const valid = profiles.some((profile) => profile.id === saved);
  const next = valid ? saved : profiles[0]?.id || "main";
  window.localStorage.setItem(ACTIVE_KEY, next);
  return next;
};

export const getActiveDesktopProfile = () => {
  const id = getActiveDesktopProfileId();
  return getDesktopProfiles().find((profile) => profile.id === id) || getDesktopProfiles()[0];
};

export const setActiveDesktopProfile = (id) => {
  const profiles = getDesktopProfiles();
  if (!profiles.some((profile) => profile.id === id)) return false;
  window.localStorage.setItem(ACTIVE_KEY, id);
  emit("synflix-desktop-profile", { id });
  return true;
};

export const saveDesktopProfile = (profile) => {
  const profiles = getDesktopProfiles();
  const normalized = {
    id: profile.id || `profile-${Date.now()}`,
    name: String(profile.name || "Profile").trim().slice(0, 24) || "Profile",
    avatar: profile.avatar || "spark",
    createdAt: profile.createdAt || Date.now(),
  };
  const index = profiles.findIndex((item) => item.id === normalized.id);
  if (index >= 0) profiles[index] = normalized;
  else profiles.push(normalized);
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.slice(0, 6)));
  emit("synflix-desktop-profiles", { profiles });
  return normalized;
};

export const deleteDesktopProfile = (id) => {
  const profiles = getDesktopProfiles();
  if (profiles.length <= 1) return false;
  const next = profiles.filter((profile) => profile.id !== id);
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  if (getActiveDesktopProfileId() === id) setActiveDesktopProfile(next[0].id);
  emit("synflix-desktop-profiles", { profiles: next });
  return true;
};

const preferenceKey = (profileId = getActiveDesktopProfileId()) => `${PREFS_KEY}:${profileId}`;

export const getDesktopPreferences = (profileId = getActiveDesktopProfileId()) => {
  if (typeof window === "undefined") return {};
  return {
    favoriteGenres: [],
    autoplayPreviews: true,
    compactLibrary: false,
    reduceArtworkMotion: false,
    ...safeParse(window.localStorage.getItem(preferenceKey(profileId)), {}),
  };
};

export const saveDesktopPreferences = (patch, profileId = getActiveDesktopProfileId()) => {
  const next = { ...getDesktopPreferences(profileId), ...patch };
  window.localStorage.setItem(preferenceKey(profileId), JSON.stringify(next));
  emit("synflix-desktop-preferences", { profileId, preferences: next });
  return next;
};

export const DESKTOP_AVATARS = [
  { id: "spark", label: "Spark" },
  { id: "moon", label: "Moon" },
  { id: "orbit", label: "Orbit" },
  { id: "wave", label: "Wave" },
  { id: "pixel", label: "Pixel" },
  { id: "nova", label: "Nova" },
];
