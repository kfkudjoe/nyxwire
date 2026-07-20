// Unit tests for streaming viewed-payload helper + /health shape.
// Runner: node --test (no Jest). Safe without RabbitMQ or video file.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { buildViewedPayload } = require("../src/viewed");
const { createApp, SERVICE_NAME } = require("../src/index");

describe("buildViewedPayload", () => {
  it("returns nyxwire-branded event with ISO timestamp", () => {
    const at = new Date("2026-01-15T12:00:00.000Z");
    const payload = buildViewedPayload("/app/videos/sample.mp4", "streaming", at);
    assert.equal(payload.videoPath, "/app/videos/sample.mp4");
    assert.equal(payload.source, "streaming");
    assert.equal(payload.brand, "nyxwire");
    assert.equal(payload.viewedAt, "2026-01-15T12:00:00.000Z");
  });

  it("rejects missing videoPath", () => {
    assert.throws(() => buildViewedPayload(""), TypeError);
    assert.throws(() => buildViewedPayload(null), TypeError);
  });
});

describe("GET /health", () => {
  it("returns ok JSON with nyxwire brand", async () => {
    const app = createApp({ channel: null });
    const server = http.createServer(app);

    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });

    const { port } = server.address();
    const body = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/health`, (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              assert.equal(res.statusCode, 200);
              const json = JSON.parse(data);
              assert.equal(json.ok, true);
              assert.equal(json.service, SERVICE_NAME);
              assert.equal(json.brand, "nyxwire");
              resolve(data);
            } catch (e) {
              reject(e);
            }
          });
        })
        .on("error", reject);
    });

    assert.ok(body.includes("nyxwire"));
    await new Promise((resolve) => server.close(resolve));
  });
});
