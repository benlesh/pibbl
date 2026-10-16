import { describe, expect, it } from "vitest";
import { layoutSankey } from "@pibbl/core/viz";

describe("layoutSankey", () => {
  it("places a weighted acyclic flow and gives each route a positive shared thickness", () => {
    const layout = layoutSankey(
      {
        nodes: [{ id: "source" }, { id: "middle" }, { id: "sink" }],
        edges: [
          { id: "a", from: "source", to: "middle", value: 8 },
          { id: "b", from: "middle", to: "sink", value: 8 },
        ],
      },
      {
        nodeKey: "id",
        edgeKey: "id",
        source: "from",
        target: "to",
        value: "value",
        unit: "MW",
        bounds: { x: 0, y: 0, width: 500, height: 300 },
      },
    );
    expect(layout.flows.map((flow) => flow.thickness)).toEqual([300, 300]);
    expect(layout.nodes[0].bounds.x).toBeLessThan(layout.nodes[2].bounds.x);
    expect(layout.flows[0].path).toContain("C");
  });
  it("rejects cycles because layered flow ranks would be ambiguous", () => {
    expect(() =>
      layoutSankey(
        {
          nodes: [{ id: "a" }, { id: "b" }],
          edges: [
            { id: "ab", from: "a", to: "b", value: 1 },
            { id: "ba", from: "b", to: "a", value: 1 },
          ],
        },
        {
          nodeKey: "id",
          edgeKey: "id",
          source: "from",
          target: "to",
          value: "value",
          unit: "MW",
          bounds: { x: 0, y: 0, width: 200, height: 100 },
        },
      ),
    ).toThrow(/acyclic/i);
  });
});
it("places default names and quantities outside the narrow node bars", () => {
  const layout = layoutSankey(
    {
      nodes: [{ id: "solar" }, { id: "homes" }],
      edges: [{ id: "s", from: "solar", to: "homes", mw: 8 }],
    },
    {
      nodeKey: "id",
      edgeKey: "id",
      source: "from",
      target: "to",
      value: "mw",
      unit: "MW",
      label: "id",
      bounds: { x: 0, y: 0, width: 300, height: 200 },
    },
  );
  expect(layout.nodes[0].label.bounds.x).toBeGreaterThan(
    layout.nodes[0].bounds.x + layout.nodes[0].bounds.width,
  );
  expect(layout.nodes[0].detail?.text).toBe("8 MW");
});
