import { describe, expect, it } from "vitest";
import { layoutBipartite } from "@pibbl/core/viz";

describe("layoutBipartite", () => {
  it("keeps equal raw keys distinct across the two explicit sides", () => {
    const layout = layoutBipartite(
      {
        left: [{ id: "a" }],
        right: [{ id: "a" }],
        edges: [{ id: "membership", source: "a", target: "a" }],
      },
      {
        leftKey: "id",
        rightKey: "id",
        edgeKey: "id",
        source: "source",
        target: "target",
        bounds: { x: 0, y: 0, width: 500, height: 200 },
      },
    );
    expect(layout.edges[0].left).not.toBe(layout.edges[0].right);
    expect(layout.edges[0].path).toContain("C");
  });
  it("rejects an edge whose left endpoint is absent", () => {
    expect(() =>
      layoutBipartite(
        {
          left: [{ id: "left" }],
          right: [{ id: "right" }],
          edges: [{ id: "bad", source: "missing", target: "right" }],
        },
        {
          leftKey: "id",
          rightKey: "id",
          edgeKey: "id",
          source: "source",
          target: "target",
          bounds: { x: 0, y: 0, width: 500, height: 200 },
        },
      ),
    ).toThrow(/known left key/i);
  });
});
