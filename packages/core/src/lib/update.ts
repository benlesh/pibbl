import {
  GLOBAL_STATE,
} from './global-state.js';
import { requestInstanceRender } from './scheduler/realm-scheduler.js';
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

  requestInstanceRender(crcInstance);
}
