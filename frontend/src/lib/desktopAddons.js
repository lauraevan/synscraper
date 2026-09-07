import { API } from "@/lib/api";

const ADDONS_KEY = "synflix_desktop_stremio_addons_v1";

const safeParse = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const emit = (addons) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("synflix-desktop-addons", { detail: { addons } }));
  }
};

const normalizeResources = (resources = []) => resources.map((resource) => (
  typeof resource === "string" ? resource : resource?.name
)).filter(Boolean);

const normalizeAddon = (payload) => {
  const manifest = payload?.manifest || {};
  return {
    id: String(manifest.id || ""),
    name: String(manifest.name || "Unnamed add-on"),
    version: String(manifest.version || "0.0.0"),
    description: String(manifest.description || ""),
    logo: manifest.logo || manifest.icon || "",
    types: Array.isArray(manifest.types) ? manifest.types : [],
    resources: normalizeResources(manifest.resources),
    resourceDescriptors: Array.isArray(manifest.resources) ? manifest.resources : [],
    catalogs: Array.isArray(manifest.catalogs) ? manifest.catalogs : [],
    manifestUrl: payload.manifest_url,
    baseUrl: payload.base_url,
    enabled: true,
    installedAt: Date.now(),
  };
};

export const getDesktopAddons = () => {
  if (typeof window === "undefined") return [];
  const saved = safeParse(window.localStorage.getItem(ADDONS_KEY), []);
  return Array.isArray(saved) ? saved : [];
};

const saveAll = (addons) => {
  window.localStorage.setItem(ADDONS_KEY, JSON.stringify(addons));
  emit(addons);
  return addons;
};

const requestJSON = async (path, payload) => {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await response.json(); } catch { /* noop */ }
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : "The add-on could not be reached.");
  }
  return data;
};

export const installDesktopAddon = async (url) => {
  const payload = await requestJSON("/stremio/manifest", { url });
  const addon = normalizeAddon(payload);
  if (!addon.id || !addon.baseUrl) throw new Error("The add-on returned an invalid manifest.");
  const existing = getDesktopAddons();
  const index = existing.findIndex((item) => item.id === addon.id);
  if (index >= 0) {
    existing[index] = { ...existing[index], ...addon, enabled: existing[index].enabled !== false };
  } else {
    existing.unshift(addon);
  }
  saveAll(existing);
  return addon;
};

export const setDesktopAddonEnabled = (id, enabled) => {
  const addons = getDesktopAddons().map((addon) => addon.id === id ? { ...addon, enabled: Boolean(enabled) } : addon);
  return saveAll(addons);
};

export const removeDesktopAddon = (id) => saveAll(getDesktopAddons().filter((addon) => addon.id !== id));

export const getEnabledDesktopAddons = () => getDesktopAddons().filter((addon) => addon.enabled !== false);

export const fetchDesktopAddonResource = async (addon, resource, type, id) => requestJSON("/stremio/resource", {
  base_url: addon.baseUrl,
  resource,
  type,
  id,
});
