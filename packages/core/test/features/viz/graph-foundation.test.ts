import { describe, expect, it } from "vitest";
import {
  layoutDependencies,
  createForceSimulation,
  straightGraphRoute,
} from "@pibbl/core/viz";
const graph = {
  nodes: [
    { id: "api", name: "API" },
    { id: "db", name: "Database" },
  ],
  edges: [{ id: "query", from: "api", to: "db" }],
};
const options = {
  nodeKey: "id" as const,
  edgeKey: "id" as const,
  source: "from" as const,
  target: "to" as const,
  label: "name" as const,
  bounds: { x: 0, y: 0, width: 640, height: 320 },
};
describe("public graph foundations", () => {
  it("places dependencies in ranks and retains rebuildable routes and original data", () => {
    const layout = layoutDependencies(graph, options);
    expect(layout.nodes[0].datum).toBe(graph.nodes[0]);
    expect(layout.nodes[1].bounds.x).toBeGreaterThan(layout.nodes[0].bounds.x);
    expect(layout.edges[0].route.segments.length).toBeGreaterThan(1);
    expect(layout.edges[0].targetKey).toBe("db");
    expect(() =>
      layoutDependencies(
        {
          ...graph,
          edges: [...graph.edges, { id: "cycle", from: "db", to: "api" }],
        },
        options,
      ),
    ).toThrow(/cycle/i);
  });
  it("offers resource-free seeded force stepping, bounded runs and explicit pins", () => {
    const a = createForceSimulation(graph, {
      ...options,
      simulation: { seed: 2, maxIterations: 5 },
    });
    const b = createForceSimulation(graph, {
      ...options,
      simulation: { seed: 2, maxIterations: 5 },
    });
    a.pin("api", { x: 80, y: 90 });
    b.pin("api", { x: 80, y: 90 });
    expect(a.step({ iterations: 20 })).toEqual(b.step({ iterations: 20 }));
    expect(a.read().iterations).toBe(5);
    expect(
      a.read().nodes[0].bounds.x + a.read().nodes[0].bounds.width / 2,
    ).toBe(80);
    expect(() => a.pin("unknown", { x: 0, y: 0 })).toThrow();
  });
  it("keeps retained centers inside new bounds immediately after update", () => {
    const session = createForceSimulation(graph, options);
    const bounds = { x: 0, y: 0, width: 60, height: 60 };
    session.update(graph, { ...options, bounds });
    for (const node of session.read().nodes) {
      expect(node.bounds.x).toBeGreaterThanOrEqual(0);
      expect(node.bounds.x + node.bounds.width).toBeLessThanOrEqual(60);
      expect(node.bounds.y + node.bounds.height).toBeLessThanOrEqual(60);
    }
  });
  it("exposes named anchors and independently editable path segments", () => {
    const route = straightGraphRoute({
      sourceAnchor: { x: 1, y: 2 },
      targetAnchor: { x: 50, y: 20 },
    });
    expect(route.sourceAnchor).toEqual({ x: 1, y: 2 });
    expect(route.segments).toHaveLength(2);
  });
});
