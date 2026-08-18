import {
  layoutDiagnostic,
  type LayoutDiagnosticContext,
} from '../style/diagnostics.js';
import { normalizeEdges } from '../style/normalize.js';
import { resolveLength } from '../style/resolve-length.js';
import type { BoxStyle, Length, ResolvedBoxStyle } from '../style/types.js';
import type { Constraints } from './types.js';

export function resolveBox(
  style: Readonly<BoxStyle>,
  constraints: Readonly<Constraints>,
  context: Readonly<LayoutDiagnosticContext> = {},
): ResolvedBoxStyle {
  const diagnosticContext = {
    component: context.component ?? 'layout',
    algorithm: context.algorithm ?? 'box-resolution',
    constraints,
  };
  validateConstraints(constraints, diagnosticContext);
  const padding = normalizeEdges(style.padding, 'padding', diagnosticContext);

  const horizontal = resolveAxis(
    'width',
    style.width,
    style.minWidth,
    style.maxWidth,
    constraints.minWidth,
    constraints.maxWidth,
    padding.left,
    padding.right,
    diagnosticContext,
  );
  const vertical = resolveAxis(
    'height',
    style.height,
    style.minHeight,
    style.maxHeight,
    constraints.minHeight,
    constraints.maxHeight,
    padding.top,
    padding.bottom,
    diagnosticContext,
  );

  return {
    borderBox: {
      x: 0,
      y: 0,
      width: horizontal.border,
      height: vertical.border,
    },
    contentBox: {
      x: padding.left,
      y: padding.top,
      width: horizontal.content,
      height: vertical.content,
    },
  };
}

function resolveAxis(
  axis: 'width' | 'height',
  specified: Length | undefined,
  specifiedMinimum: Exclude<Length, 'auto'> | undefined,
  specifiedMaximum: Exclude<Length, 'auto'> | undefined,
  constraintMinimum: number,
  constraintMaximum: number,
  paddingStart: number,
  paddingEnd: number,
  context: Readonly<LayoutDiagnosticContext>,
): { border: number; content: number } {
  const minimumProperty = axis === 'width' ? 'minWidth' : 'minHeight';
  const maximumProperty = axis === 'width' ? 'maxWidth' : 'maxHeight';
  const minimum =
    specifiedMinimum === undefined
      ? 0
      : resolveAllocationLength(
          specifiedMinimum,
          constraintMaximum,
          minimumProperty,
          context,
        );
  const maximum =
    specifiedMaximum === undefined
      ? Number.POSITIVE_INFINITY
      : resolveAllocationLength(
          specifiedMaximum,
          constraintMaximum,
          maximumProperty,
          context,
        );

  if (minimum > maximum) {
    throw layoutDiagnostic({
      ...context,
      property: minimumProperty,
      value: minimum,
      reason: `${minimumProperty} ${minimum} must not exceed ${maximumProperty} ${maximum}`,
    });
  }

  const padding = requireFiniteArithmetic(
    paddingStart + paddingEnd,
    axis,
    context,
  );
  const resolved =
    specified === undefined
      ? undefined
      : resolveLength(specified, constraintMaximum, axis, context);
  let content: number;
  if (resolved === undefined) {
    if (!Number.isFinite(constraintMaximum)) {
      throw layoutDiagnostic({
        ...context,
        property: axis,
        value: specified ?? 'auto',
        reason: 'requires a definite finite allocation for auto sizing',
      });
    }
    content = Math.max(
      0,
      requireFiniteArithmetic(constraintMaximum - padding, axis, context),
    );
  } else {
    if (resolved < 0) {
      throw layoutDiagnostic({
        ...context,
        property: axis,
        value: specified,
        reason: 'must be nonnegative when used as a layout allocation',
      });
    }
    content = resolved;
  }

  content = Math.min(maximum, Math.max(minimum, content));
  const paddedContent = requireFiniteArithmetic(
    content + padding,
    axis,
    context,
  );
  const border = Math.min(
    constraintMaximum,
    Math.max(constraintMinimum, paddedContent),
  );
  return {
    border: requireFiniteArithmetic(border, axis, context),
    content: Math.max(
      0,
      requireFiniteArithmetic(border - padding, axis, context),
    ),
  };
}

function requireFiniteArithmetic(
  value: number,
  property: string,
  context: Readonly<LayoutDiagnosticContext>,
): number {
  if (!Number.isFinite(value)) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: 'resolved box arithmetic must remain finite',
    });
  }
  return value;
}

function resolveAllocationLength(
  value: Exclude<Length, 'auto'>,
  reference: number,
  property: string,
  context: Readonly<LayoutDiagnosticContext>,
): number {
  const resolved = resolveLength(value, reference, property, context)!;
  if (resolved < 0) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: 'must be nonnegative when used as a layout allocation',
    });
  }
  return resolved;
}

function validateConstraints(
  constraints: Readonly<Constraints>,
  context: Readonly<LayoutDiagnosticContext>,
): void {
  validateConstraint(
    constraints.minWidth,
    'constraints.minWidth',
    false,
    context,
  );
  validateConstraint(
    constraints.maxWidth,
    'constraints.maxWidth',
    true,
    context,
  );
  validateConstraint(
    constraints.minHeight,
    'constraints.minHeight',
    false,
    context,
  );
  validateConstraint(
    constraints.maxHeight,
    'constraints.maxHeight',
    true,
    context,
  );

  if (constraints.minWidth > constraints.maxWidth) {
    throw layoutDiagnostic({
      ...context,
      property: 'constraints.minWidth',
      value: constraints.minWidth,
      reason: `constraints.minWidth ${constraints.minWidth} must not exceed constraints.maxWidth ${constraints.maxWidth}`,
    });
  }
  if (constraints.minHeight > constraints.maxHeight) {
    throw layoutDiagnostic({
      ...context,
      property: 'constraints.minHeight',
      value: constraints.minHeight,
      reason: `constraints.minHeight ${constraints.minHeight} must not exceed constraints.maxHeight ${constraints.maxHeight}`,
    });
  }
}

function validateConstraint(
  value: number,
  property: string,
  allowPositiveInfinity: boolean,
  context: Readonly<LayoutDiagnosticContext>,
): void {
  if (
    !Number.isFinite(value) &&
    !(allowPositiveInfinity && value === Number.POSITIVE_INFINITY)
  ) {
    throw layoutDiagnostic({
      ...context,
      property,
      value,
      reason: 'must be finite',
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
}
