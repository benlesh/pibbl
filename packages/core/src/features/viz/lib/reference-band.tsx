import { Path, resolveSignalValue, type SignalValue } from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import type { AxisStyle } from "./types.js";
import type { ChartLineProps } from "./chart-lines.js";
import { lookupScale } from "./scale-context.js";
import { opacity } from "./paint.js";
/** A continuous domain interval painted across an explicit local pixel span. See {@link ReferenceBand}. */
export interface ReferenceBandProps extends Omit<ChartLineProps, "style"> {
  /** Two finite in-domain numeric endpoints; either order, including equal values. */
  readonly values: SignalValue<readonly [number, number]>;
  /** Fill defaults to #dce5e8; opacity defaults to 0.35. */
  readonly style?: SignalValue<SignalStyle<Pick<AxisStyle, "fill" | "opacity">>>;
}
/** Paint a decorative interval without owning layout, labels, or hit geometry.
 * @param props - Scale geometry and presentation. See {@link ReferenceBandProps}.
 * @returns Decorative chart content in the caller's coordinate space.
 */
export function ReferenceBand(props: ReferenceBandProps) {
  if (props.direction !== "horizontal" && props.direction !== "vertical") throw new TypeError("ReferenceBand direction must be horizontal or vertical.");
  const source = lookupScale(props.scale, "ReferenceBand");
  if (!source) throw new TypeError("ReferenceBand requires a scale ID.");
  const scale = source.get();
  if (scale.type === "point" || scale.type === "band") throw new TypeError("ReferenceBand requires a continuous scale.");
  const values = resolveSignalValue(props.values), span = resolveSignalValue(props.span);
  for (const pair of [values, span]) if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(value => typeof value === "number" && Number.isFinite(value))) throw new RangeError("ReferenceBand values and span require two finite endpoints.");
  const lo = Math.min(...scale.domain), hi = Math.max(...scale.domain);
  if (values.some(value => value < lo || value > hi)) throw new RangeError("ReferenceBand values must be within the scale domain.");
  const a = scale.map(values[0]), b = scale.map(values[1]);
  const start = Math.min(...span), length = Math.abs(span[1] - span[0]);
  if (!Number.isFinite(length)) throw new RangeError("ReferenceBand span length must be finite.");
  const path = new Path2D();
  if (props.direction === "horizontal") path.rect(start, Math.min(a, b), length, Math.abs(b - a));
  else path.rect(Math.min(a, b), start, Math.abs(b - a), length);
  const style = resolveSignalValue(props.style) ?? {};
  return <Path pointerEvents="none" style={{ d: path, fill: resolveSignalValue(style.fill) ?? "#dce5e8", opacity: opacity(resolveSignalValue(style.opacity) ?? 0.35, "ReferenceBand") }} />;
}
