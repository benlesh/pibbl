import { describe, expect, it } from "vitest";
import { layoutIcicle } from "@pibbl/core/viz";

describe("layoutIcicle", () => {
  it("allocates source-order widths by leaf share", () => {
    type Item = { id: string; amount: number; children?: readonly Item[] };
    const root: Item = {
      id: "root",
      amount: 0,
      children: [
        { id: "large", amount: 8 },
        { id: "small", amount: 2 },
      ],
    };
    const layout = layoutIcicle(root, {
      keyBy: "id",
      childrenBy: "children",
      value: "amount",
      unit: "GB",
      bounds: { x: 0, y: 0, width: 500, height: 180 },
    });
    const large = layout.cells.find((cell) => cell.key === "large")!,
      small = layout.cells.find((cell) => cell.key === "small")!;
    expect(layout.total).toBe(10);
    expect(large.bounds.width).toBeGreaterThan(small.bounds.width);
    expect(large.fraction).toBe(0.8);
    expect(Math.min(...layout.cells.map((cell) => cell.bounds.y))).toBe(0);
  });
});

it("omits labels whose cells cannot support an informative quantity", () => {
  type Item = { id: string; amount: number; children?: readonly Item[] };
  const root: Item = {
    id: "root",
    amount: 0,
    children: [
      { id: "large", amount: 99 },
      { id: "trace", amount: 1 },
    ],
  };
  const layout = layoutIcicle(root, {
    keyBy: "id",
    childrenBy: "children",
    value: "amount",
    unit: "GB",
    label: "id",
    bounds: { x: 0, y: 0, width: 100, height: 60 },
    cellGap: 0,
    levelGap: 0,
  });
  expect(layout.cells.find((cell) => cell.key === "trace")?.label).toBeNull();
});
