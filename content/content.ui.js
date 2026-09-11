/**
 * Meet Attire — content script UI + hybrid fal bridge
 * See SYNC_NOTE.md / box zip for canonical copy if this lags.
 * Panel: Generating… on outfit change; fal CatVTON via background.
 */
(function () {
  "use strict";
  const SOURCE = "MEET_ATTIRE_EXT";
  const TOKEN = "meet-attire-v1";
  const ATTIRE_OPTIONS = [
    { id: "classic-polo", label: "Classic polo", thumb: "classic-polo.png" },
    { id: "white-tshirt", label: "White t-shirt", thumb: "white-tshirt.png" },
    { id: "white-button-down", label: "White button-down", thumb: "white-button-down.png" },
    { id: "navy-polo", label: "Navy polo", thumb: "navy-polo.png" },
    { id: "light-blue-oxford", label: "Light blue oxford", thumb: "light-blue-oxford.png" },
  ];
  let selected = "off", cameraActive = false, panelHost = null, shadow = null;
  let generating = false, statusNote = "", hasFalKey = false, pageReady = false;
  const captureWaiters = new Map();
  let captureSeq = 0;
  function restoreSelection() {
    chrome.storage.local.get(["attireId"], (res) => {
      if (res && res.attireId) {
        selected = res.attireId;
        sendToPage({ type: "SET_ATTIRE", attireId: selected });
        updateUISelection();
      }
    });
  }
  function refreshFalKeyFlag() {
    chrome.runtime.sendMessage({ type: "HAS_FAL_KEY" }, (res) => {
      if (chrome.runtime.lastError) { hasFalKey = false; return; }
      hasFalKey = !!(res && res.hasKey);
      updateHint();
    });
  }
  function injectPageScript() {
    sendToPage({ type: "INIT", assetBase: chrome.runtime.getURL("") });
  }
  let initAttempts = 0;
  const initTimer = setInterval(() => {
    if (pageReady || initAttempts > 40) { clearInterval(initTimer); return; }
    initAttempts += 1; injectPageScript();
  }, 100);
  injectPageScript(); refreshFalKeyFlag();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.falKey) refreshFalKeyFlag();
  });
  function sendToPage(payload) {
    window.postMessage({ source: SOURCE, token: TOKEN, from: "content", ...payload }, "*");
  }
  function requestFrameCapture() {
    return new Promise((resolve) => {
      const requestId = "cap-" + ++captureSeq;
      const timer = setTimeout(() => { captureWaiters.delete(requestId); resolve(null); }, 2500);
      captureWaiters.set(requestId, (dataUrl) => { clearTimeout(timer); resolve(dataUrl || null); });
      sendToPage({ type: "FRAME_CAPTURE", requestId });
    });
  }
  async function assetToDataUrl(path) {
    const res = await fetch(chrome.runtime.getURL(path));
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error("read failed"));
      r.readAsDataURL(blob);
    });
  }
  async function runNeuralTryOn(attireId) {
    generating = true;
    statusNote = "Generating neural try-on…";
    updateHint(); setPanelVisible(true);
    try {
      const personDataUrl = await requestFrameCapture();
      if (!personDataUrl) {
        statusNote = "Could not capture frame — using local PNG warp.";
        generating = false; updateHint(); return;
      }
      let garmentDataUrl;
      try { garmentDataUrl = await assetToDataUrl("assets/attire/" + attireId + ".png"); }
      catch (_) { garmentDataUrl = await assetToDataUrl("assets/attire/" + attireId + ".svg"); }
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "FAL_TRYON", attireId, personDataUrl, garmentDataUrl }, (res) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(res || { ok: false, error: "empty response" });
        });
      });
      if (!result.ok) {
        statusNote = result.code === "NO_KEY"
          ? "Add fal.ai API key in extension options for neural try-on"
          : "Neural failed — local PNG warp. " + (result.error || "").slice(0, 80);
        sendToPage({ type: "CLEAR_NEURAL" });
        generating = false; updateHint(); return;
      }
      sendToPage({ type: "SET_NEURAL_TEXTURE", attireId, dataUrl: result.resultDataUrl || result.imageUrl });
      statusNote = "Neural look locked · local torso tracking";
    } catch (err) {
      statusNote = "Neural error — local PNG. " + String(err && err.message ? err.message : err).slice(0, 60);
      sendToPage({ type: "CLEAR_NEURAL" });
    } finally { generating = false; updateHint(); }
  }
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || data.token !== TOKEN || data.from === "content") return;
    if (data.type === "CAMERA_ACTIVE") {
      cameraActive = !!data.active; ensurePanel(); setPanelVisible(cameraActive || selected !== "off");
    } else if (data.type === "INJECTED" || data.type === "READY") {
      if (!pageReady) { pageReady = true; injectPageScript(); restoreSelection(); }
      ensurePanel();
    } else if (data.type === "ATTIRE_ACK") { selected = data.attireId || "off"; updateUISelection();
    } else if (data.type === "FRAME_CAPTURE_RESULT") {
      const waiter = captureWaiters.get(data.requestId);
      if (waiter) { captureWaiters.delete(data.requestId); waiter(data.dataUrl); }
    } else if (data.type === "NEURAL_TEXTURE_ACK" && data.ok) {
      statusNote = "Neural look locked · local torso tracking"; updateHint();
    }
  });
  function ensurePanel() {
    if (panelHost && document.contains(panelHost)) return;
    if (!document.body) { document.addEventListener("DOMContentLoaded", ensurePanel, { once: true }); return; }
    panelHost = document.createElement("div");
    panelHost.id = "meet-attire-root";
    panelHost.style.cssText = "all:initial;position:fixed;z-index:2147483646;bottom:88px;right:16px;pointer-events:none;";
    shadow = panelHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `:host{all:initial}*{box-sizing:border-box;font-family:system-ui,sans-serif}.panel{pointer-events:auto;width:268px;background:rgba(32,33,36,.94);color:#e8eaed;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.45);padding:12px;opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s}.panel.visible{opacity:1;transform:none}.panel.hidden{display:none}.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px}.title{font-size:13px;font-weight:600}.badge{font-size:10px;color:#9aa0a6;background:rgba(255,255,255,.06);padding:2px 6px;border-radius:999px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}button.opt{appearance:none;border:1px solid transparent;background:rgba(255,255,255,.04);border-radius:10px;padding:6px 4px 8px;cursor:pointer;color:#e8eaed;display:flex;flex-direction:column;align-items:center;gap:5px}button.opt:hover{background:rgba(255,255,255,.09)}button.opt.selected{border-color:#8ab4f8;background:rgba(138,180,248,.14)}button.opt:disabled{opacity:.5;cursor:wait}button.opt img{width:56px;height:56px;object-fit:contain;border-radius:8px;background:#2d2e31}button.opt .lbl{font-size:10px;text-align:center;color:#bdc1c6;max-width:72px}button.off{grid-column:1/-1;margin-top:2px;appearance:none;border:1px solid rgba(255,255,255,.1);background:transparent;color:#bdc1c6;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer}button.off.selected{border-color:#81c995;color:#81c995}.hint{margin-top:8px;font-size:10px;color:#80868b;text-align:center;line-height:1.35}.hint.warn{color:#fdd663}.hint.busy{color:#8ab4f8}.linkish{all:unset;cursor:pointer;color:#8ab4f8;font-size:10px;text-decoration:underline;display:block;text-align:center;margin-top:6px}.collapse{all:unset;cursor:pointer;color:#9aa0a6;font-size:14px;padding:2px 4px}.fab{pointer-events:auto;display:none;align-items:center;gap:8px;background:rgba(32,33,36,.94);color:#e8eaed;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:8px 14px;font-size:12px;cursor:pointer}.fab.show{display:inline-flex}.fab img{width:18px;height:18px}`;
    const wrap = document.createElement("div");
    wrap.innerHTML = `<button class="fab" type="button" title="Meet Attire"><img alt="" /><span>Attire</span></button><div class="panel hidden" role="dialog" aria-label="Meet Attire"><div class="header"><div class="title">Change attire?</div><div style="display:flex;align-items:center;gap:6px"><span class="badge">hybrid</span><button class="collapse" type="button" title="Minimize">–</button></div></div><div class="grid"></div><button class="off" type="button" data-id="off">Off / Original</button><div class="hint">Tracks your torso · local on-device</div><button class="linkish" type="button" id="opts">fal.ai API key…</button></div>`;
    shadow.appendChild(style); shadow.appendChild(wrap);
    const fab = shadow.querySelector(".fab");
    fab.querySelector("img").src = chrome.runtime.getURL("assets/icons/icon32.png");
    const panel = shadow.querySelector(".panel");
    const grid = shadow.querySelector(".grid");
    ATTIRE_OPTIONS.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "opt"; btn.dataset.id = opt.id; btn.title = opt.label;
      const img = document.createElement("img"); img.alt = opt.label;
      img.src = chrome.runtime.getURL("assets/attire/thumbs/" + opt.thumb);
      const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = opt.label;
      btn.appendChild(img); btn.appendChild(lbl);
      btn.addEventListener("click", () => choose(opt.id));
      grid.appendChild(btn);
    });
    shadow.querySelector("button.off").addEventListener("click", () => choose("off"));
    shadow.querySelector(".collapse").addEventListener("click", () => {
      panel.classList.remove("visible"); panel.classList.add("hidden"); fab.classList.add("show");
    });
    fab.addEventListener("click", () => {
      fab.classList.remove("show"); panel.classList.remove("hidden");
      requestAnimationFrame(() => panel.classList.add("visible"));
    });
    shadow.querySelector("#opts").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    });
    document.body.appendChild(panelHost);
    updateUISelection(); updateHint(); setPanelVisible(cameraActive || selected !== "off");
  }
  function choose(id) {
    if (generating && id !== "off") return;
    selected = id;
    chrome.storage.local.set({ attireId: id });
    sendToPage({ type: "SET_ATTIRE", attireId: id });
    updateUISelection(); setPanelVisible(true);
    if (id === "off") {
      statusNote = ""; generating = false; sendToPage({ type: "CLEAR_NEURAL" }); updateHint(); return;
    }
    if (hasFalKey) runNeuralTryOn(id);
    else { statusNote = "Add fal.ai API key in extension options for neural try-on"; updateHint(); }
  }
  function updateUISelection() {
    if (!shadow) return;
    shadow.querySelectorAll("button.opt, button.off").forEach((btn) => {
      const isOff = btn.classList.contains("off");
      btn.classList.toggle("selected", isOff ? selected === "off" : btn.dataset.id === selected);
      if (!isOff) btn.disabled = generating;
    });
  }
  function updateHint() {
    if (!shadow) return;
    const hint = shadow.querySelector(".hint");
    if (!hint) return;
    hint.classList.remove("warn", "busy");
    if (generating) { hint.classList.add("busy"); hint.textContent = statusNote || "Generating…"; }
    else if (statusNote) { hint.classList.add("warn"); hint.textContent = statusNote; }
    else hint.textContent = "Tracks your torso · local on-device";
    updateUISelection();
  }
  function setPanelVisible(show) {
    if (!shadow) return;
    const panel = shadow.querySelector(".panel");
    const fab = shadow.querySelector(".fab");
    if (show) {
      if (!fab.classList.contains("show")) {
        panel.classList.remove("hidden");
        requestAnimationFrame(() => panel.classList.add("visible"));
      }
    } else {
      panel.classList.remove("visible"); panel.classList.add("hidden"); fab.classList.remove("show");
    }
  }
  const mo = new MutationObserver(() => {
    if (panelHost && !document.contains(panelHost) && document.body) document.body.appendChild(panelHost);
  });
  if (document.documentElement) mo.observe(document.documentElement, { childList: true, subtree: true });
})();
