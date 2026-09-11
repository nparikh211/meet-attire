/**
 * Meet Attire — MV3 service worker
 * Handles fal.ai CatVTON on outfit change only. Never streams video frames
 * continuously. API key from chrome.storage.local.falKey (never hardcoded).
 */
const FAL_RUN = "https://fal.run/fal-ai/cat-vton";
const FAL_UPLOAD = "https://fal.media/files";

chrome.runtime.onInstalled.addListener(() => {
  console.info("[Meet Attire] background ready (hybrid local+fal)");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === "FAL_TRYON") {
    handleTryOn(msg)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: String(err && err.message ? err.message : err),
        })
      );
    return true; // async
  }
  if (msg.type === "HAS_FAL_KEY") {
    chrome.storage.local.get(["falKey"], (res) => {
      sendResponse({ ok: true, hasKey: !!(res && res.falKey) });
    });
    return true;
  }
  if (msg.type === "OPEN_OPTIONS") {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
});

async function getFalKey() {
  const res = await chrome.storage.local.get(["falKey"]);
  const key = res && typeof res.falKey === "string" ? res.falKey.trim() : "";
  return key || null;
}

/** Upload a data URL / blob URL content to fal media; return https URL. */
async function uploadDataUrl(falKey, dataUrl, filename) {
  if (!dataUrl) throw new Error("missing image");
  if (/^https?:\/\//i.test(dataUrl)) return dataUrl;

  const blob = await (await fetch(dataUrl)).blob();
  const res = await fetch(FAL_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": blob.type || "application/octet-stream",
      "X-Fal-File-Name": filename || "upload.png",
    },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("[Meet Attire] fal upload failed, trying data URI", res.status, text.slice(0, 200));
    return dataUrl;
  }
  const json = await res.json().catch(() => null);
  const url = json && (json.access_url || json.url || json.file_url);
  if (!url) {
    console.warn("[Meet Attire] fal upload missing url field", json);
    return dataUrl;
  }
  return url;
}

async function handleTryOn(msg) {
  const falKey = await getFalKey();
  if (!falKey) {
    return {
      ok: false,
      code: "NO_KEY",
      error: "Add fal.ai API key in extension options for neural try-on",
    };
  }

  const personDataUrl = msg.personDataUrl;
  const garmentDataUrl = msg.garmentDataUrl;
  if (!personDataUrl || !garmentDataUrl) {
    return { ok: false, error: "person and garment images required" };
  }

  const humanUrl = await uploadDataUrl(falKey, personDataUrl, "person.png");
  const garmentUrl = await uploadDataUrl(falKey, garmentDataUrl, "garment.png");

  const body = {
    human_image_url: humanUrl,
    garment_image_url: garmentUrl,
    cloth_type: "upper",
    num_inference_steps: 30,
    guidance_scale: 2.5,
  };

  const res = await fetch(FAL_RUN, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `fal HTTP ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const json = await res.json();
  const imageUrl =
    (json && json.image && json.image.url) ||
    (json && json.images && json.images[0] && json.images[0].url) ||
    null;
  if (!imageUrl) {
    return { ok: false, error: "fal response missing image.url", raw: json };
  }

  let resultDataUrl = null;
  try {
    const imgRes = await fetch(imageUrl);
    const blob = await imgRes.blob();
    resultDataUrl = await blobToDataUrl(blob);
  } catch (e) {
    resultDataUrl = null;
  }

  return {
    ok: true,
    imageUrl,
    resultDataUrl,
    attireId: msg.attireId || null,
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}
