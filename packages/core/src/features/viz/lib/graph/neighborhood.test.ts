import { describe, expect, it } from "vitest";
import { layoutNeighborhood } from "@pibbl/core/viz";

describe("layoutNeighborhood", () => {
  it("selects an outbound BFS neighborhood and preserves real visible edges", () => {
    const graph = {
      nodes: ["a", "b", "c", "d"].map((id) => ({ id })),
      edges: [
        { id: "ab", from: "a", to: "b" },
        { id: "bc", from: "b", to: "c" },
        { id: "cd", from: "c", to: "d" },
        { id: "ac", from: "a", to: "c" },
      ],
    };
    const layout = layoutNeighborhood(graph, {
      nodeKey: "id",
      edgeKey: "id",
      source: "from",
      target: "to",
      centerKey: "a",
      hops: 1,
      bounds: { x: 0, y: 0, width: 600, height: 600 },
    });
    expect(layout.nodes.map((node) => node.key)).toEqual(["a", "b", "c"]);
    expect(layout.nodes.find((node) => node.key === "b")?.hop).toBe(1);
    expect(layout.edges.map((edge) => edge.key)).toEqual(["ab", "bc", "ac"]);
    expect(layout.omittedKeys).toEqual(["d"]);
  });
});
