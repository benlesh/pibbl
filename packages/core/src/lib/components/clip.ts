import { defineComp } from '../define-comp.js';
import { GLOBAL_STATE } from '../global-state.js';
import { CRCNode, RenderingContext2D, SystemStyle } from '../types.js';
import { pushClippingPath } from '../util/push-clipping-path.js';

export interface ClipProps {
  path: Path2D;
  fillRule?: CanvasFillRule;
  children: CRCNode[];
}

export function Clip(props: ClipProps, _style: SystemStyle, ctx: RenderingContext2D) {
  const { path, fillRule = 'nonzero' } = props;

  const releaseClip = pushClippingPath(ctx, path, fillRule);
  GLOBAL_STATE.componentRefs!.onAfterRender = releaseClip;

  return props.children;
}

export const clip = defineComp(Clip);
