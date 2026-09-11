/**
 * Meet Attire — bootstrap content script
 * Loads gzipped full sources from extension package (content/b64/*.js.gz.b64),
 * injects page-world getUserMedia patch, then runs UI.
 */
(async function () {
  "use strict";

  async function loadGzJs(rel) {
    const url = chrome.runtime.getURL(rel);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load " + rel + ": " + res.status);
    const b64 = (await res.text()).replace(/\s+/g, "");
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (typeof DecompressionStream === "function") {
      const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    }
    const plain = rel.replace("/b64/", "/").replace(".gz.b64", "");
    const r2 = await fetch(chrome.runtime.getURL(plain));
    if (r2.ok) return await r2.text();
    throw new Error("DecompressionStream unavailable and no plain " + plain);
  }

  try {
    const injectCode = await loadGzJs("content/b64/inject.js.gz.b64");
    const s = document.createElement("script");
    s.textContent = injectCode;
    (document.documentElement || document.head || document.body).appendChild(s);
    s.remove();

    const uiCode = await loadGzJs("content/b64/content.ui.js.gz.b64");
    eval(uiCode);
  } catch (err) {
    console.error("[Meet Attire] bootstrap failed", err);
  }
})();
