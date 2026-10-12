import {
  candleGeometry,
  financialMarkWidth,
  smallestAdjacentSpacing,
  volumeGeometry,
} from "../../../src/features/viz/lib/financial-geometry.js";
import { expect, it } from "vitest";

it("normalizes rising, falling, and doji candle geometry in local coordinates", () => {
  expect(
    candleGeometry({
      centerX: 40,
      openY: 70,
      closeY: 30,
      highY: 20,
      lowY: 90,
      width: 14,
      dojiHeight: 3,
    }),
  ).toEqual({
    bodyBoundsLocal: { x: 33, y: 30, width: 14, height: 40 },
    wickLocal: { x: 40, lowY: 90, highY: 20 },
  });
  expect(
    candleGeometry({
      centerX: 40,
      openY: 30,
      closeY: 70,
      highY: 20,
      lowY: 90,
      width: 14,
      dojiHeight: 3,
    }).bodyBoundsLocal,
  ).toEqual({ x: 33, y: 30, width: 14, height: 40 });
  expect(
    candleGeometry({
      centerX: 40,
      openY: 50,
      closeY: 50,
      highY: 20,
      lowY: 90,
      width: 14,
      dojiHeight: 3,
    }).bodyBoundsLocal,
  ).toEqual({ x: 33, y: 48.5, width: 14, height: 3 });
  expect(
    candleGeometry({
      centerX: 40,
      openY: 50,
      closeY: 50,
      highY: 20,
      lowY: 90,
      width: 14,
      dojiHeight: 0,
    }).bodyBoundsLocal,
  ).toEqual({ x: 33, y: 49.5, width: 14, height: 1 });
});

it("normalizes reversed candle and volume endpoints, including zero volume", () => {
  expect(
    candleGeometry({
      centerX: 9,
      openY: 12,
      closeY: 4,
      highY: 18,
      lowY: 1,
      width: 6,
      dojiHeight: 0.2,
    }),
  ).toEqual({
    bodyBoundsLocal: { x: 6, y: 4, width: 6, height: 8 },
    wickLocal: { x: 9, lowY: 1, highY: 18 },
  });
  expect(
    volumeGeometry({ centerX: 20, valueY: 90, baselineY: 30, width: 10 }),
  ).toEqual({ x: 15, y: 30, width: 10, height: 60 });
  expect(
    volumeGeometry({ centerX: 20, valueY: 30, baselineY: 30, width: 10 }),
  ).toEqual({ x: 15, y: 30, width: 10, height: 0 });
});

it("derives financial widths from adjacent mapped spacing and validates explicit widths", () => {
  expect(smallestAdjacentSpacing([10, 40, 20, 100])).toBe(20);
  expect(smallestAdjacentSpacing([10])).toBeUndefined();
  expect(financialMarkWidth([10, 40, 20, 100])).toBe(12);
  expect(financialMarkWidth([10])).toBe(8);
  expect(financialMarkWidth([10, 110])).toBeCloseTo(12);
  expect(financialMarkWidth([10, 40], { width: 9 })).toBe(9);
  expect(() => financialMarkWidth([10, 40], { width: 0 })).toThrow(/width/i);
});
