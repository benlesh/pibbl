/** Local coordinates for one candle body and wick. */
export interface CandleGeometry {
  /** Normalized rectangle that paints the open/close body. */
  readonly bodyBoundsLocal: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  /** Vertical wick endpoints in the caller's high/low coordinate order. */
  readonly wickLocal: Readonly<{ x: number; lowY: number; highY: number }>;
}

/** Inputs already mapped into a series' local coordinate system. */
export interface CandleGeometryInput {
  readonly centerX: number;
  readonly openY: number;
  readonly closeY: number;
  readonly highY: number;
  readonly lowY: number;
  readonly width: number;
  readonly dojiHeight: number;
}

/** Inputs already mapped into a volume series' local coordinate system. */
export interface VolumeGeometryInput {
  readonly centerX: number;
  readonly valueY: number;
  readonly baselineY: number;
  readonly width: number;
}

/** Options for the common financial mark width calculation. */
export interface FinancialMarkWidthOptions {
  /** A caller-selected local mark width. */
  readonly width?: number;
  /** Width to use when fewer than two distinct local x positions are available. */
  readonly fallbackWidth?: number;
}

function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${name} must be finite.`);
  return value;
}

function positive(value: number, name: string): number {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
  return value;
}

/**
 * Calculates local, paint-ready candle geometry without consulting a scale.
 *
 * The body spans the mapped open and close coordinates. Equal values produce a
 * centered doji whose height is at least one local unit.
 *
 * @param input - Already-mapped candle coordinates and local dimensions.
 * @returns Frozen normalized body bounds and source-ordered wick endpoints.
 */
export function candleGeometry(input: CandleGeometryInput): CandleGeometry {
  const centerX = finite(input.centerX, "centerX");
  const openY = finite(input.openY, "openY");
  const closeY = finite(input.closeY, "closeY");
  const highY = finite(input.highY, "highY");
  const lowY = finite(input.lowY, "lowY");
  const markWidth = positive(input.width, "width");
  const dojiHeight = finite(input.dojiHeight, "dojiHeight");
  if (dojiHeight < 0) throw new RangeError("dojiHeight must be nonnegative.");
  const height =
    openY === closeY ? Math.max(1, dojiHeight) : Math.abs(closeY - openY);
  const y = openY === closeY ? openY - height / 2 : Math.min(openY, closeY);
  return Object.freeze({
    bodyBoundsLocal: Object.freeze({
      x: centerX - markWidth / 2,
      y,
      width: markWidth,
      height,
    }),
    wickLocal: Object.freeze({ x: centerX, lowY, highY }),
  });
}

/**
 * Calculates the local rectangle for a volume column without consulting a scale.
 *
 * @param input - Mapped column center, mapped value and baseline, and local width.
 * @returns Frozen rectangle with a nonnegative height; equal endpoints return height zero.
 */
export function volumeGeometry(
  input: VolumeGeometryInput,
): Readonly<{ x: number; y: number; width: number; height: number }> {
  const centerX = finite(input.centerX, "centerX");
  const valueY = finite(input.valueY, "valueY");
  const baselineY = finite(input.baselineY, "baselineY");
  const width = positive(input.width, "width");
  return Object.freeze({
    x: centerX - width / 2,
    y: Math.min(valueY, baselineY),
    width,
    height: Math.abs(valueY - baselineY),
  });
}

/**
 * Finds the smallest positive separation of adjacent mapped local x positions.
 *
 * @param positions - Mapped positions in source order.
 * @returns The smallest positive adjacent separation, or undefined when none exists.
 */
export function smallestAdjacentSpacing(
  positions: readonly number[],
): number | undefined {
  let smallest = Infinity;
  for (let index = 0; index < positions.length; index++) {
    finite(positions[index]!, `positions[${index}]`);
    if (index > 0) {
      const separation = Math.abs(positions[index]! - positions[index - 1]!);
      if (separation > 0) smallest = Math.min(smallest, separation);
    }
  }
  return smallest === Infinity ? undefined : smallest;
}

/**
 * Computes a shared local mark width from mapped x spacing.
 *
 * @param positions - Mapped positions in source order.
 * @param options - Optional explicit or singleton fallback width.
 * @returns Explicit width, or 70% of the smallest spacing capped at 12 local units.
 */
export function financialMarkWidth(
  positions: readonly number[],
  options: FinancialMarkWidthOptions = {},
): number {
  if (options.width !== undefined) return positive(options.width, "width");
  const spacing = smallestAdjacentSpacing(positions);
  if (spacing !== undefined) return Math.min(12, spacing * 0.7);
  return positive(options.fallbackWidth ?? 8, "fallbackWidth");
}
