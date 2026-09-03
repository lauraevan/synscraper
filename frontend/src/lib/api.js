import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

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
    };
    const key = `streams:${JSON.stringify(params)}`;
    return cached(key, 45_000, () => http.get("/streams", {
        params,
        timeout: options.timeout || 90000,
    }).then((r) => r.data));
};

// image helpers
const IMG = "https://image.tmdb.org/t/p";
export const img = (path, size = "w500") =>
    path ? `${IMG}/${size}${path}` : null;
export const backdrop = (path, size = "original") =>
    path ? `${IMG}/${size}${path}` : null;

export const hlsProxyUrl = (playUrl) =>
    playUrl?.startsWith("http") ? playUrl : `${BACKEND_URL}${playUrl}`;
