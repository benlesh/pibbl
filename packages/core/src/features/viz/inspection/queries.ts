import type {
  NearestRecordedPointHit,
  NearestRecordedXHit,
  NumericDomainInterpolation,
  NumericDuplicateResolver,
  InspectionCandidate,
  NumericRenderedFilter,
  NumericRenderedObservation,
  NumericRenderedSeries,
  RecordedXSample,
  RenderedSeriesPoint,
} from "./query-types.js";

function finite(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${name} must be finite.`);
}

function limit(value: number | undefined, name: string): void {
  if (value === undefined) return;
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be nonnegative.`);
}

function point(value: Readonly<RenderedSeriesPoint>, name: string): void {
  finite(value.x, `${name}.x`);
  finite(value.y, `${name}.y`);
}

function candidate<D>(
  rendered: NumericRenderedSeries<D>,
  observation: NumericRenderedObservation<D>,
): InspectionCandidate<D> {
  return Object.freeze({
    ...observation,
    anchorInsideClips: () =>
      rendered.anchorInsideClips(observation.anchorLocal),
  });
}

function accepts<D>(
  rendered: NumericRenderedSeries<D>,
  observation: NumericRenderedObservation<D>,
  filter: NumericRenderedFilter<D> | undefined,
): boolean {
  return filter === undefined || filter(candidate(rendered, observation));
}

function anchored<D>(
  rendered: NumericRenderedSeries<D>,
  observation: NumericRenderedObservation<D>,
): NumericRenderedObservation<D> {
  return { ...observation, ...rendered.anchorAtDomain(observation) };
}

/**
 * Retains the first source observation at a duplicate domain coordinate.
 *
 * @param first - First selected observation at this domain coordinate.
 * @param _next - Later observation at the same domain coordinate.
 * @returns The earliest source observation.
 * @see {@link NumericDuplicateResolver}
 */
export function firstSourceObservation<D>(
  first: NumericRenderedObservation<D>,
  _next: NumericRenderedObservation<D>,
): NumericRenderedObservation<D> {
  return first;
}

/**
 * Replaces a source observation with the next one at a duplicate domain coordinate.
 *
 * @param _first - Earlier selected observation at this domain coordinate.
 * @param next - Later observation at the same domain coordinate.
 * @returns The latest source observation.
 * @see {@link NumericDuplicateResolver}
 */
export function lastSourceObservation<D>(
  _first: NumericRenderedObservation<D>,
  next: NumericRenderedObservation<D>,
): NumericRenderedObservation<D> {
  return next;
}

/**
 * Returns whether a filter candidate's anchor lies inside the committed clip stack.
 *
 * Pass this function as a query filter when visibility at the anchor is required.
 * Queries otherwise examine all eligible rendered observations.
 *
 * @param candidate - Candidate whose committed local anchor should be clip-tested.
 * @returns Whether the candidate anchor lies within every committed clip.
 * @see {@link NumericRenderedFilter}
 */
export function anchorInsideClips<D>(
  candidate: InspectionCandidate<D>,
): boolean {
  return candidate.anchorInsideClips();
}

/** Options for {@link nearestRecordedX}. */
export interface NearestRecordedXOptions<D> {
  /** Numeric horizontal domain value to inspect, or undefined for no request. */
  readonly domainX: number | undefined;
  /** Maximum accepted absolute horizontal-domain delta. */
  readonly maxDomainDelta?: number;
  /** Further restricts committed observations for this request. */
  readonly filter?: NumericRenderedFilter<D>;
}

/**
 * Finds the recorded observation nearest to a numeric horizontal domain value in O(n) time.
 *
 * Ties retain source order. Distance is measured in domain units, while both
 * returned anchors retain their explicitly named local and root-logical units.
 *
 * @param rendered - Committed rendered-series generation to inspect synchronously.
 * @param options - Domain position, optional limit, and observation filter.
 * @returns The selected recorded observation, or undefined when none qualifies.
 * @see {@link NearestRecordedXOptions}
 */
export function nearestRecordedX<D>(
  rendered: NumericRenderedSeries<D>,
  options: NearestRecordedXOptions<D>,
): NearestRecordedXHit<D> | undefined {
  rendered.assertLive();
  const query = options.domainX;
  if (query === undefined) return undefined;
  finite(query, "nearestRecordedX domainX");
  limit(options.maxDomainDelta, "nearestRecordedX maxDomainDelta");
  let best: NearestRecordedXHit<D> | undefined;
  let delta = Infinity;
  for (const observation of rendered.observations) {
    if (!accepts(rendered, observation, options.filter)) continue;
    const next = Math.abs(observation.domainX - query);
    finite(next, "nearestRecordedX domain delta");
    if (
      next < delta &&
      (options.maxDomainDelta === undefined || next <= options.maxDomainDelta)
    ) {
      delta = next;
      best = Object.freeze({
        ...anchored(rendered, observation),
        domainDelta: next,
      });
    }
  }
  return best;
}

/** Options for {@link nearestRecordedPoint}. */
export interface NearestRecordedPointOptions<D> {
  /** Root-logical point to inspect, or undefined for no request. */
  readonly rootPoint: Readonly<RenderedSeriesPoint> | undefined;
  /** Maximum accepted Euclidean root-logical distance. */
  readonly maxRootDistance?: number;
  /** Further restricts committed observations for this request. */
  readonly filter?: NumericRenderedFilter<D>;
}

/**
 * Finds the recorded observation nearest to a root-logical point in O(n) time.
 *
 * Ties retain source order. This query measures distance in root-logical units
 * so it remains meaningful under nonuniform series transforms.
 *
 * @param rendered - Committed rendered-series generation to inspect synchronously.
 * @param options - Root position, optional limit, and observation filter.
 * @returns The selected recorded observation, or undefined when none qualifies.
 * @see {@link NearestRecordedPointOptions}
 */
export function nearestRecordedPoint<D>(
  rendered: NumericRenderedSeries<D>,
  options: NearestRecordedPointOptions<D>,
): NearestRecordedPointHit<D> | undefined {
  rendered.assertLive();
  const query = options.rootPoint;
  if (query === undefined) return undefined;
  point(query, "nearestRecordedPoint rootPoint");
  limit(options.maxRootDistance, "nearestRecordedPoint maxRootDistance");
  let best: NearestRecordedPointHit<D> | undefined;
  let distance = Infinity;
  for (const observation of rendered.observations) {
    if (!accepts(rendered, observation, options.filter)) continue;
    const next = Math.hypot(
      observation.anchorRoot.x - query.x,
      observation.anchorRoot.y - query.y,
    );
    finite(next, "nearestRecordedPoint root distance");
    if (
      next < distance &&
      (options.maxRootDistance === undefined || next <= options.maxRootDistance)
    ) {
      distance = next;
      best = Object.freeze({
        ...anchored(rendered, observation),
        rootDistance: next,
      });
    }
  }
  return best;
}

/** Options for {@link sampleRecordedX}. */
export interface SampleRecordedXOptions<D> {
  /** Numeric horizontal domain value to sample, or undefined for no request. */
  readonly domainX: number | undefined;
  /** Computes the estimated numeric domain value between two recorded values. */
  readonly interpolation: NumericDomainInterpolation;
  /** Explicitly chooses one observation from each duplicate-domain group. */
  readonly resolveDuplicate?: NumericDuplicateResolver<D>;
  /** Maximum domain interval that may be interpolated across. */
  readonly maxDomainGap?: number;
  /** Further restricts committed observations for this request. */
  readonly filter?: NumericRenderedFilter<D>;
}

function resolvedRows<D>(
  rendered: NumericRenderedSeries<D>,
  filter: NumericRenderedFilter<D> | undefined,
  resolver: NumericDuplicateResolver<D> | undefined,
): readonly (readonly NumericRenderedObservation<D>[])[] {
  let validatedRun: number | undefined;
  let validatedX = -Infinity;
  for (const observation of rendered.observations) {
    finite(observation.domainX, "sampleRecordedX observation.domainX");
    finite(observation.domainY, "sampleRecordedX observation.domainY");
    if (validatedRun === observation.run && observation.domainX < validatedX)
      throw new RangeError(
        "sampleRecordedX requires nondecreasing domainX within each rendered run.",
      );
    validatedRun = observation.run;
    validatedX = observation.domainX;
  }
  const runs: NumericRenderedObservation<D>[][] = [];
  let current: NumericRenderedObservation<D>[] = [];
  let previousRun: number | undefined;
  const finish = () => {
    if (current.length) runs.push(current);
    current = [];
    previousRun = undefined;
  };
  for (const observation of rendered.observations) {
    if (previousRun !== undefined && observation.run !== previousRun) finish();
    previousRun = observation.run;
    if (!accepts(rendered, observation, filter)) {
      finish();
      continue;
    }
    current.push(observation);
  }
  finish();
  return runs.map((run) => {
    const resolved: NumericRenderedObservation<D>[] = [];
    for (let start = 0; start < run.length;) {
      let end = start + 1;
      while (end < run.length && run[end]!.domainX === run[start]!.domainX)
        end++;
      let selected = run[start]!;
      for (let duplicate = start + 1; duplicate < end; duplicate++) {
        const next = run[duplicate]!;
        if (resolver === undefined)
          throw new RangeError(
            "sampleRecordedX duplicate domainX requires resolveDuplicate.",
          );
        const resolved = resolver(selected, next);
        if (resolved !== selected && resolved !== next)
          throw new TypeError(
            "sampleRecordedX resolveDuplicate must return its first or next observation.",
          );
        selected = resolved;
      }
      resolved.push(selected);
      start = end;
    }
    return resolved;
  });
}

/**
 * Returns an exact recorded observation or a caller-defined interpolation between records.
 *
 * It never bridges separate rendered runs, filtered observations, or an interval larger
 * than `maxDomainGap`. Duplicate x values reject by default and require an explicit
 * `resolveDuplicate` function. Estimated results retain their two source observations and
 * map explicit local/root anchors through the committed generation. This is O(n) in captured
 * observations and the result is borrowed until the rendered generation is replaced or disposed.
 *
 * @param rendered - Committed rendered-series generation to inspect synchronously.
 * @param options - Domain position, interpolation, duplicate policy, and filter.
 * @returns An exact record, an explicitly interpolated estimate, or undefined.
 * @see {@link SampleRecordedXOptions}
 */
export function sampleRecordedX<D>(
  rendered: NumericRenderedSeries<D>,
  options: SampleRecordedXOptions<D>,
): RecordedXSample<D> | undefined {
  rendered.assertLive();
  const query = options.domainX;
  if (query === undefined) return undefined;
  finite(query, "sampleRecordedX domainX");
  limit(options.maxDomainGap, "sampleRecordedX maxDomainGap");
  if (typeof options.interpolation !== "function")
    throw new TypeError("sampleRecordedX interpolation must be a function.");
  if (
    options.resolveDuplicate !== undefined &&
    typeof options.resolveDuplicate !== "function"
  )
    throw new TypeError("sampleRecordedX resolveDuplicate must be a function.");
  for (const run of resolvedRows(
    rendered,
    options.filter,
    options.resolveDuplicate,
  )) {
    for (let index = 0; index < run.length; index++) {
      const before = run[index]!;
      if (before.domainX === query)
        return Object.freeze({ ...anchored(rendered, before), kind: "exact" });
      const after = run[index + 1];
      if (!after || query <= before.domainX || query >= after.domainX) continue;
      const gap = after.domainX - before.domainX;
      finite(gap, "sampleRecordedX domain gap");
      if (options.maxDomainGap !== undefined && gap > options.maxDomainGap)
        return undefined;
      const fraction = (query - before.domainX) / gap;
      const domainY = options.interpolation(
        before.domainY,
        after.domainY,
        fraction,
      );
      finite(domainY, "sampleRecordedX interpolation result");
      return Object.freeze({
        kind: "interpolated",
        domainX: query,
        domainY,
        ...rendered.anchorAtDomain({ domainX: query, domainY }),
        before,
        after,
        fraction,
      });
    }
  }
  return undefined;
}
