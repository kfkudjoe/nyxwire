// Nyxwire metadata service
// Role: own video metadata in Mongo (separate DB from history).
// Inputs: PORT, DBHOST, DBNAME
// Outputs: GET /health, GET /videos, GET /videos/:id, PUT /videos/:id
// Failure: missing env; invalid id; mongo down (retry at boot).

"use strict";

const express = require("express");
const { MongoClient } = require("mongodb");
const { toVideoDoc } = require("./videoDoc");

const PORT = Number(process.env.PORT || 3000);
const DBHOST = process.env.DBHOST;
const DBNAME = process.env.DBNAME;
const SERVICE_NAME = process.env.SERVICE_NAME || "nyxwire-metadata";

if (!DBHOST || !DBNAME) {
  console.error("FATAL: set DBHOST and DBNAME");
  process.exit(1);
}

async function connectMongoWithRetry(uri, attempts = 30, delayMs = 2000) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const client = new MongoClient(uri);
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      console.warn(`mongo connect attempt ${i}/${attempts}: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function main() {
  const client = await connectMongoWithRetry(DBHOST);
  const col = client.db(DBNAME).collection("videos");

  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", async (_req, res) => {
    const count = await col.countDocuments();
    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      brand: "nyxwire",
      videoCount: count,
    });
  });

  app.get("/videos", async (_req, res) => {
    const items = await col.find({}).sort({ updatedAt: -1 }).limit(100).toArray();
    res.json({ count: items.length, items });
  });

  app.get("/videos/:id", async (req, res) => {
    const doc = await col.findOne({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: "not found" });
    res.json(doc);
  });

  app.put("/videos/:id", async (req, res) => {
    try {
      const doc = toVideoDoc({ ...req.body, id: req.params.id });
      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            title: doc.title,
            storageName: doc.storageName,
            brand: doc.brand,
            updatedAt: doc.updatedAt,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      const saved = await col.findOne({ _id: doc._id });
      res.status(200).json(saved);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`${SERVICE_NAME} on :${PORT} db=${DBNAME}`);
  });
}

main().catch((err) => {
  console.error("metadata failed:", err);
  process.exit(1);
});
