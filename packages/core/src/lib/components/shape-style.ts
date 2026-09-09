import { layoutDiagnostic } from '../style/diagnostics.js';
import { resolveRequiredLength } from '../style/resolve-built-in.js';
import type { Length } from '../style/types.js';
import type { StyleResolutionContext } from '../types.js';
import type { GeometryErrorFactory } from '../geometry/validation.js';

export function resolveNonnegativeShapeLength(
  value: Exclude<Length, 'auto'>,
  reference: number,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  const resolved = resolveRequiredLength(value, reference, property, context);
  if (resolved < 0) {
    throw layoutDiagnostic({
      component: context.component,
      property,
      value,
      algorithm: context.algorithm,
      constraints: context.constraints,
      reason: 'must resolve to a nonnegative number',
    });
  }
  return resolved;
}

export function resolveFiniteShapeNumber(
  value: number,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  if (!Number.isFinite(value)) {
    throw layoutDiagnostic({
      component: context.component,
      property,
      value,
      algorithm: context.algorithm,
      constraints: context.constraints,
      reason: 'must be a finite number',
    });
  }
  return value;
}

export function circularPercentageBasis(
  context: Readonly<StyleResolutionContext>,
): number {
  return Math.min(
    context.percentageBasis.width,
    context.percentageBasis.height,
  );
}

export function shapeGeometryErrorFactory(
  context: Readonly<StyleResolutionContext>,
): GeometryErrorFactory {
  return (property, value, reason) => layoutDiagnostic({
    component: context.component,
    property,
    value,
    algorithm: context.algorithm,
    constraints: context.constraints,
    reason,
  });
}
