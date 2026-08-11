import { executeRender } from './execute-render';
import { GLOBAL_STATE } from './global-state';
import { Canvas, CompEl } from './types';

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
) {
  const crcInstance = GLOBAL_STATE.crcInstances.get(canvas)!;

  if (!crcInstance) {
    throw new Error('Canvas does not have CRC mounted.');
  }

  if (crcInstance.animationFrameId) {
    cancelAnimationFrame(crcInstance.animationFrameId);
  }

  crcInstance.animationFrameId = requestAnimationFrame(ts =>
    executeRender(canvas, ts, rootElement, updateParents),
  );
}
