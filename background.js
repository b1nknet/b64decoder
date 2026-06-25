"use strict";

const MENU_ID = "decode-base64-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Decode Base64: "%s"',
    contexts: ["selection"]
  });
});

// --- Base64 decode (UTF-8 aware), mirrors popup.js ---

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decode(text) {
  let b64 = text.trim().replace(/\s+/g, "");
  if (/[-_]/.test(b64)) {
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  }
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
    throw new Error("Selection is not valid Base64.");
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(b64ToBytes(b64));
}

function isMostlyPrintable(str) {
  if (!str) return false;
  let printable = 0;
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 0xfffd)) printable++;
  }
  return printable / [...str].length >= 0.9;
}

function isBase64Shape(str) {
  let s = str.trim().replace(/\s+/g, "");
  if (s.length < 8) return false;
  if (/[-_]/.test(s)) s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

// Peels every layer it can confidently identify; returns the layer list.
function decodeAll(text) {
  const layers = [];
  let current = text;
  for (let i = 0; i < 20; i++) {
    let decoded;
    try {
      decoded = decode(current);
    } catch {
      break;
    }
    if (decoded === current || decoded === "") break;
    if (i > 0 && !isMostlyPrintable(decoded)) break;
    layers.push(decoded);
    if (!isBase64Shape(decoded) || !isMostlyPrintable(decoded)) break;
    current = decoded;
  }
  return layers;
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;

  const decodedLayers = decodeAll(info.selectionText);
  const payload = decodedLayers.length > 0
    ? { ok: true, layers: decodedLayers }
    : { ok: false, error: "Selection is not valid Base64." };

  await chrome.storage.session.set({ b64result: payload });
  await chrome.windows.create({
    url: chrome.runtime.getURL("result.html"),
    type: "popup",
    width: 640,
    height: 540
  });
});
