// Nyxwire gateway
// Role: single public entry — health + proxies to streaming, history, storage,
// metadata, upload.
// Inputs: PORT, STREAMING_URL, HISTORY_URL, STORAGE_URL, METADATA_URL, UPLOAD_URL.
// Outputs: GET /health; /video → streaming; /history|/viewed → history;
//   /storage/* → storage; /videos* → metadata; /upload → upload.
// Failure modes: missing upstream URLs; upstream down (502).
//
// Note: pathFilter (not app.use mount) keeps the full request path so upstreams
// still see /video and /history. Mounting with app.use('/video', proxy) strips
// the prefix and yields "Cannot GET /" on the target.

"use strict";

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = Number(process.env.PORT || 3000);
const STREAMING_URL = process.env.STREAMING_URL || "http://streaming:3000";
const HISTORY_URL = process.env.HISTORY_URL || "http://history:3000";
const STORAGE_URL = process.env.STORAGE_URL || "http://storage:3000";
const METADATA_URL = process.env.METADATA_URL || "http://metadata:3000";
const UPLOAD_URL = process.env.UPLOAD_URL || "http://upload:3000";
const SERVICE_NAME = process.env.SERVICE_NAME || "nyxwire-gateway";
// Default 60s — streaming may publish MQ before finishing body on slow hosts
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 60000);

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: SERVICE_NAME,
    brand: "nyxwire",
    upstreams: {
      streaming: STREAMING_URL,
      history: HISTORY_URL,
      storage: STORAGE_URL,
      metadata: METADATA_URL,
      upload: UPLOAD_URL,
    },
  });
});

const proxyCommon = {
  changeOrigin: true,
  proxyTimeout: PROXY_TIMEOUT_MS,
  timeout: PROXY_TIMEOUT_MS,
};

// Streaming: /video and /api/streaming/*
app.use(
  createProxyMiddleware({
    ...proxyCommon,
    target: STREAMING_URL,
    pathFilter: (pathname) =>
      pathname === "/video" ||
      pathname.startsWith("/video?") ||
      pathname.startsWith("/api/streaming"),
    pathRewrite: {
      "^/api/streaming": "",
    },
  })
);

// History: /history, /viewed, /api/history/*
app.use(
  createProxyMiddleware({
    ...proxyCommon,
    target: HISTORY_URL,
    pathFilter: (pathname) =>
      pathname === "/history" ||
      pathname.startsWith("/history?") ||
      pathname === "/viewed" ||
      pathname.startsWith("/viewed?") ||
      pathname.startsWith("/api/history"),
    pathRewrite: {
      "^/api/history": "",
    },
  })
);

// Storage: /storage/* → storage service paths (/video, /files)
app.use(
  createProxyMiddleware({
    ...proxyCommon,
    target: STORAGE_URL,
    pathFilter: (pathname) => pathname.startsWith("/storage"),
    pathRewrite: {
      "^/storage": "",
    },
  })
);

// Metadata: /videos* and /api/metadata/*
app.use(
  createProxyMiddleware({
    ...proxyCommon,
    target: METADATA_URL,
    pathFilter: (pathname) =>
      pathname === "/videos" ||
      pathname.startsWith("/videos/") ||
      pathname.startsWith("/api/metadata"),
    pathRewrite: {
      "^/api/metadata": "",
    },
  })
);

// Upload: POST /upload?name= (raw body) and /api/upload/*
app.use(
  createProxyMiddleware({
    ...proxyCommon,
    target: UPLOAD_URL,
    pathFilter: (pathname) =>
      pathname === "/upload" ||
      pathname.startsWith("/upload?") ||
      pathname.startsWith("/api/upload"),
    pathRewrite: {
      "^/api/upload": "",
    },
  })
);

app.get("/", (_req, res) => {
  res
    .status(200)
    .type("text")
    .send(
      "Nyxwire gateway · /health · /video · /history · /storage/video · /videos · /upload\n"
    );
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} on :${PORT}`);
  console.log(`  streaming → ${STREAMING_URL}`);
  console.log(`  history   → ${HISTORY_URL}`);
  console.log(`  storage   → ${STORAGE_URL}`);
  console.log(`  metadata  → ${METADATA_URL}`);
  console.log(`  upload    → ${UPLOAD_URL}`);
});
