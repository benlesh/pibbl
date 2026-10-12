import { expect, it } from "vitest";
import {
  firstSourceObservation,
  lastSourceObservation,
  anchorInsideClips,
  nearestRecordedPoint,
  nearestRecordedX,
  sampleRecordedX,
} from "../../../src/features/viz/inspection/queries.js";
import { linearInterpolation } from "../../../src/features/viz/lib/hover-queries.js";
import type {
  NumericRenderedObservation,
  NumericRenderedSeries,
} from "../../../src/features/viz/inspection/query-types.js";

type Row = Readonly<{ id: string; x: number; y: number }>;

function observation(
  datum: Row,
  sourceIndex: number,
  options: Partial<
    Pick<NumericRenderedObservation<Row>, "run" | "anchorLocal" | "anchorRoot">
  > = {},
): NumericRenderedObservation<Row> {
  return Object.freeze({
    datum,
    sourceIndex,
    domainX: datum.x,
    domainY: datum.y,
    anchorLocal: options.anchorLocal ?? { x: datum.x * 10, y: datum.y * 10 },
    anchorRoot: options.anchorRoot ?? { x: datum.x * 10, y: datum.y * 10 },
    run: options.run ?? 0,
  });
}

function rendered(
  observations: readonly NumericRenderedObservation<Row>[],
  options: Partial<
    Pick<
      NumericRenderedSeries<Row>,
      "domainXAtRoot" | "anchorAtDomain" | "anchorInsideClips"
    >
  > = {},
) {
  let live = true;
  const series: NumericRenderedSeries<Row> = {
    observations,
    assertLive() {
      if (!live) throw new Error("RenderedSeries is no longer live.");
    },
    domainXAtRoot: options.domainXAtRoot ?? ((point) => point.x / 10),
    anchorAtDomain:
      options.anchorAtDomain ??
      ((point) => {
        const exact = observations.find(
          (observation) =>
            observation.domainX === point.domainX &&
            observation.domainY === point.domainY,
        );
        return exact
          ? {
              anchorLocal: exact.anchorLocal,
              anchorRoot: exact.anchorRoot,
            }
          : {
              anchorLocal: { x: point.domainX * 10, y: point.domainY * 10 },
              anchorRoot: { x: point.domainX * 10, y: point.domainY * 10 },
            };
      }),
    anchorInsideClips: options.anchorInsideClips ?? (() => true),
  };
  return { series, dispose: () => (live = false) };
}

it("selects recorded rows by domain x with source-order ties and explicit domain units", () => {
  const first = { id: "first", x: 4, y: 9 };
  const second = { id: "second", x: 6, y: 3 };
  const { series } = rendered([observation(first, 7), observation(second, 11)]);

  expect(nearestRecordedX(series, { domainX: 5 })).toMatchObject({
    datum: first,
    sourceIndex: 7,
    domainX: 4,
    domainY: 9,
    domainDelta: 1,
    anchorLocal: { x: 40, y: 90 },
    anchorRoot: { x: 40, y: 90 },
  });
  expect(
    nearestRecordedX(series, { domainX: 5, maxDomainDelta: 0.5 }),
  ).toBeUndefined();
  expect(nearestRecordedX(series, { domainX: undefined })).toBeUndefined();
});

it("selects nearest records in root-logical units and filters captured observations", () => {
  const hidden = { id: "hidden", x: 1, y: 1 };
  const visible = { id: "visible", x: 9, y: 9 };
  const { series } = rendered([
    observation(hidden, 0, { anchorRoot: { x: 101, y: 100 } }),
    observation(visible, 3, { anchorRoot: { x: 103, y: 100 } }),
  ]);

  expect(
    nearestRecordedPoint(series, {
      rootPoint: { x: 100, y: 100 },
      filter: (row) => row.datum.id === "visible",
    }),
  ).toMatchObject({ datum: visible, sourceIndex: 3, rootDistance: 3 });
  expect(
    nearestRecordedPoint(series, {
      rootPoint: { x: 100, y: 100 },
      maxRootDistance: 2,
    }),
  ).toMatchObject({ datum: hidden, rootDistance: 1 });
});

it("samples only within a captured run, rejecting duplicates unless a resolver is supplied", () => {
  const a = { id: "a", x: 0, y: 10 };
  const duplicate = { id: "duplicate", x: 0, y: 20 };
  const b = { id: "b", x: 10, y: 30 };
  const nextRun = { id: "next-run", x: 20, y: 40 };
  const { series } = rendered([
    observation(a, 2),
    observation(duplicate, 4),
    observation(b, 8),
    observation(nextRun, 12, { run: 1 }),
  ]);

  expect(
    sampleRecordedX(series, {
      domainX: 0,
      interpolation: linearInterpolation(),
      resolveDuplicate: lastSourceObservation,
    }),
  ).toMatchObject({ kind: "exact", datum: duplicate, sourceIndex: 4 });
  expect(
    sampleRecordedX(series, {
      domainX: 5,
      interpolation: linearInterpolation(),
      resolveDuplicate: firstSourceObservation,
    }),
  ).toMatchObject({
    kind: "interpolated",
    domainX: 5,
    domainY: 20,
    before: expect.objectContaining({ datum: a, sourceIndex: 2 }),
    after: expect.objectContaining({ datum: b, sourceIndex: 8 }),
    fraction: 0.5,
    anchorLocal: { x: 50, y: 200 },
    anchorRoot: { x: 50, y: 200 },
  });
  expect(
    sampleRecordedX(series, {
      domainX: 15,
      interpolation: linearInterpolation(),
      resolveDuplicate: firstSourceObservation,
    }),
  ).toBeUndefined();
  expect(() =>
    sampleRecordedX(series, {
      domainX: 0,
      interpolation: linearInterpolation(),
    }),
  ).toThrow(/duplicate.*resolveDuplicate/i);
});

it("uses captured root inversion only when callers request it and rejects stale snapshots", () => {
  const row = { id: "row", x: 3, y: 4 };
  const { series, dispose } = rendered([observation(row, 0)], {
    domainXAtRoot: (point) => (point.x === 30 ? 3 : undefined),
  });

  expect(series.domainXAtRoot({ x: 30, y: 70 })).toBe(3);
  expect(nearestRecordedX(series, { domainX: 3 })?.datum).toBe(row);
  dispose();
  expect(() => nearestRecordedX(series, { domainX: 3 })).toThrow(/live/i);
});

it("does not sample across clipped observations and validates captured order before filtering", () => {
  const first = { id: "first", x: 0, y: 0 };
  const hidden = { id: "hidden", x: 10, y: 10 };
  const last = { id: "last", x: 20, y: 20 };
  const linear = (before: number, after: number, fraction: number) =>
    before * (1 - fraction) + after * fraction;
  const { series } = rendered(
    [observation(first, 0), observation(hidden, 1), observation(last, 2)],
    { anchorInsideClips: (point) => point.x !== 100 },
  );

  expect(
    sampleRecordedX(series, {
      domainX: 10,
      interpolation: linear,
      resolveDuplicate: firstSourceObservation,
      filter: anchorInsideClips,
    }),
  ).toBeUndefined();

  const unordered = rendered([
    observation(last, 2),
    observation(first, 0),
  ]).series;
  expect(() =>
    sampleRecordedX(unordered, {
      domainX: 0,
      interpolation: linear,
      resolveDuplicate: firstSourceObservation,
      filter: () => false,
    }),
  ).toThrow(/nondecreasing/);
});

it("keeps default searches clip-agnostic while filters split gaps and remove duplicate ambiguity", () => {
  const first = { id: "first", x: 0, y: 2 };
  const hiddenDuplicate = { id: "hidden-duplicate", x: 0, y: 8 };
  const last = { id: "last", x: 10, y: 12 };
  const { series } = rendered(
    [observation(first, 2), observation(hiddenDuplicate, 4), observation(last, 8)],
    { anchorInsideClips: (point) => point.y !== 80 },
  );

  expect(nearestRecordedX(series, { domainX: 0 })?.datum).toBe(first);
  expect(
    sampleRecordedX(series, {
      domainX: 0,
      interpolation: linearInterpolation(),
      filter: anchorInsideClips,
    }),
  ).toMatchObject({ kind: "exact", datum: first, sourceIndex: 2 });
  expect(
    sampleRecordedX(series, {
      domainX: 5,
      interpolation: linearInterpolation(),
      filter: anchorInsideClips,
    }),
  ).toBeUndefined();
  expect(
    sampleRecordedX(series, {
      domainX: 5,
      interpolation: linearInterpolation(),
      resolveDuplicate: firstSourceObservation,
      maxDomainGap: 9,
    }),
  ).toBeUndefined();
});

it("rejects nonfinite requests and limits before inspecting observations", () => {
  const row = { id: "row", x: 1, y: 2 };
  const next = { id: "next", x: 2, y: 4 };
  const { series } = rendered([observation(row, 0), observation(next, 1)]);
  const interpolation = linearInterpolation();

  expect(() => nearestRecordedX(series, { domainX: Number.NaN })).toThrow(
    /domainX.*finite/i,
  );
  expect(() =>
    nearestRecordedX(series, { domainX: 1, maxDomainDelta: -1 }),
  ).toThrow(/maxDomainDelta.*nonnegative/i);
  expect(() =>
    nearestRecordedPoint(series, {
      rootPoint: { x: Infinity, y: 0 },
    }),
  ).toThrow(/rootPoint\.x.*finite/i);
  expect(() =>
    nearestRecordedPoint(series, {
      rootPoint: { x: 10, y: 20 },
      maxRootDistance: Number.NaN,
    }),
  ).toThrow(/maxRootDistance.*finite/i);
  expect(() =>
    sampleRecordedX(series, {
      domainX: 1,
      interpolation,
      maxDomainGap: -1,
    }),
  ).toThrow(/maxDomainGap.*nonnegative/i);
  expect(() =>
    sampleRecordedX(series, {
      domainX: 1.5,
      interpolation: () => Number.NaN,
    }),
  ).toThrow(/interpolation result.*finite/i);
});
