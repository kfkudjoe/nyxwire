// Pure helpers for viewed-event payloads (unit-tested without AMQP).
"use strict";

/**
 * Build a JSON-serializable "viewed" event.
 * @param {string} videoPath
 * @param {string} [source]
 * @param {Date} [at]
 */
function buildViewedPayload(videoPath, source = "streaming", at = new Date()) {
  if (!videoPath || typeof videoPath !== "string") {
    throw new TypeError("videoPath (string) required");
  }
  return {
    videoPath,
    viewedAt: at.toISOString(),
    source,
    brand: "nyxwire",
  };
}

module.exports = { buildViewedPayload };
