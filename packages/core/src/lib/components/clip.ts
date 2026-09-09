import { definePrimitive } from '../define-primitive.js';
import { CRCNode, SystemStyle } from '../types.js';
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
  children: CRCNode;
}

export interface ClipStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  d: Path2D;
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
  resolveStyle: style => stripLayoutParticipation(style) as ResolvedClipStyle,
});

setPrimitivePresentation<ResolvedClipStyle>(Clip, style => {
  const { d, fillRule = 'nonzero' } = style;
  return { clip: { path: d, fillRule } };
});
