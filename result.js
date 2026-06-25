"use strict";

const heading = document.getElementById("heading");
const layersEl = document.getElementById("layers");
const copyBtn = document.getElementById("copy");

let finalText = "";

function render(data) {
  const { ok, layers, error } = data || {};

  if (!ok) {
    heading.textContent = error || "Could not decode";
    heading.className = "error";
    copyBtn.style.display = "none";
    return;
  }

  finalText = layers[layers.length - 1];
  const multi = layers.length > 1;
  heading.textContent = multi ? `Decode Result — ${layers.length} layers` : "Decode Result";
  heading.className = "ok";

  layers.forEach((text, i) => {
    const isFinal = i === layers.length - 1;
    const wrap = document.createElement("div");
    wrap.className = "layer" + (isFinal ? " final" : "");

    if (multi) {
      const t = document.createElement("div");
      t.className = "layer-title";
      t.textContent = isFinal ? `Layer ${i + 1} — final` : `Layer ${i + 1}`;
      wrap.appendChild(t);
    }

    const pre = document.createElement("pre");
    pre.textContent = text;
    wrap.appendChild(pre);
    layersEl.appendChild(wrap);
  });
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(finalText);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
  } catch {
    copyBtn.textContent = "Copy failed";
  }
});

chrome.storage.session.get("b64result").then((res) => {
  render(res.b64result);
  // One-shot payload: clear it so a later window doesn't show stale data.
  chrome.storage.session.remove("b64result");
});
