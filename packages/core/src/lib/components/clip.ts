import { defineComp } from '../define-comp.js';
import { GLOBAL_STATE } from '../global-state.js';
import { CRCNode, RenderingContext2D, SystemStyle } from '../types.js';
import { pushClippingPath } from '../util/push-clipping-path.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';

export interface ClipProps {
  children: CRCNode[];
}

export interface ClipStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  d: Path2D;
  fillRule?: CanvasFillRule;
}

type ResolvedClipStyle = ResolvedDrawingStyle<ClipStyle>;

export function Clip(
  props: ClipProps,
  style: Readonly<ResolvedClipStyle>,
  ctx: RenderingContext2D,
) {
  const { d, fillRule = 'nonzero' } = style;

  const releaseClip = pushClippingPath(ctx, d, fillRule);
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseClip;

  return props.children;
}

export const clip = defineComp<
  ClipProps,
  ClipStyle,
  ClipStyle,
  ResolvedClipStyle
>(Clip, {
  resolveStyle: style => stripLayoutParticipation(style) as ResolvedClipStyle,
});
