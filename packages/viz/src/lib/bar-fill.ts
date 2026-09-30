import type { FillStyle } from "@crc/core";

/** Domain thresholds divide the bar fill into sharp, ordered color intervals. */
export interface BarThresholdFill {
  readonly type: "threshold";
  readonly thresholds: readonly number[];
  readonly colors: readonly string[];
}

export function barFill(
  ctx: Pick<CanvasRenderingContext2D, "createLinearGradient">,
  fill: FillStyle | BarThresholdFill,
  map: (value: number) => number,
): (start: number, end: number) => FillStyle {
  if (
    typeof fill === "string" ||
    fill instanceof CanvasGradient ||
    fill instanceof CanvasPattern
  )
    return () => fill;
  if (!fill || fill.type !== "threshold")
    throw new TypeError("BarSeries fill must be a paint or a threshold fill.");
  const { thresholds, colors } = fill;
  if (
    !Array.isArray(thresholds) ||
    !Array.isArray(colors) ||
    colors.length !== thresholds.length + 1
  )
    throw new TypeError(
      "BarSeries threshold fill requires one more color than thresholds.",
    );
  for (let i = 0; i < thresholds.length; i++) {
    if (
      typeof thresholds[i] !== "number" ||
      !Number.isFinite(thresholds[i]) ||
      (i > 0 && thresholds[i] <= thresholds[i - 1])
    )
      throw new RangeError(
        "BarSeries fill thresholds must be finite and strictly increasing.",
      );
  }
  // Validate even colors whose intervals are not present in the current data.
  const validation = ctx.createLinearGradient(0, 0, 0, 1);
  for (const color of colors) {
    if (typeof color !== "string")
      throw new TypeError(
        "BarSeries threshold colors must be CSS color strings.",
      );
    validation.addColorStop(0, color);
  }
  return (start, end) => {
    const low = Math.min(start, end),
      high = Math.max(start, end);
    let index = 0;
    while (index < thresholds.length && thresholds[index] <= low) index++;
    const y0 = map(low),
      y1 = map(high);
    if (y0 === y1) return colors[index];
    // Rectangle placement translates its local paint coordinates.
    const top = Math.min(y0, y1);
    const gradient = ctx.createLinearGradient(0, y0 - top, 0, y1 - top);
    gradient.addColorStop(0, colors[index]);
    for (; index < thresholds.length && thresholds[index] < high; index++) {
      const offset = Math.max(
        0,
        Math.min(1, (map(thresholds[index]) - y0) / (y1 - y0)),
      );
      gradient.addColorStop(offset, colors[index]);
      gradient.addColorStop(offset, colors[index + 1]);
    }
    gradient.addColorStop(1, colors[index]);
    return gradient;
  };
}
