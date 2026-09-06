import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DESKTOP_AVATARS, deleteDesktopProfile, getActiveDesktopProfileId, getDesktopProfiles, saveDesktopProfile, setActiveDesktopProfile } from "@/lib/desktopProfile";

export default function DesktopProfiles() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(() => getDesktopProfiles());
  const [active, setActive] = useState(() => getActiveDesktopProfileId());
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("spark");

  const canAdd = profiles.length < 6;
  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === editing), [profiles, editing]);

  const refresh = () => { setProfiles(getDesktopProfiles()); setActive(getActiveDesktopProfileId()); };
  const choose = (id) => { setActiveDesktopProfile(id); refresh(); navigate("/"); };
  const startCreate = () => { setEditing("new"); setName(""); setAvatar("spark"); };
  const startEdit = (profile) => { setEditing(profile.id); setName(profile.name); setAvatar(profile.avatar || "spark"); };
  const save = (event) => {
    event.preventDefault();
    const existing = editing !== "new" ? selectedProfile : null;
    const saved = saveDesktopProfile({ ...existing, id: existing?.id, name, avatar });
    if (editing === "new") setActiveDesktopProfile(saved.id);
    setEditing(null);
    refresh();
  };
  const remove = (id) => { if (deleteDesktopProfile(id)) { setEditing(null); refresh(); } };

  return (
    <div className="desktop-page desktop-profiles-page" data-testid="desktop-profiles-page">
      <div className="desktop-page-heading"><div><span className="desktop-eyebrow"><UserRound aria-hidden="true" /> Personal profiles</span><h1>Who’s watching?</h1><p>Each profile keeps its own watchlist, progress and recommendations.</p></div></div>

      <div className="desktop-profile-grid">
        {profiles.map((profile) => (
          <div className="desktop-profile-card" key={profile.id} data-active={profile.id === active}>
            <button type="button" className="desktop-profile-main" onClick={() => choose(profile.id)}>
              <span className="desktop-avatar desktop-avatar--large" data-avatar={profile.avatar || "spark"}><span>{profile.name?.slice(0, 1)?.toUpperCase()}</span></span>
              <strong>{profile.name}</strong>
              <small>{profile.id === active ? "Active profile" : "Switch profile"}</small>
              {profile.id === active ? <span className="desktop-profile-check"><Check aria-hidden="true" /></span> : null}
            </button>
            <button type="button" className="desktop-profile-edit" onClick={() => startEdit(profile)} aria-label={`Edit ${profile.name}`}><Pencil aria-hidden="true" /></button>
          </div>
        ))}
        {canAdd ? <button type="button" className="desktop-profile-add" onClick={startCreate}><span><Plus aria-hidden="true" /></span><strong>Add profile</strong><small>Up to 6 profiles</small></button> : null}
      </div>

      {editing ? (
        <div className="desktop-profile-editor-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="desktop-profile-editor" onSubmit={save}>
            <div><span className="desktop-eyebrow">{editing === "new" ? "New profile" : "Edit profile"}</span><h2>{editing === "new" ? "Create a profile" : `Edit ${selectedProfile?.name || "profile"}`}</h2></div>
            <label className="desktop-form-field"><span>Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Profile name" required /></label>
            <fieldset className="desktop-avatar-picker"><legend>Avatar</legend><div>{DESKTOP_AVATARS.map((item) => <button type="button" key={item.id} data-active={avatar === item.id} onClick={() => setAvatar(item.id)} aria-label={item.label}><span className="desktop-avatar" data-avatar={item.id}><span>{(name || "S").slice(0, 1).toUpperCase()}</span></span></button>)}</div></fieldset>
            <div className="desktop-editor-actions">
              {editing !== "new" && profiles.length > 1 ? <button type="button" className="desktop-danger-button" onClick={() => remove(editing)}><Trash2 aria-hidden="true" /> Delete</button> : <span />}
              <div><button type="button" className="desktop-secondary-button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="desktop-primary-button">Save profile</button></div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
