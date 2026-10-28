import type { BoxStyle } from '../style/types.js';
import { resolveScalarSizingLength, type SizingLength } from '../style/sizing-length.js';
import { normalizeBoxInsets } from './box-insets.js';
import { layoutDiagnostic, type LayoutDiagnosticContext } from '../style/diagnostics.js';

// Private canonical-input marker survives internal descriptor/style copies.
const BORDER_BOX_CONTENT = Symbol('pibbl.border-box-content');
type CanonicalBox = { [BORDER_BOX_CONTENT]?: true };

export function borderBoxPaddingFloor(style: Readonly<BoxStyle>): boolean {
  return style.boxSizing === 'border-box' || (style as CanonicalBox)[BORDER_BOX_CONTENT] === true;
}
export function validateBoxSizing(style: Readonly<BoxStyle>, context: Readonly<LayoutDiagnosticContext>): void {
  if (style.boxSizing !== undefined && style.boxSizing !== 'content-box' && style.boxSizing !== 'border-box') {
    throw layoutDiagnostic({ ...context, property: 'boxSizing', value: style.boxSizing, reason: 'must be content-box or border-box' });
  }
}

/** Converts authored outer inputs once; ordinary content-box styles are returned unchanged. */
export function contentBoxStyle<S extends BoxStyle & { flexBasis?: SizingLength }>(style: Readonly<S>, options: { width: number; height: number; mainAxis?: 'width' | 'height'; context: Readonly<LayoutDiagnosticContext> }): Readonly<S> {
  validateBoxSizing(style, options.context);
  if (style.boxSizing !== 'border-box') return style;
  const padding = normalizeBoxInsets(style, options.context);
  const horizontal = padding.left + padding.right, vertical = padding.top + padding.bottom;
  const width = nonnegativeLength(style.width, options.width, 'width', options.context);
  const height = nonnegativeLength(style.height, options.height, 'height', options.context);
  const minWidth = nonnegativeLength(style.minWidth, options.width, 'minWidth', options.context);
  const maxWidth = nonnegativeLength(style.maxWidth, options.width, 'maxWidth', options.context);
  const minHeight = nonnegativeLength(style.minHeight, options.height, 'minHeight', options.context);
  const maxHeight = nonnegativeLength(style.maxHeight, options.height, 'maxHeight', options.context);
  if (minWidth !== undefined && maxWidth !== undefined && minWidth > maxWidth) throw layoutDiagnostic({ ...options.context, property: 'minWidth', value: minWidth, reason: 'minimum must not exceed maximum' });
  if (minHeight !== undefined && maxHeight !== undefined && minHeight > maxHeight) throw layoutDiagnostic({ ...options.context, property: 'minHeight', value: minHeight, reason: 'minimum must not exceed maximum' });
  const result: BoxStyle & { flexBasis?: SizingLength } & CanonicalBox = { ...style, boxSizing: 'content-box' as const, [BORDER_BOX_CONTENT]: true as const,
    width: width === undefined ? style.width : Math.max(0, width-horizontal),
    height: height === undefined ? style.height : Math.max(0, height-vertical),
    minWidth: minWidth === undefined ? undefined : Math.max(0, minWidth-horizontal),
    maxWidth: maxWidth === undefined ? undefined : Math.max(0, maxWidth-horizontal),
    minHeight: minHeight === undefined ? undefined : Math.max(0, minHeight-vertical),
    maxHeight: maxHeight === undefined ? undefined : Math.max(0, maxHeight-vertical),
  };
  if (options.mainAxis && style.flexBasis !== undefined && style.flexBasis !== 'auto') {
    const basis = nonnegativeLength(style.flexBasis, options.mainAxis === 'width' ? options.width : options.height, 'flexBasis', options.context)!;
    result.flexBasis = Math.max(0, basis-(options.mainAxis === 'width' ? horizontal : vertical));
  }
  return result as Readonly<S>;
}

/** Settled dimensions are already content values; authored bounds have been applied. */
export function allocatedContentBoxStyle<S extends BoxStyle>(style: Readonly<S>, width: number, height: number): Readonly<S> {
  if (style.boxSizing !== 'border-box') return { ...style, width, height };
  return { ...style, boxSizing: 'content-box', [BORDER_BOX_CONTENT]: true,
    width, height, minWidth: undefined, maxWidth: undefined, minHeight: undefined, maxHeight: undefined };
}
function nonnegativeLength(value: SizingLength | undefined, reference: number, property: string, context: Readonly<LayoutDiagnosticContext>): number | undefined {
  if (value === undefined) return undefined;
  const resolved = resolveScalarSizingLength(value, reference, property, context);
  if (resolved !== undefined && resolved < 0) throw layoutDiagnostic({ ...context, property, value, reason: 'must be nonnegative when used as a layout allocation' });
  return resolved;
}
