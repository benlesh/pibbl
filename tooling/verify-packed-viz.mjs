import {
  verifyCurveTreeShaking,
  verifyColorTreeShaking,
} from "./verify-viz-curve-tree-shaking.mjs";
import { verifyScaleTreeShaking } from "./verify-viz-scale-tree-shaking.mjs";
import assert from "node:assert/strict";
import { parse } from "yaml";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const store = dirname(
  parse(readFileSync(join(root, "node_modules/.modules.yaml"), "utf8"))
    .storeDir,
);
const temp = mkdtempSync(join(tmpdir(), "pibbl-packed-viz-"));
const pnpm = (args, cwd = root) =>
  execFileSync("corepack", ["pnpm@11.21.0", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
try {
  const tarballs = {};
  for (const name of ["core"]) {
    pnpm(
      ["pack", "--out", join(temp, `${name}.tgz`)],
      join(root, "packages", name),
    );
    tarballs[`@pibbl/${name}`] = `file:${join(temp, `${name}.tgz`)}`;
  }
  const consumer = join(temp, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies: tarballs }),
  );
  writeFileSync(join(consumer, "pnpm-workspace.yaml"), `packages:\n  - .\n`);
  pnpm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--strict-peer-dependencies",
      "--store-dir",
      store,
    ],
    consumer,
  );
  const installed = createRequire(join(consumer, "probe.mjs"));
  const entry = installed.resolve("@pibbl/core/viz");
  await verifyScaleTreeShaking(entry);
  await verifyCurveTreeShaking(entry);
  await verifyColorTreeShaking(entry);
  const fromViz = createRequire(entry);
  assert.equal(
    realpathSync(fromViz.resolve("@pibbl/core")),
    realpathSync(installed.resolve("@pibbl/core")),
  );
  const viz = await import(pathToFileURL(entry).href);
  const inspectionEntry = installed.resolve("@pibbl/core/viz/inspection");
  const inspection = await import(pathToFileURL(inspectionEntry).href);
  const names = [
    "extent",
    "linearTicks",
    "niceLinearDomain",
    "formatNumber",
    "interpolateNumericRange",
    "visibleOhlcPriceExtent",
    "padLinearDomain",
    "percentageReturns",
    "indexTo100",
    "simpleMovingAverage",
    "exponentialMovingAverage",
    "bollingerBands",
    "aggregateOhlcv",
    "sessionVwap",
    "relativeStrengthIndex",
    "movingAverageConvergenceDivergence",
    "stochasticOscillator",
    "utcTickLabels",
    "LogScale",
    "useLogScale",
    "SymlogScale",
    "useSymlogScale",
    "PointScale",
    "usePointScale",
    "GridLines",
    "ReferenceLine",
    "ReferenceBand",
    "RangeNavigator",
    "EditableReferenceLine",
    "EditableReferenceBand",
    "EditableTrendLine",
    "AxisTitle",
    "niceUTCDomain",
    "pieSlices",
    "PieLayout",
    "PieSlice",
    "PieLabel",
    "Axis",
    "LineSeries",
    "AreaSeries",
    "IntervalBandSeries",
    "HorizontalIntervalSeries",
    "IntervalDiamondSeries",
    "WeightedPointSeries",
    "TrajectorySeries",
    "PairedSeries",
    "CensoredPointSeries",
    "VerticalIntervalSeries",
    "stepBefore",
    "stepAfter",
    "stepMidpoint",
    "monotoneX",
    "panDomain",
    "zoomDomain",
    "SequentialColorScale",
    "useSequentialColorScale",
    "DivergingColorScale",
    "useDivergingColorScale",
    "ThresholdColorScale",
    "useThresholdColorScale",
    "LinearScale",
    "BarScale",
    "UTCScale",
    "TradingTimeScale",
    "useTradingTimeScale",
    "VolumeSeries",
    "CandlestickSeries",
    "OhlcBarSeries",
    "BaselineSeries",
    "ScaleAdjust",
    "useLinearScale",
    "useBarScale",
    "useUTCScale",
    "PointSeries",
    "BarSeries",
    "PlotSeries",
    "nearestDomainValue",
    "nearestPoint",
    "HoverData",
    "HoverCard",
    "AnchoredLayout",
    "defineSeries",
    "closestPoint",
    "closestX",
    "interpolateX",
    "linearInterpolation",
  ].sort();
  assert.deepEqual(Object.keys(viz).sort(), names);
  for (const name of [
    "anchorInsideClips",
    "firstSourceObservation",
    "lastSourceObservation",
    "nearestRecordedPoint",
    "nearestRecordedX",
    "paintedBarAt",
    "paintedPointAt",
    "sampleRecordedX",
    "useBarInspection",
    "useCandleInspection",
    "useOhlcBarInspection",
    "useVolumeInspection",
    "nearestRecordedCandleX",
    "nearestRecordedOhlcBarX",
    "nearestRecordedVolumeX",
    "paintedCandleAt",
    "paintedOhlcBarAt",
    "paintedVolumeAt",
    "useNumericInspection",
    "usePointInspection",
    "withInspection",
  ])
    assert.equal(typeof inspection[name], "function", `${name} must be public`);
  const observation = Object.freeze({
    datum: Object.freeze({ time: 1, value: 4 }),
    sourceIndex: 0,
    domainX: 1,
    domainY: 4,
    anchorLocal: Object.freeze({ x: 10, y: 20 }),
    anchorRoot: Object.freeze({ x: 30, y: 40 }),
    run: 0,
  });
  const numericRendered = Object.freeze({
    observations: Object.freeze([observation]),
    assertLive() {},
    domainXAtRoot(point) {
      return point.x;
    },
    anchorAtDomain({ domainX, domainY }) {
      return Object.freeze({
        anchorLocal: Object.freeze({ x: domainX, y: domainY }),
        anchorRoot: Object.freeze({ x: domainX + 20, y: domainY + 20 }),
      });
    },
    anchorInsideClips() {
      return true;
    },
  });
  assert.equal(
    inspection.nearestRecordedX(numericRendered, { domainX: 1 })?.datum,
    observation.datum,
  );
  assert.equal(
    inspection.nearestRecordedPoint(numericRendered, {
      rootPoint: { x: 30, y: 40 },
    })?.sourceIndex,
    0,
  );
  assert.equal(
    inspection.sampleRecordedX(numericRendered, {
      domainX: 1,
      interpolation: (before) => before,
    })?.kind,
    "exact",
  );
  const pointRendered = Object.freeze({
    ...numericRendered,
    marks: Object.freeze([
      Object.freeze({
        ...observation,
        radiusLocal: 4,
        fill: true,
        strokeWidthLocal: 0,
      }),
    ]),
    localAtRoot(point) {
      return point;
    },
  });
  assert.equal(
    inspection.paintedPointAt(pointRendered, { rootPoint: { x: 10, y: 20 } })
      ?.datum,
    observation.datum,
  );
  const barDatum = Object.freeze({ desk: "Rates" });
  const barRendered = Object.freeze({
    marks: Object.freeze([
      Object.freeze({
        datum: barDatum,
        sourceIndex: 0,
        category: "Rates",
        group: undefined,
        valueStart: -2,
        valueEnd: 5,
        boundsLocal: Object.freeze({ x: 10, y: 20, width: 30, height: 40 }),
        fill: true,
        strokeWidthLocal: 0,
      }),
    ]),
    assertLive() {},
    localAtRoot(point) {
      return point;
    },
    anchorInsideClips() {
      return true;
    },
  });
  assert.equal(
    inspection.paintedBarAt(barRendered, { rootPoint: { x: 25, y: 35 } })
      ?.datum,
    barDatum,
  );
  if (process.argv.includes("--self-test-missing-export"))
    assert.equal(typeof viz.MissingScale, "function");
  for (const path of [
    "@pibbl/core/viz/internal",
    "@pibbl/core/viz/src/index.ts",
    "@pibbl/core/viz/lib/scale",
  ])
    assert.throws(() => installed.resolve(path), {
      code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
    });
  const manifest = JSON.parse(
    readFileSync(installed.resolve("@pibbl/core/package.json"), "utf8"),
  );
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
  writeFileSync(
    join(consumer, "public.tsx"),
    readFileSync(join(root, "packages/core/type-tests/viz/public.tsx"), "utf8"),
  );
  writeFileSync(
    join(consumer, "inspection.tsx"),
    `
      /** @jsxImportSource @pibbl/core */
      import type { PibblNode } from "@pibbl/core";
      import { BarSeries, LineSeries, PointSeries, defineSeries } from "@pibbl/core/viz";
      import { useBarInspection, useNumericInspection, usePointInspection } from "@pibbl/core/viz/inspection";
      const observations = [{ time: 0, value: 4 }, { time: 1, value: 9 }] as const;
      const series = defineSeries({ data: observations, x: "time", y: "value" });
      const bars = [{ desk: "Rates", low: -2, high: 5 }] as const;
      export function InspectionConsumer(): PibblNode {
        const line = useNumericInspection(series);
        const points = usePointInspection(series);
        const bar = useBarInspection({ data: bars, category: "desk" });
        return <><LineSeries data={observations} x="time" y="value" xScale="time" yScale="value" inspection={line} /><PointSeries data={observations} x="time" y="value" xScale="time" yScale="value" inspection={points} /><BarSeries data={bars} category="desk" valueStart="low" valueEnd="high" categoryScale="desk" valueScale="risk" inspection={bar} /></>;
      }
    `,
  );
  const financialFiles = [
    "chart-editing.tsx",
    "interval-series.tsx",
    "interval-diamond-series.tsx",
    "weighted-point-series.tsx",
    "censored-point-series.tsx",
    "financial-candles.tsx",
    "financial-candle-inspection.tsx",
    "financial-ohlc-bars.tsx",
    "financial-baseline.tsx",
    "financial-aggregation.tsx",
    "financial-volume.tsx",
    "financial-volume-inspection.tsx",
    "financial-trading-time.tsx",
    "financial-percentage-returns.tsx",
    "financial-index-to-100.tsx",
    "financial-indicators.tsx",
    "financial-oscillators.tsx",
    "numeric-range-interpolation.tsx",
  ];
  for (const file of financialFiles)
    writeFileSync(
      join(consumer, file),
      readFileSync(join(root, "docs/site/minimal/viz", file), "utf8"),
    );
  const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
  for (const mode of ["Bundler", "NodeNext"]) {
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          lib: ["ESNext", "DOM"],
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
          jsx: "react-jsx",
          jsxImportSource: "@pibbl/core",
          module: mode === "Bundler" ? "ESNext" : "NodeNext",
          moduleResolution: mode,
        },
        files: ["public.tsx", "inspection.tsx", ...financialFiles],
      }),
    );
    execFileSync(
      process.execPath,
      [tsc, "-p", join(consumer, "tsconfig.json")],
      { encoding: "utf8", stdio: "pipe" },
    );
  }
  process.stdout.write(
    "Packed viz: Bundler, NodeNext, runtime exports, shared core identity, and private boundaries passed.\n",
  );
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
