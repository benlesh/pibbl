import { GLOBAL_STATE } from "./global-state.js";
import { mountPibbl } from "./mount-pibbl.js";
import { assertCompatibleRootNode } from "./element/children.js";
import { update } from "./update.js";
import { validateSurfaceConfig } from "./surface/resolve-surface.js";
import type { PibblController, PibblNode } from "./types.js";
import type { PibblConfig } from "./surface/types.js";

export function validateMountArguments(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): void {
  assertCompatibleRootNode(element);
  if (!canvas || typeof canvas.getContext !== "function")
    throw new TypeError("Pibbl requires a canvas element.");
  // Existing mounts keep their originally captured surface configuration.
  if (!GLOBAL_STATE.pibblInstances.has(canvas))
    validateSurfaceConfig(canvas, config);
}

/** Called only after a public loading path has prepared the compatible module. */
export function mountPreparedRoot(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): PibblController {
  const mounted = GLOBAL_STATE.pibblInstances.get(canvas);
  if (mounted) {
    update(canvas, element);
    return mounted.controller;
  }
  const controller = mountPibbl(canvas, element, config);
  if (GLOBAL_STATE.pibblInstances.has(canvas)) update(canvas, element);
  return controller;
}
