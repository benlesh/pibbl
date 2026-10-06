import { resolveTexturePaint } from "@pibbl/core/internal";
import {
  Path,
  isSignal,
  resolveSignalValue,
  useCanvasContext,
} from "@pibbl/core";
import type { FillStyle, StrokeStyle } from "@pibbl/core";
import type {
  PointMarkStyle,
  PointSeriesProps,
  PointSeriesStyle,
} from "./point-types.js";
import {
  useSeriesPosition,
  seriesAccessor,
  mapSeriesPosition,
} from "./series-position.js";
import { pointData } from "./point-data.js";
import { appendPointTarget, pointPath } from "./point-geometry.js";
import { opacity, width } from "./paint.js";
const fields = ["radius", "fill", "stroke", "strokeWidth", "opacity", "cursor"];
function paint(
  value: unknown,
  name: string,
): FillStyle | StrokeStyle | undefined {
  if (
    value === undefined ||
    typeof value === "string" ||
    value instanceof CanvasGradient ||
    value instanceof CanvasPattern
  )
    return value;
  throw new TypeError(`PointSeries: invalid ${name}.`);
}
function styleObject(input: unknown, callback: boolean): PointSeriesStyle {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("PointSeries: style must be an object.");
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (!fields.includes(key) || (callback && key === "cursor"))
      throw new TypeError(`PointSeries: unsupported style field ${key}.`);
    const value = (input as Record<string, unknown>)[key];
    if (callback && isSignal(value))
      throw new TypeError(
        "PointSeries: datum styles must contain plain values; read signals explicitly.",
      );
    result[key] = callback ? value : resolveSignalValue(value);
  }
  return result as PointSeriesStyle;
}
function normalized(style: PointSeriesStyle) {
  const radius = width(style.radius ?? 3, "PointSeries radius");
  if (style.cursor !== undefined && typeof style.cursor !== "string")
    throw new TypeError("PointSeries: cursor must be a string.");
  return {
    radius,
    fill: paint(style.fill ?? "#2563eb", "fill"),
    stroke: paint(style.stroke, "stroke"),
    strokeWidth: width(style.strokeWidth ?? 1, "PointSeries"),
    opacity: opacity(style.opacity ?? 1, "PointSeries"),
    cursor: style.cursor,
  };
}
/**
 * Batched circles in source paint order with one ordinary Pibbl target.
 *
 * @param props - Data, coordinate accessors, scales, and point styling. See
 * {@link PointSeriesProps} .
 * @returns Pibbl nodes drawing the point marks.
 *
 * @see {@link PointSeriesProps}
 */
export function PointSeries<D>({
  data: input,
  x: xInput,
  y: yInput,
  xScale: xId,
  yScale: yId,
  defined,
  style: styleInput,
  ...events
}: PointSeriesProps<D>) {
  const xs = useSeriesPosition(xId),
    ys = useSeriesPosition(yId);
  const data = pointData(resolveSignalValue(input), "PointSeries");
  const x = seriesAccessor(xInput),
    y = seriesAccessor(yInput);
  const specified = resolveSignalValue(styleInput);
  const shared =
    typeof specified === "function"
      ? undefined
      : normalized(styleObject(specified ?? {}, false));
  const ctx = useCanvasContext();
  const target = new Path2D();
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) continue;
    const xv = x(datum, i, data),
      yv = y(datum, i, data);
    const mappedX = mapSeriesPosition(xs, xv),
      mappedY = mapSeriesPosition(ys, yv);
    if (mappedX === undefined || mappedY === undefined) continue;
    const px = mappedX,
      py = mappedY;
    const style =
      shared ??
      normalized(
        styleObject(
          (specified as (d: D, i: number, a: readonly D[]) => PointMarkStyle)(
            datum,
            i,
            data,
          ),
          true,
        ),
      );
    if (style.radius === 0) continue;
    appendPointTarget(
      target,
      px,
      py,
      style.radius,
      !!style.fill,
      style.stroke ? style.strokeWidth : 0,
    );
    const path = pointPath(px, py, style.radius);
    ctx.save();
    try {
      ctx.globalAlpha *= style.opacity;
      if (style.fill) {
        ctx.fillStyle = resolveTexturePaint(style.fill, ctx, {
          x: px - style.radius,
          y: py - style.radius,
          width: style.radius * 2,
          height: style.radius * 2,
        });
        ctx.fill(path);
      }
      if (style.stroke && style.strokeWidth > 0) {
        ctx.strokeStyle = resolveTexturePaint(style.stroke, ctx, {
          x: px - style.radius,
          y: py - style.radius,
          width: style.radius * 2,
          height: style.radius * 2,
        });
        ctx.lineWidth = style.strokeWidth;
        ctx.stroke(path);
      }
    } finally {
      ctx.restore();
    }
  }
  return (
    <Path
      {...events}
      style={{ d: target, fill: "transparent", cursor: shared?.cursor }}
    />
  );
}
