/** Optional committed-render inspection. Rendering entries do not import these algorithms. */
export {
  useNumericInspection,
  usePointInspection,
} from "./inspection/capture.js";
export { withInspection } from "./inspection/handler.js";
export { paintedPointAt } from "./inspection/painted-point.js";
export { useBarInspection, paintedBarAt } from "./inspection/bar.js";
export type {
  BarInspectionRef,
  BarRenderedSeries,
  PaintedBarHit,
} from "./inspection/bar.js";
export type { PaintedPointHit } from "./inspection/painted-point.js";
export type { InspectionContext, InspectionRef } from "./inspection/handler.js";
export type {
  NumericInspectionRef,
  PointInspectionRef,
  PointRenderedSeries,
} from "./inspection/capture-types.js";
export {
  nearestRecordedX,
  nearestRecordedPoint,
  sampleRecordedX,
  firstSourceObservation,
  lastSourceObservation,
  anchorInsideClips,
} from "./inspection/queries.js";
export type {
  NumericRenderedSeries,
  NumericRenderedObservation,
  RecordedNumericHit,
  NearestRecordedXHit,
  NearestRecordedPointHit,
  RecordedXSample,
  NumericRenderedFilter,
  NumericDuplicateResolver,
  NumericDomainInterpolation,
  RenderedSeriesPoint,
} from "./inspection/query-types.js";

export type {
  NumericRenderedSeries as RenderedSeries,
  InspectionCandidate,
  NumericRenderedAnchors,
} from "./inspection/query-types.js";
export type {
  NearestRecordedXOptions,
  NearestRecordedPointOptions,
  SampleRecordedXOptions,
} from "./inspection/queries.js";
