import { createRequire } from "node:module";
import { Worker as NodeWorker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
const { WebR } = createRequire(import.meta.url)("webr");
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
// webR 0.6.1 uses an absolute Windows path for dynamic import in its Node worker.
// Use file URLs for this test adapter; the shipped browser runtime is unchanged.
if (process.platform === "win32") {
  const original = await readFile(
    new URL("../node_modules/webr/dist/webr-worker.js", import.meta.url),
    "utf8",
  );
  const patched = original.replace(
    'await import((await import("path")).default.resolve(e))',
    'await import((await import("url")).pathToFileURL((await import("path")).default.resolve(e)).href)',
  );
  if (patched === original)
    throw Error(
      "Review the Windows webR test adapter for this runtime version.",
    );
  const worker = new URL("../../artifacts/webr-worker.cjs", import.meta.url);
  await writeFile(worker, patched);
  globalThis.Worker = class extends NodeWorker {
    constructor(file, options) {
      super(fileURLToPath(worker), options);
    }
  };
}
const r = new WebR({ interactive: false });
await r.init();
await r.evalRVoid(await readFile("../research-pipeline/engine.R", "utf8"));
const fixtures = JSON.parse(
  await readFile("../artifacts/parity-fixtures.json", "utf8"),
);
let comparisons = 0;
function compare(a, b, path = "result") {
  if (path.endsWith("r_version")) return;
  if (typeof a === "number") {
    if (!Number.isFinite(b) || Math.abs(a - b) > 1e-8 + 1e-6 * Math.abs(a))
      throw Error(`${path}: ${a} != ${b}`);
    comparisons++;
  } else if (a && typeof a === "object") {
    for (const key of Object.keys(a))
      compare(a[key], b?.[key], `${path}.${key}`);
  } else if (a !== b) throw Error(`${path}: ${a} != ${b}`);
}
const timings = [];
try {
  for (const fixture of fixtures) {
    const started = performance.now();
    const shelter = await new r.Shelter();
    try {
      const input = await new shelter.RList(fixture.request);
      await r.objs.globalEnv.bind("lab_request", input);
      const out = JSON.parse(
        await (await shelter.evalR("run_json(lab_request)")).toString(),
      );
      compare(fixture.result, out);
      timings.push({
        model: fixture.request.model,
        mode: fixture.request.mode,
        prior: fixture.request.prior.family,
        milliseconds: Math.round(performance.now() - started),
      });
    } finally {
      await shelter.purge();
    }
  }
  await writeFile(
    "../artifacts/parity-report.json",
    JSON.stringify(
      { cases: fixtures.length, numeric_comparisons: comparisons, timings },
      null,
      2,
    ),
  );
  console.log(
    `${fixtures.length} R/webR cases passed; ${comparisons} numeric comparisons (atol 1e-8, rtol 1e-6).`,
  );
} finally {
  await r.close();
}
