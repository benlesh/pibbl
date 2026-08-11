import { defineComp } from '../define-comp.js';
import { GLOBAL_STATE } from '../global-state.js';
import { CRCNode, RenderingContext2D } from '../types.js';

export interface ClipProps {
  path: Path2D;
  fillRule?: CanvasFillRule;
  children: CRCNode[];
}

export function Clip(props: ClipProps, ctx: RenderingContext2D) {
  const { path, fillRule = 'nonzero' } = props;

  GLOBAL_STATE.componentRefs!.onAfterRender = () => {
    GLOBAL_STATE.clippingStack.pop();
  };

  GLOBAL_STATE.clippingStack.push({
    path,
    fillRule,
    transform: ctx.getTransform(),
  });
  ctx.clip(path, fillRule);

  return props.children;
}

export const clip = defineComp(Clip);
