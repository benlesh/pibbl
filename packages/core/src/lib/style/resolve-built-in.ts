import type { StyleResolutionContext, SystemStyle } from '../types.js';
import { layoutDiagnostic } from './diagnostics.js';
import { resolveLength } from './resolve-length.js';
import type { Length } from './types.js';

const LAYOUT_PARTICIPATION_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'padding',
  'overflow',
  'left',
  'top',
  'alignSelf',
  'justifySelf',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'gridColumnStart',
  'gridColumnSpan',
  'gridRowStart',
  'gridRowSpan',
]);

export function stripLayoutParticipation<S extends SystemStyle>(
  style: Readonly<S>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    if (!LAYOUT_PARTICIPATION_KEYS.has(key)) result[key] = value;
  }
  return result;
}

export function resolveRequiredLength(
  value: Length,
  reference: number,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  const resolved = resolveLength(value, reference, property, context);
  if (resolved === undefined) {
    throw layoutDiagnostic({
      component: context.component,
      property,
      value,
      algorithm: context.algorithm,
      constraints: context.constraints,
      reason: 'must resolve to a finite number before rendering',
    });
  }
  return resolved;
}

export function resolveOptionalLength(
  value: Length | undefined,
  reference: number,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number | undefined {
  if (value === undefined) return undefined;
  return resolveLength(value, reference, property, context);
}

export function resolveLocalOffset(
  value: Exclude<Length, 'auto'> | undefined,
  reference: number,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  return resolveRequiredLength(value ?? 0, reference, property, context);
}
