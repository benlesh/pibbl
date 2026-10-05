import { GLOBAL_STATE } from './global-state.js';
import { mountPibbl } from './mount-pibbl.js';
import { assertCompatibleRootNode } from './element/children.js';
import { PibblController, type PibblNode } from './types.js';
import { update } from './update.js';
import type { PibblConfig } from './surface/types.js';

/**
 * Mounts or updates a canvas render component on a given HTMLCanvasElement.
 * The first mount captures the surface configuration; later calls update only
 * the root element until that controller is disposed.
 * @param canvas The canvas to render on
 * @param element The Pibbl element to render
 * @param config The mount lifetime, logical viewport, fit, and pixel density. See
 * {@link PibblConfig} .
 * @returns The stable {@link PibblController} for this canvas; dispose it to release the mount.
 *
 * @see {@link PibblNode}
 * @see {@link PibblConfig}
 * @see {@link PibblController}
 */
export function pibbl(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): PibblController {
  assertCompatibleRootNode(element);
  const mountedInstance = GLOBAL_STATE.pibblInstances.get(canvas);
  if (mountedInstance) {
    update(canvas, element);
    return mountedInstance.controller;
  }

  const controller = mountPibbl(canvas, element, config);
  if (GLOBAL_STATE.pibblInstances.has(canvas)) {
    update(canvas, element);
  }
  return controller;
}
