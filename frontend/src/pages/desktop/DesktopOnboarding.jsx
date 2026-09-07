import { useMemo, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { createDesktopAccount, hasDesktopAccount, signInDesktopAccount } from "@/lib/desktopAccount";
import { getDesktopProfiles, saveDesktopProfile, setActiveDesktopProfile } from "@/lib/desktopProfile";

export default function DesktopOnboarding() {
  const existingAccount = useMemo(() => hasDesktopAccount(), []);
  const [mode, setMode] = useState(existingAccount ? "signin" : "create");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const creating = mode === "create";

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (creating && password !== confirm) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      let account;
      if (creating) {
        account = await createDesktopAccount({ displayName, email, password });
        const profiles = getDesktopProfiles();
        const primary = profiles[0];
        const saved = saveDesktopProfile({
          ...primary,
          id: primary?.id || "main",
          name: account.displayName,
          avatar: primary?.avatar || "spark",
        });
        setActiveDesktopProfile(saved.id);
      } else {
        account = await signInDesktopAccount({ email, password });
      }
      window.location.replace("/");
    } catch (err) {
      setError(err?.message || "SynFlix could not complete sign-in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="desktop-onboarding" aria-labelledby="desktop-onboarding-title">
      <section className="desktop-onboarding-story" aria-hidden="true">
        <div className="desktop-onboarding-brand">
          <img src="/synflix-logo.webp" alt="" />
          <span>SynFlix</span>
        </div>
        <div className="desktop-onboarding-story-copy">
          <span className="desktop-onboarding-kicker">Your cinema, one place</span>
          <h1>Settle in.<br />Everything else is ready.</h1>
          <p>Profiles, watch history, recommendations and add-ons stay organized in a desktop experience built for the big screen.</p>
          <div className="desktop-onboarding-feature-row">
            <span><ShieldCheck /> Device-first privacy</span>
            <span><UserRound /> Separate profiles</span>
          </div>
        </div>
        <div className="desktop-onboarding-glow" />
      </section>

      <section className="desktop-onboarding-panel">
        <div className="desktop-onboarding-card">
          <div className="desktop-onboarding-mobile-brand">
            <img src="/synflix-logo.webp" alt="" />
            <strong>SynFlix</strong>
          </div>
          <header>
            <span className="desktop-onboarding-step">{creating ? "Create your SynFlix ID" : "Welcome back"}</span>
            <h2 id="desktop-onboarding-title">{creating ? "Create your account" : "Sign in to SynFlix"}</h2>
            <p>{creating ? "One account for this device. You can add profiles after setup." : "Continue with the SynFlix ID saved on this device."}</p>
          </header>

          <form onSubmit={submit} className="desktop-onboarding-form">
            {creating ? (
              <label>
                <span>Display name</span>
                <div className="desktop-onboarding-input"><UserRound aria-hidden="true" /><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" placeholder="What should we call you?" minLength={2} maxLength={40} required /></div>
              </label>
            ) : null}

            <label>
              <span>Email</span>
              <div className="desktop-onboarding-input"><Mail aria-hidden="true" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div>
            </label>

            <label>
              <span>Password</span>
              <div className="desktop-onboarding-input"><LockKeyhole aria-hidden="true" /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} placeholder={creating ? "At least 8 characters" : "Your password"} minLength={8} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div>
            </label>

            {creating ? (
              <label>
                <span>Confirm password</span>
                <div className="desktop-onboarding-input"><LockKeyhole aria-hidden="true" /><input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password" minLength={8} required /></div>
              </label>
            ) : null}

            {error ? <div className="desktop-onboarding-error" role="alert">{error}</div> : null}

            <button className="desktop-onboarding-submit" type="submit" disabled={busy}>
              <span>{busy ? "Just a moment…" : creating ? "Create account" : "Sign in"}</span>
              {!busy ? <ArrowRight aria-hidden="true" /> : <span className="desktop-onboarding-spinner" aria-hidden="true" />}
            </button>
          </form>

          <div className="desktop-onboarding-switch">
            <span>{creating ? "Already set up on this device?" : "Need a new local account?"}</span>
            <button type="button" onClick={() => { setMode(creating ? "signin" : "create"); setError(""); }}>
              {creating ? "Sign in" : "Create account"}
            </button>
          </div>

          <p className="desktop-onboarding-privacy">This desktop build stores your SynFlix ID and password verifier locally on this device. Your password is never saved in plain text or sent to SynFlix.</p>
        </div>
      </section>
    </main>
  );
}
