/**
 * Meet Attire — page-world inject
 * Patches getUserMedia; composites clothing onto torso BELOW the face.
 * Never paints over the face. Fail-open.
 */
(function () {
  "use strict";

  const SOURCE = "MEET_ATTIRE_EXT";
  const TOKEN = "meet-attire-v1";

  if (window.__MEET_ATTIRE_INJECTED__) return;
  window.__MEET_ATTIRE_INJECTED__ = true;

  /** @type {string|null} */
  let selectedAttire = null;
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

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || data.token !== TOKEN) return;

    if (data.type === "INIT") {
      assetBase = data.assetBase || "";
      preloadAttire();
      postToContent({ type: "READY" });
    } else if (data.type === "SET_ATTIRE") {
      selectedAttire =
        data.attireId === "off" || !data.attireId ? null : data.attireId;
      postToContent({ type: "ATTIRE_ACK", attireId: selectedAttire || "off" });
    } else if (data.type === "PING") {
      postToContent({ type: "PONG", attireId: selectedAttire || "off" });
    }
  });

  function postToContent(payload) {
    window.postMessage(
      { source: SOURCE, token: TOKEN, from: "page", ...payload },
      "*"
    );
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

  // --- face detection ------------------------------------------------------
  let faceDetector = null;
  try {
    if (typeof FaceDetector === "function") {
      faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }
  } catch (_) {
    faceDetector = null;
  }

  let smoothFace = null;
  let smoothTorso = null;
  const FACE_SMOOTH = 0.45;
  const TORSO_SMOOTH = 0.4;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothBox(prev, next, t) {
    if (!next) return prev;
    if (!prev) return { ...next };
    return {
      x: lerp(prev.x, next.x, t),
      y: lerp(prev.y, next.y, t),
      w: lerp(prev.w, next.w, t),
      h: lerp(prev.h, next.h, t),
    };
  }

  /**
   * Detect face in video frame. Returns {x,y,w,h} or null.
   */
  async function detectFace(video) {
    if (!faceDetector) return null;
    try {
      const faces = await faceDetector.detect(video);
      if (!faces || !faces.length) return null;
      const bb = faces[0].boundingBox;
      if (!bb || bb.width < 8 || bb.height < 8) return null;
      return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
    } catch (_) {
      return null;
    }
  }

  /**
   * Build torso box strictly below the face (chin → mid torso).
   */
  function torsoFromFace(face, vw, vh) {
    // Chin / neck line — start clothing BELOW the face, not on it
    const chinY = face.y + face.h * 1.02;
    const neckY = chinY - face.h * 0.02; // tiny collar tuck under chin only
    const shoulderW = face.w * 2.6;
    const cx = face.x + face.w / 2;
    // Extend down; leave some margin at bottom
    const maxH = Math.max(40, vh - neckY - 8);
    const torsoH = Math.min(maxH, face.h * 3.4);
    let box = {
      x: cx - shoulderW / 2,
      y: neckY,
      w: shoulderW,
      h: torsoH,
    };
    box.x = Math.max(0, Math.min(box.x, vw - 10));
    box.y = Math.max(0, Math.min(box.y, vh - 10));
    box.w = Math.min(box.w, vw - box.x);
    box.h = Math.min(box.h, vh - box.y);
    return box;
  }

  /**
   * Meet headshot fallback when face detector misses: lower half of frame.
   * Old heuristic (y=28%) put collars on faces — that was the sticker bug.
   */
  function torsoFallback(vw, vh) {
    const torsoW = vw * 0.62;
    const torsoH = vh * 0.48;
    return {
      x: (vw - torsoW) / 2,
      y: vh * 0.48,
      w: torsoW,
      h: torsoH,
    };
  }

  /**
   * Expanded face oval used as a hard exclusion zone so clothes never cover the head.
   */
  function faceExclusion(face) {
    const cx = face.x + face.w / 2;
    const cy = face.y + face.h * 0.48;
    // Slightly wider/taller than bbox so forehead + ears stay clear
    const rx = face.w * 0.72;
    const ry = face.h * 0.78;
    return { cx, cy, rx, ry, bottom: face.y + face.h * 1.05 };
  }

  function drawAttire(ctx, img, torso, face) {
    if (!torso || !img) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(torso.x, torso.y, torso.w, torso.h);
    if (face) {
      const ex = faceExclusion(face);
      // Punch face oval out of the clip so the head is never covered
      ctx.ellipse(ex.cx, ex.cy, ex.rx, ex.ry, 0, 0, Math.PI * 2);
      ctx.clip("evenodd");
    } else {
      ctx.clip();
    }
    ctx.globalAlpha = 0.94;
    ctx.drawImage(img, torso.x, torso.y, torso.w, torso.h);
    ctx.restore();
  }

  // --- processing pipeline -------------------------------------------------
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
    let cachedFace = null;
    let cachedTorso = null;
    let detecting = false;
    let missStreak = 0;
    const DETECT_MS = 50; // ~20 Hz face track

    const playPromise = video.play().catch(() => {});

    function scheduleDetect(vw, vh) {
      if (detecting) return;
      detecting = true;
      detectFace(video)
        .then((raw) => {
          if (!running) return;
          if (raw) {
            missStreak = 0;
            smoothFace = smoothBox(smoothFace, raw, FACE_SMOOTH);
            cachedFace = smoothFace;
            const nextTorso = torsoFromFace(smoothFace, vw, vh);
            smoothTorso = smoothBox(smoothTorso, nextTorso, TORSO_SMOOTH);
            cachedTorso = smoothTorso;
          } else {
            missStreak += 1;
            // Hold last lock briefly so tracking does not flicker
            if (cachedFace && missStreak < 8) {
              const nextTorso = torsoFromFace(cachedFace, vw, vh);
              smoothTorso = smoothBox(smoothTorso, nextTorso, TORSO_SMOOTH);
              cachedTorso = smoothTorso;
            } else {
              cachedFace = null;
              smoothFace = null;
              cachedTorso = torsoFallback(vw, vh);
              smoothTorso = cachedTorso;
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          detecting = false;
        });
    }

    function drawFrame() {
      if (!running) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh) {
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
          smoothFace = null;
          smoothTorso = null;
          cachedFace = null;
          cachedTorso = null;
        }

        ctx.drawImage(video, 0, 0, vw, vh);

        const attireId = selectedAttire;
        const img = attireId ? attireImages[attireId] : null;
        if (img && img.complete && img.naturalWidth > 0) {
          const now = performance.now();
          if (now - lastDetect >= DETECT_MS) {
            lastDetect = now;
            scheduleDetect(vw, vh);
          }
          if (!cachedTorso) {
            cachedTorso = torsoFallback(vw, vh);
          }
          drawAttire(ctx, img, cachedTorso, cachedFace);
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
      outStream = canvas.captureStream(30);
    } catch (e) {
      running = false;
      return null;
    }

    const processedTrack = outStream.getVideoTracks()[0];
    try {
      Object.defineProperty(processedTrack, "label", {
        get: () => videoTrack.label || "Meet Attire Camera",
      });
    } catch (_) {}

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
    postToContent({
      type: "ERROR",
      message: "mediaDevices.getUserMedia unavailable",
    });
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

      postToContent({ type: "CAMERA_ACTIVE", active: true });

      const proc = createProcessedTrack(stream);
      if (!proc) {
        return stream;
      }
      activeProcessors.add(proc);

      const out = new MediaStream();
      out.addTrack(proc.processedTrack);
      stream.getAudioTracks().forEach((t) => out.addTrack(t));

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
      postToContent({
        type: "ERROR",
        message: String(err && err.message ? err.message : err),
      });
      return stream;
    }
  };

  postToContent({ type: "INJECTED" });
})();
