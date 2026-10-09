import { createTradingTimeMapping } from "../../../src/features/viz/lib/trading-time-mapping.js";
import { expect, it } from "vitest";

const friday = Date.UTC(2026, 9, 2, 16);
const monday = Date.UTC(2026, 9, 5, 9, 30);
const tuesday = Date.UTC(2026, 9, 6, 9, 30);

it("maps supplied Friday/Monday observations into equal consecutive slots", () => {
  const mapping = createTradingTimeMapping({
    timestamps: [friday, monday, tuesday],
    logicalRange: [0, 2],
    range: [20, 220],
  });
  expect(mapping.mapTime(friday)).toBe(20);
  expect(mapping.mapTime(monday)).toBe(120);
  expect(mapping.mapTime(tuesday)).toBe(220);
  expect(mapping.slotAtTime(monday)).toBe(1);
  expect(mapping.timeAtSlot(1)).toBe(monday);
  expect(mapping.timeAtSlot(1.5)).toBeUndefined();
  expect(() => mapping.mapTime(friday + 1)).toThrow(/unknown/i);
});

it("keeps viewport slots fractional and handles reversed logical and physical ranges", () => {
  const mapping = createTradingTimeMapping({
    timestamps: [friday, monday, tuesday],
    logicalRange: [2.5, -0.5],
    range: [300, 0],
  });
  expect(mapping.mapTime(friday)).toBe(50);
  expect(mapping.mapTime(monday)).toBe(150);
  expect(mapping.slotAtPosition(100)).toBe(0.5);
  expect(mapping.slotAtPosition(350)).toBe(3);
});

it("rounds nearest positions toward the earlier slot on ties and clamps to known data", () => {
  const mapping = createTradingTimeMapping({
    timestamps: [friday, monday, tuesday],
    logicalRange: [0, 2],
    range: [0, 200],
  });
  expect(mapping.nearestTimeAtPosition(-10)).toBe(friday);
  expect(mapping.nearestTimeAtPosition(50)).toBe(friday);
  expect(mapping.nearestTimeAtPosition(150)).toBe(monday);
  expect(mapping.nearestTimeAtPosition(400)).toBe(tuesday);
});

it("defines empty and singleton mapping behavior and captures input timestamps", () => {
  const empty = createTradingTimeMapping({
    timestamps: [],
    logicalRange: [0, 1],
    range: [0, 100],
  });
  expect(empty.nearestTimeAtPosition(10)).toBeUndefined();
  expect(empty.slotAtTime(friday)).toBeUndefined();
  expect(empty.timeAtSlot(0)).toBeUndefined();
  expect(() => empty.mapTime(friday)).toThrow(/unknown/i);

  const source = [friday];
  const singleton = createTradingTimeMapping({
    timestamps: source,
    logicalRange: [-1, 1],
    range: [0, 100],
  });
  source[0] = monday;
  expect(singleton.mapTime(friday)).toBe(50);
  expect(singleton.slotAtTime(monday)).toBeUndefined();
  expect(singleton.timeAtSlot(0)).toBe(friday);
});

it("rejects malformed timestamp, viewport, and range inputs", () => {
  const base = {
    timestamps: [friday, monday],
    logicalRange: [0, 1] as const,
    range: [0, 100] as const,
  };
  expect(() =>
    createTradingTimeMapping({ ...base, timestamps: [monday, friday] }),
  ).toThrow(/increasing/i);
  expect(() =>
    createTradingTimeMapping({ ...base, timestamps: [friday, friday] }),
  ).toThrow(/increasing/i);
  expect(() =>
    createTradingTimeMapping({ ...base, timestamps: [0.5, monday] }),
  ).toThrow(/safe integers/i);
  expect(() =>
    createTradingTimeMapping({ ...base, logicalRange: [0, 0] }),
  ).toThrow(/logicalRange/i);
  expect(() => createTradingTimeMapping({ ...base, range: [0, 0] })).toThrow(
    /range/i,
  );
});
