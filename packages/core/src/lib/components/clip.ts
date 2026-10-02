import { portablePath } from '../html/portable-clips.js';
import { definePrimitive } from '../define-primitive.js';
import { PathGeometry } from '../geometry/path-geometry.js';
import { resolvePath } from '../geometry/resolve-path.js';
import { CRCNodeInput, SystemStyle } from '../types.js';
import { setPrimitivePresentation } from '../primitive-presentation.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import {
  type CRCStructuralEventProps,
  wireStructuralEvents,
} from './structural-events.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';

export interface ClipProps extends CRCStructuralEventProps {
  children: CRCNodeInput;
}

export interface ClipStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  d: Path2D | PathGeometry;
  fillRule?: CanvasFillRule;
}

type ResolvedClipStyle = ResolvedDrawingStyle<ClipStyle>;

function renderClip(
  props: ClipProps,
) {
  wireStructuralEvents(props);
  return props.children;
}

/** Describes a clipping container for JSX or createElement authoring. */
export const Clip = definePrimitive<
  ClipProps,
  ClipStyle,
  ClipStyle,
  ResolvedClipStyle
>(renderClip, {
  childInput: 'structural',
  resolveStyle: style => stripLayoutParticipation(style) as ResolvedClipStyle,
});

setPrimitivePresentation<ResolvedClipStyle>(Clip, style => {
  const { d, fillRule = 'nonzero' } = style;
  return { clip: { path: resolvePath(d), fillRule, svgPath: portablePath(d) } };
});
