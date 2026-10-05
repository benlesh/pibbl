import type { HoverCardProps } from './hover-card.js';
import type { PieLayoutProps } from './pie-types.js';
import type { HoverPoint } from "./hover-types.js";
/**
 * Preferred side of an anchor, or automatic placement within available bounds.
 *
 * @see {@link HoverCardProps}
 */
export type HoverPlacement = "auto" | "above" | "below" | "right" | "left";
/**
 * Logical bounds used to constrain hover-card placement.
 *
 * @see {@link HoverCardProps}
 * @see {@link PieLayoutProps}
 */
export interface HoverBounds {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link HoverBounds}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link HoverBounds}.
   */
  readonly y: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See {@link HoverBounds}
   * .
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See {@link HoverBounds}.
   */
  readonly height: number;
}
export function placeHoverCard(input: {
  anchor: HoverPoint;
  anchorRadius: number;
  gap: number;
  bounds: HoverBounds;
  width: number;
  height: number;
  strokeWidth: number;
  placement: HoverPlacement;
}): HoverPoint {
  const {
    anchor,
    anchorRadius,
    gap,
    bounds,
    width,
    height,
    strokeWidth,
    placement,
  } = input;
  for (const [name, value] of Object.entries({
    x: anchor.x,
    y: anchor.y,
    boundsX: bounds.x,
    boundsY: bounds.y,
    anchorRadius,
    gap,
    width,
    height,
    strokeWidth,
    boundsWidth: bounds.width,
    boundsHeight: bounds.height,
  })) {
    if (
      !Number.isFinite(value) ||
      (!["x", "y", "boundsX", "boundsY"].includes(name) && value < 0)
    )
      throw new RangeError(
        `HoverCard ${name} must be finite${name.endsWith("X") || name.endsWith("Y") || name === "x" || name === "y" ? "" : " and nonnegative"}.`,
      );
  }
  const sides = ["above", "below", "right", "left"] as const;
  if (placement !== "auto" && !sides.includes(placement))
    throw new TypeError("HoverCard placement is invalid.");
  const order =
    placement === "auto"
      ? sides
      : [placement, ...sides.filter((s) => s !== placement)];
  const half = strokeWidth / 2,
    clearance = anchorRadius + gap + half;
  const slide = (
    value: number,
    start: number,
    available: number,
    size: number,
  ) => Math.max(start + half, Math.min(value, start + available - size - half));
  const candidates = order.map((side) => {
    const vertical = side === "above" || side === "below";
    const x = vertical
      ? slide(anchor.x - width / 2, bounds.x, bounds.width, width)
      : side === "right"
        ? anchor.x + clearance
        : anchor.x - clearance - width;
    const y = !vertical
      ? slide(anchor.y - height / 2, bounds.y, bounds.height, height)
      : side === "below"
        ? anchor.y + clearance
        : anchor.y - clearance - height;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(x + width + half) ||
      !Number.isFinite(y + height + half)
    )
      throw new RangeError("HoverCard placement arithmetic must be finite.");
    return { x, y };
  });
  return (
    candidates.find(
      (p) =>
        p.x - half >= bounds.x &&
        p.y - half >= bounds.y &&
        p.x + width + half <= bounds.x + bounds.width &&
        p.y + height + half <= bounds.y + bounds.height,
    ) ?? candidates[0]
  );
}
