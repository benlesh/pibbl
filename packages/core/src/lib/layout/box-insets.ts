import { normalizeEdges } from '../style/normalize.js';
import { layoutDiagnostic, type LayoutDiagnosticContext } from '../style/diagnostics.js';
import type { BoxStyle } from '../style/types.js';
import type { Edges } from './types.js';

/** Internal layout insets; painted stroke is deliberately independent. */
export function normalizeBoxInsets(style: Readonly<BoxStyle>, context: Readonly<LayoutDiagnosticContext>): Edges {
  const padding = normalizeEdges(style.padding, 'padding', context);
  if (style.borderWidth === undefined) return padding;
  const border = normalizeEdges(style.borderWidth, 'borderWidth', context);
  const top = padding.top + border.top, right = padding.right + border.right;
  const bottom = padding.bottom + border.bottom, left = padding.left + border.left;
  if (!Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom) || !Number.isFinite(left)) {
    throw layoutDiagnostic({ ...context, property: 'borderWidth', value: style.borderWidth, reason: 'combined padding and border insets must be finite' });
  }
  return { top, right, bottom, left };
}
