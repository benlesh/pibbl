import { defineComp } from '../define-comp.js';
import { GLOBAL_STATE } from '../global-state.js';
import { CRCNode, RenderingContext2D, SystemStyle } from '../types.js';
import { pushClippingPath } from '../util/push-clipping-path.js';

export interface ClipProps {
  children: CRCNode[];
}

export interface ClipStyle extends SystemStyle {
  d: Path2D;
  fillRule?: CanvasFillRule;
}

export function Clip(
  props: ClipProps,
  style: Readonly<ClipStyle>,
  ctx: RenderingContext2D,
) {
  const { d, fillRule = 'nonzero' } = style;

  const releaseClip = pushClippingPath(ctx, d, fillRule);
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseClip;

  return props.children;
}

export const clip = defineComp(Clip);
