import { normalizeEdges } from '../style/normalize.js';
import { layoutDiagnostic, type LayoutDiagnosticContext } from '../style/diagnostics.js';
import { resolveLength } from '../style/resolve-length.js';
import type { BoxStyle, EdgeValues, Percentage } from '../style/types.js';
import type { Edges } from './types.js';

/** Internal layout insets; painted stroke is deliberately independent. */
export function normalizeBoxInsets(style: Readonly<BoxStyle>, context: Readonly<LayoutDiagnosticContext>): Edges {
  const padding = normalizeEdges(style.padding as EdgeValues | undefined, 'padding', context);
  if (style.borderWidth === undefined) return padding;
  const border = normalizeEdges(style.borderWidth, 'borderWidth', context);
  const top = padding.top + border.top, right = padding.right + border.right;
  const bottom = padding.bottom + border.bottom, left = padding.left + border.left;
  if (!Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom) || !Number.isFinite(left)) {
    throw layoutDiagnostic({ ...context, property: 'borderWidth', value: style.borderWidth, reason: 'combined padding and border insets must be finite' });
  }
  return { top, right, bottom, left };
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
/** Resolves participating Flex padding once; ordinary numeric styles keep identity. */
export function resolveAllocatedPadding<S extends BoxStyle>(style: Readonly<S>, options: { width: number; context: Readonly<LayoutDiagnosticContext> }): Readonly<S> {
  const value = style.padding;
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
