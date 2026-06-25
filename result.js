"use strict";

const heading = document.getElementById("heading");
const layersEl = document.getElementById("layers");
const urlsEl = document.getElementById("urls");
const copyBtn = document.getElementById("copy");

let finalText = "";

// Matches http/https/ftp URLs as well as bare www. links.
const URL_RE = /\b(?:https?|ftp):\/\/[^\s<>"'`]+|\bwww\.[^\s<>"'`]+/gi;

// Returns the unique list of URLs found in `text`, with trailing
// punctuation (commas, periods, closing brackets) trimmed off.
function extractUrls(text) {
  const matches = text.match(URL_RE) || [];
  const seen = new Set();
  const urls = [];
  for (let url of matches) {
    url = url.replace(/[.,;:!?)\]}'"]+$/, "");
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

function renderUrls() {
  urlsEl.innerHTML = "";
  const urls = extractUrls(finalText);
  if (urls.length === 0) return;

  const title = document.createElement("div");
  title.className = "layer-title";
  title.textContent = urls.length > 1 ? `Detected URLs — ${urls.length}` : "Detected URL";
  urlsEl.appendChild(title);

  urls.forEach((url) => {
    const row = document.createElement("div");
    row.className = "url-row";

    const link = document.createElement("a");
    link.className = "url-text";
    link.href = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = url;

    const btn = document.createElement("button");
    btn.className = "ghost url-copy";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      } catch {
        btn.textContent = "Failed";
      }
    });

    row.appendChild(link);
    row.appendChild(btn);
    urlsEl.appendChild(row);
  });
}

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

  if (multi) {
    // Intermediate layers aren't fully decoded yet — collapse them by default
    // so the final result is what stands out. They stay one click away.
    const details = document.createElement("details");
    details.className = "layers-collapsed";

    const summary = document.createElement("summary");
    const count = layers.length - 1;
    summary.textContent = `${count} intermediate layer${count > 1 ? "s" : ""} (click to expand)`;
    details.appendChild(summary);

    for (let i = 0; i < layers.length - 1; i++) {
      details.appendChild(layerEl(layers[i], `Layer ${i + 1}`, false));
    }
    layersEl.appendChild(details);

    layersEl.appendChild(layerEl(finalText, `Layer ${layers.length} — final`, true));
  } else {
    layersEl.appendChild(layerEl(layers[0], null, true));
  }

  renderUrls();
}

function layerEl(text, title, isFinal) {
  const wrap = document.createElement("div");
  wrap.className = "layer" + (isFinal ? " final" : "");

  if (title) {
    const t = document.createElement("div");
    t.className = "layer-title";
    t.textContent = title;
    wrap.appendChild(t);
  }

  const pre = document.createElement("pre");
  pre.textContent = text;
  wrap.appendChild(pre);
  return wrap;
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
