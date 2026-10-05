import {
  GLOBAL_STATE,
  NO_PENDING_ROOT,
} from './global-state.js';
import { requestInstanceRender } from './scheduler/realm-scheduler.js';
import { Canvas, type PibblNode } from './types.js';

/**
 *
 * @param canvas The canvas with Pibbl mounted on it to update
 * @param rootElement The optional element to update as the root element of that canvas.
 * @param updateParents Whether to update parent components while rendering.
 */
export function update(
  canvas: Canvas,
  rootElement?: PibblNode,
  updateParents = false,
): void {
  const pibblInstance = GLOBAL_STATE.pibblInstances.get(canvas);

  if (!pibblInstance) {
    throw new Error('Canvas does not have Pibbl mounted.');
  }

  const hasExplicitRoot = arguments.length >= 2 && !(
    rootElement === undefined && updateParents
  );
  requestInstanceRender(pibblInstance, {
    pendingRoot: hasExplicitRoot ? rootElement : NO_PENDING_ROOT,
    pendingUpdateParents: updateParents,
  });
}
