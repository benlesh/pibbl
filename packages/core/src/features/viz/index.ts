export { LinearScale } from "./lib/linear-scale-component.js";
export { BarScale } from "./lib/bar-scale.js";
export { UTCScale } from "./lib/utc-scale-component.js";
export { useLinearScale } from "./lib/use-linear-scale.js";
export { useBarScale } from "./lib/use-bar-scale.js";
export { useUTCScale } from "./lib/use-utc-scale.js";
export type {
  ScaleId,
  LinearDomain,
  BandCategory,
  BandDomain,
  BarScaleProps,
  BandScaleRange,
  ResolvedBandScale,
  ScaleRange,
  ScaleLayoutStyle,
  LinearScaleProps,
  ResolvedLinearScale,
  ResolvedScale,
} from "./lib/types.js";
export { Axis } from "./lib/axis.js";
export { LineSeries } from "./lib/line-series.js";
export { ScaleAdjust } from "./lib/scale-adjust.js";
export type {
  AxisStyle,
  AxisProps,
  LineCoordinate,
  LineAccessor,
  LineCurve,
  LineSeriesStyle,
  LineSeriesProps,
  ScaleAdjustProps,
} from "./lib/types.js";
export { PointSeries } from "./lib/point-series.js";
export type {
  PointAccessor,
  PointMarkStyle,
  PointSeriesStyle,
  PointStyleResolver,
  PointSeriesProps,
} from "./lib/point-types.js";
export { PlotSeries } from "./lib/plot-series.js";
export type { PlotSeriesProps, PlotKeyAccessor } from "./lib/plot-types.js";
export { nearestDomainValue, nearestPoint } from "./lib/nearest.js";
export type { NearestPointOptions, NearestPoint } from "./lib/nearest.js";

export { HoverData } from "./lib/hover-data.js";
export { defineSeries, closestPoint } from "./lib/hover-queries.js";
export type {
  HoverQueryContext,
  HoverQuery,
  HoverDataProps,
  HoverSeries,
  HoverPoint,
  HoverHit,
  HoverSeriesMap,
  ClosestPointHit,
  ClosestPointOptions,
} from "./lib/hover-types.js";

export { HoverCard } from "./lib/hover-card.js";
export type {
  HoverCardProps,
  HoverCardStyle,
  HoverBounds,
  HoverPlacement,
} from "./lib/hover-card.js";

export {
  closestX,
  interpolateX,
  linearInterpolation,
} from "./lib/hover-queries.js";
export type {
  ClosestXOptions,
  ClosestXHit,
  HoverInterpolation,
  InterpolateXOptions,
  HoverSample,
} from "./lib/hover-types.js";

export { AnchoredLayout } from "./lib/anchored-layout.js";
export type {
  AnchoredItem,
  AnchoredPlacement,
  AnchoredLayoutProps,
} from "./lib/anchored-layout.js";

export { BarSeries } from "./lib/bar-series.js";
export type {
  BarThresholdFill,
  BarCategoryAccessor,
  BarSeriesStyle,
  BarStyleResolver,
  BarSeriesProps,
} from "./lib/bar-series.js";

export { pieSlices } from "./lib/pie-slices.js";
export type { PieOptions, PieSliceGeometry } from "./lib/pie-slices.js";

export { PieLayout, PieSlice, PieLabel } from "./lib/pie-layout.js";
export type { PieLayoutProps, PieLayoutStyle, PieLayoutSlice, PieLabelPlacement, PieLabelLayout, PieSliceProps, PieSliceStyle, PieLabelProps, PieLabelStyle } from "./lib/pie-types.js";

export { extent, niceUTCDomain } from "./lib/utc-scale.js";
export type { NumericDomain, UtcDomain, UTCScaleProps, ResolvedUtcScale, ResolvedContinuousScale } from "./lib/types.js";

export { linearTicks, niceLinearDomain, formatNumber } from "./lib/numeric-ticks.js";
export type { LinearTickOptions, NumberFormatOptions } from "./lib/numeric-ticks.js";
