// Normalize POST body into a metadata document (history DB ownership separate).
"use strict";

function toVideoDoc(body) {
  if (!body || typeof body !== "object") {
    throw new Error("body required");
  }
  const id = body.id || body.videoId;
  if (!id || typeof id !== "string") {
    throw new Error("id required");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new Error("invalid id");
  }
  return {
    _id: id,
    title: typeof body.title === "string" ? body.title : id,
    storageName: typeof body.storageName === "string" ? body.storageName : null,
    brand: "nyxwire",
    updatedAt: new Date(),
  };
}

module.exports = { toVideoDoc };
