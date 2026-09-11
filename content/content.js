/**
 * Meet Attire — content script (page-world inject only)
 * Uses <script src="chrome-extension://..."> so Meet CSP allows it.
 * No inline scripts, no eval.
 */
(function () {
  "use strict";

  if (window.__MEET_ATTIRE_BOOTSTRAPPED__) return;
  window.__MEET_ATTIRE_BOOTSTRAPPED__ = true;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("content/inject.js");
  s.async = false;
  s.onload = function () {
    s.remove();
  };
  s.onerror = function () {
    console.error("[Meet Attire] failed to load inject.js");
  };
  (document.documentElement || document.head || document).appendChild(s);
})();
