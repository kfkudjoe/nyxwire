// Pure helper: storage-local video URL for streaming proxy.
"use strict";

/**
 * Build `${STORAGE_URL}/video?name=` for a given object name.
 * Empty/missing name defaults to sample.mp4 (storage-local convention).
 * @param {string} storageUrl base, e.g. http://storage:3000
 * @param {string} [name]
 * @returns {string}
 */
function buildStorageVideoUrl(storageUrl, name) {
  if (!storageUrl || typeof storageUrl !== "string") {
    throw new TypeError("storageUrl (string) required");
  }
  const base = storageUrl.replace(/\/$/, "");
  const n =
    name != null && String(name).trim() !== ""
      ? String(name).trim()
      : "sample.mp4";
  return `${base}/video?name=${encodeURIComponent(n)}`;
}

module.exports = { buildStorageVideoUrl };
