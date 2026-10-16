import { describe, expect, it } from "vitest";
import { layoutMatrix } from "@pibbl/core/viz";

describe("layoutMatrix", () => {
  it("creates every ordered cell and preserves an observed zero", () => {
    const layout = layoutMatrix(
      {
        rows: [{ id: "north" }, { id: "south" }],
        columns: [{ id: "north" }, { id: "south" }],
        relations: [
          { from: "north", to: "south", count: 4 },
          { from: "north", to: "south", count: 3 },
          { from: "south", to: "north", count: 0 },
        ],
      },
      {
        rowKey: "id",
        columnKey: "id",
        source: "from",
        target: "to",
        value: "count",
        unit: "links",
        bounds: { x: 0, y: 0, width: 300, height: 200 },
      },
    );
    expect(layout.cells).toHaveLength(4);
    expect(
      layout.cells.find(
        (cell) => cell.rowKey === "north" && cell.columnKey === "south",
      )?.value,
    ).toBe(7);
    expect(
      layout.cells.find(
        (cell) => cell.rowKey === "south" && cell.columnKey === "north",
      )?.value,
    ).toBe(0);
    expect(
      layout.cells.find(
        (cell) => cell.rowKey === "north" && cell.columnKey === "north",
      )?.value,
    ).toBeNull();
  });
  it("rejects relations outside the declared row and column domains", () => {
    expect(() =>
      layoutMatrix(
        {
          rows: [{ id: "north" }],
          columns: [{ id: "north" }],
          relations: [{ from: "missing", to: "north", count: 1 }],
        },
        {
          rowKey: "id",
          columnKey: "id",
          source: "from",
          target: "to",
          value: "count",
          unit: "links",
          bounds: { x: 0, y: 0, width: 20, height: 20 },
        },
      ),
    ).toThrow(/row key/i);
  });
});
