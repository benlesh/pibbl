import { layoutDiagnostic, type LayoutDiagnosticContext } from './diagnostics.js';
import { parsePercentage, resolveLength } from './resolve-length.js';
import type { Length, Percentage } from './types.js';

const fitContentBrand: unique symbol = Symbol('pibbl.fit-content');

/** Sizing values requiring an intrinsic layout owner. See {@link SizingLength}. */
export type SizingKeyword = 'min-content' | 'max-content';

/** Immutable fit-content bound created by {@link fitContent}. See {@link SizingLength}. */
export interface FitContent {
  /** Finite nonnegative logical length or parent-axis percentage. See {@link Percentage}. */
  readonly limit: number | Percentage;
  readonly [fitContentBrand]: true;
}

/** Sizing-only value; padding and insets retain {@link Length}. See {@link FitContent}, {@link SizingKeyword}. */
export type SizingLength = Length | SizingKeyword | FitContent | 'stretch';

/** A scalar result or an owner-resolved intrinsic sizing request. */
export type NormalizedSizingLength =
  | Readonly<{ kind: 'auto' }>
  | Readonly<{ kind: 'length'; value: number }>
  | Readonly<{ kind: 'min-content' }>
  | Readonly<{ kind: 'max-content' }>
  | Readonly<{ kind: 'fit-content'; limit: number }>;

/** Options supplied by the layout owner that owns intrinsic-size policy. */
export interface SizingNormalizationOptions {
  readonly reference: number | undefined;
  readonly property: string;
  readonly context?: Readonly<LayoutDiagnosticContext>;
  readonly allowAuto: boolean;
  readonly allowIntrinsic: boolean;
}

/**
 * Creates an immutable bound between measured min- and max-content widths.
 * @param limit - Nonnegative finite logical width or parent-axis {@link Percentage}.
 * @returns Branded immutable {@link FitContent} sizing value.
 * @see {@link SizingLength}
 */
export function fitContent(limit: number | Percentage): FitContent {
  const numeric = typeof limit === 'number' ? limit : parsePercentage(limit, 'fitContent');
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw layoutDiagnostic({
      property: 'fitContent',
      value: limit,
      reason: 'limit must be finite and nonnegative',
    });
  }
  return Object.freeze({ [fitContentBrand]: true, limit }) as FitContent;
}

/** Identifies a fit-content value without accepting lookalike style records. */
export function isFitContent(value: unknown): value is FitContent {
  return typeof value === 'object' && value !== null &&
    (value as Partial<FitContent>)[fitContentBrand] === true;
}

/** Identifies a non-scalar sizing request without widening scalar length users. */
export function isIntrinsicSizingValue(value: unknown): value is SizingKeyword | FitContent {
  return value === 'min-content' || value === 'max-content' || isFitContent(value);
}

/** Resolves only scalar sizing input at a non-intrinsic owner boundary. */
export function resolveScalarSizingLength(
  value: SizingLength,
  reference: number | undefined,
  property: string,
  context: Readonly<LayoutDiagnosticContext> = {},
): number | undefined {
  if (value === 'stretch') {
    if (reference !== undefined && Number.isFinite(reference) && reference >= 0) return reference;
    throw layoutDiagnostic({ ...context, property, value, reason: 'stretch requires a finite owning allocation' });
  }
  if (isIntrinsicSizingValue(value)) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: 'requires a direct finite Flex intrinsic-sizing owner',
    });
  }
  return resolveLength(value, reference, property, context);
}

/** Normalizes sizing syntax without teaching scalar length users intrinsic semantics. */
export function normalizeSizingLength(
  value: SizingLength | undefined,
  options: Readonly<SizingNormalizationOptions>,
): NormalizedSizingLength | undefined {
  if (value === undefined) return undefined;
  const context = options.context ?? {};
  if (isFitContent(value)) {
    if (!options.allowIntrinsic) throw unsupported(options, value, 'intrinsic sizing requires a measuring layout owner');
    const limit = resolveLength(value.limit, options.reference, options.property, context);
    if (limit === undefined || limit < 0) {
      throw layoutDiagnostic({ ...context, property: options.property, value, reason: 'fit-content limit must resolve to a finite nonnegative length' });
    }
    return { kind: 'fit-content', limit };
  }
  if (value === 'min-content' || value === 'max-content') {
    if (!options.allowIntrinsic) throw unsupported(options, value, 'intrinsic sizing requires a measuring layout owner');
    return { kind: value };
  }
  if (value === 'stretch') {
    const resolved = resolveScalarSizingLength(value, options.reference, options.property, context)!;
    return { kind: 'length', value: resolved };
  }
  const resolved = resolveLength(value, options.reference, options.property, context);
  if (resolved === undefined) {
    if (!options.allowAuto) throw unsupported(options, value, 'automatic sizing is not allowed for this property');
    return { kind: 'auto' };
  }
  return { kind: 'length', value: resolved };
}

function unsupported(
  options: Readonly<SizingNormalizationOptions>,
  value: unknown,
  reason: string,
): Error {
  return layoutDiagnostic({
    ...(options.context ?? {}),
    property: options.property,
    value,
    reason,
  });
}
