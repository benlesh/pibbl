import {
  Group,
  resolveSignalValue,
  useLayoutBox,
  type CRCNode,
  type SignalValue,
} from "@crc/core";
import {
  pushLayoutBox,
  setCurrentComponentAfterRender,
  withHooksForbidden,
} from "@crc/core/internal";

/**
 * Declared outer box and protected anchor, all in the parent's local coordinates.
 *
 * @see {@link AnchoredLayout}
 * @see {@link AnchoredLayoutProps}
 */
export interface AnchoredItem {
  /** Stable identity used by the containing protocol. See {@link AnchoredItem}. */
  readonly key: string | number;
  /** Logical point to which the content or result is anchored. See {@link AnchoredItem}. */
  readonly anchor: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link AnchoredItem}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link AnchoredItem}.
     */
    y: number;
  }>;
  /** Clearance around the anchor before placing the item. See {@link AnchoredItem}. */
  readonly anchorRadius?: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See {@link AnchoredItem}
   * .
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See {@link AnchoredItem}.
   */
  readonly height: number;
}
/**
 * The resolved logical rectangle assigned to an anchored item.
 *
 * @see {@link AnchoredLayoutProps}
 */
export interface AnchoredPlacement {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link AnchoredPlacement}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link AnchoredPlacement}.
   */
  readonly y: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link AnchoredPlacement}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link AnchoredPlacement}.
   */
  readonly height: number;
}
/**
 * Authored inputs for AnchoredLayout, including the declared data and presentation options.
 *
 * @see {@link AnchoredItem}
 * @see {@link SignalValue}
 * @see {@link AnchoredPlacement}
 * @see {@link CRCNode}
 * @see {@link AnchoredLayout}
 */
export interface AnchoredLayoutProps<T extends AnchoredItem> {
  /** Items to place around their declared anchors. See {@link SignalValue}. */
  readonly items: SignalValue<readonly T[]>;
  /** Direction in which this operation proceeds. See {@link AnchoredLayoutProps}. */
  readonly direction?: "vertical" | "horizontal";
  /** Spacing between adjacent items. See {@link SignalValue}. */
  readonly gap?: SignalValue<number>;
  /**
   * Logical region constraining the content or query. See {@link SignalValue},
   * {@link AnchoredPlacement}.
   */
  readonly bounds?: SignalValue<AnchoredPlacement>;
  /**
   * Descendant content or the callback that supplies it. See {@link AnchoredPlacement},
   * {@link CRCNode}.
   * @param item - Item being placed.
   * @param placement - Computed anchor and placement geometry. See {@link AnchoredPlacement}.
   * @returns CRC content for that item. See {@link CRCNode}.
   */
  readonly children: (item: T, placement: AnchoredPlacement) => CRCNode;
}
function finite(value: number, name: string, nonnegative = false) {
  if (!Number.isFinite(value) || (nonnegative && value < 0))
    throw new RangeError(
      `AnchoredLayout ${name} must be finite${nonnegative ? " and nonnegative" : ""}.`,
    );
  return value;
}
function arrange(
  items: readonly AnchoredItem[],
  bounds: AnchoredPlacement,
  gap: number,
  vertical: boolean,
): AnchoredPlacement[] {
  finite(gap, "gap", true);
  finite(bounds.x, "bounds.x");
  finite(bounds.y, "bounds.y");
  finite(bounds.width, "bounds.width", true);
  finite(bounds.height, "bounds.height", true);
  finite(bounds.x + bounds.width, "bounds right");
  finite(bounds.y + bounds.height, "bounds bottom");
  const keys = new Set<string>();
  const rows = items.map((item, index) => {
    if (typeof item.key !== "string" && typeof item.key !== "number")
      throw new TypeError("AnchoredLayout keys must be strings or numbers.");
    const key = String(item.key);
    if (keys.has(key))
      throw new Error(`AnchoredLayout duplicate key "${key}".`);
    keys.add(key);
    finite(item.anchor.x, "anchor.x");
    finite(item.anchor.y, "anchor.y");
    finite(item.width, "width", true);
    finite(item.height, "height", true);
    const radius = finite(item.anchorRadius ?? 0, "anchorRadius", true);
    return {
      item,
      index,
      key,
      radius,
      along: vertical ? item.anchor.y : item.anchor.x,
      across: vertical ? item.anchor.x : item.anchor.y,
      size: vertical ? item.height : item.width,
      breadth: vertical ? item.width : item.height,
      position: 0,
    };
  });
  if (!rows.length) return [];
  // Sort a private working list; preserve source paint order when rendering.
  rows.sort(
    (a, b) => a.along - b.along || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const start = vertical ? bounds.y : bounds.x;
  const end = finite(
    start + (vertical ? bounds.height : bounds.width),
    "packing end",
  );
  const acrossStart = vertical ? bounds.x : bounds.y;
  const acrossEnd = finite(
    acrossStart + (vertical ? bounds.width : bounds.height),
    "cross-axis end",
  );
  let positive = -Infinity,
    negative = Infinity,
    breadth = 0,
    cursor = start;
  for (const row of rows) {
    positive = Math.max(
      positive,
      finite(row.across + row.radius + gap, "anchor clearance"),
    );
    negative = Math.min(
      negative,
      finite(row.across - row.radius - gap, "anchor clearance"),
    );
    breadth = Math.max(breadth, row.breadth);
    row.position = Math.max(start, row.along - row.size / 2, cursor);
    cursor = finite(row.position + row.size + gap, "packing position");
  }
  // Back-pack at the far edge, then preserve separation by overflowing if needed.
  let limit = end;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    row.position = Math.min(row.position, limit - row.size);
    limit = finite(row.position - gap, "packing limit");
  }
  const shift = Math.max(0, start - rows[0].position);
  const positiveFits =
    positive >= acrossStart && positive + breadth <= acrossEnd;
  const negativeFits =
    negative - breadth >= acrossStart && negative <= acrossEnd;
  const usePositive = positiveFits || !negativeFits;
  const placements: AnchoredPlacement[] = new Array(items.length);
  for (const row of rows) {
    const along = finite(row.position + shift, "placement");
    const across = finite(
      usePositive ? positive : negative - row.breadth,
      "placement",
    );
    const x = vertical ? across : along,
      y = vertical ? along : across;
    finite(x + row.item.width, "placement right");
    finite(y + row.item.height, "placement bottom");
    placements[row.index] = {
      x,
      y,
      width: row.item.width,
      height: row.item.height,
    };
  }
  return placements;
}
function Item<T extends AnchoredItem>({
  item,
  placement,
  render,
}: {
  item: T;
  placement: AnchoredPlacement;
  render: AnchoredLayoutProps<T>["children"];
}): CRCNode {
  const box = { x: 0, y: 0, width: placement.width, height: placement.height };
  // Both the received allocation and percentage basis belong to the declared box.
  const outer = pushLayoutBox(box);
  let inner: (() => void) | undefined;
  try {
    inner = pushLayoutBox(box);
    setCurrentComponentAfterRender(() => {
      inner!();
      outer();
    });
  } catch (error) {
    inner?.();
    outer();
    throw error;
  }
  return withHooksForbidden(
    "CRC hooks cannot be called in AnchoredLayout children; return a component instead.",
    () => render(item, placement),
  );
}
/**
 * Arranges keyed CRC content together, clear of every supplied anchor.
 *
 * @param props - Anchored items, placement constraints, and child renderer. See
 * {@link AnchoredLayoutProps} .
 * @returns CRC content positioned using the computed placements. See {@link CRCNode}.
 *
 * @see {@link AnchoredLayoutProps}
 * @see {@link CRCNode}
 * @see {@link AnchoredItem}
 */
export function AnchoredLayout<T extends AnchoredItem>(
  props: AnchoredLayoutProps<T>,
): CRCNode {
  const allocation = useLayoutBox();
  const items = resolveSignalValue(props.items);
  if (!Array.isArray(items))
    throw new TypeError("AnchoredLayout items must be an array.");
  if (typeof props.children !== "function")
    throw new TypeError(
      "AnchoredLayout children must be a synchronous function.",
    );
  const direction = props.direction ?? "vertical";
  if (direction !== "vertical" && direction !== "horizontal")
    throw new TypeError(
      "AnchoredLayout direction must be vertical or horizontal.",
    );
  const bounds =
    props.bounds === undefined
      ? { x: 0, y: 0, width: allocation.width, height: allocation.height }
      : resolveSignalValue(props.bounds);
  const placements = arrange(
    items,
    bounds,
    resolveSignalValue(props.gap ?? 8),
    direction === "vertical",
  );
  return items.map((item, i) => (
    <Group
      key={String(item.key)}
      style={{ translateX: placements[i].x, translateY: placements[i].y }}
    >
      <Item item={item} placement={placements[i]} render={props.children} />
    </Group>
  ));
}
