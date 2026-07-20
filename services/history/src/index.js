// Nyxwire history service
// Role: consume "viewed" messages from RabbitMQ into MongoDB; list via HTTP.
// Inputs: PORT, RABBIT_URL, QUEUE_NAME, DBHOST (Mongo URI), DBNAME.
// Outputs: GET /health, GET /history, POST /viewed (HTTP fallback).
// Failure modes: broker/mongo down at boot (retry); bad JSON nack/drop.

"use strict";

const express = require("express");
const amqp = require("amqplib");
const { MongoClient } = require("mongodb");

const PORT = Number(process.env.PORT || 3000);
const RABBIT_URL = process.env.RABBIT_URL;
const QUEUE_NAME = process.env.QUEUE_NAME || "viewed";
const DBHOST = process.env.DBHOST;
const DBNAME = process.env.DBNAME;
const SERVICE_NAME = process.env.SERVICE_NAME || "nyxwire-history";

if (!RABBIT_URL) {
  console.error("FATAL: set RABBIT_URL");
  process.exit(1);
}
if (!DBHOST || !DBNAME) {
  console.error("FATAL: set DBHOST (Mongo URI) and DBNAME");
  process.exit(1);
}

async function connectAmqpWithRetry(url, attempts = 30, delayMs = 2000) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      lastErr = err;
      console.warn(`amqp connect attempt ${i}/${attempts}: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
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

/** Normalize inbound event into a Mongo document. */
function toDoc(body) {
  return {
    videoPath: body.videoPath || body.videoId || null,
    videoId: body.videoId || null,
    source: body.source || "unknown",
    brand: body.brand || "nyxwire",
    viewedAt: body.viewedAt ? new Date(body.viewedAt) : new Date(),
    receivedAt: new Date(),
  };
}

async function main() {
  const mongoClient = await connectMongoWithRetry(DBHOST);
  const db = mongoClient.db(DBNAME);
  // Collection private to history — other services must not write here.
  const viewed = db.collection("viewed");

  const conn = await connectAmqpWithRetry(RABBIT_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: false });
  await channel.prefetch(1);

  await channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
    try {
      const body = JSON.parse(msg.content.toString("utf8"));
      const doc = toDoc(body);
      await viewed.insertOne(doc);
      console.log("viewed recorded:", doc.videoPath || doc.videoId);
      channel.ack(msg);
    } catch (err) {
      console.error("bad message, discarding:", err.message);
      channel.nack(msg, false, false);
    }
  });

  const app = express();
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    const count = await viewed.countDocuments();
    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      brand: "nyxwire",
      count,
    });
  });

  // HTTP fallback — useful for smoke tests without going through streaming
  app.post("/viewed", async (req, res) => {
    const doc = toDoc({ ...req.body, source: req.body?.source || "http" });
    if (!doc.videoPath && !doc.videoId) {
      return res.status(400).json({ error: "videoPath or videoId required" });
    }
    const result = await viewed.insertOne(doc);
    res.status(201).json({ id: result.insertedId, ...doc });
  });

  app.get("/history", async (req, res) => {
    let limit = Number(req.query.limit || 20);
    if (!Number.isFinite(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;

    const events = await viewed
      .find({})
      .sort({ receivedAt: -1 })
      .limit(limit)
      .toArray();

    res.status(200).json({ count: events.length, events });
  });

  app.listen(PORT, () => {
    console.log(`${SERVICE_NAME} on :${PORT} queue=${QUEUE_NAME} db=${DBNAME}`);
  });
}

main().catch((err) => {
  console.error("history failed to start:", (err && err.stack) || err);
  process.exit(1);
});
