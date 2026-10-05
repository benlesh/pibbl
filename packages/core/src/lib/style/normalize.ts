import type { Edges } from '../layout/types.js';
import {
  layoutDiagnostic,
  type LayoutDiagnosticContext,
} from './diagnostics.js';
import type { EdgeValues } from './types.js';

/**
 * Expands shorthand insets into four validated numeric edges.
 *
 * @param value - Edge shorthand to expand; undefined uses the empty edge defaults. See
 * {@link EdgeValues} .
 * @param property - Property name used in diagnostics.
 * @param context - Component and property context for diagnostic messages. See
 * {@link LayoutDiagnosticContext} .
 * @returns Explicit top, right, bottom, and left edge values. See {@link Edges}.
 *
 * @see {@link EdgeValues}
 * @see {@link LayoutDiagnosticContext}
 * @see {@link Edges}
 */
export function normalizeEdges(
  value: EdgeValues | undefined,
  property: string,
  context: Readonly<LayoutDiagnosticContext> = {},
): Edges {
  if (value === undefined) return zeroEdges();
  if (typeof value === 'number') {
    const edge = validateEdge(value, property, context);
    return { top: edge, right: edge, bottom: edge, left: edge };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: `uses an unsupported edge value ${String(value)}`,
    });
  }

  return {
    top: validateEdge(value.top ?? 0, `${property}.top`, context),
    right: validateEdge(value.right ?? 0, `${property}.right`, context),
    bottom: validateEdge(value.bottom ?? 0, `${property}.bottom`, context),
    left: validateEdge(value.left ?? 0, `${property}.left`, context),
  };
}

function validateEdge(
  value: number,
  property: string,
  context: Readonly<LayoutDiagnosticContext>,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: 'must be a finite number',
    });
  }
  if (value < 0) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: 'must be nonnegative',
    });
  }
  return value;
}

function zeroEdges(): Edges {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}
