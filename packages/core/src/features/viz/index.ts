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
export { AreaSeries } from "./lib/area-series.js";
export type { AreaSeriesProps, AreaSeriesStyle } from "./lib/area-series.js";
export { IntervalBandSeries } from "./lib/interval-band-series.js";
export type { IntervalBandSeriesProps } from "./lib/interval-band-series.js";
export type { SeriesCurve } from "./lib/curve-definition.js";
export { stepBefore, stepAfter, stepMidpoint } from "./lib/step-curves.js";
export { monotoneX } from "./lib/monotone-curve.js";
export { ScaleAdjust } from "./lib/scale-adjust.js";
export type {
  AxisStyle,
  AxisProps,
  LineCoordinate,
  LineAccessor,
  SeriesAccessor,
  SeriesCoordinate,
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
export type {
  PieLayoutProps,
  PieLayoutStyle,
  PieLayoutSlice,
  PieLabelPlacement,
  PieLabelLayout,
  PieSliceProps,
  PieSliceStyle,
  PieLabelProps,
  PieLabelStyle,
} from "./lib/pie-types.js";

export { extent, niceUTCDomain } from "./lib/utc-scale.js";
export type {
  NumericDomain,
  UtcDomain,
  UTCScaleProps,
  ResolvedUtcScale,
  ResolvedContinuousScale,
} from "./lib/types.js";

export {
  linearTicks,
  niceLinearDomain,
  formatNumber,
} from "./lib/numeric-ticks.js";
export type {
  LinearTickOptions,
  NumberFormatOptions,
} from "./lib/numeric-ticks.js";
export { interpolateNumericRange } from "./lib/numeric-range-interpolation.js";
export {
  visibleOhlcPriceExtent,
  padLinearDomain,
} from "./lib/financial-autoscale.js";
export type {
  VisibleOhlcPriceExtentOptions,
  PadLinearDomainOptions,
} from "./lib/financial-autoscale.js";
export { percentageReturns, indexTo100 } from "./lib/financial-comparison.js";
export type {
  ComparisonBaseOptions,
  PercentageReturnPoint,
  IndexedValuePoint,
} from "./lib/financial-comparison.js";

export { utcTickLabels } from "./lib/utc-labels.js";
export type { UTCTickLabelOptions } from "./lib/utc-labels.js";

export { LogScale } from "./lib/log-scale-component.js";
export { useLogScale } from "./lib/use-log-scale.js";
export type { LogScaleProps, ResolvedLogScale } from "./lib/types.js";

export { SymlogScale } from "./lib/symlog-scale-component.js";
export { useSymlogScale } from "./lib/use-symlog-scale.js";
export type { SymlogScaleProps, ResolvedSymlogScale } from "./lib/types.js";

export { PointScale } from "./lib/point-scale-component.js";
export { usePointScale } from "./lib/use-point-scale.js";
export type { PointScaleProps, ResolvedPointScale } from "./lib/types.js";
export { GridLines, ReferenceLine } from "./lib/chart-lines.js";
export type {
  ChartLineProps,
  GridLinesProps,
  ReferenceLineProps,
} from "./lib/chart-lines.js";
export { ReferenceBand } from "./lib/reference-band.js";
export type { ReferenceBandProps } from "./lib/reference-band.js";
export { AxisTitle } from "./lib/axis-title.js";
export type { AxisTitleProps } from "./lib/axis-title.js";

export { panDomain, zoomDomain } from "./lib/domain-navigation.js";
export type {
  DomainNavigationConstraints,
  PanDomainOptions,
  ZoomDomainOptions,
} from "./lib/domain-navigation.js";

export {
  SequentialColorScale,
  useSequentialColorScale,
} from "./lib/sequential-color-scale.js";
export {
  DivergingColorScale,
  useDivergingColorScale,
} from "./lib/diverging-color-scale.js";
export type {
  ColorScaleStop,
  SequentialColorScaleProps,
  DivergingColorScaleProps,
  ResolvedSequentialColorScale,
  ResolvedDivergingColorScale,
} from "./lib/color-types.js";

export {
  ThresholdColorScale,
  useThresholdColorScale,
} from "./lib/threshold-color-scale.js";
export type {
  ThresholdColorBand,
  ThresholdColorScaleProps,
  ResolvedThresholdColorScale,
} from "./lib/threshold-color-scale.js";

export { VolumeSeries } from "./lib/volume-series.js";
export type {
  VolumeSeriesProps,
  VolumeSeriesStyle,
} from "./lib/volume-series.js";

export {
  TradingTimeScale,
  useTradingTimeScale,
} from "./lib/trading-time-scale.js";
export type {
  TradingTimeScaleProps,
  ResolvedTradingTimeScale,
} from "./lib/trading-time-scale.js";
export { CandlestickSeries } from "./lib/candlestick-series.js";
export type {
  CandlestickSeriesProps,
  CandlestickSeriesStyle,
  CandleBodyStyle,
  CandleWickStyle,
} from "./lib/candlestick-series.js";
