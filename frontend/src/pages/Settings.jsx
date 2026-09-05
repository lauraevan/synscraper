import { useMemo, useState } from "react";
import {
  Accessibility,
  Check,
  CircleGauge,
  Contrast,
  Eye,
  Gauge,
  Layers3,
  LayoutGrid,
  Laptop,
  MonitorCog,
  Moon,
  Palette,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  Text,
  WandSparkles,
} from "lucide-react";
import { PLAYER_THEMES, SITE_THEMES, getPreferences, resetPreferences, savePreferences } from "@/lib/preferences";

const CATEGORIES = [
  { id: "all", label: "All settings", icon: LayoutGrid, description: "Everything in one place" },
  { id: "site", label: "Appearance", icon: Palette, description: "Mode, colors and themes" },
  { id: "browsing", label: "Browsing", icon: Layers3, description: "Cards, rows and layout" },
  { id: "player", label: "Player", icon: PlayCircle, description: "SynPlayer look and feel" },
  { id: "accessibility", label: "Accessibility", icon: Accessibility, description: "Motion, contrast and scale" },
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
  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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

const AppearanceModes = ({ value, onChange }) => {
  const options = [
    { value: "dark", label: "Dark", description: "Cinema-black surfaces", icon: Moon },
    { value: "light", label: "Light", description: "Bright paper-like surfaces", icon: Sun },
    { value: "system", label: "System", description: "Follow this device", icon: Laptop },
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex min-h-[92px] items-center gap-3 rounded-[20px] border p-4 text-left transition ${active ? "border-[#ffd400]/55 bg-[#ffd400]/[0.08]" : "border-white/[0.07] bg-black/20 hover:border-[#ffd400]/25 hover:bg-white/[0.035]"}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${active ? "bg-[#ffd400] text-black" : "bg-white/[0.05] text-white/55"}`}><Icon className="h-4.5 w-4.5" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white/86">{option.label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-white/30">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

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
  const [activeSection, setActiveSection] = useState("all");
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

  const show = (section) => activeSection === "all" || activeSection === section;
  const activeLabel = CATEGORIES.find((item) => item.id === activeSection)?.label || "All settings";

  return (
    <main className="min-h-screen bg-[#070707] px-5 pb-20 pt-[104px] md:px-8" data-testid="settings-page">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd400]/70"><MonitorCog className="h-3.5 w-3.5" /> Personalize SynFlix</div>
          <h1 className="text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">Settings</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/40 md:text-[15px]">Tune SynFlix and SynPlayer independently. Appearance, themes and playback preferences are saved on this device and apply instantly.</p>
        </div>

        <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Settings categories">
          {CATEGORIES.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-medium transition ${active ? "border-[#ffd400] bg-[#ffd400] text-black" : "border-white/[0.08] bg-white/[0.025] text-white/48 hover:border-[#ffd400]/25 hover:text-[#ffd400]"}`}>
                <Icon className="h-3.5 w-3.5" />{item.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
          <aside className="sticky top-[88px] hidden overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-2.5 lg:block">
            <div className="px-3 pb-3 pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">Settings</div>
              <div className="mt-1 text-sm font-semibold text-white/82">{activeLabel}</div>
            </div>

            <nav className="space-y-1" aria-label="Settings sidebar">
              {CATEGORIES.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-active={active ? "true" : "false"}
                    onClick={() => setActiveSection(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition ${active ? "bg-[#ffd400] text-black" : "text-white/52 hover:bg-white/[0.045] hover:text-white/82"}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${active ? "bg-black/10" : "bg-white/[0.035]"}`}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold">{item.label}</span>
                      <span className={`mt-0.5 block truncate text-[10px] ${active ? "text-black/55" : "text-white/24"}`}>{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mx-2 my-3 h-px bg-white/[0.06]" />
            <div className="rounded-[18px] border border-white/[0.06] bg-black/15 p-3.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">Current look</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex -space-x-2">
                  <span className="h-8 w-8 rounded-full border-[3px] border-[#0b0b0b]" style={{ background: siteTheme?.accent }} />
                  <span className="h-8 w-8 rounded-full border-[3px] border-[#0b0b0b]" style={{ background: playerTheme?.accent }} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-white/72">{siteTheme?.name} · {prefs.siteMode}</div>
                  <div className="mt-0.5 truncate text-[10px] text-white/25">Player · {playerTheme?.name}</div>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            {show("site") && (
              <>
                <SettingSection eyebrow="Appearance" title="Light & dark mode" description="Switch the SynFlix browsing interface between its cinematic dark look and a bright light interface. System follows your device automatically.">
                  <AppearanceModes value={prefs.siteMode} onChange={(value) => set("siteMode", value)} />
                </SettingSection>

                <SettingSection eyebrow="Site appearance" title="Site themes" description="Themes change the SynFlix accent, surfaces, controls, cards and brand treatment. They work in both light and dark mode.">
                  <ThemeGrid themes={SITE_THEMES} value={prefs.siteTheme} onChange={(value) => set("siteTheme", value)} />
                </SettingSection>
              </>
            )}

            {show("browsing") && (
              <SettingSection eyebrow="Browsing" title="Layout & browsing" description="Change how dense and expressive the movie browsing experience feels without touching playback.">
                <SettingRow icon={Layers3} title="Content density" description="Compact fits more films on screen; comfortable keeps the larger cinematic spacing."><Segmented value={prefs.siteDensity} onChange={(value) => set("siteDensity", value)} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></SettingRow>
                <SettingRow icon={Square} title="Corner style" description="Adjust card geometry across the SynFlix interface."><Segmented value={prefs.siteCorners} onChange={(value) => set("siteCorners", value)} options={[{ value: "round", label: "Round" }, { value: "soft", label: "Soft" }, { value: "square", label: "Square" }]} /></SettingRow>
                <SettingRow icon={Sparkles} title="Ambient color" description="Adds a subtle theme-colored wash to page backgrounds."><Toggle value={prefs.siteAmbient} onChange={(value) => set("siteAmbient", value)} /></SettingRow>
                <SettingRow icon={Text} title="Row descriptions" description="Show the smaller descriptive line under supported content-row headings."><Toggle value={prefs.showRowSubtitles} onChange={(value) => set("showRowSubtitles", value)} /></SettingRow>
              </SettingSection>
            )}

            {show("player") && (
              <>
                <SettingSection eyebrow="SynPlayer" title="Player themes" description="Player themes stay completely separate from the site. Pick Purple here and SynPlayer controls, sliders, highlights and settings chrome become purple regardless of your SynFlix theme.">
                  <ThemeGrid themes={PLAYER_THEMES} value={prefs.playerTheme} onChange={(value) => set("playerTheme", value)} />
                </SettingSection>

                <SettingSection eyebrow="Playback appearance" title="Player interface" description="These settings only affect SynPlayer and do not change discovery pages.">
                  <SettingRow icon={Square} title="Player corners" description="Choose the outer player and popup geometry."><Segmented value={prefs.playerCorners} onChange={(value) => set("playerCorners", value)} options={[{ value: "round", label: "Round" }, { value: "soft", label: "Soft" }, { value: "square", label: "Square" }]} /></SettingRow>
                  <SettingRow icon={Layers3} title="Settings material" description="Glass keeps the translucent Peak-style panel; solid removes blur for a flatter look."><Segmented value={prefs.playerGlass} onChange={(value) => set("playerGlass", value)} options={[{ value: "glass", label: "Glass" }, { value: "solid", label: "Solid" }]} /></SettingRow>
                  <SettingRow icon={Gauge} title="Player density" description="Compact shortens player settings rows and reduces visual padding."><Segmented value={prefs.playerDensity} onChange={(value) => set("playerDensity", value)} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></SettingRow>
                  <SettingRow icon={CircleGauge} title="Accent strength" description="Controls how strongly the selected player color appears on interactive chrome."><Segmented value={prefs.playerAccentStrength} onChange={(value) => set("playerAccentStrength", value)} options={[{ value: "subtle", label: "Subtle" }, { value: "normal", label: "Normal" }, { value: "bold", label: "Bold" }]} /></SettingRow>
                  <SettingRow icon={Eye} title="SynPlayer label" description="Show or hide the small SynPlayer brand label inside playback controls."><Toggle value={prefs.playerTitle} onChange={(value) => set("playerTitle", value)} /></SettingRow>
                </SettingSection>
              </>
            )}

            {show("accessibility") && (
              <SettingSection eyebrow="Accessibility" title="Motion, contrast & scale" description="Keep SynFlix and SynPlayer comfortable to use without changing your chosen colors or layout style.">
                <SettingRow icon={WandSparkles} title="Site motion" description="Reduced motion disables most card movement, transitions and decorative animation."><Segmented value={prefs.siteMotion} onChange={(value) => set("siteMotion", value)} options={[{ value: "full", label: "Full" }, { value: "reduced", label: "Reduced" }]} /></SettingRow>
                <SettingRow icon={Contrast} title="Site contrast" description="High contrast strengthens text and surface separation."><Segmented value={prefs.siteContrast} onChange={(value) => set("siteContrast", value)} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} /></SettingRow>
                <SettingRow icon={Eye} title="Interface scale" description="Slightly enlarges navigation and control text while keeping film artwork intact."><Segmented value={prefs.siteScale} onChange={(value) => set("siteScale", value)} options={[{ value: "normal", label: "Normal" }, { value: "large", label: "Large" }]} /></SettingRow>
                <SettingRow icon={Contrast} title="Player contrast" description="Boosts separation for darker scenes and translucent controls."><Segmented value={prefs.playerContrast} onChange={(value) => set("playerContrast", value)} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} /></SettingRow>
                <SettingRow icon={WandSparkles} title="Player motion" description="Reduced motion removes popup animations and most control transitions."><Segmented value={prefs.playerMotion} onChange={(value) => set("playerMotion", value)} options={[{ value: "full", label: "Full" }, { value: "reduced", label: "Reduced" }]} /></SettingRow>
              </SettingSection>
            )}

            <section className="flex flex-col gap-4 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <div className="text-sm font-semibold text-white/82">Reset appearance</div>
                <div className="mt-1 text-xs leading-5 text-white/30">Return SynFlix to dark mode, the original yellow site theme and Classic SynPlayer defaults.</div>
              </div>
              <button onClick={reset} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-5 text-sm font-medium text-white/60 transition hover:border-[#ffd400]/30 hover:text-[#ffd400]">
                {resetFlash ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}{resetFlash ? "Reset complete" : "Reset all"}
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
