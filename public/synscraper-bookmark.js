(() => {
  const ROOT_ID = "__synscraper_bookmark";
  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-synscraper-bookmark", "v1");
  root.style.cssText = [
    "position:fixed",
    "right:18px",
    "top:18px",
    "width:min(460px,calc(100vw - 24px),calc(100vh - 24px))",
    "height:min(460px,calc(100vw - 24px),calc(100vh - 24px))",
    "z-index:2147483647",
    "border:1px solid rgba(255,255,255,.14)",
    "border-radius:22px",
    "overflow:hidden",
    "background:#070707",
    "box-shadow:0 28px 90px rgba(0,0,0,.55)",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "color:#fff",
    "isolation:isolate",
    "transform:translateZ(0)"
  ].join(";");

  const bar = document.createElement("div");
  bar.style.cssText = [
    "height:38px",
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "padding:0 10px 0 14px",
    "background:rgba(12,12,12,.96)",
    "border-bottom:1px solid rgba(255,255,255,.08)",
    "cursor:grab",
    "user-select:none",
    "-webkit-user-select:none",
    "touch-action:none"
  ].join(";");

  const brand = document.createElement("div");
  brand.textContent = "Synscraper";
  brand.style.cssText = [
    "font-size:12px",
    "font-weight:700",
    "letter-spacing:-.01em",
    "color:rgba(255,255,255,.82)"
  ].join(";");

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:6px;align-items:center;";

  const makeButton = (label, aria) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", aria);
    button.style.cssText = [
      "width:26px",
      "height:26px",
      "border:0",
      "border-radius:8px",
      "background:transparent",
      "color:rgba(255,255,255,.58)",
      "font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "cursor:pointer",
      "padding:0"
    ].join(";");
    button.onmouseenter = () => {
      button.style.background = "rgba(255,255,255,.08)";
      button.style.color = "#fff";
    };
    button.onmouseleave = () => {
      button.style.background = "transparent";
      button.style.color = "rgba(255,255,255,.58)";
    };
    return button;
  };

  const minimize = makeButton("–", "Minimize Synscraper");
  const close = makeButton("×", "Close Synscraper");
  actions.append(minimize, close);
  bar.append(brand, actions);

  const frame = document.createElement("iframe");
  const base = "https://synscraper-tffk.vercel.app";
  const sourceTitle = document.title ? document.title.slice(0, 160) : "";
  frame.src = base + "/bookmark-app.html?v=2&q=" + encodeURIComponent(sourceTitle);
  frame.title = "Synscraper";
  frame.allow = "autoplay; fullscreen; picture-in-picture";
  frame.referrerPolicy = "no-referrer";
  frame.style.cssText = [
    "display:block",
    "width:100%",
    "height:calc(100% - 38px)",
    "border:0",
    "background:#070707"
  ].join(";");

  root.append(bar, frame);
  document.documentElement.appendChild(root);

  let minimized = false;
  let savedSize = root.style.width;

  minimize.onclick = (event) => {
    event.stopPropagation();
    minimized = !minimized;
    if (minimized) {
      savedSize = root.style.width || "min(460px,calc(100vw - 24px),calc(100vh - 24px))";
      root.style.height = "38px";
      root.style.width = "168px";
      root.style.borderRadius = "14px";
      frame.style.display = "none";
      minimize.textContent = "+";
      minimize.setAttribute("aria-label", "Restore Synscraper");
    } else {
      root.style.width = savedSize;
      root.style.height = savedSize;
      root.style.borderRadius = "22px";
      frame.style.display = "block";
      minimize.textContent = "–";
      minimize.setAttribute("aria-label", "Minimize Synscraper");
    }
  };

  close.onclick = (event) => {
    event.stopPropagation();
    root.remove();
  };

  let drag = null;

  const beginDrag = (event) => {
    if (event.target.closest("button")) return;
    const rect = root.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top
    };
    bar.setPointerCapture?.(event.pointerId);
    bar.style.cursor = "grabbing";
    root.style.right = "auto";
  };

  const moveDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const maxX = Math.max(6, window.innerWidth - root.offsetWidth - 6);
    const maxY = Math.max(6, window.innerHeight - root.offsetHeight - 6);
    const left = Math.min(maxX, Math.max(6, event.clientX - drag.dx));
    const top = Math.min(maxY, Math.max(6, event.clientY - drag.dy));
    root.style.left = left + "px";
    root.style.top = top + "px";
  };

  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    bar.style.cursor = "grab";
    try { bar.releasePointerCapture?.(event.pointerId); } catch (_) {}
  };

  bar.addEventListener("pointerdown", beginDrag);
  bar.addEventListener("pointermove", moveDrag);
  bar.addEventListener("pointerup", endDrag);
  bar.addEventListener("pointercancel", endDrag);

  window.addEventListener("message", (event) => {
    if (event.origin !== base) return;
    if (event.data?.type === "synscraper:close") root.remove();
    // Keep the bookmark window square. Content scrolls inside the iframe instead
    // of stretching the outer shell into a tall panel.
  });
})();