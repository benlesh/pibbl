import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

// Studio lessons must stay self-contained, with exactly one default mount export.
// Exercise the actual private pure helpers without widening the lesson's module surface.
const source = readFileSync(
  new URL(
    "../packages/scenarios/src/learning/composition/pipeline-health.example.tsx",
    import.meta.url,
  ),
  "utf8",
);
const start = source.indexOf("/** Private synthetic request telemetry helpers");
const end = source.indexOf(
  "/* ------------------------------------------------------------------ the data */",
  start,
);
assert.ok(start >= 0 && end > start);
const { summarizePathLatency } = new Function(
  `${stripTypeScriptTypes(source.slice(start, end))}; return { summarizePathLatency };`,
)();

test("path p95 uses aligned request totals rather than summed stage percentiles", () => {
  const first = Array.from({ length: 100 }, (_, i) => (i < 6 ? 100 : 0));
  const second = Array.from({ length: 100 }, (_, i) =>
    i >= 6 && i < 12 ? 100 : 0,
  );
  assert.deepEqual(summarizePathLatency([first, second]), {
    p95: 100,
    complete: true,
  });
});

test("missing stages yield a lower bound over the same request cohort", () => {
  assert.deepEqual(
    summarizePathLatency([
      [10, 20, 30],
      [null, null, null],
    ]),
    { p95: 30, complete: false },
  );
  assert.deepEqual(
    summarizePathLatency([
      [10, 20, 30],
      [4, 5, 6],
    ]),
    { p95: 36, complete: true },
  );
});
