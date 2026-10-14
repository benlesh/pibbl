import { expect, it } from "vitest";
import { chooseSource, site, sources } from "../src/lib/electric-sources.js";

it("selects proportionally by weight, ignores zero weight, and is independent of input ordering", () => {
  const pool = sources([
    { id: "light", point: { x: 0.2, y: 0.2 }, weight: 1 },
    { id: "heavy", point: { x: 0.8, y: 0.8 }, weight: 9 },
    { id: "off", point: { x: 0.5, y: 0.2 }, weight: 0 },
  ]).map(site);
  let heavy = 0;
  for (let ticket = 0; ticket < 10000; ticket++) {
    const chosen = chooseSource(pool, 42, ticket)!;
    expect(chosen.id).not.toBe("off");
    expect(chooseSource([...pool].reverse(), 42, ticket)?.id).toBe(chosen.id);
    if (chosen.id === "heavy") heavy++;
  }
  expect(heavy / 10000).toBeGreaterThan(0.88);
  expect(heavy / 10000).toBeLessThan(0.92);
});

it("crawls only to local level/upward sites and preserves preference for strong sites", () => {
  const pool = sources([
    { id: "here", point: { x: 0.5, y: 0.6 }, weight: 1000 },
    { id: "up", point: { x: 0.5, y: 0.55 }, weight: 1 },
    { id: "down", point: { x: 0.5, y: 0.7 }, weight: 1000000 },
    { id: "far", point: { x: 0.9, y: 0.1 }, weight: 1000000 },
  ]).map(site);
  let retained = 0;
  for (let ticket = 0; ticket < 1000; ticket++) {
    const chosen = chooseSource(pool, 42, ticket, { x: 0.5, y: 0.6 })!;
    expect(["here", "up"]).toContain(chosen.id);
    if (chosen.id === "here") retained++;
  }
  expect(retained).toBeGreaterThan(980);
  expect(
    chooseSource(
      pool.filter((s) => s.id !== "here"),
      42,
      0,
      { x: 0.5, y: 0.6 },
    )?.id,
  ).toBe("up");
});

it("validates bounded structured data and rejects duplicate, nonfinite, and negative weights", () => {
  const valid = { id: "a", point: { x: 0.5, y: 0.5 }, weight: 1 };
  expect(() => sources([valid, valid])).toThrow(/Duplicate/);
  for (const weight of [-1, Infinity, NaN, 1000001])
    expect(() => sources([{ ...valid, weight }])).toThrow(/weight/);
  expect(() => sources([{ ...valid, id: "" }])).toThrow(/id/);
  expect(() => sources([{ ...valid, point: { x: -0.1, y: 0.5 } }])).toThrow(
    /Point/,
  );
  expect(() =>
    sources(Array.from({ length: 513 }, (_, i) => ({ ...valid, id: `${i}` }))),
  ).toThrow(/512/);
  expect(
    chooseSource(sources([{ ...valid, weight: 0 }]).map(site), 42, 0),
  ).toBeUndefined();
});

it("accepts tiny positive weights without overflow", () => {
  const pool = sources([
    { id: "tiny", point: { x: 0.5, y: 0.5 }, weight: Number.MIN_VALUE },
  ]).map(site);
  expect(chooseSource(pool, 42, 0)?.id).toBe("tiny");
  expect(chooseSource(pool, 42, 0, { x: 0.5, y: 0.5 })?.id).toBe("tiny");
});
