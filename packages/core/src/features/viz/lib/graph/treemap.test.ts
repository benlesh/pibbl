import { describe, expect, it } from "vitest";
import { layoutTreemap } from "@pibbl/core/viz";

describe("layoutTreemap", () => {
  it("uses source leaf quantities and retains collapsed branch totals", () => {
    type Item = { id: string; size: number; children?: readonly Item[] };
    const root: Item = {
      id: "root",
      size: 99,
      children: [
        {
          id: "a",
          size: 0,
          children: [
            { id: "a1", size: 9 },
            { id: "a2", size: 3 },
          ],
        },
        { id: "b", size: 4 },
      ],
    };
    const layout = layoutTreemap(root, {
      keyBy: "id",
      childrenBy: "children",
      value: "size",
      unit: "GB",
      collapsed: (item) => item.id === "a",
      bounds: { x: 0, y: 0, width: 400, height: 260 },
    });
    expect(layout.total).toBe(16);
    expect(layout.cells.find((cell) => cell.key === "a")).toMatchObject({
      value: 12,
      collapsed: true,
      label: { text: "12 GB" },
    });
    expect(layout.cells.find((cell) => cell.key === "a1")).toBeUndefined();
  });

  it("squarifies stable source-order siblings while preserving their quantitative area", () => {
    type Item = { id: string; size: number; children?: readonly Item[] };
    const root: Item = { id: "root", size: 0 };
    const items = [
      { id: "large", size: 60 },
      { id: "medium", size: 30 },
      { id: "small", size: 10 },
    ];
    const tree: Item = { ...root, children: items };
    const layout = layoutTreemap(tree, {
      keyBy: "id",
      childrenBy: "children",
      value: "size",
      unit: "GB",
      bounds: { x: 0, y: 0, width: 1000, height: 500 },
      cellGap: 0,
      padding: 0,
      headerHeight: 0,
    });
    const [large, medium, small] = layout.cells;
    expect(layout.cells.map((cell) => cell.key)).toEqual([
      "large",
      "medium",
      "small",
    ]);
    expect(large.bounds.width * large.bounds.height).toBeCloseTo(300_000);
    expect(medium.bounds.width * medium.bounds.height).toBeCloseTo(150_000);
    expect(small.bounds.width * small.bounds.height).toBeCloseTo(50_000);
    expect(
      Math.max(
        large.bounds.width / large.bounds.height,
        large.bounds.height / large.bounds.width,
      ),
    ).toBeLessThan(3);
  });
});

it("omits labels that cannot support an informative quantity", () => {
  type Item = { id: string; size: number; children?: readonly Item[] };
  const root: Item = {
    id: "root",
    size: 0,
    children: [
      { id: "large", size: 99 },
      { id: "trace", size: 1 },
    ],
  };
  const layout = layoutTreemap(root, {
    keyBy: "id",
    childrenBy: "children",
    value: "size",
    unit: "GB",
    label: "id",
    bounds: { x: 0, y: 0, width: 100, height: 60 },
    cellGap: 0,
    padding: 0,
    headerHeight: 0,
  });
  expect(layout.cells.find((cell) => cell.key === "trace")?.label).toBeNull();
});
