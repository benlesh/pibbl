/**
 * Friend adapter for `@pibbl/layout`. It owns one native persistent tree and
 * deliberately has no Canvas, signal, component, or scheduler dependency.
 */
import { readyLayoutModule } from "./wasm/module.js";

type Direction = "ltr" | "rtl";
type Measure = (input: {
  readonly width: { readonly minimum: number; readonly maximum: number };
  readonly height: { readonly minimum: number; readonly maximum: number };
}) => { readonly width: number; readonly height: number };
type IntrinsicMeasure = () => {
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly minHeight: number;
  readonly maxHeight: number;
};
/** One private native-tree node provided by {@link StandaloneLayoutKernelInput}. */
export interface StandaloneLayoutKernelNode {
  /** Traversal-local node identifier. */ readonly id: number;
  /** Parent identifier, if any. */ readonly parent: number | undefined;
  /** Source-order child identifiers. */ readonly children: readonly number[];
  /** Fully normalized standalone style data. */ readonly style: Readonly<
    Record<string, unknown>
  >;
  /** Final-size measurement callback, if owned by this node. */ readonly measure:
    Measure | undefined;
  /** Paired intrinsic contribution callback, if owned by this node. */ readonly measureIntrinsic:
    IntrinsicMeasure | undefined;
}
/** Private request consumed by {@link StandaloneLayoutKernel}. */
export interface StandaloneLayoutKernelInput {
  /** Identifier of the calculated root. */ readonly root: number;
  /** Finite owner width. */ readonly width: number;
  /** Finite owner height. */ readonly height: number;
  /** Inherited layout direction. */ readonly direction: Direction;
  /** Reachable source-order native nodes. */ readonly nodes: readonly StandaloneLayoutKernelNode[];
}
/** One private box returned by {@link StandaloneLayoutKernel}. */
export interface StandaloneLayoutKernelBox {
  /** Traversal-local node identifier. */ readonly id: number;
  /** Physical x coordinate. */ readonly x: number;
  /** Physical y coordinate. */ readonly y: number;
  /** Outer width. */ readonly width: number;
  /** Outer height. */ readonly height: number;
}
/** Private native-tree owner used by the version-coupled {@link StandaloneLayoutKernelInput} adapter. */
export interface StandaloneLayoutKernel {
  /**
   * Calculates boxes for one request.
   * @param input - Fully normalized owned-tree input.
   * @returns Frozen native boxes in traversal order.
   */ calculate(
    input: StandaloneLayoutKernelInput,
  ): readonly StandaloneLayoutKernelBox[];
  /** Releases the native arena. */ dispose(): void;
}

interface Kernel {
  memory: WebAssembly.Memory;
  standalone_tree_create(): number;
  standalone_tree_generation(handle: number): number;
  standalone_tree_dispose(handle: number, generation: number): number;
  standalone_tree_resize_nodes(
    handle: number,
    generation: number,
    count: number,
  ): number;
  standalone_tree_resize_children(
    handle: number,
    generation: number,
    count: number,
  ): number;
  standalone_tree_resize_grid(
    handle: number,
    generation: number,
    count: number,
  ): number;
  standalone_tree_replace(
    handle: number,
    generation: number,
    root: number,
    direction: number,
  ): number;
  standalone_tree_prepare(
    handle: number,
    generation: number,
    width: number,
    height: number,
  ): number;
  standalone_tree_prepare_settled_measurements(
    handle: number,
    generation: number,
  ): number;
  standalone_tree_measure_count(handle: number, generation: number): number;
  standalone_tree_measure_node(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_measure_kind(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_measure_width_min(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_measure_width_max(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_measure_height_min(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_measure_height_max(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_resize_measurements(
    handle: number,
    generation: number,
    count: number,
  ): number;
  standalone_tree_solve(
    handle: number,
    generation: number,
    width: number,
    height: number,
  ): number;
  standalone_tree_box_count(handle: number, generation: number): number;
  standalone_tree_box_id(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_box_x(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_box_y(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_box_width(
    handle: number,
    generation: number,
    index: number,
  ): number;
  standalone_tree_box_height(
    handle: number,
    generation: number,
    index: number,
  ): number;
  dispose(): void;
}

// Keep this record deliberately append-only.  The Rust owner validates every
// field before it enters the persistent tree.
const NODE_STRIDE = 70;
const MEASUREMENT_STRIDE = 7;
const LENGTH_NONE = 0;
const LENGTH_POINT = 1;
const LENGTH_PERCENT = 2;
const LENGTH_AUTO = 3;
const FLEX_DIRECTIONS = [
  "row",
  "row-reverse",
  "column",
  "column-reverse",
] as const;
const FLEX_WRAPS = ["nowrap", "wrap", "wrap-reverse"] as const;
const JUSTIFY_CONTENT = [
  "flex-start",
  "flex-end",
  "center",
  "space-between",
  "space-around",
  "space-evenly",
] as const;
const ALIGNMENTS = [
  "stretch",
  "flex-start",
  "flex-end",
  "center",
  "baseline",
  "first-baseline",
  "last-baseline",
] as const;
const ALIGN_SELF = [
  "auto",
  "stretch",
  "flex-start",
  "flex-end",
  "center",
  "baseline",
  "first-baseline",
  "last-baseline",
] as const;
const ALIGN_CONTENT = [
  "flex-start", "flex-end", "center", "stretch", "space-between",
  "space-around", "space-evenly",
] as const;
const POSITIONS = ["relative", "static", "absolute"] as const;
const BOX_SIZINGS = ["border-box", "content-box"] as const;
const GRID_FLOWS = ["row", "column", "row dense", "column dense"] as const;
function status(value: number, action: string): void {
  if (value !== 0)
    throw new Error(`Standalone native layout ${action} failed (${value}).`);
}
function finite(value: unknown, property: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(
      `Standalone layout ${property} must be a finite number.`,
    );
  return value;
}
function length(
  records: Float64Array,
  offset: number,
  value: unknown,
  property: string,
): void {
  if (value === undefined) {
    records[offset] = 0;
    records[offset + 1] = LENGTH_NONE;
    return;
  }
  if (value === "auto") {
    records[offset] = 0;
    records[offset + 1] = LENGTH_AUTO;
    return;
  }
  if (typeof value === "number") {
    records[offset] = finite(value, property);
    records[offset + 1] = LENGTH_POINT;
    return;
  }
  if (typeof value === "string" && /^-?(?:\d+|\d*\.\d+)%$/.test(value)) {
    records[offset] = Number.parseFloat(value);
    records[offset + 1] = LENGTH_PERCENT;
    return;
  }
  throw new TypeError(
    `Standalone layout ${property} must be numeric, percentage, auto, or omitted.`,
  );
}
function numeric(
  records: Float64Array,
  offset: number,
  value: unknown,
  fallback: number,
  property: string,
): void {
  records[offset] = value === undefined ? fallback : finite(value, property);
}
function numericValue(
  value: unknown,
  fallback: number,
  property: string,
): number {
  return value === undefined ? fallback : finite(value, property);
}
function enumCode(
  value: unknown,
  values: readonly string[],
  fallback: number,
  property: string,
): number {
  if (value === undefined) return fallback;
  const index = values.indexOf(value as string);
  if (index < 0)
    throw new TypeError(
      `Standalone layout ${property} is unsupported by the native tree boundary.`,
    );
  return index;
}
function edge(
  style: Readonly<Record<string, unknown>>,
  side: "top" | "right" | "bottom" | "left",
  property: "padding" | "borderWidth",
): unknown {
  const value = style[property];
  if (
    value === undefined ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return value;
  if (value !== null && typeof value === "object")
    return (value as Record<string, unknown>)[side];
  throw new TypeError(
    `Standalone layout ${property} must be a scalar or physical-edge record.`,
  );
}

class NativeStandaloneLayoutKernel implements StandaloneLayoutKernel {
  #kernel: Kernel | undefined;
  #handle = 0;
  #generation = 0;
  constructor() {
    this.#kernel = new WebAssembly.Instance(readyLayoutModule())
      .exports as unknown as Kernel;
    this.#handle = this.kernel.standalone_tree_create();
    this.#generation = this.#handle
      ? this.kernel.standalone_tree_generation(this.#handle)
      : 0;
    if (!this.#handle || !this.#generation)
      throw new Error("Standalone native tree allocation failed.");
  }
  get kernel(): Kernel {
    if (!this.#kernel)
      throw new Error("The standalone layout kernel has been disposed.");
    return this.#kernel;
  }
  calculate(
    input: StandaloneLayoutKernelInput,
  ): readonly StandaloneLayoutKernelBox[] {
    if (
      !Number.isFinite(input.width) ||
      input.width < 0 ||
      !Number.isFinite(input.height) ||
      input.height < 0
    )
      throw new RangeError(
        "Standalone layout constraints must be finite and nonnegative.",
      );
    const nodes = input.nodes;
    const sourceIndex = new Map<number, number>();
    for (let index = 0; index < nodes.length; index++) {
      const id = nodes[index]!.id;
      if (!Number.isInteger(id) || id < 0 || sourceIndex.has(id))
        throw new Error(
          "Standalone layout node ids must be unique nonnegative integers.",
        );
      sourceIndex.set(id, index);
    }
    const rootIndex = sourceIndex.get(input.root);
    if (rootIndex === undefined)
      throw new Error(
        "Standalone layout root is not present in the owned node set.",
      );
    const children: number[] = [];
    const pointer = this.kernel.standalone_tree_resize_nodes(
      this.#handle,
      this.#generation,
      nodes.length,
    );
    if (!pointer && nodes.length)
      throw new Error("Standalone native node storage allocation failed.");
    const records = new Float64Array(
      this.kernel.memory.buffer,
      pointer,
      nodes.length * NODE_STRIDE,
    );
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index]!;
      const offset = index * NODE_STRIDE;
      const style = node.style;
      const parentIndex =
        node.parent === undefined ? -1 : sourceIndex.get(node.parent);
      if (parentIndex === undefined)
        throw new Error(
          "Standalone layout node parent is not present in the owned node set.",
        );
      const parent = parentIndex < 0 ? undefined : nodes[parentIndex];
      const gridContainerDeclaration =
        style.gridTemplateColumns !== undefined ||
        style.gridTemplateRows !== undefined ||
        style.gridAutoColumns !== undefined ||
        style.gridAutoRows !== undefined ||
        style.gridAutoFlow !== undefined;
      const gridItemDeclaration =
        style.gridColumnStart !== undefined ||
        style.gridColumnSpan !== undefined ||
        style.gridRowStart !== undefined ||
        style.gridRowSpan !== undefined;
      const flexContainerDeclaration =
        style.flexDirection !== undefined ||
        style.flexWrap !== undefined ||
        style.justifyContent !== undefined ||
        style.alignContent !== undefined;
      const flexItemDeclaration =
        style.flexBasis !== undefined ||
        style.flexGrow !== undefined ||
        style.flexShrink !== undefined;
      if (style.layout !== "grid" && gridContainerDeclaration)
        throw new TypeError(
          "Standalone Grid declarations require layout: 'grid'.",
        );
      if (style.layout === "grid" && flexContainerDeclaration)
        throw new TypeError(
          "Standalone Flex-container declarations cannot be applied to a Grid owner.",
        );
      if (parent === undefined && style.layout === "grid" && flexItemDeclaration)
        throw new TypeError(
          "Standalone Flex item declarations require a Flex parent.",
        );
      if (parent?.style.layout === "grid" && flexItemDeclaration)
        throw new TypeError(
          "Standalone Flex item declarations require a Flex parent.",
        );
      if (parent?.style.layout !== "grid" && gridItemDeclaration)
        throw new TypeError(
          "Standalone Grid item placement requires a Grid parent.",
        );
      if (style.overflow !== undefined && style.overflow !== "visible")
        throw new TypeError(
          "The standalone native tree does not yet admit clipped overflow.",
        );
      if (style.alignItems === 'baseline' || style.alignItems === 'first-baseline' || style.alignItems === 'last-baseline' ||
          style.alignSelf === 'baseline' || style.alignSelf === 'first-baseline' || style.alignSelf === 'last-baseline')
        throw new TypeError('Standalone baseline alignment requires a baseline provider and is not supported.');
      records[offset] = index;
      records[offset + 1] = parentIndex;
      records[offset + 2] = children.length;
      records[offset + 3] = node.children.length;
      for (const child of node.children) {
        const childIndex = sourceIndex.get(child);
        if (childIndex === undefined)
          throw new Error(
            "Standalone layout child is not present in the owned node set.",
          );
        children.push(childIndex);
      }
      length(records, offset + 4, style.width, "width");
      length(records, offset + 6, style.height, "height");
      length(records, offset + 8, style.minWidth, "minWidth");
      length(records, offset + 10, style.minHeight, "minHeight");
      length(records, offset + 12, style.maxWidth, "maxWidth");
      length(records, offset + 14, style.maxHeight, "maxHeight");
      length(records, offset + 16, style.flexBasis, "flexBasis");
      numeric(records, offset + 18, style.flexGrow, 0, "flexGrow");
      numeric(records, offset + 19, style.flexShrink, 0, "flexShrink");
      numeric(records, offset + 20, style.gap, 0, "gap");
      numeric(records, offset + 21, style.rowGap, -1, "rowGap");
      numeric(records, offset + 22, style.columnGap, -1, "columnGap");
      records[offset + 23] = enumCode(
        style.flexDirection,
        FLEX_DIRECTIONS,
        0,
        "flexDirection",
      );
      records[offset + 24] = enumCode(
        style.flexWrap,
        FLEX_WRAPS,
        0,
        "flexWrap",
      );
      records[offset + 25] = enumCode(
        style.justifyContent,
        JUSTIFY_CONTENT,
        0,
        "justifyContent",
      );
      records[offset + 26] = enumCode(
        style.alignItems,
        ALIGNMENTS,
        0,
        "alignItems",
      );
      records[offset + 27] = enumCode(
        style.alignSelf,
        ALIGN_SELF,
        0,
        "alignSelf",
      );
      records[offset + 50] = enumCode(style.alignContent, ALIGN_CONTENT, 0, "alignContent");
      records[offset + 51] = enumCode(style.position, POSITIONS, 0, "position");
      records[offset + 52] = enumCode(style.boxSizing, BOX_SIZINGS, 0, "boxSizing");
      numeric(records, offset + 53, style.aspectRatio, 0, "aspectRatio");
      if (records[offset + 53] < 0 || (records[offset + 53] !== 0 && records[offset + 53] <= 0))
        throw new TypeError("Standalone layout aspectRatio must be positive.");
      length(records, offset + 54, style.left, "left");
      length(records, offset + 56, style.right, "right");
      length(records, offset + 58, style.top, "top");
      length(records, offset + 60, style.bottom, "bottom");
      const borderLeft = edge(style, "left", "borderWidth") ?? 0;
      const borderRight = edge(style, "right", "borderWidth") ?? 0;
      const borderTop = edge(style, "top", "borderWidth") ?? 0;
      const borderBottom = edge(style, "bottom", "borderWidth") ?? 0;
      records[offset + 62] = finite(borderLeft, "borderWidth.left");
      records[offset + 63] = finite(borderRight, "borderWidth.right");
      records[offset + 64] = finite(borderTop, "borderWidth.top");
      records[offset + 65] = finite(borderBottom, "borderWidth.bottom");
      if (records[offset + 62] < 0 || records[offset + 63] < 0 || records[offset + 64] < 0 || records[offset + 65] < 0)
        throw new TypeError("Standalone layout borderWidth must be nonnegative.");
      length(
        records,
        offset + 28,
        style.marginLeft ?? style.margin,
        "marginLeft",
      );
      length(
        records,
        offset + 30,
        style.marginRight ?? style.margin,
        "marginRight",
      );
      length(
        records,
        offset + 32,
        style.marginTop ?? style.margin,
        "marginTop",
      );
      length(
        records,
        offset + 34,
        style.marginBottom ?? style.margin,
        "marginBottom",
      );
      length(
        records,
        offset + 36,
        edge(style, "left", "padding") ?? 0,
        "padding.left",
      );
      length(
        records,
        offset + 38,
        edge(style, "right", "padding") ?? 0,
        "padding.right",
      );
      length(
        records,
        offset + 40,
        edge(style, "top", "padding") ?? 0,
        "padding.top",
      );
      length(
        records,
        offset + 42,
        edge(style, "bottom", "padding") ?? 0,
        "padding.bottom",
      );
      if (
        (records[offset + 37] !== LENGTH_POINT &&
          records[offset + 37] !== LENGTH_PERCENT) ||
        (records[offset + 39] !== LENGTH_POINT &&
          records[offset + 39] !== LENGTH_PERCENT) ||
        (records[offset + 41] !== LENGTH_POINT &&
          records[offset + 41] !== LENGTH_PERCENT) ||
        (records[offset + 43] !== LENGTH_POINT &&
          records[offset + 43] !== LENGTH_PERCENT)
      )
        throw new TypeError(
          "Standalone layout padding must be numeric or percentage.",
        );
      records[offset + 44] = node.measure ? 1 : 0;
      records[offset + 49] = node.measureIntrinsic ? 1 : 0;
      records[offset + 45] = numericValue(
        style.gridColumnStart,
        0,
        "gridColumnStart",
      );
      records[offset + 46] = numericValue(
        style.gridColumnSpan,
        1,
        "gridColumnSpan",
      );
      records[offset + 47] = numericValue(
        style.gridRowStart,
        0,
        "gridRowStart",
      );
      records[offset + 48] = numericValue(style.gridRowSpan, 1, "gridRowSpan");
    }
    const grid: number[] = [];
    type PackedTrack = readonly [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const breadth = (
      value: unknown,
      property: string,
    ): readonly [number, number] => {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0)
        return [0, value];
      if (typeof value === "string" && /^(?:\d+|\d*\.\d+)%$/.test(value))
        return [1, Number.parseFloat(value)];
      if (
        typeof value === "string" &&
        /^(?:\d+|\d*\.\d+)fr$/.test(value) &&
        Number.parseFloat(value) >= 0
      )
        return [2, Number.parseFloat(value)];
      if (value === "min-content") return [3, 0];
      if (value === "max-content") return [4, 0];
      if (value === "auto") return [5, 0];
      throw new TypeError(
        `Standalone Grid ${property} must be a finite, percentage, fractional, or intrinsic track.`,
      );
    };
    const track = (value: unknown, property: string): PackedTrack => {
      if (
        value !== null &&
        typeof value === "object" &&
        (value as { kind?: unknown }).kind === "minmax"
      ) {
        const min = breadth(
          (value as { min?: unknown }).min,
          `${property}.min`,
        );
        const max = breadth(
          (value as { max?: unknown }).max,
          `${property}.max`,
        );
        return [6, 0, min[0], min[1], max[0], max[1], 0];
      }
      if (
        value !== null &&
        typeof value === "object" &&
        (value as { kind?: unknown }).kind === "fit-content"
      ) {
        const limit = breadth(
          (value as { limit?: unknown }).limit,
          `${property}.limit`,
        );
        if (limit[0] > 1)
          throw new TypeError(
            `Standalone Grid ${property} fit-content limit must be numeric or percentage.`,
          );
        return [limit[0] === 1 ? 9 : 7, limit[1], 0, 0, 4, 0, 0];
      }
      const fixed = breadth(value, property);
      return [fixed[0], fixed[1], 0, 0, 4, fixed[1], 0];
    };
    const expand = (
      value: unknown,
      property: string,
      target: PackedTrack[],
      nestedAuto = false,
    ): void => {
      if (
        value !== null &&
        typeof value === "object" &&
        (value as { kind?: unknown }).kind === "repeat"
      ) {
        const repeat = value as { count?: unknown; tracks?: unknown };
        if (!Array.isArray(repeat.tracks) || !repeat.tracks.length)
          throw new TypeError(
            `Standalone Grid ${property} repeat requires tracks.`,
          );
        if (repeat.count === "auto-fill" || repeat.count === "auto-fit") {
          if (nestedAuto)
            throw new TypeError(
              `Standalone Grid ${property} does not permit nested automatic repeats.`,
            );
          const pattern: PackedTrack[] = [];
          for (const nested of repeat.tracks)
            expand(nested, `${property}.tracks`, pattern, true);
          // Marker kind 8 is expanded by the owner-bound native Grid helper.
          target.push([
            8,
            repeat.count === "auto-fill" ? 1 : 2,
            pattern.length,
            0,
            0,
            0,
            0,
          ]);
          for (const record of pattern) target.push(record);
          return;
        }
        if (!Number.isInteger(repeat.count) || (repeat.count as number) < 1)
          throw new TypeError(
            `Standalone Grid ${property} repeat count must be positive or automatic.`,
          );
        for (let count = 0; count < (repeat.count as number); count++)
          for (const nested of repeat.tracks)
            expand(nested, `${property}.tracks`, target, nestedAuto);
        return;
      }
      target.push(track(value, property));
    };
    for (let index = 0; index < nodes.length; index++) {
      const style = nodes[index]!.style;
      if (style.layout !== "grid") continue;
      const columns = style.gridTemplateColumns;
      const rows = style.gridTemplateRows;
      if (
        !Array.isArray(columns) ||
        !Array.isArray(rows) ||
        !columns.length ||
        !rows.length
      )
        throw new TypeError(
          "Standalone Grid requires nonempty explicit column and row tracks.",
        );
      const packedColumns: PackedTrack[] = [];
      const packedRows: PackedTrack[] = [];
      for (const value of columns)
        expand(value, "gridTemplateColumns", packedColumns);
      for (const value of rows) expand(value, "gridTemplateRows", packedRows);
      const flow = enumCode(style.gridAutoFlow, GRID_FLOWS, 0, "gridAutoFlow");
      const autoColumn =
        style.gridAutoColumns === undefined
          ? undefined
          : track(style.gridAutoColumns, "gridAutoColumns");
      const autoRow =
        style.gridAutoRows === undefined
          ? undefined
          : track(style.gridAutoRows, "gridAutoRows");
      // Header: owner, explicit axis counts, gaps, flow, configured implicit-axis flags, then auto records and explicit records.
      grid.push(
        index,
        packedColumns.length,
        packedRows.length,
        numericValue(style.columnGap ?? style.gap, 0, "columnGap"),
        numericValue(style.rowGap ?? style.gap, 0, "rowGap"),
        flow,
        autoColumn ? 1 : 0,
        autoRow ? 1 : 0,
        ...(autoColumn ?? [0, 0, 0, 0, 4, 0, 0]),
        ...(autoRow ?? [0, 0, 0, 0, 4, 0, 0]),
      );
      for (const value of packedColumns) grid.push(...value);
      for (const value of packedRows) grid.push(...value);
    }
    const gridPointer = this.kernel.standalone_tree_resize_grid(
      this.#handle,
      this.#generation,
      grid.length,
    );
    if (!gridPointer && grid.length)
      throw new Error("Standalone native Grid storage allocation failed.");
    new Float64Array(this.kernel.memory.buffer, gridPointer, grid.length).set(
      grid,
    );
    const childPointer = this.kernel.standalone_tree_resize_children(
      this.#handle,
      this.#generation,
      children.length,
    );
    if (!childPointer && children.length)
      throw new Error("Standalone native child storage allocation failed.");
    new Uint32Array(
      this.kernel.memory.buffer,
      childPointer,
      children.length,
    ).set(children);
    status(
      this.kernel.standalone_tree_replace(
        this.#handle,
        this.#generation,
        rootIndex,
        input.direction === "rtl" ? 1 : 0,
      ),
      "tree replacement",
    );
    status(
      this.kernel.standalone_tree_prepare(
        this.#handle,
        this.#generation,
        input.width,
        input.height,
      ),
      "measurement preparation",
    );
    const count = this.kernel.standalone_tree_measure_count(
      this.#handle,
      this.#generation,
    );
    const measurementPointer = this.kernel.standalone_tree_resize_measurements(
      this.#handle,
      this.#generation,
      count,
    );
    if (!measurementPointer && count)
      throw new Error(
        "Standalone native measurement storage allocation failed.",
      );
    const measurements = new Float64Array(
      this.kernel.memory.buffer,
      measurementPointer,
      count * MEASUREMENT_STRIDE,
    );
    for (let index = 0; index < count; index++) {
      const nativeId = this.kernel.standalone_tree_measure_node(
        this.#handle,
        this.#generation,
        index,
      );
      const node = nodes[nativeId];
      const kind = this.kernel.standalone_tree_measure_kind(
        this.#handle,
        this.#generation,
        index,
      );
      if (!node)
        throw new Error(
          "Standalone native tree requested an unknown measurement node.",
        );
      // Native tree ids are traversal indexes; public owned-node ids are only
      // mapped back after solve. Returning the public id here misroutes a
      // callback whenever a root does not happen to be id zero.
      const offset = index * MEASUREMENT_STRIDE;
      measurements[offset] = nativeId;
      if (kind === 0) {
        if (!node.measure)
          throw new Error(
            "Standalone native tree requested a node without an owned measurement callback.",
          );
        const result = node.measure({
          width: {
            minimum: this.kernel.standalone_tree_measure_width_min(
              this.#handle,
              this.#generation,
              index,
            ),
            maximum: this.kernel.standalone_tree_measure_width_max(
              this.#handle,
              this.#generation,
              index,
            ),
          },
          height: {
            minimum: this.kernel.standalone_tree_measure_height_min(
              this.#handle,
              this.#generation,
              index,
            ),
            maximum: this.kernel.standalone_tree_measure_height_max(
              this.#handle,
              this.#generation,
              index,
            ),
          },
        });
        measurements[offset + 1] = finite(result.width, "measurement width");
        measurements[offset + 2] = finite(result.height, "measurement height");
      } else if (kind === 1) {
        if (!node.measureIntrinsic)
          throw new Error(
            "Standalone native tree requested a node without an owned intrinsic measurement callback.",
          );
        const result = node.measureIntrinsic();
        measurements[offset + 3] = finite(
          result.minWidth,
          "intrinsic minimum width",
        );
        measurements[offset + 4] = finite(
          result.maxWidth,
          "intrinsic maximum width",
        );
        measurements[offset + 5] = finite(
          result.minHeight,
          "intrinsic minimum height",
        );
        measurements[offset + 6] = finite(
          result.maxHeight,
          "intrinsic maximum height",
        );
        if (
          measurements[offset + 3] > measurements[offset + 4] ||
          measurements[offset + 5] > measurements[offset + 6]
        )
          throw new RangeError(
            "Standalone intrinsic measurement minimums must not exceed maximums.",
          );
      } else
        throw new Error(
          "Standalone native tree requested an unknown measurement kind.",
        );
    }
    status(
      this.kernel.standalone_tree_solve(
        this.#handle,
        this.#generation,
        input.width,
        input.height,
      ),
      "solve",
    );
    // The native first pass has now fixed every parent allocation.  Ask the
    // tree for one bounded continuation at those boxes, then let native solve
    // placement again from the refreshed measurements.
    let settled = false;
    for (let phase = 0; phase <= nodes.length; phase++) {
    status(
      this.kernel.standalone_tree_prepare_settled_measurements(
        this.#handle,
        this.#generation,
      ),
      "settled measurement preparation",
    );
    const settledCount = this.kernel.standalone_tree_measure_count(
      this.#handle,
      this.#generation,
    );
    if (!settledCount) { settled = true; break; }
    {
      const settledPointer = this.kernel.standalone_tree_resize_measurements(this.#handle, this.#generation, settledCount);
      if (!settledPointer) throw new Error("Standalone native settled measurement storage allocation failed.");
      const settled = new Float64Array(this.kernel.memory.buffer, settledPointer, settledCount * MEASUREMENT_STRIDE);
      for (let index = 0; index < settledCount; index++) {
        const nativeId = this.kernel.standalone_tree_measure_node(this.#handle, this.#generation, index);
        const node = nodes[nativeId]; const kind = this.kernel.standalone_tree_measure_kind(this.#handle, this.#generation, index);
        if (!node) throw new Error("Standalone native tree requested an unknown settled measurement node.");
        const offset = index * MEASUREMENT_STRIDE; settled[offset] = nativeId;
        if (kind === 0) {
          if (!node.measure) throw new Error("Standalone native tree requested a node without an owned measurement callback.");
          const result = node.measure({ width: { minimum: this.kernel.standalone_tree_measure_width_min(this.#handle, this.#generation, index), maximum: this.kernel.standalone_tree_measure_width_max(this.#handle, this.#generation, index) }, height: { minimum: this.kernel.standalone_tree_measure_height_min(this.#handle, this.#generation, index), maximum: this.kernel.standalone_tree_measure_height_max(this.#handle, this.#generation, index) } });
          settled[offset + 1] = finite(result.width, "settled measurement width"); settled[offset + 2] = finite(result.height, "settled measurement height");
        } else if (kind === 1) {
          if (!node.measureIntrinsic) throw new Error("Standalone native tree requested a node without an owned intrinsic measurement callback.");
          const result = node.measureIntrinsic(); settled[offset + 3] = finite(result.minWidth, "settled intrinsic minimum width"); settled[offset + 4] = finite(result.maxWidth, "settled intrinsic maximum width"); settled[offset + 5] = finite(result.minHeight, "settled intrinsic minimum height"); settled[offset + 6] = finite(result.maxHeight, "settled intrinsic maximum height");
          if (settled[offset + 3] > settled[offset + 4] || settled[offset + 5] > settled[offset + 6]) throw new RangeError("Standalone settled intrinsic measurement minimums must not exceed maximums.");
        } else throw new Error("Standalone native tree requested an unknown settled measurement kind.");
      }
      status(this.kernel.standalone_tree_solve(this.#handle, this.#generation, input.width, input.height), "settled solve");
    }
    }
    if (!settled)
      throw new Error(`Standalone native layout measurement continuation did not converge within ${nodes.length + 1} native dependency phases.`);
    const boxCount = this.kernel.standalone_tree_box_count(
      this.#handle,
      this.#generation,
    );
    if (boxCount !== nodes.length)
      throw new Error("Standalone native tree returned an incomplete box set.");
    const boxes: StandaloneLayoutKernelBox[] = [];
    for (let index = 0; index < boxCount; index++) {
      const nativeId = this.kernel.standalone_tree_box_id(
        this.#handle,
        this.#generation,
        index,
      );
      const source = nodes[nativeId];
      if (!source)
        throw new Error("Standalone native tree returned an unknown node id.");
      const box = {
        id: source.id,
        x: this.kernel.standalone_tree_box_x(
          this.#handle,
          this.#generation,
          index,
        ),
        y: this.kernel.standalone_tree_box_y(
          this.#handle,
          this.#generation,
          index,
        ),
        width: this.kernel.standalone_tree_box_width(
          this.#handle,
          this.#generation,
          index,
        ),
        height: this.kernel.standalone_tree_box_height(
          this.#handle,
          this.#generation,
          index,
        ),
      };
      boxes.push(box);
    }
    return Object.freeze(
      boxes.map((box) => Object.freeze(box)) as StandaloneLayoutKernelBox[],
    );
  }
  dispose(): void {
    const kernel = this.#kernel;
    if (!kernel) return;
    this.#kernel = undefined;
    try {
      if (
        this.#handle &&
        kernel.standalone_tree_dispose(this.#handle, this.#generation) !== 0
      )
        throw new Error("Standalone native tree disposal failed.");
    } finally {
      this.#handle = 0;
      this.#generation = 0;
      kernel.dispose();
    }
  }
}

/**
 * Creates a private native-tree owner used by {@link StandaloneLayoutKernelInput}.
 * @returns A disposable standalone kernel.
 */
export function createStandaloneLayoutKernel(): StandaloneLayoutKernel {
  return new NativeStandaloneLayoutKernel();
}
