const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toVideoDoc } = require("../src/videoDoc");

test("builds doc", () => {
  const d = toVideoDoc({ id: "clip1", title: "Demo", storageName: "sample.mp4" });
  assert.equal(d._id, "clip1");
  assert.equal(d.brand, "nyxwire");
  assert.equal(d.storageName, "sample.mp4");
});

test("rejects path-like id", () => {
  assert.throws(() => toVideoDoc({ id: "../x" }), /invalid id/);
});
