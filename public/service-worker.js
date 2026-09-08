const SHELL_CACHE = "synflix-shell-v3";
const DATA_CACHE = "synflix-data-v3";
const ASSET_CACHE = "synflix-assets-v3";
const IMAGE_CACHE = "synflix-images-v3";

const APP_SHELL = [
  "/?iosApp=1",
  "/search?iosApp=1",
  "/my-list?iosApp=1",
  "/settings?iosApp=1",
  "/manifest.webmanifest",
  "/synflix-logo.webp",
];

const OFFLINE_FALLBACKS = ["/?iosApp=1", "/"];

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
};

const safePut = async (cacheName, request, response, maxEntries) => {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (maxEntries) await trimCache(cacheName, maxEntries);
  } catch {
    // Storage pressure should never break normal playback or browsing.
  }
};

const fetchWithTimeout = async (request, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const isStreamLike = (request, url) => {
  if (request.headers.has("range")) return true;
  if (["video", "audio"].includes(request.destination)) return true;
  return /\/(watch|embed|stream|streams|proxy-media|hls)(\/|$)/i.test(url.pathname);
};

const navigationStrategy = async (request) => {
  try {
    const response = await fetchWithTimeout(request, 2200);
    if (response && response.ok) {
      safePut(SHELL_CACHE, request, response, 18);
    }
    return response;
  } catch {
    const exact = await caches.match(request);
    if (exact) return exact;

    for (const fallback of OFFLINE_FALLBACKS) {
      const cached = await caches.match(fallback);
      if (cached) return cached;
    }

    throw new Error("No cached SynFlix shell is available yet.");
  }
};

const jsonStrategy = async (request) => {
  try {
    const response = await fetchWithTimeout(request, 2600);
    const contentType = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length") || 0);
    const smallEnough = !length || length < 2_500_000;

    if (response.ok && contentType.includes("application/json") && smallEnough) {
      safePut(DATA_CACHE, request, response, 90);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("No saved SynFlix data is available for this request.");
  }
};

const assetStrategy = async (request) => {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response.ok || response.type === "opaque") {
          safePut(ASSET_CACHE, request, response, 90);
        }
      })
      .catch(() => {});
    return cached;
  }

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    safePut(ASSET_CACHE, request, response, 90);
  }
  return response;
};

const imageStrategy = async (request) => {
  const cached = await caches.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") {
        safePut(IMAGE_CACHE, request, response, 220);
      }
      return response;
    });

  if (cached) {
    update.catch(() => {});
    return cached;
  }

  return update;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, DATA_CACHE, ASSET_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("synflix-") && !keep.has(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_CACHE" || !Array.isArray(event.data.urls)) return;

  event.waitUntil(
    Promise.allSettled(
      event.data.urls.slice(0, 12).map(async (url) => {
        const request = new Request(url, { credentials: "same-origin" });
        const response = await fetch(request);
        if (response.ok) await safePut(SHELL_CACHE, request, response, 18);
      })
    )
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isStreamLike(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    const accept = request.headers.get("accept") || "";
    if (accept.includes("application/json") || request.destination === "") {
      event.respondWith(jsonStrategy(request));
    }
    return;
  }

  if (["script", "style", "font", "worker"].includes(request.destination)) {
    event.respondWith(assetStrategy(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(imageStrategy(request));
  }
});
