// Nyxwire streaming service
// Role: stream video (local file or storage-local proxy); publish "viewed" to RabbitMQ.
// Inputs: PORT, VIDEO_PATH and/or STORAGE_URL, RABBIT_URL, QUEUE_NAME (default "viewed").
// Outputs: GET /health, GET /video?name= (mp4 + side-effect publish).
// Failure modes: missing env; broker down at boot (retry); publish fail logged only.
// STORAGE_URL set → fetch `${STORAGE_URL}/video?name=` and pipe; else VIDEO_PATH local file.

"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const amqp = require("amqplib");
const { buildViewedPayload } = require("./viewed");
const { buildStorageVideoUrl } = require("./storageUrl");

const PORT = Number(process.env.PORT || 3000);
const QUEUE_NAME = process.env.QUEUE_NAME || "viewed";
const SERVICE_NAME = process.env.SERVICE_NAME || "nyxwire-streaming";

/** Retry connect until broker accepts (Compose race / restart). */
async function connectWithRetry(url, attempts = 30, delayMs = 2000) {
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

/**
 * Publish viewed event; never throws to caller (log only).
 * @param {object | null} channel
 * @param {string} queueName
 * @param {string} videoPath
 */
function publishViewed(channel, queueName, videoPath) {
  if (!channel) return;
  try {
    const payload = buildViewedPayload(videoPath, "streaming");
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
      contentType: "application/json",
    });
  } catch (pubErr) {
    console.error("publish failed:", pubErr.message);
  }
}

/**
 * Build Express app. channel may be null in tests that only hit /health.
 * @param {{
 *   channel?: object | null,
 *   videoPath?: string,
 *   storageUrl?: string,
 *   queueName?: string,
 *   fetchImpl?: typeof fetch
 * }} opts
 */
function createApp(opts = {}) {
  const channel = opts.channel ?? null;
  const videoPath = opts.videoPath || process.env.VIDEO_PATH || "";
  const storageUrl =
    opts.storageUrl !== undefined
      ? opts.storageUrl
      : process.env.STORAGE_URL || "";
  const queueName = opts.queueName || QUEUE_NAME;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      brand: "nyxwire",
      source: storageUrl ? "storage" : "local",
    });
  });

  app.get("/video", async (req, res) => {
    const name = req.query.name;

    // Prefer storage-local when STORAGE_URL is configured
    if (storageUrl) {
      const url = buildStorageVideoUrl(storageUrl, name);
      const logicalPath =
        name != null && String(name).trim() !== ""
          ? String(name).trim()
          : "sample.mp4";

      try {
        const upstream = await fetchImpl(url);
        if (!upstream.ok) {
          const status = upstream.status === 404 ? 404 : 502;
          const msg =
            upstream.status === 404 ? "video not found" : "storage upstream error";
          console.error("storage fetch failed:", url, upstream.status);
          return res.status(status).send(msg);
        }

        publishViewed(channel, queueName, logicalPath);

        res.status(200);
        res.setHeader(
          "Content-Type",
          upstream.headers.get("content-type") || "video/mp4"
        );
        const cl = upstream.headers.get("content-length");
        if (cl) res.setHeader("Content-Length", cl);

        if (!upstream.body) {
          return res.end();
        }

        const nodeStream = Readable.fromWeb(upstream.body);
        nodeStream.on("error", (streamErr) => {
          console.error("storage stream error:", streamErr.message);
          if (!res.headersSent) res.status(500).end("stream failed");
          else res.destroy(streamErr);
        });
        req.on("close", () => nodeStream.destroy());
        nodeStream.pipe(res);
      } catch (err) {
        console.error("storage fetch error:", err.message);
        if (!res.headersSent) res.status(502).send("storage unreachable");
      }
      return;
    }

    // Backward-compatible local file path
    if (!videoPath) {
      return res.status(500).send("VIDEO_PATH not configured");
    }
    const resolved = path.resolve(videoPath);
    fs.stat(resolved, (err, stats) => {
      if (err) {
        console.error("video missing:", resolved, err.message);
        return res.status(404).send("video not found");
      }

      publishViewed(channel, queueName, resolved);

      res.status(200);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", stats.size);
      const stream = fs.createReadStream(resolved);
      stream.on("error", (streamErr) => {
        console.error("stream error:", streamErr.message);
        if (!res.headersSent) res.status(500).end("stream failed");
        else res.destroy(streamErr);
      });
      req.on("close", () => stream.destroy());
      stream.pipe(res);
    });
  });

  return app;
}

async function main() {
  const VIDEO_PATH = process.env.VIDEO_PATH;
  const STORAGE_URL = process.env.STORAGE_URL;
  const RABBIT_URL = process.env.RABBIT_URL;

  if (!STORAGE_URL && !VIDEO_PATH) {
    console.error("FATAL: set STORAGE_URL or VIDEO_PATH");
    process.exit(1);
  }
  if (!RABBIT_URL) {
    console.error("FATAL: set RABBIT_URL (e.g. amqp://nyxwire:nyxwire@rabbit:5672)");
    process.exit(1);
  }

  const conn = await connectWithRetry(RABBIT_URL);
  const channel = await conn.createChannel();
  // durable:false keeps local MVP simple; prod often durable:true + persistent msgs
  await channel.assertQueue(QUEUE_NAME, { durable: false });

  const app = createApp({
    channel,
    videoPath: VIDEO_PATH,
    storageUrl: STORAGE_URL || "",
  });
  app.listen(PORT, () => {
    const mode = STORAGE_URL ? `storage=${STORAGE_URL}` : `file=${VIDEO_PATH}`;
    console.log(`${SERVICE_NAME} on :${PORT} queue=${QUEUE_NAME} ${mode}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("streaming failed to start:", (err && err.stack) || err);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  buildViewedPayload,
  buildStorageVideoUrl,
  SERVICE_NAME,
};
