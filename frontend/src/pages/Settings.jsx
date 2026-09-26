import { useMemo, useState } from "react";
import {
  Accessibility,
  Check,
  LayoutGrid,
  Palette,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { PLAYER_THEMES, SITE_THEMES, getPreferences, resetPreferences, savePreferences } from "@/lib/preferences";

const NAV = [
  { id: "playback", label: "Playback", icon: Play },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "browsing", label: "Browsing", icon: LayoutGrid },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
];

const Section = ({ title, description, children }) => (
  <section className="border-b border-white/[0.07] pb-8 last:border-b-0 last:pb-0">
    <div className="mb-5">
      <h2 className="text-[20px] font-semibold tracking-[-0.035em] text-white">{title}</h2>
      {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-white/38">{description}</p>}
    </div>
    {children}
  </section>
);

const Row = ({ title, description, children }) => (
  <div className="grid min-h-[64px] gap-4 border-t border-white/[0.055] py-4 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <div className="min-w-0">
      <div className="text-[13px] font-medium text-white/88">{title}</div>
      {description && <div className="mt-1 max-w-xl text-[11px] leading-[17px] text-white/32">{description}</div>}
    </div>
    <div className="sm:justify-self-end">{children}</div>
  </div>
);

const Toggle = ({ value, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    aria-label={label}
    onClick={() => onChange(!value)}
    className={`relative h-7 w-12 rounded-full border transition ${value ? "border-[#ffd400]/45 bg-[#ffd400]" : "border-white/12 bg-white/[0.06]"}`}
  >
    <span className={`absolute top-[3px] h-5 w-5 rounded-full shadow-sm transition ${value ? "left-[25px] bg-black" : "left-[3px] bg-white/75"}`} />
  </button>
);

const Segmented = ({ value, options, onChange, label }) => (
  <div className="inline-flex rounded-[12px] border border-white/[0.08] bg-black/30 p-1" role="radiogroup" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={`min-w-[78px] rounded-[9px] px-3 py-2 text-[11px] font-semibold transition ${value === option.value ? "bg-white/[0.10] text-white shadow-sm" : "text-white/38 hover:text-white/68"}`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const ThemePicker = ({ themes, value, onChange }) => (
  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
    {themes.map((theme) => {
      const active = theme.id === value;
      return (
        <button
          key={theme.id}
          type="button"
          onClick={() => onChange(theme.id)}
          className={`group flex min-h-[66px] items-center gap-2.5 rounded-[14px] border px-3 text-left transition ${active ? "border-white/[0.18] bg-white/[0.07]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"}`}
        >
          <span className="relative h-6 w-6 shrink-0 rounded-full border border-white/[0.16]" style={{ background: theme.accent }}>
            {active && <span className="absolute inset-0 grid place-items-center"><Check className="h-3.5 w-3.5 text-black drop-shadow" /></span>}
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-white/72">{theme.name}</span>
        </button>
      );
    })}
  </div>
);

const EngineChoice = ({ value, onChange }) => (
  <div className="grid gap-2 md:grid-cols-2">
    <button
      type="button"
      onClick={() => onChange("system")}
      className={`relative min-h-[116px] rounded-[16px] border p-4 text-left transition ${value === "system" ? "border-[#ffd400]/45 bg-[#ffd400]/[0.055]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-white">System Player</div>
          <p className="mt-1.5 max-w-sm text-[11px] leading-[17px] text-white/38">Uses the browser or device's native media controls, the same playback model as the SynFlix iOS app, with SynFlix source switching on top.</p>
        </div>
        {value === "system" && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ffd400] text-black"><Check className="h-3.5 w-3.5" /></span>}
      </div>
      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ffd400]/70">Recommended</div>
    </button>

    <button
      type="button"
      onClick={() => onChange("legacy")}
      className={`relative min-h-[116px] rounded-[16px] border p-4 text-left transition ${value === "legacy" ? "border-white/[0.20] bg-white/[0.06]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-white">Legacy SynPlayer</div>
          <p className="mt-1.5 max-w-sm text-[11px] leading-[17px] text-white/38">Keeps the original fully custom SynPlayer interface, advanced menus and its existing playback behavior.</p>
        </div>
        {value === "legacy" && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-black"><Check className="h-3.5 w-3.5" /></span>}
      </div>
      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28">Compatibility</div>
    </button>
  </div>
);

export default function Settings() {
  const [prefs, setPrefs] = useState(() => getPreferences());
  const [active, setActive] = useState("playback");
  const [resetFlash, setResetFlash] = useState(false);
  const playerTheme = useMemo(() => PLAYER_THEMES.find((theme) => theme.id === prefs.playerTheme), [prefs.playerTheme]);

  const set = (key, value) => {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      savePreferences(next);
      return next;
    });
  };

  const reset = () => {
    const next = resetPreferences();
    setPrefs(next);
    setResetFlash(true);
    window.setTimeout(() => setResetFlash(false), 1300);
  };

  return (
    <main className="min-h-screen bg-[#070707] px-4 pb-24 pt-[92px] sm:px-6 md:px-8" data-testid="settings-page">
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-7 flex flex-col gap-4 border-b border-white/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[34px] font-semibold tracking-[-0.055em] text-white md:text-[42px]">Settings</h1>
            <p className="mt-1.5 text-[13px] text-white/36">SynFlix preferences are stored on this device.</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-[12px] border border-white/[0.09] bg-white/[0.025] px-4 text-[12px] font-semibold text-white/52 transition hover:border-white/[0.16] hover:text-white/80 sm:self-auto"
          >
            {resetFlash ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            {resetFlash ? "Reset" : "Reset settings"}
          </button>
        </header>

        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setActive(item.id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-[11px] px-3.5 text-[12px] font-semibold transition ${selected ? "bg-white/[0.10] text-white" : "text-white/38 hover:bg-white/[0.04] hover:text-white/70"}`}>
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-[94px] space-y-1" aria-label="Settings sections">
              {NAV.map((item) => {
                const Icon = item.icon;
                const selected = active === item.id;
                return (
                  <button key={item.id} type="button" onClick={() => setActive(item.id)} className={`flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[12px] font-semibold transition ${selected ? "bg-white/[0.08] text-white" : "text-white/36 hover:bg-white/[0.035] hover:text-white/70"}`}>
                    <Icon className={`h-4 w-4 ${selected ? "text-[#ffd400]" : ""}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-8">
            {active === "playback" && (
              <>
                <Section title="Player" description="Choose how SynFlix plays video. System Player is the new default; Legacy SynPlayer stays available whenever you want it.">
                  <EngineChoice value={prefs.playerEngine} onChange={(value) => set("playerEngine", value)} />
                </Section>

                <Section title="Playback behavior">
                  <Row title="Player accent" description="Colors SynFlix source controls. Device-native transport controls keep the operating system's own appearance.">
                    <div className="flex items-center gap-2 rounded-[10px] border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] font-semibold text-white/55">
                      <span className="h-4 w-4 rounded-full border border-white/15" style={{ background: playerTheme?.accent }} />
                      {playerTheme?.name || "Classic"}
                    </div>
                  </Row>
                  <Row title="Player theme" description="Choose the accent used by the source selector and by Legacy SynPlayer.">
                    <select value={prefs.playerTheme} onChange={(event) => set("playerTheme", event.target.value)} className="h-10 min-w-[150px] rounded-[10px] border border-white/[0.08] bg-[#101010] px-3 text-[12px] font-semibold text-white/72 outline-none focus:border-[#ffd400]/35">
                      {PLAYER_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                    </select>
                  </Row>
                  {prefs.playerEngine === "legacy" && (
                    <>
                      <Row title="Legacy density" description="Controls spacing inside the original SynPlayer menus.">
                        <Segmented label="Legacy player density" value={prefs.playerDensity} onChange={(value) => set("playerDensity", value)} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
                      </Row>
                      <Row title="Legacy material" description="Choose translucent or solid settings panels in the original player.">
                        <Segmented label="Legacy player material" value={prefs.playerGlass} onChange={(value) => set("playerGlass", value)} options={[{ value: "glass", label: "Glass" }, { value: "solid", label: "Solid" }]} />
                      </Row>
                    </>
                  )}
                </Section>
              </>
            )}

            {active === "appearance" && (
              <>
                <Section title="Color theme" description="Yellow stays the SynFlix default, with the additional themes available across the client.">
                  <ThemePicker themes={SITE_THEMES} value={prefs.siteTheme} onChange={(value) => set("siteTheme", value)} />
                </Section>
                <Section title="Appearance mode">
                  <Row title="Interface" description="Choose a dark, light, or device-matched appearance.">
                    <Segmented label="Appearance mode" value={prefs.siteMode} onChange={(value) => set("siteMode", value)} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
                  </Row>
                  <Row title="Ambient color" description="Adds a restrained theme tint behind selected browsing surfaces.">
                    <Toggle label="Ambient color" value={prefs.siteAmbient} onChange={(value) => set("siteAmbient", value)} />
                  </Row>
                </Section>
              </>
            )}

            {active === "browsing" && (
              <Section title="Browsing experience" description="Keep the catalog dense and readable without changing playback.">
                <Row title="Content density" description="Compact fits more artwork on screen.">
                  <Segmented label="Content density" value={prefs.siteDensity} onChange={(value) => set("siteDensity", value)} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
                </Row>
                <Row title="Card corners" description="Adjust poster and surface geometry.">
                  <Segmented label="Card corners" value={prefs.siteCorners} onChange={(value) => set("siteCorners", value)} options={[{ value: "round", label: "Round" }, { value: "soft", label: "Soft" }, { value: "square", label: "Square" }]} />
                </Row>
                <Row title="Row descriptions" description="Show the secondary line beneath supported shelf headings.">
                  <Toggle label="Row descriptions" value={prefs.showRowSubtitles} onChange={(value) => set("showRowSubtitles", value)} />
                </Row>
              </Section>
            )}

            {active === "accessibility" && (
              <Section title="Accessibility" description="Motion, contrast and scale controls apply across SynFlix without changing your theme.">
                <Row title="Motion" description="Reduced motion minimizes decorative movement and transitions.">
                  <Segmented label="Site motion" value={prefs.siteMotion} onChange={(value) => set("siteMotion", value)} options={[{ value: "full", label: "Full" }, { value: "reduced", label: "Reduced" }]} />
                </Row>
                <Row title="Contrast" description="Increase separation between text and dark surfaces.">
                  <Segmented label="Site contrast" value={prefs.siteContrast} onChange={(value) => set("siteContrast", value)} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
                </Row>
                <Row title="Interface scale" description="Increase control and navigation text without enlarging artwork.">
                  <Segmented label="Interface scale" value={prefs.siteScale} onChange={(value) => set("siteScale", value)} options={[{ value: "normal", label: "Normal" }, { value: "large", label: "Large" }]} />
                </Row>
                <Row title="Legacy player contrast" description="Applies only when Legacy SynPlayer is selected.">
                  <Segmented label="Legacy player contrast" value={prefs.playerContrast} onChange={(value) => set("playerContrast", value)} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
                </Row>
              </Section>
            )}

            <div className="flex items-center gap-3 border-t border-white/[0.07] pt-6 text-[10px] text-white/25">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Changes apply immediately and stay on this device.</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
