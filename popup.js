"use strict";

const input = document.getElementById("input");
const output = document.getElementById("output");
const status = document.getElementById("status");
const urlSafe = document.getElementById("url-safe");
const recursive = document.getElementById("recursive");
const recursiveLabel = document.getElementById("recursive-label");
const modeDecode = document.getElementById("mode-decode");
const modeEncode = document.getElementById("mode-encode");
const clearBtn = document.getElementById("clear");
const copyBtn = document.getElementById("copy");
const openWindowBtn = document.getElementById("open-window");

let mode = "decode";
let currentLayers = []; // layers of the latest successful result (final = last)

// --- Base64 helpers (UTF-8 aware) ---

function bytesToB64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encode(text, useUrlSafe) {
  const bytes = new TextEncoder().encode(text);
  let b64 = bytesToB64(bytes);
  if (useUrlSafe) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
}

function decode(text, useUrlSafe) {
  let b64 = text.trim().replace(/\s+/g, "");
  if (useUrlSafe || /[-_]/.test(b64)) {
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  }
  // Restore padding
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
    throw new Error("Input is not valid Base64.");
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(b64ToBytes(b64));
}

// --- Recursive decoding (multiple layers) ---

function isMostlyPrintable(str) {
  if (!str) return false;
  let printable = 0;
  for (const ch of str) {
    const c = ch.codePointAt(0);
    // tab/newline/cr, or any non-control char that isn't the U+FFFD replacement
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 0xfffd)) printable++;
  }
  return printable / [...str].length >= 0.9;
}

function isBase64Shape(str, useUrlSafe) {
  let s = str.trim().replace(/\s+/g, "");
  if (s.length < 8) return false; // too short to confidently call another layer
  if (useUrlSafe || /[-_]/.test(s)) s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

// Peels every layer it can confidently identify. Returns the list of layers
// (layers[0] = first decode, last = deepest). Always returns at least one
// layer if the input decodes at all.
function decodeAll(text, useUrlSafe) {
  const layers = [];
  let current = text;
  for (let i = 0; i < 20; i++) {
    let decoded;
    try {
      decoded = decode(current, useUrlSafe);
    } catch {
      break;
    }
    if (decoded === current || decoded === "") break;
    // Past the first layer, only accept results that look like real text.
    if (i > 0 && !isMostlyPrintable(decoded)) break;
    layers.push(decoded);
    // Only go deeper when the result still looks like decodable Base64.
    if (!isBase64Shape(decoded, useUrlSafe) || !isMostlyPrintable(decoded)) break;
    current = decoded;
  }
  return layers;
}

// --- UI ---

function setStatus(msg, kind) {
  status.textContent = msg || "";
  status.className = "status" + (kind ? " " + kind : "");
}

function run() {
  const text = input.value;
  if (!text.trim()) {
    output.value = "";
    currentLayers = [];
    setStatus("");
    return;
  }
  try {
    if (mode === "encode") {
      output.value = encode(text, urlSafe.checked);
      currentLayers = [output.value];
      setStatus("");
    } else if (recursive.checked) {
      const layers = decodeAll(text, urlSafe.checked);
      if (layers.length === 0) throw new Error("Input is not valid Base64.");
      output.value = layers[layers.length - 1];
      currentLayers = layers;
      setStatus(
        layers.length > 1 ? `Decoded ${layers.length} layers (deepest shown).` : "",
        layers.length > 1 ? "ok" : null
      );
    } else {
      output.value = decode(text, urlSafe.checked);
      currentLayers = [output.value];
      setStatus("");
    }
  } catch (err) {
    output.value = "";
    currentLayers = [];
    setStatus(err.message, "error");
  }
}

function setMode(next) {
  mode = next;
  const decoding = mode === "decode";
  modeDecode.classList.toggle("active", decoding);
  modeEncode.classList.toggle("active", !decoding);
  modeDecode.setAttribute("aria-selected", String(decoding));
  modeEncode.setAttribute("aria-selected", String(!decoding));
  input.placeholder = decoding ? "Paste Base64 text here…" : "Type text to encode…";
  recursiveLabel.style.display = decoding ? "" : "none";
  run();
}

modeDecode.addEventListener("click", () => setMode("decode"));
modeEncode.addEventListener("click", () => setMode("encode"));
input.addEventListener("input", run);
urlSafe.addEventListener("change", run);
recursive.addEventListener("change", run);

clearBtn.addEventListener("click", () => {
  input.value = "";
  output.value = "";
  setStatus("");
  input.focus();
});

openWindowBtn.addEventListener("click", async () => {
  if (currentLayers.length === 0) {
    setStatus("Nothing to open.", "error");
    return;
  }
  await chrome.storage.session.set({ b64result: { ok: true, layers: currentLayers } });
  await chrome.windows.create({
    url: chrome.runtime.getURL("result.html"),
    type: "popup",
    width: 640,
    height: 540
  });
});

copyBtn.addEventListener("click", async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    setStatus("Copied to clipboard.", "ok");
    setTimeout(() => setStatus(""), 1500);
  } catch {
    setStatus("Could not copy.", "error");
  }
});
