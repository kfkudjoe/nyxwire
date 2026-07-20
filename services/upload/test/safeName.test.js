const { test } = require("node:test");
const assert = require("node:assert/strict");
const { safeName, idFromName } = require("../src/safeName");

test("accepts simple names", () => {
  assert.equal(safeName("clip.mp4"), "clip.mp4");
});

test("blocks path traversal", () => {
  assert.equal(safeName("../etc/passwd"), null);
  assert.equal(safeName("a/b"), null);
});

test("idFromName uses stem", () => {
  assert.equal(idFromName("demo.mp4"), "demo");
  assert.equal(idFromName("bad/name"), null);
});
