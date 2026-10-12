import type { LayoutBox } from "@pibbl/core";
import type { BarSeriesProps } from "../lib/bar-series.js";
import type { BandCategory } from "../lib/types.js";
import type { RenderedSeriesPoint } from "./query-types.js";
import { useRenderedRef } from "./owned-ref.js";

/** Original range/value/grouped bar with its captured endpoints and local paint bounds.
 * @see {@link BarRenderedSeries}
 */
export interface PaintedBarHit<D> {
  /** Caller-owned original record. */
  readonly datum: D;
  /** Original zero-based source position. */
  readonly sourceIndex: number;
  /** Original discrete category, without numeric coercion. */
  readonly category: BandCategory;
  /** Original subgroup when grouping is enabled. */
  readonly group: BandCategory | undefined;
  /** Data-space starting endpoint, including an ordinary bar's baseline. */
  readonly valueStart: number;
  /** Data-space ending endpoint. */
  readonly valueEnd: number;
  /** Logical rectangle bounds before world transforms. */
  readonly boundsLocal: Readonly<LayoutBox>;
}
/** @internal Captured rectangle paint flags used only for geometric lookup. */
export interface CapturedBarMark<D> extends PaintedBarHit<D> {
  /** Whether this rectangle paints its interior. */
  readonly fill: boolean;
  /** Painted stroke width in local logical units. */
  readonly strokeWidthLocal: number;
}
/** A borrowed committed categorical bar generation; contains no numeric category mapping.
 * @see {@link PaintedBarHit}
 */
export interface BarRenderedSeries<D> {
  /** Original records and geometry in source paint order. */
  readonly marks: readonly CapturedBarMark<D>[];
  /** Throws after replacement or disposal. */
  assertLive(): void;
  /** Converts root logical units into this generation's local geometry.
   * @param point - Root-logical Canvas point.
   * @returns Local point or undefined for a singular transform.
   */
  localAtRoot(
    point: Readonly<RenderedSeriesPoint>,
  ): Readonly<RenderedSeriesPoint> | undefined;
  /** Tests a local point against every committed clip/layer bound.
   * @param point - Local-logical Canvas point.
   * @returns Whether the point is inside every clip and layer bound.
   */
  anchorInsideClips(point: Readonly<RenderedSeriesPoint>): boolean;
}
/** Mount-owned optional categorical-bar capture.
 * @see {@link BarRenderedSeries}
 */
export interface BarInspectionRef<D> {
  /** Returns the last successful generation.
   * @returns Borrowed bar geometry or undefined before paint/after disposal.
   */
  rendered(): BarRenderedSeries<D> | undefined;
  /** @internal Records candidate values and paint geometry without executing a search.
   * @param input - Source-ordered captured rectangle marks.
   */
  capture(input: readonly CapturedBarMark<D>[]): void;
}

/**
 * Owns opt-in capture for ordinary, range or grouped categorical bars.
 * @param _inputs - Bar inputs used for datum inference; no data is read or subscribed here.
 * @returns A stable ref to pass to one BarSeries inspection prop; captured endpoints share one fixed contract.
 * @see {@link BarInspectionRef}
 */
export function useBarInspection<D>(
  _inputs: Pick<BarSeriesProps<D>, "data" | "category">,
): BarInspectionRef<D> {
  return useRenderedRef<readonly CapturedBarMark<D>[], BarRenderedSeries<D>>(
    "barSeriesInspection",
    (marks, geometry) =>
      Object.freeze({
        marks: Object.freeze(marks.slice()),
        assertLive: geometry.assertLive,
        localAtRoot: geometry.localAtRoot,
        anchorInsideClips: geometry.anchorInsideClips,
      }),
  );
}

/**
 * Finds the last-painted bar covering a root-logical point in this explicit series.
 * @param rendered - Borrowed committed categorical bar values and rectangle geometry.
 * @param options - Root-logical query point; respects every clip, fill/stroke and source order.
 * @returns Original record, category/group, endpoints and local bounds, or undefined for gaps and singular transforms.
 * @see {@link PaintedBarHit}
 */
export function paintedBarAt<D>(
  rendered: BarRenderedSeries<D>,
  options: { rootPoint: Readonly<RenderedSeriesPoint> },
): PaintedBarHit<D> | undefined {
  rendered.assertLive();
  if (
    !Number.isFinite(options.rootPoint.x) ||
    !Number.isFinite(options.rootPoint.y)
  )
    throw new RangeError("paintedBarAt rootPoint must be finite.");
  const point = rendered.localAtRoot(options.rootPoint);
  if (!point || !rendered.anchorInsideClips(point)) return undefined;
  for (let index = rendered.marks.length - 1; index >= 0; index--) {
    const mark = rendered.marks[index],
      b = mark.boundsLocal,
      half = mark.strokeWidthLocal / 2;
    const inside =
      point.x >= b.x &&
      point.x <= b.x + b.width &&
      point.y >= b.y &&
      point.y <= b.y + b.height;
    const outline =
      half > 0 &&
      point.x >= b.x - half &&
      point.x <= b.x + b.width + half &&
      point.y >= b.y - half &&
      point.y <= b.y + b.height + half &&
      !(
        point.x > b.x + half &&
        point.x < b.x + b.width - half &&
        point.y > b.y + half &&
        point.y < b.y + b.height - half
      );
    if (!((mark.fill && inside) || outline)) continue;
    const {
      datum,
      sourceIndex,
      category,
      group,
      valueStart,
      valueEnd,
      boundsLocal,
    } = mark;
    return Object.freeze({
      datum,
      sourceIndex,
      category,
      group,
      valueStart,
      valueEnd,
      boundsLocal,
    });
  }
  return undefined;
}
