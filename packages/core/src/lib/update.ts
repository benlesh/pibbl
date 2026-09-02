import { executeRender } from './execute-render.js';
import {
  GLOBAL_STATE,
  NO_PENDING_ROOT,
} from './global-state.js';
import { Canvas, type CRCNode } from './types.js';

/**
 *
 * @param canvas The canvas with CRC mounted on it to update
 * @param rootElement The optional element to update as the root element of that canvas.
 * @param updateParents Whether to update parent components while rendering.
 */
export function update(
  canvas: Canvas,
  rootElement?: CRCNode,
  updateParents = false,
): void {
  const crcInstance = GLOBAL_STATE.crcInstances.get(canvas);

  if (!crcInstance) {
    throw new Error('Canvas does not have CRC mounted.');
  }

  const hasExplicitRoot = arguments.length >= 2 && !(
    rootElement === undefined && updateParents
  );
  if (hasExplicitRoot) {
    crcInstance.pendingRoot = rootElement;
  }
  crcInstance.pendingUpdateParents ||= updateParents;

  if (crcInstance.animationFrameId !== undefined) {
    return;
  }

  let frameId = 0;
  frameId = requestAnimationFrame((timestamp) => {
    if (
      GLOBAL_STATE.crcInstances.get(canvas) !== crcInstance ||
      crcInstance.mainTeardowns.closed ||
      crcInstance.animationFrameId !== frameId
    ) {
      return;
    }

    crcInstance.animationFrameId = undefined;
    const pendingRoot = crcInstance.pendingRoot;
    const pendingUpdateParents = crcInstance.pendingUpdateParents;
    crcInstance.pendingRoot = NO_PENDING_ROOT;
    crcInstance.pendingUpdateParents = false;
    executeRender(canvas, timestamp, pendingRoot, pendingUpdateParents);
  });
  crcInstance.animationFrameId = frameId;
}
