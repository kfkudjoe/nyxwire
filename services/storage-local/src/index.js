// Nyxwire storage-local
// Role: own video bytes on local FS (volume). Stream + simple put.
// Inputs: PORT, STORAGE_DIR (default /data)
// Outputs: GET /health, GET /video?name=, PUT /video?name= (raw body)
// Failure: missing name/file → 4xx; never stores secrets.

"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "/data");
const SERVICE_NAME = process.env.SERVICE_NAME || "nyxwire-storage-local";

function safeName(name) {
  if (!name || typeof name !== "string") return null;
  // Reject anything that is not already a single path segment
  if (name !== path.basename(name)) return null;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  return name;
}

function createApp() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      brand: "nyxwire",
      storageDir: STORAGE_DIR,
    });
  });

  // List files (debug / ops)
  app.get("/files", (_req, res) => {
    fs.readdir(STORAGE_DIR, (err, files) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ count: files.length, files });
    });
  });

  app.get("/video", (req, res) => {
    const name = safeName(req.query.name || "sample.mp4");
    if (!name) return res.status(400).send("invalid name");
    const full = path.join(STORAGE_DIR, name);
    fs.stat(full, (err, stats) => {
      if (err) return res.status(404).send("not found");
      res.status(200);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", stats.size);
      fs.createReadStream(full).pipe(res);
    });
  });

  // Raw body put — Content-Type: application/octet-stream
  app.put(
    "/video",
    express.raw({ type: "*/*", limit: "50mb" }),
    (req, res) => {
      const name = safeName(req.query.name);
      if (!name) return res.status(400).send("invalid name");
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).send("empty body");
      }
      const full = path.join(STORAGE_DIR, name);
      fs.writeFile(full, req.body, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ ok: true, name, bytes: req.body.length });
      });
    }
  );

  return app;
}

if (require.main === module) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  // Volume mount often empty on first run — seed demo object once
  const seed = "/app/seed/sample.mp4";
  const target = path.join(STORAGE_DIR, "sample.mp4");
  if (!fs.existsSync(target) && fs.existsSync(seed)) {
    fs.copyFileSync(seed, target);
    console.log("seeded sample.mp4 into STORAGE_DIR");
  }
  createApp().listen(PORT, () => {
    console.log(`${SERVICE_NAME} on :${PORT} dir=${STORAGE_DIR}`);
  });
}

module.exports = { createApp, safeName };
