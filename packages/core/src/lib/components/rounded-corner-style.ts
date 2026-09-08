import { layoutDiagnostic } from '../style/diagnostics.js';
import { resolveRequiredLength } from '../style/resolve-built-in.js';
import type { RoundedCornerStyle } from '../style/types.js';
import type { StyleResolutionContext } from '../types.js';
import { circularPercentageBasis } from './shape-style.js';

export interface ResolvedRoundedCornerStyle {
  cornerRadius?: number;
  cornerRadii?: readonly (number | null | undefined)[];
}

export function resolveRoundedCornerStyle(
  cornerCount: number,
  style: Readonly<RoundedCornerStyle>,
  context: Readonly<StyleResolutionContext>,
): ResolvedRoundedCornerStyle {
  if (style.cornerRadii && style.cornerRadii.length > cornerCount) {
    throw layoutDiagnostic({
      component: context.component,
      property: 'cornerRadii',
      value: style.cornerRadii.length,
      algorithm: context.algorithm,
      constraints: context.constraints,
      reason: `length must not exceed corner count ${cornerCount}`,
    });
  }

  const basis = circularPercentageBasis(context);
  const resolveRadius = (
    value: NonNullable<RoundedCornerStyle['cornerRadius']>,
    property: string,
  ) => {
    const resolved = resolveRequiredLength(value, basis, property, context);
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
  };

  return {
    cornerRadius: style.cornerRadius === undefined ? undefined :
      resolveRadius(style.cornerRadius, 'cornerRadius'),
    cornerRadii: style.cornerRadii?.map((radius, index) =>
      radius === null || radius === undefined ? radius :
        resolveRadius(radius, `cornerRadii[${index}]`),
    ),
  };
}
