import { expect, it } from "vitest";
import {
  layoutSankey,
  layoutTreemap,
  layoutMatrix,
  layoutChords,
  layoutTree,
  layoutNeighborhood,
} from "@pibbl/core/viz";
const bounds = { x: 0, y: 0, width: 640, height: 400 };
it("returns finite Sankey node geometry when all flow values are zero or absent", () => {
  const graph = {
    nodes: [{ id: "zero" }],
    edges: [] as { id: string; from: string; to: string; value: number }[],
  };
  const result = layoutSankey(graph, {
    nodeKey: "id",
    edgeKey: "id",
    source: "from",
    target: "to",
    value: "value",
    unit: "MW",
    bounds,
  });
  expect(result.nodes).toHaveLength(1);
  expect(result.nodes[0].bounds.height).toBe(0);
  expect(Number.isFinite(result.nodes[0].bounds.y)).toBe(true);
});
it("rejects quantity sums which overflow before producing geometry", () => {
  const graph = {
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [
      { id: "one", from: "a", to: "b", value: 1e308 },
      { id: "two", from: "a", to: "b", value: 1e308 },
    ],
  };
  expect(() =>
    layoutSankey(graph, {
      nodeKey: "id",
      edgeKey: "id",
      source: "from",
      target: "to",
      value: "value",
      unit: "MW",
      bounds,
    }),
  ).toThrow(/finite|overflow/i);
  expect(() =>
    layoutMatrix(
      { rows: graph.nodes, columns: graph.nodes, relations: graph.edges },
      {
        rowKey: "id",
        columnKey: "id",
        source: "from",
        target: "to",
        value: "value",
        unit: "requests",
        bounds,
      },
    ),
  ).toThrow(/finite|overflow/i);
  expect(() =>
    layoutChords(
      { categories: graph.nodes, transfers: graph.edges },
      {
        categoryKey: "id",
        source: "from",
        target: "to",
        value: "value",
        unit: "trips",
        bounds,
      },
    ),
  ).toThrow(/finite|overflow/i);
  type Item = { id: string; value: number; children?: Item[] };
  const tree: Item = {
    id: "root",
    value: 0,
    children: [
      { id: "one", value: 1e308 },
      { id: "two", value: 1e308 },
    ],
  };
  expect(() =>
    layoutTreemap(tree, {
      keyBy: "id",
      childrenBy: "children",
      value: "value",
      unit: "bytes",
      bounds,
    }),
  ).toThrow(/finite|overflow/i);
});

it("uses stable node keys as default tree and neighborhood labels", () => {
  const root: { id: string; children?: { id: string }[] } = { id: "root" };
  expect(
    layoutTree(root, { keyBy: "id", childrenBy: "children", bounds }).nodes[0]
      .label.text,
  ).toBe("root");
  const graph = {
    nodes: [{ id: "center" }],
    edges: [] as { id: string; from: string; to: string }[],
  };
  expect(
    layoutNeighborhood(graph, {
      nodeKey: "id",
      edgeKey: "id",
      source: "from",
      target: "to",
      centerKey: "center",
      bounds,
    }).nodes[0].label.text,
  ).toBe("center");
});
