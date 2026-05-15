// src/lib/snapshot.js
import LZString from 'lz-string';

export function encodeSnapshot(state) {
  const json = JSON.stringify(state);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeSnapshot(encoded) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getSnapshotFromURL() {
  const params = new URLSearchParams(window.location.search);
  const snap = params.get('snapshot');
  if (!snap) return null;
  return decodeSnapshot(snap);
}

export function buildSnapshotURL(state) {
  const encoded = encodeSnapshot(state);
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('snapshot', encoded);
  return url.toString();
}
