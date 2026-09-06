import { useEffect, useState } from "react";
import { MonitorCog, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { getActiveDesktopProfile, getDesktopPreferences, saveDesktopPreferences } from "@/lib/desktopProfile";

const GENRES = ["action", "adventure", "animation", "comedy", "family", "fantasy", "horror", "mystery", "romance", "scifi", "thriller"];

export default function DesktopSettings() {
  const [profile, setProfile] = useState(() => getActiveDesktopProfile());
  const [prefs, setPrefs] = useState(() => getDesktopPreferences());

  useEffect(() => {
    const sync = () => { setProfile(getActiveDesktopProfile()); setPrefs(getDesktopPreferences()); };
    window.addEventListener("synflix-desktop-profile", sync);
    return () => window.removeEventListener("synflix-desktop-profile", sync);
  }, []);

  const update = (patch) => setPrefs(saveDesktopPreferences(patch));
  const toggleGenre = (genre) => {
    const current = new Set(prefs.favoriteGenres || []);
    if (current.has(genre)) current.delete(genre); else if (current.size < 5) current.add(genre);
    update({ favoriteGenres: [...current] });
  };

  return (
    <div className="desktop-page desktop-settings-page" data-testid="desktop-settings-page">
      <div className="desktop-page-heading"><div><span className="desktop-eyebrow"><MonitorCog aria-hidden="true" /> Desktop preferences</span><h1>Settings</h1><p>Personalize SynFlix for {profile?.name || "this profile"}.</p></div></div>

      <div className="desktop-settings-layout">
        <section className="desktop-settings-card desktop-settings-profile">
          <div className="desktop-settings-icon"><UserRound aria-hidden="true" /></div>
          <div className="desktop-settings-copy"><h2>Profile</h2><p>Switch, add or edit profiles. Libraries and progress stay separate.</p></div>
          <Link to="/profiles" className="desktop-soft-button">Manage profiles</Link>
        </section>

        <section className="desktop-settings-card desktop-settings-wide">
          <div className="desktop-settings-icon"><Sparkles aria-hidden="true" /></div>
          <div className="desktop-settings-copy"><h2>Tune recommendations</h2><p>Pick up to five genres. SynFlix uses these to shape the desktop Home page.</p></div>
          <div className="desktop-preference-genres">{GENRES.map((genre) => <button type="button" key={genre} data-active={prefs.favoriteGenres?.includes(genre)} onClick={() => toggleGenre(genre)}>{genre === "scifi" ? "Sci‑Fi" : genre.charAt(0).toUpperCase() + genre.slice(1)}</button>)}</div>
        </section>

        <section className="desktop-settings-card desktop-settings-wide desktop-toggle-list">
          <div className="desktop-settings-copy"><h2>Playback & interface</h2><p>Comfort settings for the desktop experience.</p></div>
          <label className="desktop-setting-row"><span><strong>Autoplay previews</strong><small>Allow featured artwork and previews to move automatically.</small></span><input type="checkbox" checked={Boolean(prefs.autoplayPreviews)} onChange={(e) => update({ autoplayPreviews: e.target.checked })} /></label>
          <label className="desktop-setting-row"><span><strong>Compact library</strong><small>Fit more posters on screen in your Library.</small></span><input type="checkbox" checked={Boolean(prefs.compactLibrary)} onChange={(e) => update({ compactLibrary: e.target.checked })} /></label>
          <label className="desktop-setting-row"><span><strong>Reduce artwork motion</strong><small>Keep navigation animation while reducing moving artwork.</small></span><input type="checkbox" checked={Boolean(prefs.reduceArtworkMotion)} onChange={(e) => update({ reduceArtworkMotion: e.target.checked })} /></label>
        </section>
      </div>
    </div>
  );
}
