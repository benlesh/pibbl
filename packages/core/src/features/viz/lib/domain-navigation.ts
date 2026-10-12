import type { LinearDomain, ResolvedContinuousScale } from "./types.js";
/** Explicit hard bounds and minimum mapped extent for continuous-domain navigation. @see {@link panDomain} @see {@link zoomDomain} */
export interface DomainNavigationConstraints {
  /** Finite hard domain endpoints, in either order, valid for the supplied scale. See {@link LinearDomain}. */
  readonly bounds: LinearDomain;
  /** Minimum span as a fraction of the mapped hard bounds, greater than zero through one. Defaults to 0.01. */
  readonly minimumSpanRatio?: number;
}
/** Named pan settings with explicit navigation limits. @see {@link panDomain} */
export interface PanDomainOptions extends DomainNavigationConstraints {
  /** Finite displacement in range units; positive shifts mapped values toward increasing range coordinates. */
  readonly rangeDelta: number;
}
/** Named zoom settings with explicit navigation limits. @see {@link zoomDomain} */
export interface ZoomDomainOptions extends DomainNavigationConstraints {
  /** Finite anchor in the scale's range coordinates, using the same units as its range. */
  readonly rangeAnchor: number;
  /** Finite positive magnification; greater than one zooms in. */
  readonly factor: number;
}
function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${name} must be finite.`);
  return value;
}
function navigate(
  scale: ResolvedContinuousScale,
  start: number,
  end: number,
  constraints: DomainNavigationConstraints,
  requestedSpan?: number,
): LinearDomain {
  const [r0, r1] = scale.range;
  if (r0 === r1 || scale.domain[0] === scale.domain[1])
    throw new RangeError(
      "Domain navigation requires noncollapsed domain and range.",
    );
  const { bounds, minimumSpanRatio = 0.01 } = constraints;
  if (!Array.isArray(bounds) || bounds.length !== 2)
    throw new RangeError("Navigation bounds require two endpoints.");
  if (scale.type === "utc" && !bounds.every(Number.isSafeInteger))
    throw new RangeError(
      "UTC navigation bounds must be safe integer milliseconds.",
    );
  const b0 = scale.map(finite(bounds[0], "Lower bound")),
    b1 = scale.map(finite(bounds[1], "Upper bound"));
  const lo = Math.min(b0, b1),
    hi = Math.max(b0, b1),
    extent = hi - lo;
  if (!Number.isFinite(extent) || extent <= 0)
    throw new RangeError(
      "Navigation bounds must have a finite nonzero mapped extent.",
    );
  if (
    !Number.isFinite(minimumSpanRatio) ||
    minimumSpanRatio <= 0 ||
    minimumSpanRatio > 1
  )
    throw new RangeError(
      "minimumSpanRatio must be greater than zero and at most one.",
    );
  finite(start, "Mapped start");
  finite(end, "Mapped end");
  const requested = requestedSpan ?? Math.abs(end - start);
  if (!Number.isFinite(requested))
    throw new RangeError("Navigation span must be finite.");
  const span = Math.min(extent, Math.max(extent * minimumSpanRatio, requested));
  const center = start / 2 + end / 2;
  const low = Math.max(lo, Math.min(hi - span, center - span / 2)),
    high = low + span;
  let a = scale.invert(r0 < r1 ? low : high),
    b = scale.invert(r0 < r1 ? high : low);
  if (scale.type === "utc") {
    a = Math.round(a);
    b = Math.round(b);
  }
  finite(a, "Domain start");
  finite(b, "Domain end");
  if (a === b)
    throw new RangeError(
      "Navigation result collapses at the scale's numeric precision.",
    );
  return Object.freeze([a, b] as const);
}
/**
 * Moves the visible continuous domain by a displacement expressed in range units.
 * Positive displacement shifts mapped values toward increasing range coordinates; the returned domain moves oppositely.
 * @param scale - Current resolved continuous mapping. See {@link ResolvedContinuousScale}.
 * @param options - Displacement, bounds, and minimum span. See {@link PanDomainOptions}.
 * @returns A new immutable domain pair. See {@link LinearDomain}.
 * @throws When inputs, bounds, or the resulting extent are invalid or collapsed.
 * @see {@link zoomDomain}
 */
export function panDomain(
  scale: ResolvedContinuousScale,
  options: PanDomainOptions,
): LinearDomain {
  const { rangeDelta } = options;
  finite(rangeDelta, "Pan displacement");
  return navigate(
    scale,
    scale.range[0] - rangeDelta,
    scale.range[1] - rangeDelta,
    options,
    Math.abs(scale.range[1] - scale.range[0]),
  );
}
/**
 * Magnifies a continuous domain around an anchor in range coordinates.
 * Factor greater than one zooms in; hard bounds and minimum span may limit anchor preservation.
 * @param scale - Current resolved continuous mapping. See {@link ResolvedContinuousScale}.
 * @param options - Anchor, magnification, bounds, and minimum span. See {@link ZoomDomainOptions}.
 * @returns A new immutable domain pair. See {@link LinearDomain}.
 * @throws When factor, mapping, bounds, or the resulting extent are invalid or collapsed.
 * @see {@link panDomain}
 */
export function zoomDomain(
  scale: ResolvedContinuousScale,
  options: ZoomDomainOptions,
): LinearDomain {
  const { rangeAnchor, factor } = options;
  finite(rangeAnchor, "Zoom anchor");
  finite(factor, "Zoom factor");
  if (factor <= 0) throw new RangeError("Zoom factor must be positive.");
  return navigate(
    scale,
    rangeAnchor + (scale.range[0] - rangeAnchor) / factor,
    rangeAnchor + (scale.range[1] - rangeAnchor) / factor,
    options,
  );
}
