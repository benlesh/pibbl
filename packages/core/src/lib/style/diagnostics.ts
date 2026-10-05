import type { normalizeEdges } from './normalize.js';
import type { resolveLength } from './resolve-length.js';
import type { Constraints } from '../layout/types.js';

/**
 * Component and source context attached to a layout diagnostic.
 *
 * @see {@link Constraints}
 * @see {@link LayoutDiagnosticInput}
 * @see {@link normalizeEdges}
 * @see {@link resolveLength}
 */
export interface LayoutDiagnosticContext {
  /**
   * Component identity or diagnostic name associated with this value. See
   * {@link LayoutDiagnosticContext}.
   */
  component?: string;
  /**
   * Name of the layout algorithm producing this diagnostic or resolution. See
   * {@link LayoutDiagnosticContext}.
   */
  algorithm?: string;
  /** Sizing limits and available dimensions for this operation. See {@link Constraints}. */
  constraints?: Readonly<Constraints>;
}

/**
 * Validation-failure details used to construct a layout diagnostic.
 *
 * @see {@link LayoutDiagnosticContext}
 * @see {@link layoutDiagnostic}
 */
export interface LayoutDiagnosticInput extends LayoutDiagnosticContext {
  /** Name of the affected input property. See {@link LayoutDiagnosticInput}. */
  property: string;
  /** Value associated with this sample, input, or result. See {@link LayoutDiagnosticInput}. */
  value: unknown;
  /**
   * Reason the operation could not produce its ordinary result. See {@link LayoutDiagnosticInput}
   * .
   */
  reason: string;
}

/**
 * A layout validation error carrying the affected property and component context.
 *
 * @see {@link layoutDiagnostic}
 */
export class LayoutDiagnostic extends Error {
  /**
   * Component identity or diagnostic name associated with this value. See {@link LayoutDiagnostic}
   * .
   */
  readonly component: string;
  /** Name of the affected input property. See {@link LayoutDiagnostic}. */
  readonly property: string;
  /** The original value that failed validation. See {@link LayoutDiagnostic}. */
  readonly suppliedValue: unknown;
  /**
   * Name of the layout algorithm producing this diagnostic or resolution. See
   * {@link LayoutDiagnostic}.
   */
  readonly algorithm: string;
  /** Sizing limits and available dimensions for this operation. See {@link Constraints}. */
  readonly constraints: Readonly<Constraints> | undefined;

  /**
   * Creates a layout error containing the property, supplied value, and diagnostic context. See
   * {@link LayoutDiagnostic}.
   * @param input - Diagnostic code, message, property, and layout context. See
   * {@link LayoutDiagnosticInput} .
   */
  constructor(input: LayoutDiagnosticInput) {
    const component = input.component ?? 'layout';
    const algorithm = input.algorithm ?? 'value-resolution';
    const constraints = input.constraints;
    super(
      `${component}: property ${input.property} received ${formatValue(input.value)} ` +
        `during ${algorithm}; constraints ${formatConstraints(constraints)}; ${input.reason}`,
    );
    this.name = 'LayoutDiagnostic';
    this.component = component;
    this.property = input.property;
    this.suppliedValue = input.value;
    this.algorithm = algorithm;
    this.constraints = constraints;
  }
}

/**
 * Creates a structured layout error from a validation failure and its component context.
 *
 * @param input - Diagnostic code, message, property, and layout context. See
 * {@link LayoutDiagnosticInput} .
 * @returns A structured layout diagnostic. See {@link LayoutDiagnostic}.
 *
 * @see {@link LayoutDiagnosticInput}
 * @see {@link LayoutDiagnostic}
 */
export function layoutDiagnostic(
  input: LayoutDiagnosticInput,
): LayoutDiagnostic {
  return new LayoutDiagnostic(input);
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Number.POSITIVE_INFINITY) return 'Infinity';
    if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatConstraints(
  constraints: Readonly<Constraints> | undefined,
): string {
  if (!constraints) return 'unspecified';
  return (
    `{ minWidth: ${formatValue(constraints.minWidth)}, maxWidth: ${formatValue(constraints.maxWidth)}, ` +
    `minHeight: ${formatValue(constraints.minHeight)}, maxHeight: ${formatValue(constraints.maxHeight)} }`
  );
}
