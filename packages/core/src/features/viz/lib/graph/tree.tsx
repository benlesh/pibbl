import { Group, resolveSignalValue, type PibblNode } from "@pibbl/core";
import {
  defaultGraphEdgeStyle,
  defaultGraphLabelStyle,
  defaultGraphNodeStyle,
  GraphEdge,
  GraphLabel,
  GraphNode,
  resolveMarkStyle,
  useGraphFrame,
} from "./shared.js";
import type {
  GraphEdgeGeometry,
  TidyTreeProps,
  TreeEdge,
  TreeLayout,
  TreeNodeGeometry,
  TreeOptions,
  TreeStyle,
} from "./types.js";
import {
  checkedBounds,
  finiteGap,
  finiteSize,
  hierarchy,
  hierarchyLabel,
  type HierarchyRecord,
} from "./hierarchy.js";

interface Positioned<D> {
  record: HierarchyRecord<D>;
  width: number;
  x: number;
}

/** Lay out a validated hierarchy with stable child order and variable node dimensions.
 * @param root - Hierarchy root.
 * @param options - Named hierarchy accessors and finite bounds.
 * @returns Immutable node and edge geometry. @see {@link TreeLayout} */
export function layoutTree<D>(root: D, options: TreeOptions<D>): TreeLayout<D> {
  const bounds = checkedBounds(options.bounds, "layoutTree");
  const siblingGap = finiteGap(options.siblingGap, 24, "layoutTree siblingGap");
  const levelGap = finiteGap(options.levelGap, 48, "layoutTree levelGap");
  const tree = hierarchy(root, options, "layoutTree");
  const visible = (record: HierarchyRecord<D>) =>
    record.collapsed ? [] : record.children;
  const sizes = new Map<
    HierarchyRecord<D>,
    { width: number; height: number }
  >();
  const spans = new Map<HierarchyRecord<D>, number>();
  const depthHeights: number[] = [];
  const measure = (record: HierarchyRecord<D>): number => {
    const size = finiteSize(record.datum, options.nodeSize, "layoutTree");
    sizes.set(record, size);
    depthHeights[record.depth] = Math.max(
      depthHeights[record.depth] ?? 0,
      size.height,
    );
    const kids = visible(record);
    const childSpan = kids.reduce(
      (sum, child, index) => sum + measure(child) + (index ? siblingGap : 0),
      0,
    );
    const span = Math.max(size.width, childSpan);
    spans.set(record, span);
    return span;
  };
  const totalWidth = measure(tree);
  const totalHeight = depthHeights.reduce(
    (sum, height, index) => sum + height + (index ? levelGap : 0),
    0,
  );
  if (totalWidth > bounds.width || totalHeight > bounds.height)
    throw new RangeError(
      "layoutTree: bounds are too small for nodes and gaps.",
    );
  const yAt: number[] = [];
  let y = bounds.y;
  for (let depth = 0; depth < depthHeights.length; depth++) {
    yAt.push(y);
    y += depthHeights[depth] + levelGap;
  }
  const positions: Positioned<D>[] = [];
  const place = (record: HierarchyRecord<D>, left: number) => {
    const span = spans.get(record)!;
    const size = sizes.get(record)!;
    const x = left + (span - size.width) / 2;
    positions.push({ record, width: size.width, x });
    let childLeft = left;
    for (const child of visible(record)) {
      place(child, childLeft);
      childLeft += spans.get(child)! + siblingGap;
    }
  };
  place(tree, bounds.x + (bounds.width - totalWidth) / 2);
  const nodes = positions.map(({ record, x }) => {
    const size = sizes.get(record)!;
    const box = Object.freeze({
      x,
      y: yAt[record.depth],
      width: size.width,
      height: size.height,
    });
    return Object.freeze({
      key: record.key,
      datum: record.datum,
      bounds: box,
      label: hierarchyLabel(
        record.datum,
        options.label,
        {
          x: x + 10,
          y: box.y + 10,
          width: size.width - 20,
          height: 18,
        },
        String(record.key),
      ),
      detail:
        options.detail === undefined
          ? null
          : hierarchyLabel(record.datum, options.detail, {
              x: x + 10,
              y: box.y + 31,
              width: size.width - 20,
              height: 16,
            }),
      depth: record.depth,
      parentKey: record.parent?.key ?? null,
      hiddenChildren: record.hiddenChildren,
    } satisfies TreeNodeGeometry<D>);
  });
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const edges: GraphEdgeGeometry<TreeEdge<D>>[] = [];
  for (const node of nodes)
    if (node.parentKey !== null) {
      const parent = byKey.get(node.parentKey)!;
      const sourceAnchor = {
        x: parent.bounds.x + parent.bounds.width / 2,
        y: parent.bounds.y + parent.bounds.height,
      };
      const targetAnchor = {
        x: node.bounds.x + node.bounds.width / 2,
        y: node.bounds.y,
      };
      const bend = (sourceAnchor.y + targetAnchor.y) / 2;
      const segments = Object.freeze([
        { type: "move" as const, ...sourceAnchor },
        { type: "line" as const, x: sourceAnchor.x, y: bend },
        { type: "line" as const, x: targetAnchor.x, y: bend },
        { type: "line" as const, ...targetAnchor },
      ]);
      edges.push(
        Object.freeze({
          key: `${String(parent.key)}→${String(node.key)}`,
          datum: { parent: parent.datum, child: node.datum },
          sourceKey: parent.key,
          targetKey: node.key,
          route: Object.freeze({
            sourceAnchor: Object.freeze(sourceAnchor),
            targetAnchor: Object.freeze(targetAnchor),
            segments,
            arrowSegments: null,
          }),
          path: `M ${sourceAnchor.x} ${sourceAnchor.y} L ${sourceAnchor.x} ${bend} L ${targetAnchor.x} ${bend} L ${targetAnchor.x} ${targetAnchor.y}`,
          arrowPath: null,
        }),
      );
    }
  return Object.freeze({
    bounds,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

/** Render a tidy hierarchy from ordinary data using default marks or caller compositions.
 * @param props - Reactive hierarchy data, presentation, and frame style.
 * @returns Canvas composition. @see {@link layoutTree} */
export function TidyTree<D>(props: TidyTreeProps<D>): PibblNode {
  const frame = useGraphFrame<TreeStyle>(props.style);
  const root = resolveSignalValue(props.root);
  if (frame.bounds.width === 0 || frame.bounds.height === 0)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const layout = layoutTree(root, {
    ...props,
    bounds: frame.bounds,
    levelGap: frame.style.levelGap,
    siblingGap: frame.style.siblingGap,
  });
  return (
    <Group style={frame.groupStyle}>
      {layout.edges.map((edge) =>
        props.renderEdge ? (
          <Group
            key={edge.key}
            onClick={(event) => props.onEdgeClick?.(edge, event)}
          >
            {props.renderEdge(edge)}
          </Group>
        ) : (
          <GraphEdge
            key={edge.key}
            edge={edge}
            style={{
              ...defaultGraphEdgeStyle(edge),
              ...resolveMarkStyle(edge, props.edgeStyle),
            }}
            onClick={(event) => props.onEdgeClick?.(edge, event)}
          />
        ),
      )}
      {layout.nodes.map((node) =>
        props.renderNode ? (
          <Group
            key={node.key}
            onClick={(event) => props.onNodeClick?.(node, event)}
          >
            {props.renderNode(node)}
          </Group>
        ) : (
          <Group key={node.key}>
            <GraphNode
              node={node}
              style={{
                ...defaultGraphNodeStyle(node),
                ...resolveMarkStyle(node, props.nodeStyle),
              }}
              onClick={(event) => props.onNodeClick?.(node, event)}
            />
            <GraphLabel
              label={node.label}
              style={{
                ...defaultGraphLabelStyle(node.label),
                ...resolveMarkStyle(node, props.labelStyle),
              }}
            />
            {node.detail && (
              <GraphLabel
                label={node.detail}
                style={{
                  ...defaultGraphLabelStyle(node.detail),
                  font: "11px sans-serif",
                  ...resolveMarkStyle(node, props.labelStyle),
                }}
              />
            )}
          </Group>
        ),
      )}
    </Group>
  );
}
