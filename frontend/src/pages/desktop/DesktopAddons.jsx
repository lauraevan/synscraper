import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, PackagePlus, Puzzle, RefreshCw, Trash2 } from "lucide-react";
import {
  fetchDesktopAddonResource,
  getDesktopAddons,
  installDesktopAddon,
  removeDesktopAddon,
  setDesktopAddonEnabled,
} from "@/lib/desktopAddons";

const capabilityNames = {
  catalog: "Catalogs",
  meta: "Metadata",
  stream: "Streams",
  subtitles: "Subtitles",
  addon_catalog: "Add-on catalog",
};

const safeHost = (value) => {
  try { return new URL(value).hostname; } catch { return "Installed add-on"; }
};

export default function DesktopAddons() {
  const [addons, setAddons] = useState(() => getDesktopAddons());
  const [manifestUrl, setManifestUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [installError, setInstallError] = useState("");
  const [installedName, setInstalledName] = useState("");
  const [catalogState, setCatalogState] = useState({ loading: false, addonId: "", catalogId: "", title: "", items: [], error: "" });

  const enabledCount = useMemo(() => addons.filter((addon) => addon.enabled !== false).length, [addons]);

  const refresh = () => setAddons(getDesktopAddons());

  const install = async (event) => {
    event.preventDefault();
    setInstallError("");
    setInstalledName("");
    setBusy(true);
    try {
      const addon = await installDesktopAddon(manifestUrl);
      setInstalledName(addon.name);
      setManifestUrl("");
      refresh();
    } catch (error) {
      setInstallError(error?.message || "The add-on could not be installed.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id, enabled) => {
    setDesktopAddonEnabled(id, enabled);
    refresh();
  };

  const remove = (id) => {
    removeDesktopAddon(id);
    if (catalogState.addonId === id) setCatalogState({ loading: false, addonId: "", catalogId: "", title: "", items: [], error: "" });
    refresh();
  };

  const previewCatalog = async (addon, catalog) => {
    setCatalogState({ loading: true, addonId: addon.id, catalogId: catalog.id, title: `${addon.name} · ${catalog.name || catalog.id}`, items: [], error: "" });
    try {
      const payload = await fetchDesktopAddonResource(addon, "catalog", catalog.type, catalog.id);
      const items = Array.isArray(payload?.metas) ? payload.metas : [];
      setCatalogState({ loading: false, addonId: addon.id, catalogId: catalog.id, title: `${addon.name} · ${catalog.name || catalog.id}`, items: items.slice(0, 18), error: "" });
    } catch (error) {
      setCatalogState({ loading: false, addonId: addon.id, catalogId: catalog.id, title: `${addon.name} · ${catalog.name || catalog.id}`, items: [], error: error?.message || "Could not load this catalog." });
    }
  };

  return (
    <div className="desktop-page desktop-addons-page" data-testid="desktop-addons-page">
      <div className="desktop-page-heading">
        <div>
          <span className="desktop-eyebrow"><Puzzle aria-hidden="true" /> Stremio protocol</span>
          <h1>Add-ons</h1>
          <p>Install compatible Stremio add-ons from a public manifest URL. {enabledCount} enabled.</p>
        </div>
      </div>

      <section className="desktop-addon-install">
        <div className="desktop-addon-install-copy">
          <span className="desktop-addon-install-icon"><PackagePlus aria-hidden="true" /></span>
          <div>
            <h2>Install an add-on</h2>
            <p>Paste the add-on’s HTTPS manifest address. SynFlix validates the manifest before saving it.</p>
          </div>
        </div>
        <form onSubmit={install}>
          <label htmlFor="stremio-manifest-url">Manifest URL</label>
          <div className="desktop-addon-url-row">
            <input id="stremio-manifest-url" value={manifestUrl} onChange={(e) => setManifestUrl(e.target.value)} placeholder="https://example.com/manifest.json" inputMode="url" autoComplete="url" required />
            <button type="submit" className="desktop-primary-button" disabled={busy}>{busy ? <RefreshCw className="desktop-spin" aria-hidden="true" /> : <PackagePlus aria-hidden="true" />}{busy ? "Checking…" : "Install"}</button>
          </div>
          <small>Public HTTPS add-ons only. Local-network and private addresses are blocked.</small>
          {installError ? <div className="desktop-addon-message desktop-addon-message--error" role="alert">{installError}</div> : null}
          {installedName ? <div className="desktop-addon-message desktop-addon-message--success"><CheckCircle2 aria-hidden="true" /> {installedName} is ready.</div> : null}
        </form>
      </section>

      <section className="desktop-media-section">
        <header className="desktop-section-header"><div><h2>Installed add-ons</h2><p>Enable, disable, browse, or remove add-ons from this device.</p></div></header>
        {addons.length ? (
          <div className="desktop-addon-list">
            {addons.map((addon) => (
              <article className="desktop-addon-card" key={addon.id} data-enabled={addon.enabled !== false}>
                <div className="desktop-addon-logo">
                  {addon.logo ? <img src={addon.logo} alt="" loading="lazy" /> : <span>{addon.name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="desktop-addon-main">
                  <div className="desktop-addon-title-row">
                    <div><h3>{addon.name}</h3><span>{addon.version} · {safeHost(addon.manifestUrl)}</span></div>
                    <label className="desktop-addon-switch"><input type="checkbox" checked={addon.enabled !== false} onChange={(e) => toggle(addon.id, e.target.checked)} /><span aria-hidden="true" /></label>
                  </div>
                  {addon.description ? <p>{addon.description}</p> : null}
                  <div className="desktop-addon-capabilities">
                    {addon.resources.map((resource) => <span key={resource}>{capabilityNames[resource] || resource}</span>)}
                    {addon.types.slice(0, 4).map((type) => <span key={`type:${type}`} className="desktop-addon-type">{type}</span>)}
                  </div>
                  {addon.catalogs?.length ? (
                    <div className="desktop-addon-catalogs">
                      {addon.catalogs.slice(0, 8).map((catalog) => <button type="button" key={`${catalog.type}:${catalog.id}`} onClick={() => previewCatalog(addon, catalog)} disabled={addon.enabled === false}>{catalog.name || catalog.id}</button>)}
                    </div>
                  ) : null}
                </div>
                <div className="desktop-addon-actions">
                  <a href={addon.manifestUrl} target="_blank" rel="noreferrer" aria-label={`Open ${addon.name} manifest`}><ExternalLink aria-hidden="true" /></a>
                  <button type="button" onClick={() => remove(addon.id)} aria-label={`Remove ${addon.name}`}><Trash2 aria-hidden="true" /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="desktop-addon-empty">
            <Puzzle aria-hidden="true" />
            <h3>No add-ons installed</h3>
            <p>Add a manifest above and its catalogs will appear here.</p>
          </div>
        )}
      </section>

      {(catalogState.loading || catalogState.items.length || catalogState.error) ? (
        <section className="desktop-media-section desktop-addon-preview">
          <header className="desktop-section-header"><div><h2>{catalogState.title || "Catalog preview"}</h2><p>Live results from the installed add-on.</p></div></header>
          {catalogState.loading ? <div className="desktop-addon-preview-loading"><span className="desktop-loader" /> Loading catalog…</div> : null}
          {catalogState.error ? <div className="desktop-addon-message desktop-addon-message--error">{catalogState.error}</div> : null}
          {catalogState.items.length ? (
            <div className="desktop-addon-poster-grid">
              {catalogState.items.map((item, index) => (
                <article className="desktop-addon-poster" key={`${item.id || item.name}:${index}`}>
                  <div>{item.poster ? <img src={item.poster} alt="" loading="lazy" /> : <span>{String(item.name || "?").slice(0, 1)}</span>}</div>
                  <strong>{item.name || "Untitled"}</strong>
                  <small>{item.releaseInfo || item.year || item.type || ""}</small>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
