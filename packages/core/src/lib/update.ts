import { executeRender } from './execute-render.js';
import { GLOBAL_STATE } from './global-state.js';
import { Canvas, CompEl } from './types.js';

/**
 *
 * @param canvas The canvas with CRC mounted on it to update
 * @param rootElement The optional element to update as the root element of that canvas.
 * @param updateParents Whether to update parent components while rendering.
 */
export function update(
  canvas: Canvas,
  rootElement?: CompEl,
  updateParents = false,
): void {
  const crcInstance = GLOBAL_STATE.crcInstances.get(canvas);

  if (!crcInstance) {
    throw new Error('Canvas does not have CRC mounted.');
  }

  if (rootElement !== undefined) {
    crcInstance.pendingRoot = rootElement;
  }
  crcInstance.pendingUpdateParents ||= updateParents;

  if (crcInstance.animationFrameId !== undefined) {
    cancelAnimationFrame(crcInstance.animationFrameId);
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
    crcInstance.pendingRoot = undefined;
    crcInstance.pendingUpdateParents = false;
    executeRender(canvas, timestamp, pendingRoot, pendingUpdateParents);
  });
  crcInstance.animationFrameId = frameId;
}
