import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, MoreVertical, PlusSquare, Share, X } from "lucide-react";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

export function InstallSynFlix() {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(isStandaloneMode());
  const [installReady, setInstallReady] = useState(Boolean(typeof window !== "undefined" && window.__synflixInstallPrompt));

  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }, []);

  useEffect(() => {
    const onReady = () => setInstallReady(Boolean(window.__synflixInstallPrompt));
    const onInstalled = () => {
      setInstalled(true);
      setInstallReady(false);
      setOpen(false);
    };
    window.addEventListener("synflix-install-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("synflix-install-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const startInstall = async () => {
    if (installed) return;
    const prompt = window.__synflixInstallPrompt;
    if (prompt) {
      try {
        await prompt.prompt();
        const result = await prompt.userChoice;
        if (result?.outcome === "accepted") {
          window.__synflixInstallPrompt = null;
          setInstallReady(false);
        }
      } catch {
        setOpen(true);
      }
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={startInstall}
        className="mt-2 flex w-full items-center gap-3 rounded-[12px] border border-[#ffd400]/15 bg-[#ffd400]/[0.055] px-3 py-3 text-left text-sm text-white/72 transition active:scale-[0.99]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[#ffd400]/20 bg-black">
          <img src="/synflix-logo.webp" alt="" className="h-8 w-8 object-contain" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-white/90">{installed ? "SynFlix is installed" : "Add SynFlix to Home Screen"}</span>
          <span className="mt-0.5 block text-[10px] leading-4 text-white/32">
            {installed ? "Running like an app" : installReady ? "Install the app version with the SynFlix logo" : "Opens standalone like an app"}
          </span>
        </span>
        {installed ? <CheckCircle2 className="h-4 w-4 text-[#ffd400]" /> : <Download className="h-4 w-4 text-[#ffd400]" />}
      </button>

      {open && !installed && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:items-center" role="dialog" aria-modal="true" aria-label="Install SynFlix">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close install instructions" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-[24px] border border-white/[0.12] bg-[#0b0e13] p-5 shadow-[0_28px_90px_rgba(0,0,0,.7)]">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-[#ffd400]/20 bg-black">
                <img src="/synflix-logo.webp" alt="SynFlix" className="h-11 w-11 object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-[-0.03em] text-white">Install SynFlix</h2>
                <p className="mt-1 text-xs leading-5 text-white/42">This puts the SynFlix logo on your home screen and launches the site in its own app-style window.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-white/55" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>

            {isIOS ? (
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.025] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/[0.05] text-white/70"><Share className="h-4 w-4" /></span>
                  <span className="text-xs text-white/62"><strong className="font-semibold text-white/90">1.</strong> In Safari, tap the Share button.</span>
                </div>
                <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.025] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/[0.05] text-white/70"><PlusSquare className="h-4 w-4" /></span>
                  <span className="text-xs text-white/62"><strong className="font-semibold text-white/90">2.</strong> Tap “Add to Home Screen,” then Add.</span>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.025] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/[0.05] text-white/70"><MoreVertical className="h-4 w-4" /></span>
                  <span className="text-xs text-white/62"><strong className="font-semibold text-white/90">1.</strong> Open your browser menu.</span>
                </div>
                <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.025] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/[0.05] text-white/70"><Download className="h-4 w-4" /></span>
                  <span className="text-xs text-white/62"><strong className="font-semibold text-white/90">2.</strong> Choose “Install app” or “Add to Home screen.”</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
