// localStorage helpers for watchlist + continue watching.
// The Windows desktop app scopes these collections per profile; the website keeps
// the existing global keys so browser users are not migrated unexpectedly.
const WATCHLIST = "synflix_watchlist";
const CONTINUE = "synflix_continue_watching";
const ACTIVE_DESKTOP_PROFILE = "synflix_desktop_active_profile";

const isDesktopRuntime = () => {
    if (typeof window === "undefined") return false;
    if (window.__TAURI__ || window.__TAURI_INTERNALS__) return true;
    try {
        return window.sessionStorage.getItem("synflix-desktop-preview") === "1";
    } catch {
        return false;
    }
};

const scopedKey = (key) => {
    if (!isDesktopRuntime()) return key;
    let profile = "main";
    try { profile = window.localStorage.getItem(ACTIVE_DESKTOP_PROFILE) || "main"; } catch { /* noop */ }
    return `${key}:profile:${profile}`;
};

const read = (k) => {
    try {
        return JSON.parse(localStorage.getItem(scopedKey(k)) || "[]");
    } catch {
        return [];
    }
};
const write = (k, v) => {
    localStorage.setItem(scopedKey(k), JSON.stringify(v));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("synflix-library-change", { detail: { key: k } }));
};

const keyOf = (item) => `${item.media_type}:${item.id}`;

// ---- Watchlist ----
export const getWatchlist = () => read(WATCHLIST);
export const inWatchlist = (item) =>
    read(WATCHLIST).some((x) => keyOf(x) === keyOf(item));
export const toggleWatchlist = (item) => {
    const list = read(WATCHLIST);
    const idx = list.findIndex((x) => keyOf(x) === keyOf(item));
    if (idx >= 0) list.splice(idx, 1);
    else list.unshift({ ...item, added_at: Date.now() });
    write(WATCHLIST, list);
    return idx < 0;
};

// ---- Continue watching ----
export const getContinue = () =>
    read(CONTINUE).sort((a, b) => b.updated_at - a.updated_at);

export const getProgress = (media_type, id, season, episode) => {
    const list = read(CONTINUE);
    return list.find(
        (x) =>
            x.media_type === media_type &&
            String(x.id) === String(id) &&
            (media_type === "movie" ||
                (String(x.season) === String(season) && String(x.episode) === String(episode)))
    );
};

export const saveProgress = (entry) => {
    const list = read(CONTINUE);
    const match = (x) =>
        x.media_type === entry.media_type && String(x.id) === String(entry.id);
    const filtered = list.filter((x) => !match(x));
    const pct = entry.duration ? entry.position / entry.duration : 0;
    if (pct > 0.95) {
        write(CONTINUE, filtered);
        return;
    }
    filtered.unshift({ ...entry, updated_at: Date.now() });
    write(CONTINUE, filtered.slice(0, 30));
};

export const removeContinue = (media_type, id) => {
    const list = read(CONTINUE).filter(
        (x) => !(x.media_type === media_type && String(x.id) === String(id))
    );
    write(CONTINUE, list);
};
