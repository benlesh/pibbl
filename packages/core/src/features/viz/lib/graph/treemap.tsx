import type { NodeStyle } from "./types.js";
import {
  Group,
  Rectangle,
  resolveSignalValue,
  type PibblNode,
} from "@pibbl/core";
import {
  defaultGraphLabelStyle,
  GraphLabel,
  resolveMarkStyle,
  useGraphFrame,
} from "./shared.js";
import type {
  Bounds,
  PartitionCellGeometry,
  PartitionLayout,
  PartitionCellProps,
  TreemapOptions,
  TreemapProps,
  TreemapStyle,
} from "./types.js";
import {
  checkedBounds,
  finiteGap,
  hierarchy,
  partitionLabel,
  partitionLabelFits,
  type HierarchyRecord,
} from "./hierarchy.js";

/** Return the built-in depth-aware partition paint.
 * @param cell - Partition cell geometry.
 * @returns Ordinary rectangle style. @see {@link PartitionCellGeometry} */
export function defaultPartitionCellStyle<D>(
  cell: PartitionCellGeometry<D>,
): NodeStyle {
  const shade = 82 - Math.min(cell.depth, 4) * 8;
  return {
    fill: `hsl(174 42% ${shade}%)`,
    stroke: "#fbfaf6",
    strokeWidth: 1,
    cornerRadius: 3,
  };
}

function inset(box: Bounds, amount: number): Bounds {
  return {
    x: box.x + amount,
    y: box.y + amount,
    width: Math.max(0, box.width - amount * 2),
    height: Math.max(0, box.height - amount * 2),
  };
}

interface WeightedRecord<D> {
  readonly record: HierarchyRecord<D>;
  readonly area: number;
}

function worstAspect<D>(
  row: readonly WeightedRecord<D>[],
  length: number,
): number {
  if (row.length === 0 || length <= 0) return Infinity;
  const sum = row.reduce((total, item) => total + item.area, 0);
  if (sum === 0) return Infinity;
  const min = Math.min(...row.map((item) => item.area));
  const max = Math.max(...row.map((item) => item.area));
  const side2 = length * length;
  return Math.max((side2 * max) / (sum * sum), (sum * sum) / (side2 * min));
}

/** Stable squarification: append records while doing so improves the current row’s worst aspect ratio. */
function squarify<D>(
  records: readonly HierarchyRecord<D>[],
  box: Bounds,
): ReadonlyMap<HierarchyRecord<D>, Bounds> {
  const total = records.reduce((sum, record) => sum + record.value, 0);
  const weighted = records.map((record) => ({
    record,
    area:
      box.width *
      box.height *
      (total === 0 ? 1 / records.length : record.value / total),
  }));
  const boxes = new Map<HierarchyRecord<D>, Bounds>();
  let remaining = { ...box };
  let index = 0;
  while (
    index < weighted.length &&
    remaining.width > 0 &&
    remaining.height > 0
  ) {
    const row: WeightedRecord<D>[] = [weighted[index++]];
    const length = Math.min(remaining.width, remaining.height);
    while (
      index < weighted.length &&
      worstAspect([...row, weighted[index]], length) <= worstAspect(row, length)
    )
      row.push(weighted[index++]);
    const area = row.reduce((sum, item) => sum + item.area, 0);
    if (remaining.width >= remaining.height) {
      const rowWidth = area / remaining.height;
      let y = remaining.y;
      for (const item of row) {
        const height = rowWidth === 0 ? 0 : item.area / rowWidth;
        boxes.set(item.record, { x: remaining.x, y, width: rowWidth, height });
        y += height;
      }
      remaining = {
        x: remaining.x + rowWidth,
        y: remaining.y,
        width: Math.max(0, remaining.width - rowWidth),
        height: remaining.height,
      };
    } else {
      const rowHeight = area / remaining.width;
      let x = remaining.x;
      for (const item of row) {
        const width = rowHeight === 0 ? 0 : item.area / rowHeight;
        boxes.set(item.record, { x, y: remaining.y, width, height: rowHeight });
        x += width;
      }
      remaining = {
        x: remaining.x,
        y: remaining.y + rowHeight,
        width: remaining.width,
        height: Math.max(0, remaining.height - rowHeight),
      };
    }
  }
  return boxes;
}

/** Squarify weighted hierarchy leaves into stable, compact rectangles.
 * @param root - Hierarchy root.
 * @param options - Accessors, units, and finite bounds.
 * @returns Immutable partition geometry. @see {@link PartitionLayout} */
export function layoutTreemap<D>(
  root: D,
  options: TreemapOptions<D>,
): PartitionLayout<D> {
  const bounds = checkedBounds(options.bounds, "layoutTreemap");
  const gap = finiteGap(options.cellGap, 4, "layoutTreemap cellGap");
  const padding = finiteGap(options.padding, 6, "layoutTreemap padding");
  const headerHeight = finiteGap(
    options.headerHeight,
    26,
    "layoutTreemap headerHeight",
  );
  const tree = hierarchy(root, options, "layoutTreemap", options.value);
  const cells: PartitionCellGeometry<D>[] = [];
  const add = (
    record: HierarchyRecord<D>,
    box: Bounds,
    depth: number,
    parentKey: PartitionCellGeometry<D>["parentKey"],
    rootItem: boolean,
  ) => {
    const children = record.collapsed ? [] : record.children;
    const boxLabel = partitionLabel(record, options, {
      x: box.x + 12,
      y: box.y + 8,
      width: Math.max(0, box.width - 24),
      height: Math.max(0, box.height - 16),
    });
    if (!rootItem || record.isLeaf)
      cells.push(
        Object.freeze({
          key: record.key,
          datum: record.datum,
          parentKey,
          depth,
          value: record.value,
          fraction: tree.value === 0 ? 0 : record.value / tree.value,
          isLeaf: record.isLeaf,
          collapsed: record.collapsed,
          bounds: Object.freeze(box),
          label: partitionLabelFits(boxLabel, box) ? boxLabel : null,
        }),
      );
    if (children.length === 0) return;
    const content = inset(
      {
        x: box.x,
        y: box.y + headerHeight,
        width: box.width,
        height: Math.max(0, box.height - headerHeight),
      },
      padding,
    );
    const laidOut = squarify(children, content);
    for (const child of children) {
      const raw = laidOut.get(child)!;
      const childBox = inset(raw, gap / 2);
      add(
        child,
        childBox,
        rootItem ? 0 : depth + 1,
        rootItem ? null : record.key,
        false,
      );
    }
  };
  add(tree, bounds, 0, null, true);
  return Object.freeze({
    bounds,
    rootKey: tree.key,
    total: tree.value,
    unit: options.unit,
    cells: Object.freeze(cells),
  });
}

/** Paint one partition cell at its immutable geometry.
 * @param props - Cell geometry, paint, events, and optional global-coordinate children.
 * @returns Canvas composition. @see {@link PartitionCellGeometry} */
export function TreemapCell<D>(props: PartitionCellProps<D>): PibblNode {
  const { bounds } = props.cell;
  const { children, style, ...events } = props;
  return (
    <Group>
      <Rectangle
        {...events}
        style={{
          ...resolveSignalValue(style),
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
        }}
      />
      {children}
    </Group>
  );
}

/** Render a squarified hierarchy with visible quantitative labels.
 * @param props - Reactive hierarchy data and presentation.
 * @returns Canvas composition. @see {@link layoutTreemap} */
export function Treemap<D>(props: TreemapProps<D>): PibblNode {
  const frame = useGraphFrame<TreemapStyle>(props.style);
  const root = resolveSignalValue(props.root);
  if (frame.bounds.width === 0 || frame.bounds.height === 0)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const layout = layoutTreemap(root, {
    ...props,
    bounds: frame.bounds,
    cellGap: frame.style.cellGap,
    padding: frame.style.padding,
    headerHeight: frame.style.headerHeight,
  });
  const labelStyle = resolveSignalValue(props.labelStyle);
  return (
    <Group style={frame.groupStyle}>
      {layout.cells.map((cell) =>
        props.renderCell ? (
          <Group
            key={cell.key}
            onClick={(event) => props.onCellClick?.(cell, event)}
          >
            {props.renderCell(cell)}
          </Group>
        ) : (
          <TreemapCell
            key={cell.key}
            cell={cell}
            style={{
              ...defaultPartitionCellStyle(cell),
              ...resolveMarkStyle(cell, props.cellStyle),
            }}
            onClick={(event) => props.onCellClick?.(cell, event)}
          >
            {cell.label && (
              <GraphLabel
                label={cell.label}
                style={{ ...defaultGraphLabelStyle(cell.label), ...labelStyle }}
              />
            )}
          </TreemapCell>
        ),
      )}
    </Group>
  );
}
