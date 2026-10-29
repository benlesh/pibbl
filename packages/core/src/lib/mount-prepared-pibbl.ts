import { validateSurfaceConfig } from './surface/resolve-surface.js';
import { mountAbortError } from './mount-request.js';
import { GLOBAL_STATE } from './global-state.js';
import { mountPibbl } from './mount-pibbl.js';
import { assertCompatibleRootNode } from './element/children.js';
import { PibblController, type PibblNode } from './types.js';
import { update } from './update.js';
import type { PibblConfig } from './surface/types.js';

/** Validates a new request before it can supersede another pending request. */
export function assertMountRequest(canvas: HTMLCanvasElement, element: PibblNode, config?: PibblConfig): void {
  assertCompatibleRootNode(element);
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("Pibbl requires a canvas element.");
  if (config?.signal?.aborted) throw mountAbortError();
  // Live mounts retain their initial surface configuration; update options do
  // not recapture or revalidate ignored surface fields.
  if (!GLOBAL_STATE.pibblInstances.has(canvas)) validateSurfaceConfig(canvas, config);
}

export function mountPreparedPibbl(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): PibblController {
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
