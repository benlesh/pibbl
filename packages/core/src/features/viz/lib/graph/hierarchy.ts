import type {
  Accessor,
  Bounds,
  HierarchyAccessors,
  LabelGeometry,
  PartitionAccessors,
  Size,
  VizKey,
} from "./types.js";
import { readAccessor, validateBounds } from "./shared.js";

export interface HierarchyRecord<D> {
  readonly datum: D;
  readonly key: VizKey;
  readonly parent: HierarchyRecord<D> | null;
  readonly children: readonly HierarchyRecord<D>[];
  readonly depth: number;
  readonly collapsed: boolean;
  readonly hiddenChildren: number;
  readonly value: number;
  readonly isLeaf: boolean;
}

function key<D>(datum: D, accessor: Accessor<D, VizKey>, name: string): VizKey {
  const value = readAccessor(datum, accessor);
  if (
    typeof value !== "string" &&
    (typeof value !== "number" || !Number.isFinite(value))
  )
    throw new TypeError(`${name}: key must be a string or finite number.`);
  return value;
}

export function hierarchy<D>(
  root: D,
  options: HierarchyAccessors<D>,
  name: string,
  value?: PartitionAccessors<D>["value"],
): HierarchyRecord<D> {
  const known = new Set<VizKey>();
  const active = new Set<D>();
  const visit = (
    datum: D,
    parent: HierarchyRecord<D> | null,
    depth: number,
  ): HierarchyRecord<D> => {
    if (active.has(datum))
      throw new Error(`${name}: hierarchy contains a cycle.`);
    const id = key(datum, options.keyBy, name);
    if (known.has(id)) throw new Error(`${name}: duplicate key ${String(id)}.`);
    known.add(id);
    active.add(datum);
    const rawChildren = readAccessor(datum, options.childrenBy);
    if (rawChildren != null && !Array.isArray(rawChildren))
      throw new TypeError(
        `${name}: childrenBy must return an array, null, or undefined.`,
      );
    const collapsed = options.collapsed?.(datum) === true;
    const draft = {
      datum,
      key: id,
      parent,
      children: [] as HierarchyRecord<D>[],
      depth,
      collapsed,
      hiddenChildren: rawChildren?.length ?? 0,
      value: 0,
      isLeaf: !rawChildren?.length,
    };
    const children = (rawChildren ?? []).map((child) =>
      visit(child, draft as HierarchyRecord<D>, depth + 1),
    );
    active.delete(datum);
    const ownValue =
      children.length === 0 && value !== undefined
        ? readAccessor(datum, value)
        : 0;
    if (!Number.isFinite(ownValue) || ownValue < 0)
      throw new RangeError(
        `${name}: leaf value for ${String(id)} must be finite and nonnegative.`,
      );
    const total =
      children.length === 0
        ? ownValue
        : children.reduce((sum, child) => sum + child.value, 0);
    if (!Number.isFinite(total))
      throw new RangeError(
        `${name}: aggregate quantity overflow; totals must remain finite.`,
      );
    return Object.freeze({
      ...draft,
      children: Object.freeze(children),
      hiddenChildren: collapsed ? children.length : 0,
      value: total,
      isLeaf: children.length === 0,
    });
  };
  return visit(root, null, 0);
}

export function finiteGap(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < 0)
    throw new RangeError(`${name} must be finite and nonnegative.`);
  return resolved;
}

export function finiteSize<D>(
  datum: D,
  size: Size | ((datum: D) => Size) | undefined,
  name: string,
): Size {
  const resolved =
    typeof size === "function"
      ? size(datum)
      : (size ?? { width: 160, height: 56 });
  if (
    !Number.isFinite(resolved.width) ||
    !Number.isFinite(resolved.height) ||
    resolved.width <= 0 ||
    resolved.height <= 0
  )
    throw new RangeError(
      `${name}: nodeSize must have finite positive width and height.`,
    );
  return resolved;
}

export function hierarchyLabel<D>(
  datum: D,
  accessor: Accessor<D, string> | undefined,
  bounds: Bounds,
  fallbackText = "",
): LabelGeometry {
  const text =
    accessor === undefined
      ? fallbackText
      : String(readAccessor(datum, accessor));
  return Object.freeze({
    text,
    bounds: Object.freeze(bounds),
    rotationDegrees: 0,
  });
}

/** Build a visible partition label that retains the measured value and its declared unit. */
export function partitionLabel<D>(
  record: HierarchyRecord<D>,
  options: PartitionAccessors<D>,
  bounds: Bounds,
): LabelGeometry {
  const base = hierarchyLabel(record.datum, options.label, bounds);
  const quantity = options.formatValue?.(record.value) ?? String(record.value);
  return Object.freeze({
    ...base,
    text: base.text
      ? `${base.text} · ${quantity} ${options.unit}`
      : `${quantity} ${options.unit}`,
  });
}

/** Return whether a partition has enough physical room for a single label line. */
export function partitionLabelFits(
  label: LabelGeometry,
  bounds: Bounds,
): boolean {
  void label;
  return bounds.height >= 18 && bounds.width >= 48;
}

export function checkedBounds(bounds: Bounds, name: string): Bounds {
  try {
    return validateBounds(bounds);
  } catch (error) {
    throw new RangeError(
      `${name}: ${error instanceof Error ? error.message : "invalid bounds"}`,
      { cause: error },
    );
  }
}
