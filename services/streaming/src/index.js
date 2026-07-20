// Nyxwire streaming service
// Role: stream a local video file; publish a "viewed" event to RabbitMQ.
// Inputs: PORT, VIDEO_PATH, RABBIT_URL, QUEUE_NAME (default "viewed").
// Outputs: GET /health, GET /video (mp4 + side-effect publish).
// Failure modes: missing env; broker down at boot (retry); publish fail logged only.

"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const amqp = require("amqplib");
const { buildViewedPayload } = require("./viewed");

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
 * Build Express app. channel may be null in tests that only hit /health.
 * @param {{ channel?: object | null, videoPath?: string, queueName?: string }} opts
 */
function createApp(opts = {}) {
  const channel = opts.channel ?? null;
  const videoPath = opts.videoPath || process.env.VIDEO_PATH || "";
  const queueName = opts.queueName || QUEUE_NAME;
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: SERVICE_NAME,
      brand: "nyxwire",
    });
  });

  app.get("/video", (req, res) => {
    if (!videoPath) {
      return res.status(500).send("VIDEO_PATH not configured");
    }
    const resolved = path.resolve(videoPath);
    fs.stat(resolved, (err, stats) => {
      if (err) {
        console.error("video missing:", resolved, err.message);
        return res.status(404).send("video not found");
      }

      // Side-effect: notify history (and any other consumers)
      if (channel) {
        try {
          const payload = buildViewedPayload(resolved, "streaming");
          channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(payload)),
            { contentType: "application/json" }
          );
        } catch (pubErr) {
          console.error("publish failed:", pubErr.message);
        }
      }

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
  const RABBIT_URL = process.env.RABBIT_URL;

  if (!VIDEO_PATH) {
    console.error("FATAL: set VIDEO_PATH");
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

  const app = createApp({ channel, videoPath: VIDEO_PATH });
  app.listen(PORT, () => {
    console.log(`${SERVICE_NAME} on :${PORT} queue=${QUEUE_NAME}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("streaming failed to start:", (err && err.stack) || err);
    process.exit(1);
  });
}

module.exports = { createApp, buildViewedPayload, SERVICE_NAME };
