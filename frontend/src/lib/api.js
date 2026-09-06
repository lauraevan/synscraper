import axios from "axios";

const IS_DESKTOP_RUNTIME = typeof window !== "undefined" && Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
const DESKTOP_BACKEND_URL = process.env.REACT_APP_DESKTOP_BACKEND_URL || "https://synscraper-tffk.vercel.app";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (IS_DESKTOP_RUNTIME ? DESKTOP_BACKEND_URL : "");
const DOWNLOAD_BASE_URL = (process.env.REACT_APP_DOWNLOAD_WORKER_URL || BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;
// Downloads now default to the same backend. REACT_APP_DOWNLOAD_WORKER_URL remains
// an optional override for a dedicated worker/container deployment.
export const DOWNLOADS_CONFIGURED = true;

const http = axios.create({ baseURL: API, timeout: 30000 });
const memoryCache = new Map();

const cached = (key, ttl, loader) => {
    const now = Date.now();
    const hit = memoryCache.get(key);
    if (hit && hit.expires > now) {
        if (hit.promise) return hit.promise;
        return Promise.resolve(hit.value);
    }
    const promise = Promise.resolve()
        .then(loader)
        .then((value) => {
            memoryCache.set(key, { expires: Date.now() + ttl, value });
            return value;
        })
        .catch((error) => {
            memoryCache.delete(key);
            throw error;
        });
    memoryCache.set(key, { expires: now + ttl, promise });
    if (memoryCache.size > 160) {
        for (const [cacheKey, entry] of memoryCache) {
            if (entry.expires <= now) memoryCache.delete(cacheKey);
            if (memoryCache.size <= 120) break;
        }
    }
    return promise;
};

export const getHome = () =>
    cached("home", 60_000, () => http.get("/home").then((r) => r.data));
export const searchAll = (q, page = 1) =>
    cached(`search:${q}:${page}`, 20_000, () => http.get("/search", { params: { q, page } }).then((r) => r.data));
export const getDetails = (mediaType, id) =>
    cached(`details:${mediaType}:${id}`, 300_000, () => http.get(`/details/${mediaType}/${id}`).then((r) => r.data));
export const getPerson = (id) =>
    cached(`person:${id}`, 600_000, () => http.get(`/tmdb/person/${id}`, {
        params: { append_to_response: "combined_credits,images,external_ids" },
    }).then((r) => r.data));
export const getTitleImages = (mediaType, id) =>
    cached(`title-images:${mediaType}:${id}`, 3_600_000, () => http.get(`/tmdb/${mediaType}/${id}/images`, {
        params: { include_image_language: "en,null" },
    }).then((r) => r.data));
export const getSeason = (id, season) =>
    cached(`season:${id}:${season}`, 180_000, () => http.get(`/tv/${id}/season/${season}`).then((r) => r.data));
export const getGenres = (mediaType) =>
    cached(`genres:${mediaType}`, 600_000, () => http.get(`/genre/${mediaType}`).then((r) => r.data));
export const discover = (mediaType, params) =>
    cached(`discover:${mediaType}:${JSON.stringify(params || {})}`, 30_000, () => http.get(`/discover/${mediaType}`, { params }).then((r) => r.data));
export const getStreams = (type, id, season, episode, options = {}) => {
    const params = {
        type,
        id,
        season,
        episode,
        provider: options.provider,
        mirror: options.mirror,
        exclude: options.exclude,
        title: options.title,
        year: options.year,
        imdb_id: options.imdbId,
    };
    const key = `streams:${JSON.stringify(params)}`;
    return cached(key, 45_000, () => http.get("/streams", {
        params,
        timeout: options.timeout || 90000,
    }).then((r) => r.data));
};

const downloadParams = (params = {}) => {
    const query = new URLSearchParams();
    const values = {
        type: params.type,
        id: params.id,
        season: params.season,
        episode: params.episode,
        provider: params.provider,
        mirror: params.mirror,
        quality: params.quality,
        title: params.title,
    };
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    });
    return query;
};

export const getDownloadOptions = async (params) => {
    const query = downloadParams(params);
    query.delete("quality");
    query.delete("title");
    const response = await fetch(`${DOWNLOAD_BASE_URL}/api/download/options?${query.toString()}`);
    if (!response.ok) {
        let message = `Download API returned HTTP ${response.status}`;
        try {
            const body = await response.json();
            message = body?.detail?.message || body?.detail || message;
        } catch { /* ignore */ }
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }
    return response.json();
};

export const downloadWorkerUrl = (params) =>
    `${DOWNLOAD_BASE_URL}/api/download?${downloadParams(params).toString()}`;

// image helpers
const IMG = "https://image.tmdb.org/t/p";
export const img = (path, size = "w500") =>
    path ? `${IMG}/${size}${path}` : null;
export const backdrop = (path, size = "original") =>
    path ? `${IMG}/${size}${path}` : null;

export const hlsProxyUrl = (playUrl) =>
    playUrl?.startsWith("http") ? playUrl : `${BACKEND_URL}${playUrl}`;
