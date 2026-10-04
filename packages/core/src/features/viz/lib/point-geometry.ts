/** Separate contours avoid line segments between circles; opposite inner winding makes rings. */
function circle(
  path: Path2D,
  x: number,
  y: number,
  radius: number,
  reverse = false,
) {
  path.moveTo(x + radius, y);
  path.arc(x, y, radius, 0, Math.PI * 2, reverse);
  path.closePath();
}
export function pointPath(x: number, y: number, radius: number): Path2D {
  const path = new Path2D();
  circle(path, x, y, radius);
  return path;
}
export function appendPointTarget(
  path: Path2D,
  x: number,
  y: number,
  radius: number,
  fill: boolean,
  strokeWidth: number,
): void {
  if (radius === 0 || (!fill && strokeWidth === 0)) return;
  const outer = radius + strokeWidth / 2;
  if (
    !Number.isFinite(outer) ||
    !Number.isFinite(x + outer) ||
    !Number.isFinite(y + outer)
  )
    throw new RangeError("PointSeries: circle geometry overflow.");
  circle(path, x, y, outer);
  const inner = radius - strokeWidth / 2;
  if (!fill && inner > 0) circle(path, x, y, inner, true);
}
