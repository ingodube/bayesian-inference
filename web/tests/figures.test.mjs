import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bindFigure, posteriorFigure } from "../src/figures.mjs";
const defs = JSON.parse(
  await readFile(new URL("../public/figures.json", import.meta.url)),
);
const bindings = JSON.parse(
  await readFile(new URL("../public/bindings.json", import.meta.url)),
);
test("Python definitions bind R arrays without changing the source design", () => {
  const before = JSON.stringify(defs);
  const f = bindFigure(defs.observed, bindings.observed, {
    x: [1, 2],
    y: [0.4, 0.6],
    width: [0.8, 0.8],
    theory_x: [1, 2],
    theory_y: [0.5, 0.5],
  });
  assert.deepEqual(f.data[0].y, [0.4, 0.6]);
  assert.deepEqual(f.data[1].line, defs.observed.data[1].line);
  assert.equal(JSON.stringify(defs), before);
});
test("undefined prior omitted, coincident summaries grouped, range controllable", () => {
  const panel = {
    target: "mu",
    truth: 2,
    summary: {
      interval: { level: 0.95 },
      mean: { value: 1 },
      median: { value: 1 },
      mode: { values: 1 },
    },
    focus: [0, 2],
    expanded: [-5, 5],
    shade: { x: [0, 2], y: [0, 0] },
    curve: { x: [0, 1, 2], y: [0, 1, 0] },
    prior_curve: null,
  };
  const f = posteriorFigure(defs, bindings, panel, true);
  assert.deepEqual(f.data[1].x, []);
  assert.deepEqual(f.layout.xaxis.range, [-5, 5]);
  assert.equal(f.data.length, 5);
  assert.match(f.data[4].name, /Mean \/ Median \/ Mode/);
});
