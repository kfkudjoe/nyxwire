// Nyxwire upload service
// Role: accept raw video bytes, store them, register metadata.
// Inputs: PORT, STORAGE_URL, METADATA_URL, SERVICE_NAME
// Outputs: GET /health, POST /upload?name= (raw body)
// Flow: bytes → PUT storage /video?name= → PUT metadata /videos/:id
// Failure: missing env/name/body; upstream 4xx/5xx → surface status.

"use strict";

const express = require("express");
const { safeName, idFromName } = require("./safeName");

const PORT = Number(process.env.PORT || 3000);
const STORAGE_URL = process.env.STORAGE_URL;
const METADATA_URL = process.env.METADATA_URL;
const SERVICE_NAME = process.env.SERVICE_NAME || "nyxwire-upload";

if (!STORAGE_URL || !METADATA_URL) {
  console.error("FATAL: set STORAGE_URL and METADATA_URL");
  process.exit(1);
}

async function putStorage(name, body) {
  const url = `${STORAGE_URL.replace(/\/$/, "")}/video?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json.error || text || `storage ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function putMetadata(id, { title, storageName }) {
  const url = `${METADATA_URL.replace(/\/$/, "")}/videos/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, storageName }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json.error || text || `metadata ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function createApp() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      brand: "nyxwire",
      upstreams: { storage: STORAGE_URL, metadata: METADATA_URL },
    });
  });

  // Raw body upload — Content-Type: application/octet-stream (or any)
  // Query: name= (required), title= (optional), id= (optional metadata id)
  app.post(
    "/upload",
    express.raw({ type: "*/*", limit: "50mb" }),
    async (req, res) => {
      const name = safeName(req.query.name);
      if (!name) {
        return res.status(400).json({ error: "invalid or missing name" });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "empty body" });
      }

      const id =
        typeof req.query.id === "string" && safeName(req.query.id)
          ? safeName(req.query.id)
          : idFromName(name);
      const title =
        typeof req.query.title === "string" && req.query.title.length > 0
          ? req.query.title
          : name;

      try {
        const stored = await putStorage(name, req.body);
        const meta = await putMetadata(id, { title, storageName: name });
        res.status(201).json({
          ok: true,
          brand: "nyxwire",
          name,
          id,
          bytes: req.body.length,
          storage: stored,
          metadata: meta,
        });
      } catch (err) {
        const status = err.status && err.status >= 400 ? err.status : 502;
        res.status(status).json({ error: err.message || "upstream failed" });
      }
    }
  );

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`${SERVICE_NAME} on :${PORT}`);
    console.log(`  storage  → ${STORAGE_URL}`);
    console.log(`  metadata → ${METADATA_URL}`);
  });
}

module.exports = { createApp, safeName, idFromName };
