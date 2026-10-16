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
import { defaultPartitionCellStyle } from "./treemap.js";
import type {
  IcicleOptions,
  IcicleProps,
  IcicleStyle,
  PartitionCellGeometry,
  PartitionCellProps,
  PartitionLayout,
} from "./types.js";
import {
  checkedBounds,
  finiteGap,
  hierarchy,
  partitionLabel,
  partitionLabelFits,
  type HierarchyRecord,
} from "./hierarchy.js";

/** Lay out hierarchy values in depth rows.
 * @param root - Hierarchy root.
 * @param options - Accessors, units, and finite bounds.
 * @returns Immutable partition geometry. @see {@link PartitionLayout} */
export function layoutIcicle<D>(
  root: D,
  options: IcicleOptions<D>,
): PartitionLayout<D> {
  const bounds = checkedBounds(options.bounds, "layoutIcicle");
  const gap = finiteGap(options.cellGap, 1, "layoutIcicle cellGap");
  const levelGap = finiteGap(options.levelGap, 3, "layoutIcicle levelGap");
  const tree = hierarchy(root, options, "layoutIcicle", options.value);
  const depths: number[] = [];
  const visit = (record: HierarchyRecord<D>) => {
    depths[record.depth] = 1;
    for (const child of record.children) visit(child);
  };
  visit(tree);
  const visibleLevels = tree.isLeaf ? 1 : Math.max(1, depths.length - 1);
  const levelHeight =
    (bounds.height - Math.max(0, visibleLevels - 1) * levelGap) / visibleLevels;
  if (levelHeight < 0)
    throw new RangeError("layoutIcicle: bounds are too short for levelGap.");
  const cells: PartitionCellGeometry<D>[] = [];
  const add = (
    record: HierarchyRecord<D>,
    x: number,
    width: number,
    rootItem: boolean,
    parentKey: PartitionCellGeometry<D>["parentKey"],
  ) => {
    const visibleDepth = rootItem ? 0 : record.depth - 1;
    const y = bounds.y + visibleDepth * (levelHeight + levelGap);
    const box = Object.freeze({
      x: x + gap / 2,
      y,
      width: Math.max(0, width - gap),
      height: levelHeight,
    });
    if (!rootItem || record.isLeaf)
      cells.push(
        Object.freeze({
          key: record.key,
          datum: record.datum,
          parentKey,
          depth: rootItem ? 0 : record.depth - 1,
          value: record.value,
          fraction: tree.value === 0 ? 0 : record.value / tree.value,
          isLeaf: record.isLeaf,
          collapsed: record.collapsed,
          bounds: box,
          label: (() => {
            const label = partitionLabel(record, options, {
              x: box.x + 12,
              y: box.y + 8,
              width: Math.max(0, box.width - 24),
              height: Math.max(0, box.height - 16),
            });
            return partitionLabelFits(label, box) ? label : null;
          })(),
        }),
      );
    if (record.collapsed) return;
    const total = record.children.reduce((sum, child) => sum + child.value, 0);
    let cursor = x;
    for (const child of record.children) {
      const span =
        total === 0
          ? width / record.children.length
          : (width * child.value) / total;
      add(child, cursor, span, false, rootItem ? null : record.key);
      cursor += span;
    }
  };
  add(tree, bounds.x, bounds.width, true, null);
  return Object.freeze({
    bounds,
    rootKey: tree.key,
    total: tree.value,
    unit: options.unit,
    cells: Object.freeze(cells),
  });
}

/** Paint one icicle partition cell.
 * @param props - Cell geometry, paint, events, and optional children.
 * @returns Canvas composition. @see {@link PartitionCellGeometry} */
export function IcicleCell<D>(props: PartitionCellProps<D>): PibblNode {
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

/** Render hierarchy values as depth-aligned bands.
 * @param props - Reactive hierarchy data and presentation.
 * @returns Canvas composition. @see {@link layoutIcicle} */
export function Icicle<D>(props: IcicleProps<D>): PibblNode {
  const frame = useGraphFrame<IcicleStyle>(props.style);
  const root = resolveSignalValue(props.root);
  if (frame.bounds.width === 0 || frame.bounds.height === 0)
    return <Group style={frame.groupStyle}>{null}</Group>;
  const layout = layoutIcicle(root, {
    ...props,
    bounds: frame.bounds,
    cellGap: frame.style.cellGap,
    levelGap: frame.style.levelGap,
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
          <IcicleCell
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
          </IcicleCell>
        ),
      )}
    </Group>
  );
}
