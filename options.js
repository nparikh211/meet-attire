(function () {
  const input = document.getElementById("falKey");
  const status = document.getElementById("status");

  chrome.storage.local.get(["falKey"], (res) => {
    if (res && res.falKey) input.value = res.falKey;
  });

  document.getElementById("save").addEventListener("click", () => {
    const falKey = input.value.trim();
    chrome.storage.local.set({ falKey }, () => {
      status.className = "status ok";
      status.textContent = falKey ? "Saved. Neural try-on enabled on outfit change." : "Saved empty key — local PNG warp only.";
    });
  });

  document.getElementById("clear").addEventListener("click", () => {
    input.value = "";
    chrome.storage.local.remove(["falKey"], () => {
      status.className = "status ok";
      status.textContent = "Key cleared. Local photoreal PNG warp only.";
    });
  });

  document.getElementById("toggle").addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
})();
