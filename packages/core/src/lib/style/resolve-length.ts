import {
  layoutDiagnostic,
  type LayoutDiagnosticContext,
} from './diagnostics.js';
import type { Length } from './types.js';

const DECIMAL_PERCENTAGE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/;

export function resolveLength(
  value: Length,
  reference: number | undefined,
  property: string,
  context: Readonly<LayoutDiagnosticContext> = {},
): number | undefined {
  if (value === 'auto') return undefined;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw diagnostic(property, value, 'must be a finite number', context);
    }
    return value;
  }

  if (typeof value !== 'string' || !DECIMAL_PERCENTAGE.test(value)) {
    throw diagnostic(
      property,
      value,
      `uses an unsupported length value ${String(value)}`,
      context,
    );
  }

  if (reference === undefined || !Number.isFinite(reference)) {
    throw diagnostic(
      property,
      value,
      'requires a definite finite percentage reference',
      context,
    );
  }
  if (reference < 0) {
    throw diagnostic(
      property,
      value,
      'percentage reference must be nonnegative',
      context,
    );
  }

  const resolved = (Number.parseFloat(value) / 100) * reference;
  if (!Number.isFinite(resolved)) {
    throw diagnostic(
      property,
      value,
      'resolved percentage arithmetic must remain finite',
      context,
    );
  }
  return resolved;
}

function diagnostic(
  property: string,
  value: unknown,
  reason: string,
  context: Readonly<LayoutDiagnosticContext>,
) {
  return layoutDiagnostic({ ...context, property, value, reason });
}
