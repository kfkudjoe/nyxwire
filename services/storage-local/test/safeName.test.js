const { test } = require("node:test");
const assert = require("node:assert/strict");
const { safeName } = require("../src/index");

test("accepts simple names", () => {
  assert.equal(safeName("sample.mp4"), "sample.mp4");
});

test("blocks path traversal", () => {
  assert.equal(safeName("../etc/passwd"), null);
  assert.equal(safeName("a/b"), null);
});
