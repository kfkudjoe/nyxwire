// Nyxwire gateway
// Role: single public entry — health + proxies to streaming and history.
// Inputs: PORT, STREAMING_URL, HISTORY_URL.
// Outputs: GET /health, /video → streaming, /history|/viewed → history.
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

app.get("/", (_req, res) => {
  res
    .status(200)
    .type("text")
    .send("Nyxwire gateway · /health · /video · /history · /storage/video\n");
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} on :${PORT}`);
  console.log(`  streaming → ${STREAMING_URL}`);
  console.log(`  history   → ${HISTORY_URL}`);
  console.log(`  storage   → ${STORAGE_URL}`);
});
