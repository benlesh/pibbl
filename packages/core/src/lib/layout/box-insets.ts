import { getLayoutDirection } from './context.js';
import { nativeLayout } from './wasm/region.js';
import { normalizeEdges } from '../style/normalize.js';
import { layoutDiagnostic, type LayoutDiagnosticContext } from '../style/diagnostics.js';
import { resolveLength } from '../style/resolve-length.js';
import type { BoxStyle, EdgeValues, Percentage } from '../style/types.js';
import type { Edges } from './types.js';

/** Internal layout insets; painted stroke is deliberately independent. */
export function normalizeBoxInsets(style: Readonly<BoxStyle>, context: Readonly<LayoutDiagnosticContext>): Edges {
  const padding = numericPadding(style, context);
  if (style.borderWidth === undefined && style.borderStartWidth === undefined && style.borderEndWidth === undefined) return padding;
  const border = numericBorder(style, context);
  const top = padding.top + border.top, right = padding.right + border.right;
  const bottom = padding.bottom + border.bottom, left = padding.left + border.left;
  if (!Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom) || !Number.isFinite(left)) {
    throw layoutDiagnostic({ ...context, property: 'borderWidth', value: style.borderWidth, reason: 'combined padding and border insets must be finite' });
  }
  return { top, right, bottom, left };
}

/** @internal Resolves padding only for positioned containing-box coordinates. */
export function normalizePaddingInsets(
  style: Readonly<BoxStyle>,
  context: Readonly<LayoutDiagnosticContext>,
): Edges {
  return numericPadding(style, context);
}

/** Internal admission check; no inferred percentage reference. */
export function hasPercentagePadding(value: unknown): boolean {
  if (typeof value === 'string') return value.endsWith('%');
  if (value === null || typeof value !== 'object') return false;
  const edges = value as { top?: unknown; right?: unknown; bottom?: unknown; left?: unknown };
  return typeof edges.top === 'string' && edges.top.endsWith('%') ||
    typeof edges.right === 'string' && edges.right.endsWith('%') ||
    typeof edges.bottom === 'string' && edges.bottom.endsWith('%') ||
    typeof edges.left === 'string' && edges.left.endsWith('%');
}
/** Resolves participating Flex insets once; ordinary physical numeric styles keep identity. */
export function resolveAllocatedInsets<S extends BoxStyle>(style: Readonly<S>, options: { width: number; layoutDirection?: 'ltr' | 'rtl'; context: Readonly<LayoutDiagnosticContext> }): Readonly<S> {
  if (style.borderStartWidth !== undefined || style.borderEndWidth !== undefined) {
    const borderWidth = numericBorder(style, options.context, options.layoutDirection);
    style = { ...style, borderWidth, borderStartWidth: undefined, borderEndWidth: undefined };
  }
  const value = style.padding;
  if (style.paddingStart !== undefined || style.paddingEnd !== undefined) {
    requireLogicalPadding(style, options.context);
    const direction = receiverDirection(style, options.layoutDirection);
    const logicalLeft = direction === 'rtl' ? style.paddingEnd : style.paddingStart;
    const logicalRight = direction === 'rtl' ? style.paddingStart : style.paddingEnd;
    validatePaddingInput(value, options.context);
    const edges = value !== null && typeof value === 'object' ? value : undefined;
    const uniform = typeof value === 'number' ? value : typeof value === 'string' ? value as Percentage : 0;
    const padding = {
      top: allocatedPaddingEdge(edges?.top ?? uniform, options.width, 'padding.top', options.context),
      right: allocatedPaddingEdge(logicalRight !== undefined ? logicalRight : edges?.right ?? uniform, options.width, logicalRight !== undefined ? direction === 'rtl' ? 'paddingStart' : 'paddingEnd' : 'padding.right', options.context),
      bottom: allocatedPaddingEdge(edges?.bottom ?? uniform, options.width, 'padding.bottom', options.context),
      left: allocatedPaddingEdge(logicalLeft !== undefined ? logicalLeft : edges?.left ?? uniform, options.width, logicalLeft !== undefined ? direction === 'rtl' ? 'paddingEnd' : 'paddingStart' : 'padding.left', options.context),
    };
    return { ...style, padding, paddingStart: undefined, paddingEnd: undefined };
  }
  if (!hasPercentagePadding(value)) return style;
  let padding: Edges;
  if (typeof value === 'string') {
    const edge = allocatedPaddingEdge(value, options.width, 'padding', options.context);
    padding = { top: edge, right: edge, bottom: edge, left: edge };
  } else {
    const edges = value as Exclude<EdgeValues<number | Percentage>,number | Percentage>;
    padding = {
      top: allocatedPaddingEdge(edges.top ?? 0, options.width, 'padding.top', options.context),
      right: allocatedPaddingEdge(edges.right ?? 0, options.width, 'padding.right', options.context),
      bottom: allocatedPaddingEdge(edges.bottom ?? 0, options.width, 'padding.bottom', options.context),
      left: allocatedPaddingEdge(edges.left ?? 0, options.width, 'padding.left', options.context),
    };
  }
  return { ...style, padding };
}
function allocatedPaddingEdge(value: number | Percentage, width: number, property: string, context: Readonly<LayoutDiagnosticContext>): number {
  const resolved = resolveLength(value, width, property, context);
  if (resolved === undefined || resolved < 0) throw layoutDiagnostic({ ...context, property, value, reason: 'padding must be finite and nonnegative' });
  return resolved;
}

/** Internal raw percentage admission; no allocation is inferred from constraints. */
export function hasPercentageBoxPadding(style: Readonly<BoxStyle>, inheritedDirection?: 'ltr' | 'rtl'): boolean {
  if (style.paddingStart === undefined && style.paddingEnd === undefined) return hasPercentagePadding(style.padding);
  const value = style.padding;
  if (typeof value === 'string' && hasPercentagePadding(value)) return true;
  const edges = value !== null && typeof value === 'object' ? value : undefined;
  const direction = receiverDirection(style, inheritedDirection);
  const left = direction === 'rtl' ? style.paddingEnd : style.paddingStart;
  const right = direction === 'rtl' ? style.paddingStart : style.paddingEnd;
  return hasPercentagePadding(edges?.top) || hasPercentagePadding(edges?.bottom) ||
    hasPercentagePadding(left !== undefined ? left : edges?.left) ||
    hasPercentagePadding(right !== undefined ? right : edges?.right);
}
function receiverDirection(style: Readonly<BoxStyle>, inherited?: 'ltr' | 'rtl'): 'ltr' | 'rtl' {
  return (style as Readonly<BoxStyle & { layoutDirection?: 'ltr' | 'rtl' }>).layoutDirection ?? inherited ?? getLayoutDirection();
}
function requireLogicalPadding(style: Readonly<BoxStyle>, context: Readonly<LayoutDiagnosticContext>): void {
  if (!nativeLayout) throw layoutDiagnostic({ ...context, property: style.paddingStart !== undefined ? 'paddingStart' : 'paddingEnd', value: style.paddingStart ?? style.paddingEnd, reason: 'logical padding requires the experimental layout engine' });
}
function validatePaddingInput(value: BoxStyle['padding'], context: Readonly<LayoutDiagnosticContext>): void {
  if (value === undefined || typeof value === 'number' || typeof value === 'string' ||
      value !== null && typeof value === 'object' && !Array.isArray(value)) return;
  throw layoutDiagnostic({ ...context, property: 'padding', value, reason: 'uses an unsupported edge value' });
}
function numericPadding(style: Readonly<BoxStyle>, context: Readonly<LayoutDiagnosticContext>): Edges {
  if (style.paddingStart === undefined && style.paddingEnd === undefined) return normalizeEdges(style.padding as EdgeValues | undefined, 'padding', context);
  requireLogicalPadding(style, context);
  const direction = receiverDirection(style);
  const logicalLeft = direction === 'rtl' ? style.paddingEnd : style.paddingStart;
  const logicalRight = direction === 'rtl' ? style.paddingStart : style.paddingEnd;
  const value = style.padding;
  validatePaddingInput(value, context);
  const edges = value !== null && typeof value === 'object' ? value : undefined;
  const uniform = typeof value === 'number' ? value : typeof value === 'string' ? value as Percentage : 0;
  return {
    top: numericPaddingEdge(edges?.top ?? uniform, 'padding.top', context),
    right: numericPaddingEdge(logicalRight !== undefined ? logicalRight : edges?.right ?? uniform, logicalRight !== undefined ? direction === 'rtl' ? 'paddingStart' : 'paddingEnd' : 'padding.right', context),
    bottom: numericPaddingEdge(edges?.bottom ?? uniform, 'padding.bottom', context),
    left: numericPaddingEdge(logicalLeft !== undefined ? logicalLeft : edges?.left ?? uniform, logicalLeft !== undefined ? direction === 'rtl' ? 'paddingEnd' : 'paddingStart' : 'padding.left', context),
  };
}
function numericPaddingEdge(value: unknown, property: string, context: Readonly<LayoutDiagnosticContext>): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw layoutDiagnostic({ ...context, property, value, reason: 'padding must be finite and nonnegative; percentages require an actual finite Flex allocation' });
  return value;
}

function numericBorder(style: Readonly<BoxStyle>, context: Readonly<LayoutDiagnosticContext>, inheritedDirection?: 'ltr' | 'rtl'): Edges {
  if (style.borderStartWidth === undefined && style.borderEndWidth === undefined) return normalizeEdges(style.borderWidth, 'borderWidth', context);
  if (!nativeLayout) throw layoutDiagnostic({ ...context, property: style.borderStartWidth !== undefined ? 'borderStartWidth' : 'borderEndWidth', value: style.borderStartWidth !== undefined ? style.borderStartWidth : style.borderEndWidth, reason: 'logical layout borders require the experimental layout engine' });
  const direction = receiverDirection(style, inheritedDirection);
  const logicalLeft = direction === 'rtl' ? style.borderEndWidth : style.borderStartWidth;
  const logicalRight = direction === 'rtl' ? style.borderStartWidth : style.borderEndWidth;
  const value = style.borderWidth;
  if (!(value === undefined || typeof value === 'number' || value !== null && typeof value === 'object' && !Array.isArray(value))) throw layoutDiagnostic({ ...context, property: 'borderWidth', value, reason: 'layout borders require numeric physical edge values' });
  const edges = value !== null && typeof value === 'object' ? value : undefined;
  const uniform = typeof value === 'number' ? value : 0;
  return {
    top: numericBorderEdge(edges?.top ?? uniform, 'borderWidth.top', context),
    right: numericBorderEdge(logicalRight !== undefined ? logicalRight : edges?.right ?? uniform, logicalRight !== undefined ? direction === 'rtl' ? 'borderStartWidth' : 'borderEndWidth' : 'borderWidth.right', context),
    bottom: numericBorderEdge(edges?.bottom ?? uniform, 'borderWidth.bottom', context),
    left: numericBorderEdge(logicalLeft !== undefined ? logicalLeft : edges?.left ?? uniform, logicalLeft !== undefined ? direction === 'rtl' ? 'borderEndWidth' : 'borderStartWidth' : 'borderWidth.left', context),
  };
}
function numericBorderEdge(value: unknown, property: string, context: Readonly<LayoutDiagnosticContext>): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw layoutDiagnostic({ ...context, property, value, reason: 'layout border width must be a finite nonnegative number; percentages are unsupported' });
  return value;
}
