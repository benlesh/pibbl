/**
 * A point in a named logical coordinate system.
 *
 * @see {@link NumericRenderedObservation}
 */
export interface RenderedSeriesPoint {
  /** Horizontal logical coordinate. */
  readonly x: number;
  /** Vertical logical coordinate. */
  readonly y: number;
}

/**
 * One numeric observation evaluated for a committed rendered-series generation.
 *
 * `anchorLocal` belongs to the series' local logical coordinate system and
 * `anchorRoot` belongs to the root-logical coordinate system used by Pibbl
 * events. `run` separates observations that the rendered mark does not join.
 *
 * @see {@link NumericRenderedSeries}
 */
export interface NumericRenderedObservation<D> {
  /** Caller-owned original record. */
  readonly datum: D;
  /** Original zero-based index in the caller's source array. */
  readonly sourceIndex: number;
  /** Evaluated horizontal value in the series' numeric domain. */
  readonly domainX: number;
  /** Evaluated vertical value in the series' numeric domain. */
  readonly domainY: number;
  /** The observation anchor in series-local logical coordinates. */
  readonly anchorLocal: Readonly<RenderedSeriesPoint>;
  /** The observation anchor in root-logical coordinates. */
  readonly anchorRoot: Readonly<RenderedSeriesPoint>;
  /** Identifier of the contiguous rendered run containing this observation. */
  readonly run: number;
}

/**
 * The two logical anchors of a numeric domain position.
 *
 * @see {@link NumericRenderedSeries}
 */
export interface NumericRenderedAnchors {
  /** Anchor in the series-local logical coordinate system. */
  readonly anchorLocal: Readonly<RenderedSeriesPoint>;
  /** Anchor in the root-logical coordinate system. */
  readonly anchorRoot: Readonly<RenderedSeriesPoint>;
}

/**
 * A committed numeric rendering available for synchronous inspection.
 *
 * Instances are supplied by the matching inspection ref; applications do not
 * create them. They are valid only for the synchronous inspection context that
 * supplied them. `assertLive` throws after that context, after a replacement
 * generation, or after disposal.
 *
 * @see {@link NumericRenderedObservation}
 */
export interface NumericRenderedSeries<D> {
  /** Evaluated observations in source order for this committed generation. */
  readonly observations: readonly NumericRenderedObservation<D>[];
  /** Asserts that this generation can still be inspected synchronously. */
  assertLive(): void;
  /**
   * Converts a root-logical point to a numeric horizontal domain value, or
   * reports that the committed transform cannot invert that point.
   * @param point - Root-logical position to invert.
   * @returns The numeric horizontal domain value, or undefined when unavailable.
   */
  domainXAtRoot(point: Readonly<RenderedSeriesPoint>): number | undefined;
  /**
   * Maps numeric domain values to the committed local and root-logical anchors.
   * @param point - Numeric domain values to map.
   * @param point.domainX - Horizontal numeric domain value.
   * @param point.domainY - Vertical numeric domain value.
   * @returns Both committed logical anchors for the requested domain point.
   */
  anchorAtDomain(
    point: Readonly<{
      /** Horizontal numeric domain value. */
      domainX: number;
      /** Vertical numeric domain value. */
      domainY: number;
    }>,
  ): NumericRenderedAnchors;
  /**
   * Returns whether a local point lies within the committed clip stack.
   * @param pointLocal - Series-local logical position to test.
   * @returns Whether every committed clip contains the point.
   */
  anchorInsideClips(pointLocal: Readonly<RenderedSeriesPoint>): boolean;
}

/**
 * An observation that can be explicitly filtered by committed clipping.
 *
 * @see {@link NumericRenderedFilter}
 */
export interface InspectionCandidate<D> extends NumericRenderedObservation<D> {
  /** @returns Whether this observation's anchor lies within the committed clips. */
  anchorInsideClips(): boolean;
}

/**
 * Selects observations eligible for one inspection request.
 *
 * @param observation - Candidate containing the original observation and optional clip test.
 * @returns Whether the candidate participates in this request.
 * @see {@link InspectionCandidate}
 */
export type NumericRenderedFilter<D> = (
  observation: InspectionCandidate<D>,
) => boolean;

/**
 * A recorded observation selected by a numeric inspection query.
 *
 * @see {@link NumericRenderedObservation}
 */
export interface RecordedNumericHit<D> extends NumericRenderedObservation<D> {}

/**
 * A recorded observation selected by horizontal-domain proximity.
 *
 * @see {@link NearestRecordedXHit}
 */
export interface NearestRecordedXHit<D> extends RecordedNumericHit<D> {
  /** Absolute difference from the requested horizontal domain value. */
  readonly domainDelta: number;
}

/**
 * A recorded observation selected by root-logical geometric proximity.
 *
 * @see {@link NearestRecordedPointHit}
 */
export interface NearestRecordedPointHit<D> extends RecordedNumericHit<D> {
  /** Euclidean distance from the requested root-logical point. */
  readonly rootDistance: number;
}

/**
 * Chooses one source observation when several observations in one rendered run
 * have the same horizontal domain value.
 *
 * @param first - Observation selected so far at this domain value.
 * @param next - Later source observation at the same domain value.
 * @returns Either `first` or `next`.
 * @see {@link NumericRenderedObservation}
 */
export type NumericDuplicateResolver<D> = (
  first: NumericRenderedObservation<D>,
  next: NumericRenderedObservation<D>,
) => NumericRenderedObservation<D>;

/**
 * Computes a numeric vertical sample between two recorded domain values.
 *
 * @param beforeDomainY - Numeric vertical value before the sample.
 * @param afterDomainY - Numeric vertical value after the sample.
 * @param fraction - Distance from before to after, from zero through one.
 * @returns The estimated numeric vertical domain value.
 * @see {@link RecordedXSample}
 */
export type NumericDomainInterpolation = (
  beforeDomainY: number,
  afterDomainY: number,
  fraction: number,
) => number;

/**
 * An exact recorded sample or an explicit estimate between recorded observations.
 *
 * @see {@link NumericDomainInterpolation}
 */
export type RecordedXSample<D> =
  | (RecordedNumericHit<D> & {
      /** Identifies a value selected directly from one recorded observation. */
      readonly kind: "exact";
    })
  | Readonly<{
      /** Identifies a value computed between two recorded observations. */
      kind: "interpolated";
      /** Requested horizontal numeric domain value. */
      domainX: number;
      /** Numeric domain value returned by the caller's interpolation function. */
      domainY: number;
      /** Interpolated anchor in committed series-local logical coordinates. */
      anchorLocal: Readonly<RenderedSeriesPoint>;
      /** Interpolated anchor in committed root-logical coordinates. */
      anchorRoot: Readonly<RenderedSeriesPoint>;
      /** Observation immediately before the sampled position in its rendered run. */
      before: NumericRenderedObservation<D>;
      /** Observation immediately after the sampled position in its rendered run. */
      after: NumericRenderedObservation<D>;
      /** Fraction of the interval from `before` through `after`. */
      fraction: number;
    }>;
