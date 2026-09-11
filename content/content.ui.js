/**
 * Meet Attire — content script
 * Injects page-world script early, hosts floating UI (shadow DOM),
 * bridges messages via window.postMessage with a unique token.
 */
(function () {
  "use strict";

  const SOURCE = "MEET_ATTIRE_EXT";
  const TOKEN = "meet-attire-v1";

  const ATTIRE_OPTIONS = [
    { id: "classic-polo", label: "Classic polo", thumb: "classic-polo.svg" },
    { id: "white-tshirt", label: "White t-shirt", thumb: "white-tshirt.svg" },
    { id: "white-button-down", label: "White button-down", thumb: "white-button-down.svg" },
    { id: "navy-polo", label: "Navy polo", thumb: "navy-polo.svg" },
    { id: "light-blue-oxford", label: "Light blue oxford", thumb: "light-blue-oxford.svg" },
  ];

  let selected = "off";
  let cameraActive = false;
  let panelHost = null;
  let shadow = null;

  // --- hand off to page-world inject ---------------------------------------
  let pageReady = false;
  function restoreSelection() {
    chrome.storage.local.get(["attireId"], (res) => {
      if (res && res.attireId) {
        selected = res.attireId;
        sendToPage({ type: "SET_ATTIRE", attireId: selected });
        updateUISelection();
      }
    });
  }

  function injectPageScript() {
    sendToPage({
      type: "INIT",
      assetBase: chrome.runtime.getURL(""),
    });
  }

  // Retry INIT until page script answers READY (script src load is async)
  let initAttempts = 0;
  const initTimer = setInterval(() => {
    if (pageReady || initAttempts > 40) {
      clearInterval(initTimer);
      return;
    }
    initAttempts += 1;
    injectPageScript();
  }, 100);
  injectPageScript();

  function sendToPage(payload) {
    window.postMessage({ source: SOURCE, token: TOKEN, from: "content", ...payload }, "*");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || data.token !== TOKEN) return;
    if (data.from === "content") return;

    if (data.type === "CAMERA_ACTIVE") {
      cameraActive = !!data.active;
      ensurePanel();
      setPanelVisible(cameraActive || selected !== "off");
    } else if (data.type === "INJECTED" || data.type === "READY") {
      if (!pageReady) {
        pageReady = true;
        injectPageScript();
        restoreSelection();
      }
      ensurePanel();
    } else if (data.type === "ATTIRE_ACK") {
      selected = data.attireId || "off";
      updateUISelection();
    }
  });

  // --- UI ------------------------------------------------------------------
  function ensurePanel() {
    if (panelHost && document.contains(panelHost)) return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
      return;
    }

    panelHost = document.createElement("div");
    panelHost.id = "meet-attire-root";
    panelHost.style.cssText = "all:initial;position:fixed;z-index:2147483646;bottom:88px;right:16px;pointer-events:none;";
    shadow = panelHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, sans-serif; }
.panel { pointer-events: auto; width: 260px; background: rgba(32,33,36,0.94); color: #e8eaed; border-radius: 14px; box-shadow: 0 8px 28px rgba(0,0,0,0.45); padding: 12px; opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s; }
.panel.visible { opacity: 1; transform: translateY(0); }
.panel.hidden { display: none; }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px; }
.title { font-size: 13px; font-weight: 600; color: #f1f3f4; }
.badge { font-size: 10px; color: #9aa0a6; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 999px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
button.opt { appearance: none; border: 1px solid transparent; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 6px 4px 8px; cursor: pointer; color: #e8eaed; display: flex; flex-direction: column; align-items: center; gap: 5px; }
button.opt:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.12); }
button.opt.selected { border-color: #8ab4f8; background: rgba(138,180,248,0.14); }
button.opt img { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; background: #2d2e31; }
button.opt .lbl { font-size: 10px; line-height: 1.2; text-align: center; color: #bdc1c6; max-width: 72px; }
button.opt.selected .lbl { color: #e8eaed; }
button.off { grid-column: 1 / -1; margin-top: 2px; appearance: none; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #bdc1c6; border-radius: 8px; padding: 7px 10px; font-size: 12px; cursor: pointer; }
button.off:hover { background: rgba(255,255,255,0.06); color: #e8eaed; }
button.off.selected { border-color: #81c995; color: #81c995; background: rgba(129,201,149,0.1); }
.hint { margin-top: 8px; font-size: 10px; color: #80868b; text-align: center; }
.collapse { all: unset; cursor: pointer; color: #9aa0a6; font-size: 14px; padding: 2px 4px; border-radius: 4px; }
.collapse:hover { color: #e8eaed; background: rgba(255,255,255,0.06); }
.fab { pointer-events: auto; display: none; align-items: center; gap: 8px; background: rgba(32,33,36,0.94); color: #e8eaed; border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
.fab.show { display: inline-flex; }
.fab img { width: 18px; height: 18px; }
`;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <button class="fab" type="button" title="Meet Attire">
        <img alt="" />
        <span>Attire</span>
      </button>
      <div class="panel hidden" role="dialog" aria-label="Meet Attire">
        <div class="header">
          <div class="title">Change attire?</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="badge">local</span>
            <button class="collapse" type="button" title="Minimize" aria-label="Minimize">–</button>
          </div>
        </div>
        <div class="grid"></div>
        <button class="off" type="button" data-id="off">Off / Original</button>
        <div class="hint">Camera overlay · stays on your device</div>
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(wrap);

    const fab = shadow.querySelector(".fab");
    fab.querySelector("img").src = chrome.runtime.getURL("assets/icons/icon32.png");

    const panel = shadow.querySelector(".panel");
    const grid = shadow.querySelector(".grid");

    ATTIRE_OPTIONS.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opt";
      btn.dataset.id = opt.id;
      btn.title = opt.label;
      const img = document.createElement("img");
      img.alt = opt.label;
      img.src = chrome.runtime.getURL("assets/attire/thumbs/" + opt.thumb);
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = opt.label;
      btn.appendChild(img);
      btn.appendChild(lbl);
      btn.addEventListener("click", () => choose(opt.id));
      grid.appendChild(btn);
    });

    shadow.querySelector("button.off").addEventListener("click", () => choose("off"));
    shadow.querySelector(".collapse").addEventListener("click", () => {
      panel.classList.remove("visible");
      panel.classList.add("hidden");
      fab.classList.add("show");
    });
    fab.addEventListener("click", () => {
      fab.classList.remove("show");
      panel.classList.remove("hidden");
      requestAnimationFrame(() => panel.classList.add("visible"));
    });

    document.body.appendChild(panelHost);
    updateUISelection();
    setPanelVisible(cameraActive || selected !== "off");
  }

  function choose(id) {
    selected = id;
    chrome.storage.local.set({ attireId: id });
    sendToPage({ type: "SET_ATTIRE", attireId: id });
    updateUISelection();
    setPanelVisible(true);
  }

  function updateUISelection() {
    if (!shadow) return;
    shadow.querySelectorAll("button.opt, button.off").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.id === selected || (btn.classList.contains("off") && selected === "off"));
    });
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
      panel.classList.remove("visible");
      panel.classList.add("hidden");
      fab.classList.remove("show");
    }
  }

  // Meet is an SPA — keep host attached
  const mo = new MutationObserver(() => {
    if (panelHost && !document.contains(panelHost) && document.body) {
      document.body.appendChild(panelHost);
    }
  });
  if (document.documentElement) {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
