import { Group, resolveSignalValue } from "@pibbl/core";
import type { PibblNode } from "@pibbl/core";
import type { PlotSeriesProps } from "./plot-types.js";
import { pointAccessor, pointData, finiteCoordinate } from "./point-data.js";
import { useContinuousScale } from "./use-continuous-scale.js";
function PlotRow<D>({
  datum,
  index,
  data,
  render,
}: {
  datum: D;
  index: number;
  data: readonly D[];
  render: PlotSeriesProps<D>["render"];
}): PibblNode {
  return render(datum, index, data);
}
/**
 * Places keyed custom Pibbl subtrees at local data coordinates.
 *
 * @param props - Data, coordinate accessors, scales, keys, and per-datum renderer. See
 * {@link PlotSeriesProps} .
 * @returns Pibbl nodes placing each rendered datum at its mapped coordinates. See {@link PibblNode}.
 *
 * @see {@link PlotSeriesProps}
 * @see {@link PibblNode}
 */
export function PlotSeries<D>({
  data: input,
  x: xInput,
  y: yInput,
  xScale: xId,
  yScale: yId,
  defined,
  keyBy,
  render,
  ...events
}: PlotSeriesProps<D>): PibblNode {
  const xs = useContinuousScale(xId).get(),
    ys = useContinuousScale(yId).get();
  const data = pointData(resolveSignalValue(input), "PlotSeries");
  if (typeof render !== "function")
    throw new TypeError("PlotSeries: render must be a synchronous function.");
  const x = pointAccessor(xInput),
    y = pointAccessor(yInput);
  const keys = new Set<string>();
  const nodes: PibblNode[] = [];
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) continue;
    const xv = x(datum, i, data),
      yv = y(datum, i, data);
    if (!finiteCoordinate(xv) || !finiteCoordinate(yv)) continue;
    const px = xs.map(xv),
      py = ys.map(yv);
    const key =
      keyBy === undefined
        ? i
        : typeof keyBy === "function"
          ? keyBy(datum, i, data)
          : datum[keyBy];
    if (typeof key !== "string" && typeof key !== "number")
      throw new TypeError("PlotSeries: keyBy must return a string or number.");
    const normalized = String(key);
    if (keys.has(normalized))
      throw new Error(`PlotSeries: duplicate key "${normalized}".`);
    keys.add(normalized);
    nodes.push(
      <Group key={normalized} style={{ translateX: px, translateY: py }}>
        <PlotRow datum={datum} index={i} data={data} render={render} />
      </Group>,
    );
  }
  return <Group {...events}>{nodes}</Group>;
}
