import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import "@/peak-settings-clean.css";
import { applyPreferences } from "@/lib/preferences";
import App from "@/App";

applyPreferences();

const isIOSRuntime = (() => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(window.__SYNFLIX_IOS__ || params.get("iosApp") === "1");
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: isIOSRuntime ? 5 * 60_000 : 60_000,
      gcTime: isIOSRuntime ? 45 * 60_000 : 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: isIOSRuntime ? 1 : 2,
      networkMode: isIOSRuntime ? "offlineFirst" : "online",
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then((registration) => {
      if (!isIOSRuntime) return;

      const warm = () => {
        const worker = registration.active || registration.waiting || registration.installing;
        worker?.postMessage({
          type: "WARM_CACHE",
          urls: [
            "/?iosApp=1",
            "/search?iosApp=1",
            "/my-list?iosApp=1",
            "/settings?iosApp=1",
          ],
        });
      };

      warm();
      navigator.serviceWorker.ready.then(warm).catch(() => {});
    }).catch(() => {
      // SynFlix still works normally if service workers are unavailable.
    });
  });
}
