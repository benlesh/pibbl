import type { DependencyGraphProps, GraphNodeGeometry } from "@pibbl/core/viz";
const graph = {
  nodes: [{ id: "a", name: "API" }],
  edges: [{ id: "loop", from: "a", to: "a" }],
};
declare const node: GraphNodeGeometry<(typeof graph.nodes)[number]>;
// @ts-expect-error Geometry preserves original datum fields.
node.datum.missing;
export const invalidLabel: DependencyGraphProps<
  (typeof graph.nodes)[number],
  (typeof graph.edges)[number]
> = {
  graph,
  nodeKey: "id",
  edgeKey: "id",
  source: "from",
  target: "to",
  // @ts-expect-error A node label must select a string property of the node datum.
  label: "amount",
};
