import { useMemo, useState } from "react";
import { Accessibility, Check, CircleGauge, Contrast, Eye, Gauge, Layers3, LayoutGrid, MonitorCog, Palette, PlayCircle, RotateCcw, Sparkles, Square, Text, WandSparkles } from "lucide-react";
import { PLAYER_THEMES, SITE_THEMES, getPreferences, resetPreferences, savePreferences } from "@/lib/preferences";

const TABS = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "site", label: "Site", icon: Palette },
  { id: "browsing", label: "Browsing", icon: Layers3 },
  { id: "player", label: "Player", icon: PlayCircle },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
];

const SettingSection = ({ eyebrow, title, description, children }) => (
  <section className="rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-7">
    <div className="mb-6 max-w-2xl">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/65">{eyebrow}</div>
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-white/38">{description}</p>}
    </div>
    {children}
  </section>
);

const ThemeGrid = ({ themes, value, onChange }) => (
  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    {themes.map((theme) => {
      const active = value === theme.id;
      return (
        <button
          key={theme.id}
          type="button"
          onClick={() => onChange(theme.id)}
          className={`group relative min-h-[118px] overflow-hidden rounded-[20px] border p-4 text-left transition duration-200 ${active ? "border-[#ffd400]/55 bg-[#ffd400]/[0.08]" : "border-white/[0.07] bg-black/20 hover:border-[#ffd400]/25 hover:bg-white/[0.035]"}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="h-7 w-7 rounded-full border border-white/15 shadow-[0_4px_14px_rgba(0,0,0,.25)]" style={{ background: theme.accent }} />
            {active && <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ffd400] text-black"><Check className="h-3.5 w-3.5" /></span>}
          </div>
          <div className="text-[13px] font-semibold text-white/88">{theme.name}</div>
          <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/30">{theme.description}</div>
        </button>
      );
    })}
  </div>
);

const Segmented = ({ value, options, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`rounded-full border px-3.5 py-2 text-xs font-medium transition ${value === option.value ? "border-[#ffd400] bg-[#ffd400] text-black" : "border-white/[0.08] bg-white/[0.025] text-white/48 hover:border-[#ffd400]/25 hover:text-[#ffd400]"}`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const Toggle = ({ value, onChange }) => (
  <button type="button" onClick={() => onChange(!value)} className={`relative h-7 w-12 rounded-full border transition ${value ? "border-[#ffd400]/50 bg-[#ffd400]" : "border-white/10 bg-white/[0.06]"}`}>
    <span className={`absolute top-1 h-5 w-5 rounded-full transition ${value ? "left-[25px] bg-black" : "left-1 bg-white/75"}`} />
  </button>
);

const SettingRow = ({ icon: Icon, title, description, children }) => (
  <div className="grid gap-4 border-t border-white/[0.055] py-5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <div className="flex gap-3.5">
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[#ffd400]/70"><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-sm font-medium text-white/82">{title}</div>
        {description && <div className="mt-1 max-w-2xl text-xs leading-5 text-white/30">{description}</div>}
      </div>
    </div>
    <div className="sm:justify-self-end">{children}</div>
  </div>
);

export default function Settings() {
  const [prefs, setPrefs] = useState(() => getPreferences());
  const [resetFlash, setResetFlash] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const siteTheme = useMemo(() => SITE_THEMES.find((theme) => theme.id === prefs.siteTheme), [prefs.siteTheme]);
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
    window.setTimeout(() => setResetFlash(false), 1400);
  };

  const show = (tab) => activeTab === "all" || activeTab === tab;

  return (
    <main className="min-h-screen bg-[#070707] px-5 pb-20 pt-[104px] md:px-8" data-testid="settings-page">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/70"><MonitorCog className="h-3.5 w-3.5" /> Personalize SynFlix</div>
            <h1 className="text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">Settings</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/40 md:text-[15px]">Tune the entire SynFlix interface and SynPlayer independently. Every change is saved on this device and applies instantly.</p>
          </div>
          <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/30">Current look</div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white/84">Site · {siteTheme?.name}</div>
                <div className="mt-1 text-xs text-white/30">Player · {playerTheme?.name}</div>
              </div>
              <div className="flex -space-x-2">
                <span className="h-9 w-9 rounded-full border-4 border-[#0b0b0b]" style={{ background: siteTheme?.accent }} />
                <span className="h-9 w-9 rounded-full border-4 border-[#0b0b0b]" style={{ background: playerTheme?.accent }} />
              </div>
            </div>
          </div>
        </div>

        <div className="scrollbar-none mb-6 flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-white/[0.07] bg-black/30 p-1.5 sm:w-fit" role="tablist" aria-label="Settings categories">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-medium transition ${active ? "bg-[#ffd400] text-black shadow-[0_5px_18px_rgba(0,0,0,.2)]" : "text-white/42 hover:bg-white/[0.045] hover:text-white/78"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          {show("site") && (
            <SettingSection eyebrow="Site appearance" title="Site themes" description="These recolor the SynFlix shell, buttons, focus states, cards, accents, backgrounds, and even tint the brand mark to match.">
              <ThemeGrid themes={SITE_THEMES} value={prefs.siteTheme} onChange={(value) => set("siteTheme", value)} />
            </SettingSection>
          )}

          {show("browsing") && (
            <SettingSection eyebrow="Browsing" title="Layout & browsing" description="Change how dense and expressive the movie browsing experience feels without touching playback.">
              <SettingRow icon={Layers3} title="Content density" description="Compact fits more films on screen; comfortable keeps the larger cinematic spacing."><Segmented value={prefs.siteDensity} onChange={(value) => set("siteDensity", value)} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></SettingRow>
              <SettingRow icon={Square} title="Corner style" description="Adjust card geometry across the SynFlix interface."><Segmented value={prefs.siteCorners} onChange={(value) => set("siteCorners", value)} options={[{ value: "round", label: "Round" }, { value: "soft", label: "Soft" }, { value: "square", label: "Square" }]} /></SettingRow>
              <SettingRow icon={Sparkles} title="Ambient color" description="Adds a very subtle theme-colored wash to dark backgrounds."><Toggle value={prefs.siteAmbient} onChange={(value) => set("siteAmbient", value)} /></SettingRow>
              <SettingRow icon={Text} title="Row descriptions" description="Show the smaller descriptive line under supported content-row headings."><Toggle value={prefs.showRowSubtitles} onChange={(value) => set("showRowSubtitles", value)} /></SettingRow>
            </SettingSection>
          )}

          {show("player") && (
            <>
              <SettingSection eyebrow="SynPlayer" title="Player themes" description="Player themes are completely separate from the site theme. Pick Purple and player sliders, active controls, server highlights, focus states, and settings chrome become purple while SynFlix can stay any other color.">
                <ThemeGrid themes={PLAYER_THEMES} value={prefs.playerTheme} onChange={(value) => set("playerTheme", value)} />
              </SettingSection>

              <SettingSection eyebrow="Playback appearance" title="Player interface" description="These settings only affect SynPlayer. They do not change movie discovery pages.">
                <SettingRow icon={Square} title="Player corners" description="Choose the outer player and popup geometry."><Segmented value={prefs.playerCorners} onChange={(value) => set("playerCorners", value)} options={[{ value: "round", label: "Round" }, { value: "soft", label: "Soft" }, { value: "square", label: "Square" }]} /></SettingRow>
                <SettingRow icon={Layers3} title="Settings material" description="Glass keeps the translucent Peak-style panel; solid removes the blur for a flatter look."><Segmented value={prefs.playerGlass} onChange={(value) => set("playerGlass", value)} options={[{ value: "glass", label: "Glass" }, { value: "solid", label: "Solid" }]} /></SettingRow>
                <SettingRow icon={Gauge} title="Player density" description="Compact shortens player settings rows and reduces visual padding."><Segmented value={prefs.playerDensity} onChange={(value) => set("playerDensity", value)} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></SettingRow>
                <SettingRow icon={CircleGauge} title="Accent strength" description="Controls how strongly the selected player color appears on interactive chrome."><Segmented value={prefs.playerAccentStrength} onChange={(value) => set("playerAccentStrength", value)} options={[{ value: "subtle", label: "Subtle" }, { value: "normal", label: "Normal" }, { value: "bold", label: "Bold" }]} /></SettingRow>
                <SettingRow icon={Eye} title="SynPlayer label" description="Show or hide the small SynPlayer brand label inside playback controls."><Toggle value={prefs.playerTitle} onChange={(value) => set("playerTitle", value)} /></SettingRow>
              </SettingSection>
            </>
          )}

          {show("accessibility") && (
            <SettingSection eyebrow="Accessibility" title="Motion, contrast & scale" description="Keep SynFlix and SynPlayer comfortable to use without changing your chosen colors or layout style.">
              <SettingRow icon={WandSparkles} title="Site motion" description="Reduced motion disables most card movement, transitions, and decorative animation."><Segmented value={prefs.siteMotion} onChange={(value) => set("siteMotion", value)} options={[{ value: "full", label: "Full" }, { value: "reduced", label: "Reduced" }]} /></SettingRow>
              <SettingRow icon={Contrast} title="Site contrast" description="High contrast strengthens text and surface separation."><Segmented value={prefs.siteContrast} onChange={(value) => set("siteContrast", value)} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} /></SettingRow>
              <SettingRow icon={Eye} title="Interface scale" description="Slightly enlarges navigation and control text while keeping film artwork intact."><Segmented value={prefs.siteScale} onChange={(value) => set("siteScale", value)} options={[{ value: "normal", label: "Normal" }, { value: "large", label: "Large" }]} /></SettingRow>
              <SettingRow icon={Contrast} title="Player contrast" description="Boosts separation for darker scenes and translucent controls."><Segmented value={prefs.playerContrast} onChange={(value) => set("playerContrast", value)} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} /></SettingRow>
              <SettingRow icon={WandSparkles} title="Player motion" description="Reduced motion removes popup animations and most control transitions."><Segmented value={prefs.playerMotion} onChange={(value) => set("playerMotion", value)} options={[{ value: "full", label: "Full" }, { value: "reduced", label: "Reduced" }]} /></SettingRow>
            </SettingSection>
          )}

          <section className="flex flex-col gap-4 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <div className="text-sm font-semibold text-white/82">Reset appearance</div>
              <div className="mt-1 text-xs leading-5 text-white/30">Return site and player appearance to the original SynFlix + Classic player defaults.</div>
            </div>
            <button onClick={reset} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-5 text-sm font-medium text-white/60 transition hover:border-[#ffd400]/30 hover:text-[#ffd400]">
              {resetFlash ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}{resetFlash ? "Reset complete" : "Reset all"}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
