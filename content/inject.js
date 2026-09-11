/**
 * Meet Attire — page-world inject
 * Patches navigator.mediaDevices.getUserMedia so Meet receives a processed
 * canvas stream with clothing overlays. Audio is left untouched.
 * Fail-open: any error returns the original stream.
 */
(function () {
  "use strict";

  const SOURCE = "MEET_ATTIRE_EXT";
  const TOKEN = "meet-attire-v1";

  if (window.__MEET_ATTIRE_INJECTED__) return;
  window.__MEET_ATTIRE_INJECTED__ = true;

  /** @type {string|null} */
  let selectedAttire = null; // null | 'off' | attire id
  /** @type {Record<string, HTMLImageElement>} */
  const attireImages = {};
  /** @type {string} */
  let assetBase = "";

  const ATTIRE_FILES = {
    "classic-polo": "classic-polo.svg",
    "white-tshirt": "white-tshirt.svg",
    "white-button-down": "white-button-down.svg",
    "navy-polo": "navy-polo.svg",
    "light-blue-oxford": "light-blue-oxford.svg",
  };

  // --- messaging -----------------------------------------------------------
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || data.token !== TOKEN) return;

    if (data.type === "INIT") {
      assetBase = data.assetBase || "";
      preloadAttire();
      postToContent({ type: "READY" });
    } else if (data.type === "SET_ATTIRE") {
      selectedAttire = data.attireId === "off" || !data.attireId ? null : data.attireId;
      postToContent({ type: "ATTIRE_ACK", attireId: selectedAttire || "off" });
    } else if (data.type === "PING") {
      postToContent({ type: "PONG", attireId: selectedAttire || "off" });
    }
  });

  function postToContent(payload) {
    window.postMessage({ source: SOURCE, token: TOKEN, from: "page", ...payload }, "*");
  }

  function preloadAttire() {
    Object.entries(ATTIRE_FILES).forEach(([id, file]) => {
      if (attireImages[id]) return;
      const img = new Image();
      img.decoding = "async";
      img.src = assetBase + "assets/attire/" + file;
      attireImages[id] = img;
    });
  }

  // --- face / torso estimation ---------------------------------------------
  let faceDetector = null;
  try {
    if (typeof FaceDetector === "function") {
      faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }
  } catch (_) {
    faceDetector = null;
  }

  /** Smooth torso box across frames */
  let smoothBox = null;
  const SMOOTH = 0.35;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothRect(next) {
    if (!smoothBox) {
      smoothBox = { ...next };
      return smoothBox;
    }
    smoothBox.x = lerp(smoothBox.x, next.x, SMOOTH);
    smoothBox.y = lerp(smoothBox.y, next.y, SMOOTH);
    smoothBox.w = lerp(smoothBox.w, next.w, SMOOTH);
    smoothBox.h = lerp(smoothBox.h, next.h, SMOOTH);
    return smoothBox;
  }

  /**
   * Estimate torso region below the face for clothing placement.
   * Returns {x,y,w,h} in video pixel coords, or null.
   */
  async function estimateTorso(video) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    let face = null;
    if (faceDetector) {
      try {
        const faces = await faceDetector.detect(video);
        if (faces && faces.length) {
          const bb = faces[0].boundingBox;
          face = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
        }
      } catch (_) {
        /* FaceDetector can throw on some frames — fall through */
      }
    }

    let box;
    if (face) {
      // Torso: below chin, wider than face, extends toward bottom
      const chinY = face.y + face.h * 0.95;
      const torsoW = face.w * 2.4;
      const torsoH = Math.min(vh - chinY, face.h * 3.2);
      const cx = face.x + face.w / 2;
      box = {
        x: cx - torsoW / 2,
        y: chinY - face.h * 0.15, // slight overlap under jaw for collar
        w: torsoW,
        h: torsoH,
      };
    } else {
      // Heuristic: upper-center body in a typical Meet framing
      const torsoW = vw * 0.55;
      const torsoH = vh * 0.55;
      box = {
        x: (vw - torsoW) / 2,
        y: vh * 0.28,
        w: torsoW,
        h: torsoH,
      };
    }

    // Clamp
    box.x = Math.max(0, box.x);
    box.y = Math.max(0, box.y);
    box.w = Math.min(box.w, vw - box.x);
    box.h = Math.min(box.h, vh - box.y);
    return smoothRect(box);
  }

  // --- processing pipeline -------------------------------------------------
  /**
   * Wrap a MediaStreamTrack (video) with canvas processing.
   * Returns { stream, stop } where stream has processed video (+ original audio later).
   */
  function createProcessedTrack(originalStream) {
    const videoTrack = originalStream.getVideoTracks()[0];
    if (!videoTrack) return null;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });

    let running = true;
    let raf = 0;
    let lastDetect = 0;
    let cachedBox = null;
    const DETECT_INTERVAL_MS = 80; // ~12.5 Hz detection; draw every frame

    const playPromise = video.play().catch(() => {});

    function drawFrame() {
      if (!running) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh) {
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }
        ctx.drawImage(video, 0, 0, vw, vh);

        const attireId = selectedAttire;
        const img = attireId ? attireImages[attireId] : null;
        if (img && img.complete && img.naturalWidth > 0) {
          const now = performance.now();
          const apply = (box) => {
            if (!box) return;
            cachedBox = box;
            ctx.save();
            // Soft feather via shadow + globalAlpha
            ctx.globalAlpha = 0.92;
            ctx.drawImage(img, box.x, box.y, box.w, box.h);
            ctx.restore();
          };

          if (now - lastDetect >= DETECT_INTERVAL_MS) {
            lastDetect = now;
            estimateTorso(video).then(apply).catch(() => apply(cachedBox));
          } else if (cachedBox) {
            apply(cachedBox);
          }
        }
      }

      if (video.requestVideoFrameCallback) {
        raf = video.requestVideoFrameCallback(() => drawFrame());
      } else {
        raf = requestAnimationFrame(drawFrame);
      }
    }

    playPromise.then(() => drawFrame());

    let outStream;
    try {
      outStream = canvas.captureStream(24);
    } catch (e) {
      running = false;
      return null;
    }

    const processedTrack = outStream.getVideoTracks()[0];
    // Propagate labels / settings hints where possible
    try {
      Object.defineProperty(processedTrack, "label", {
        get: () => videoTrack.label || "Meet Attire Camera",
      });
    } catch (_) {}

    // When original ends, stop processing
    videoTrack.addEventListener("ended", () => {
      running = false;
      try {
        processedTrack.stop();
      } catch (_) {}
    });

    const stop = () => {
      running = false;
      if (video.requestVideoFrameCallback && video.cancelVideoFrameCallback) {
        try {
          video.cancelVideoFrameCallback(raf);
        } catch (_) {}
      } else {
        cancelAnimationFrame(raf);
      }
      try {
        video.srcObject = null;
      } catch (_) {}
      try {
        processedTrack.stop();
      } catch (_) {}
    };

    return { processedTrack, stop, canvas, video };
  }

  // --- getUserMedia patch --------------------------------------------------
  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") {
    postToContent({ type: "ERROR", message: "mediaDevices.getUserMedia unavailable" });
    return;
  }

  const originalGUM = md.getUserMedia.bind(md);
  const activeProcessors = new Set();

  md.getUserMedia = async function patchedGetUserMedia(constraints) {
    const stream = await originalGUM(constraints);
    try {
      const wantsVideo =
        constraints &&
        (constraints.video === true ||
          (typeof constraints.video === "object" && constraints.video !== null));

      if (!wantsVideo || !stream.getVideoTracks().length) {
        return stream;
      }

      // Notify UI that camera is live
      postToContent({ type: "CAMERA_ACTIVE", active: true });

      const proc = createProcessedTrack(stream);
      if (!proc) {
        return stream; // fail-open
      }
      activeProcessors.add(proc);

      const out = new MediaStream();
      out.addTrack(proc.processedTrack);
      stream.getAudioTracks().forEach((t) => out.addTrack(t));

      // Mirror stop: stopping out video should stop processor
      const origStop = proc.processedTrack.stop.bind(proc.processedTrack);
      proc.processedTrack.stop = function () {
        proc.stop();
        activeProcessors.delete(proc);
        try {
          stream.getVideoTracks().forEach((t) => t.stop());
        } catch (_) {}
        origStop();
        if (![...activeProcessors].length) {
          postToContent({ type: "CAMERA_ACTIVE", active: false });
        }
      };

      return out;
    } catch (err) {
      console.warn("[Meet Attire] processing failed, using original stream", err);
      postToContent({ type: "ERROR", message: String(err && err.message ? err.message : err) });
      return stream; // fail-open
    }
  };

  // Also patch legacy navigator.getUserMedia if present
  const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia;
  if (typeof legacy === "function") {
    const bound = legacy.bind(navigator);
    const legacyWrapper = function (constraints, success, error) {
      md.getUserMedia(constraints).then(success, error);
    };
    try {
      navigator.getUserMedia = legacyWrapper;
    } catch (_) {}
    try {
      navigator.webkitGetUserMedia = legacyWrapper;
    } catch (_) {}
  }

  postToContent({ type: "INJECTED" });
})();
