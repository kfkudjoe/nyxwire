// Unit tests for storage URL helper + storage-mode /video proxy (mocked fetch).
// Runner: node --test (no Jest). Safe without RabbitMQ or real storage.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { Readable } = require("stream");
const { buildStorageVideoUrl } = require("../src/storageUrl");
const { createApp } = require("../src/index");

describe("buildStorageVideoUrl", () => {
  it("builds /video?name= with encoded name", () => {
    assert.equal(
      buildStorageVideoUrl("http://storage:3000", "sample.mp4"),
      "http://storage:3000/video?name=sample.mp4"
    );
  });

  it("strips trailing slash on base", () => {
    assert.equal(
      buildStorageVideoUrl("http://storage:3000/", "clip.mp4"),
      "http://storage:3000/video?name=clip.mp4"
    );
  });

  it("defaults empty name to sample.mp4", () => {
    assert.equal(
      buildStorageVideoUrl("http://storage:3000", ""),
      "http://storage:3000/video?name=sample.mp4"
    );
    assert.equal(
      buildStorageVideoUrl("http://storage:3000"),
      "http://storage:3000/video?name=sample.mp4"
    );
  });

  it("encodes special characters in name", () => {
    assert.equal(
      buildStorageVideoUrl("http://storage:3000", "a b.mp4"),
      "http://storage:3000/video?name=a%20b.mp4"
    );
  });

  it("rejects missing storageUrl", () => {
    assert.throws(() => buildStorageVideoUrl(""), TypeError);
    assert.throws(() => buildStorageVideoUrl(null), TypeError);
  });
});

describe("GET /video via STORAGE_URL", () => {
  it("proxies bytes from storage and publishes viewed", async () => {
    const bytes = Buffer.from("fake-mp4-bytes");
    let published = null;
    const channel = {
      sendToQueue(queue, buf) {
        published = { queue, payload: JSON.parse(buf.toString()) };
      },
    };

    const fetchImpl = async (url) => {
      assert.equal(url, "http://storage:3000/video?name=sample.mp4");
      return {
        ok: true,
        status: 200,
        headers: {
          get(h) {
            if (h === "content-type") return "video/mp4";
            if (h === "content-length") return String(bytes.length);
            return null;
          },
        },
        body: Readable.toWeb(Readable.from([bytes])),
      };
    };

    const app = createApp({
      channel,
      storageUrl: "http://storage:3000",
      queueName: "viewed",
      fetchImpl,
    });
    const server = http.createServer(app);

    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    const { port } = server.address();

    const result = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/video?name=sample.mp4`, (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            resolve({
              status: res.statusCode,
              body: Buffer.concat(chunks),
              type: res.headers["content-type"],
            });
          });
        })
        .on("error", reject);
    });

    assert.equal(result.status, 200);
    assert.equal(result.type, "video/mp4");
    assert.deepEqual(result.body, bytes);
    assert.ok(published);
    assert.equal(published.queue, "viewed");
    assert.equal(published.payload.videoPath, "sample.mp4");
    assert.equal(published.payload.brand, "nyxwire");
    assert.equal(published.payload.source, "streaming");

    await new Promise((resolve) => server.close(resolve));
  });

  it("returns 404 when storage reports not found", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      body: null,
    });

    const app = createApp({
      channel: null,
      storageUrl: "http://storage:3000",
      fetchImpl,
    });
    const server = http.createServer(app);

    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    const { port } = server.address();

    const status = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/video?name=missing.mp4`, (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        })
        .on("error", reject);
    });

    assert.equal(status, 404);
    await new Promise((resolve) => server.close(resolve));
  });
});
