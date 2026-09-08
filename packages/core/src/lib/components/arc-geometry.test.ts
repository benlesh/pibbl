import { describe, expect, it } from "vitest";
import { arcBounds, wedgeBounds } from "./arc-geometry";
import { resolveCircularSweep } from "../geometry/circular-sweep";

const fullTurn = Math.PI * 2;

describe("arc and wedge bounds", () => {
  it("returns no bounds for empty arc geometry", () => {
    expect(
      arcBounds(0, 0, 10, resolveCircularSweep(0, 0, false)),
    ).toBeUndefined();
    expect(
      arcBounds(0, 0, 0, resolveCircularSweep(0, Math.PI, false)),
    ).toBeUndefined();
  });

  it("includes endpoints and every cardinal extremum in a clockwise sweep", () => {
    const bounds = arcBounds(
      10,
      20,
      8,
      resolveCircularSweep(Math.PI / 4, Math.PI * 1.25, false),
    )!;

    expect(bounds.x).toBeCloseTo(2);
    expect(bounds.y).toBeCloseTo(20 - Math.SQRT1_2 * 8);
    expect(bounds.width).toBeCloseTo(8 + Math.SQRT1_2 * 8);
    expect(bounds.height).toBeCloseTo(8 + Math.SQRT1_2 * 8);
  });

  it("includes only cardinals contained by a counterclockwise sweep", () => {
    const bounds = arcBounds(
      10,
      20,
      8,
      resolveCircularSweep(Math.PI / 4, -Math.PI / 4, true),
    )!;

    expect(bounds.x).toBeCloseTo(10 + Math.SQRT1_2 * 8);
    expect(bounds.y).toBeCloseTo(20 - Math.SQRT1_2 * 8);
    expect(bounds.width).toBeCloseTo(8 - Math.SQRT1_2 * 8);
    expect(bounds.height).toBeCloseTo(Math.SQRT1_2 * 16);
  });

  it("returns the circle bounds for a full sweep", () => {
    expect(
      arcBounds(10, 20, 8, resolveCircularSweep(0, fullTurn, false)),
    ).toEqual({ x: 2, y: 12, width: 16, height: 16 });
  });

  it("includes the center in partial wedge bounds", () => {
    const bounds = wedgeBounds(
      0,
      0,
      10,
      resolveCircularSweep(-Math.PI / 4, Math.PI / 4, false),
    )!;

    expect(bounds.x).toBe(0);
    expect(bounds.y).toBeCloseTo(-Math.SQRT1_2 * 10);
    expect(bounds.width).toBe(10);
    expect(bounds.height).toBeCloseTo(Math.SQRT1_2 * 20);
  });
});
