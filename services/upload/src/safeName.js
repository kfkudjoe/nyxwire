// Safe object name for storage + metadata id derivation.
// Reject path segments, traversal, and non-[a-zA-Z0-9._-] characters.
"use strict";

const path = require("path");

function safeName(name) {
  if (!name || typeof name !== "string") return null;
  if (name !== path.basename(name)) return null;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  return name;
}

/** Metadata id: stem of safe name, or full name if no extension. */
function idFromName(name) {
  const safe = safeName(name);
  if (!safe) return null;
  const stem = path.parse(safe).name;
  return stem || safe;
}

module.exports = { safeName, idFromName };
