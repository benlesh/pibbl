import { getCurrentCRCInstance, GLOBAL_STATE } from '../global-state.js';
import type { RenderingContext2D } from '../types.js';
import {
  getSurfaceSnapshot,
  toLogicalTransform,
} from '../surface/transform.js';

/**
 * Applies one Canvas clip and publishes the same geometry to interaction state.
 * Canvas state remains owned by the surrounding component save/restore.
 */
export function pushClippingPath(
  ctx: RenderingContext2D,
  path: Path2D,
  fillRule: CanvasFillRule = 'nonzero',
): () => void {
  GLOBAL_STATE.clippingStack.push({
    path,
    fillRule,
    transform: toLogicalTransform(
      getSurfaceSnapshot(getCurrentCRCInstance()),
      ctx.getTransform(),
    ),
  });

  try {
    ctx.clip(path, fillRule);
  } catch (error) {
    GLOBAL_STATE.clippingStack.pop();
    throw error;
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    GLOBAL_STATE.clippingStack.pop();
  };
}
