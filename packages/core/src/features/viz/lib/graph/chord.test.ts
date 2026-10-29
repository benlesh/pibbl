import { describe, expect, it } from "vitest";
import { layoutChords } from "@pibbl/core/viz";

describe("layoutChords", () => {
  it("aggregates duplicate ordered transfers while retaining their records", () => {
    const layout = layoutChords(
      {
        categories: [{ id: "north" }, { id: "central" }],
        transfers: [
          { from: "north", to: "central", trips: 1200 },
          { from: "north", to: "central", trips: 50 },
          { from: "central", to: "north", trips: 700 },
        ],
      },
      {
        categoryKey: "id",
        source: "from",
        target: "to",
        value: "trips",
        unit: "trips/day",
        bounds: { x: 0, y: 0, width: 500, height: 500 },
      },
    );
    expect(layout.total).toBe(1950);
    expect(layout.ribbons).toHaveLength(2);
    expect(layout.ribbons[0].records).toHaveLength(2);
    expect(layout.bands[0].path).toContain("Z");
  });
  it("keeps a self-transfer as one record in the total and two roles on its band", () => {
    const layout = layoutChords(
      {
        categories: [{ id: "north" }],
        transfers: [{ from: "north", to: "north", trips: 15 }],
      },
      {
        categoryKey: "id",
        source: "from",
        target: "to",
        value: "trips",
        unit: "trips/day",
        bounds: { x: 0, y: 0, width: 300, height: 300 },
      },
    );
    expect(layout.total).toBe(15);
    expect(layout.bands[0].incomingValue).toBe(15);
    expect(layout.bands[0].outgoingValue).toBe(15);
  });
});

it("gives self transfers disjoint source and target spans and stable ordered-pair keys", () => {
  const options = {
    categoryKey: "id" as const,
    source: "from" as const,
    target: "to" as const,
    value: "trips" as const,
    unit: "trips/day",
    bounds: { x: 0, y: 0, width: 300, height: 300 },
  };
  const self = layoutChords(
    {
      categories: [{ id: "north" }],
      transfers: [{ from: "north", to: "north", trips: 15 }],
    },
    options,
  ).ribbons[0];
  expect(self.sourceArc.endAngleDegrees).toBeLessThanOrEqual(
    self.targetArc.startAngleDegrees,
  );
  expect(self.segments).toHaveLength(6);
  expect(
    self.segments.filter((segment) => segment.type === "arc"),
  ).toHaveLength(2);
  const [move, sourceCurve, toTarget, targetCurve, toSource] = self.segments;
  if (
    move.type !== "move" ||
    sourceCurve.type !== "arc" ||
    toTarget.type !== "quadratic" ||
    targetCurve.type !== "arc" ||
    toSource.type !== "quadratic"
  )
    throw new Error("Expected a curved ribbon joined to both inner arc spans.");
  const degrees = (radians: number) => (radians * 180) / Math.PI + 90;
  expect(degrees(sourceCurve.startAngle)).toBeCloseTo(
    self.sourceArc.startAngleDegrees,
  );
  expect(degrees(sourceCurve.startAngle + sourceCurve.sweep)).toBeCloseTo(
    self.sourceArc.endAngleDegrees,
  );
  expect(targetCurve.sweep).toBeGreaterThan(0);
  expect(degrees(targetCurve.startAngle)).toBeCloseTo(
    self.targetArc.startAngleDegrees,
  );
  expect(degrees(targetCurve.startAngle + targetCurve.sweep)).toBeCloseTo(
    self.targetArc.endAngleDegrees,
  );
  expect(move.x).toBeCloseTo(toSource.x);
  expect(move.y).toBeCloseTo(toSource.y);
  expect(toTarget.x).not.toBeCloseTo(move.x);
  const forward = layoutChords(
    {
      categories: [{ id: "north" }, { id: "south" }],
      transfers: [
        { from: "north", to: "south", trips: 1 },
        { from: "south", to: "north", trips: 2 },
      ],
    },
    options,
  );
  const reversed = layoutChords(
    {
      categories: [{ id: "north" }, { id: "south" }],
      transfers: [
        { from: "south", to: "north", trips: 2 },
        { from: "north", to: "south", trips: 1 },
      ],
    },
    options,
  );
  expect(new Set(forward.ribbons.map((ribbon) => ribbon.key))).toEqual(
    new Set(reversed.ribbons.map((ribbon) => ribbon.key)),
  );
});

it("fills the middle of a wide ribbon without folding its boundary into a bow tie", () => {
  const layout = layoutChords(
    {
      categories: [{ id: "a" }, { id: "b" }],
      transfers: [{ from: "a", to: "b", value: 1 }],
    },
    {
      categoryKey: "id",
      source: "from",
      target: "to",
      value: "value",
      unit: "trips",
      bounds: { x: 0, y: 0, width: 400, height: 400 },
      padAngle: 4,
    },
  );
  const ribbon = layout.ribbons[0];
  const context = document.createElement("canvas").getContext("2d")!;
  const path = new Path2D(ribbon.path);
  for (const dx of [-0.1, 0, 0.1])
    for (const dy of [-0.1, 0, 0.1]) {
      expect(
        context.isPointInPath(
          path,
          ribbon.sourceArc.center.x + dx * ribbon.sourceArc.radius,
          ribbon.sourceArc.center.y + dy * ribbon.sourceArc.radius,
        ),
        `ribbon interior at ${dx}, ${dy}`,
      ).toBe(true);
    }
});

it("keeps an opposite-end ribbon wide through its midpoint instead of pinching the fill", () => {
  const layout = layoutChords(
    {
      categories: [{ id: "a" }, { id: "b" }],
      transfers: [
        { from: "a", to: "b", value: 1 },
        { from: "b", to: "a", value: 3 },
      ],
    },
    {
      categoryKey: "id",
      source: "from",
      target: "to",
      value: "value",
      unit: "trips",
      bounds: { x: 0, y: 0, width: 400, height: 400 },
      padAngle: 4,
    },
  );
  const ribbon = layout.ribbons[0];
  const context = document.createElement("canvas").getContext("2d")!;
  expect(
    context.isPointInPath(
      new Path2D(ribbon.path),
      ribbon.sourceArc.center.x + ribbon.sourceArc.radius * 0.04,
      ribbon.sourceArc.center.y,
    ),
  ).toBe(true);
});
