import type { PointRenderedSeries } from "./capture-types.js";
import type { RecordedNumericHit, RenderedSeriesPoint } from "./query-types.js";

/** The original record and local geometry of a discrete circle/ring covering a query point.
 * @see {@link RecordedNumericHit}
 */
export interface PaintedPointHit<D> extends RecordedNumericHit<D> {
  /** Circle radius before world transforms, in local logical units. */
  readonly radiusLocal: number;
  /** Painted stroke width before world transforms, in local logical units. */
  readonly strokeWidthLocal: number;
}

/**
 * Selects the last-painted circle/ring covering a root-logical position in this series.
 * This is geometric fill/stroke coverage, not alpha readback or a Pibbl event target.
 * @param rendered - Borrowed point geometry from the last successful paint.
 * @param options - Explicit root-logical query point; CSS/device pixels are unsupported.
 * @returns Original datum/index and captured geometry, or undefined for clips, holes, omissions or singular transforms.
 * @see {@link PaintedPointHit}
 */
export function paintedPointAt<D>(
  rendered: PointRenderedSeries<D>,
  options: { rootPoint: Readonly<RenderedSeriesPoint> },
): PaintedPointHit<D> | undefined {
  rendered.assertLive();
  const { x, y } = options.rootPoint;
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new RangeError("paintedPointAt rootPoint must be finite.");
  const local = rendered.localAtRoot(options.rootPoint);
  if (!local || !rendered.anchorInsideClips(local)) return undefined;
  for (let index = rendered.marks.length - 1; index >= 0; index--) {
    const mark = rendered.marks[index];
    const radius = mark.radiusLocal ?? 0,
      stroke = mark.strokeWidthLocal ?? 0;
    if (radius === 0 || (!mark.fill && stroke === 0)) continue;
    const distance = Math.hypot(
      local.x - mark.anchorLocal.x,
      local.y - mark.anchorLocal.y,
    );
    if (
      distance > radius + stroke / 2 ||
      (!mark.fill && distance < Math.max(0, radius - stroke / 2))
    )
      continue;
    return Object.freeze({
      ...rendered.observations[index],
      radiusLocal: radius,
      strokeWidthLocal: stroke,
    });
  }
  return undefined;
}
