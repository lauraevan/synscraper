# SynFlix Desktop v1

SynFlix Desktop is the Windows shell for the existing SynFlix React application. It uses Tauri 2 so the website and desktop app share the same movie pages, SynPlayer, watchlist, search, settings and API client.

## v1 design

- Dedicated left navigation rail inspired by full desktop media-center apps.
- Compact custom Windows titlebar with native minimize, maximize and close actions.
- Centered global search with `Ctrl+K` and `/` shortcuts.
- `Alt+Left` goes back and `F11` toggles fullscreen.
- Keyboard-visible focus rings, skip-to-content support, semantic labels, reduced-motion support and high-contrast support.
- The desktop runtime automatically uses the production SynFlix backend instead of trying to call `/api` inside the local Tauri webview.
- The existing web/mobile SynFlix layout is untouched when the app is opened in a normal browser.

## Run on Windows

Requirements: Node.js, Yarn, Rust stable, Microsoft WebView2 and the Visual Studio C++ build tools required by Tauri.

```powershell
cd desktop
npm install
yarn --cwd ../frontend install
npm run dev
```

## Build the installer

```powershell
cd desktop
npm install
yarn --cwd ../frontend install
npm run build
```

The NSIS installer is written under `desktop/src-tauri/target/release/bundle/nsis/`.

The GitHub workflow `Build SynFlix Desktop` also creates a Windows installer artifact automatically whenever desktop-specific files change.

## Browser preview

For quick visual testing without Tauri, open the normal SynFlix site with `?desktopApp=1` once in a tab. The desktop shell remains enabled for that browser tab while you navigate around SynFlix.
