import test from "node:test";
import assert from "node:assert/strict";
import { latestQueue } from "../src/latest-queue.mjs";
test("keeps one running and only the latest pending request", async () => {
  const seen = [];
  let release;
  const gate = new Promise((r) => (release = r));
  const run = latestQueue(async (input) => {
    seen.push(input);
    if (input === 1) await gate;
    return input;
  });
  const first = run(1);
  const second = run(2);
  const rejected = assert.rejects(second, /Superseded/);
  const third = run(3);
  release();
  await rejected;
  assert.equal(await first, 1);
  assert.equal(await third, 3);
  assert.deepEqual(seen, [1, 3]);
});
