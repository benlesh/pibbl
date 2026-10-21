import { prepareLayoutEngineSync } from "./layout/wasm/embedded.js";
import { reserveMountRequest } from "./mount-requests.js";
import {
  mountPreparedRoot,
  validateMountArguments,
} from "./mount-prepared-root.js";
import type { PibblController, PibblNode } from "./types.js";
import type { PibblConfig } from "./surface/types.js";

/**
 * Mounts or updates a canvas synchronously using the separately embedded layout binary.
 * Import this operation from @pibbl/core/sync. It never fetches or awaits a Promise.
 * A compatible module prepared by the asynchronous entry is reused without decoding.
 * @param canvas - Canvas receiving the mount. See {@link PibblConfig}.
 * @param element - Root tree to render. See {@link PibblNode}.
 * @param config - Surface options and lifetime signal. See {@link PibblConfig}.
 * @returns The stable {@link PibblController}; dispose it to release owned resources.
 * @throws Synchronously on initialization or mount failure, or AbortError if already aborted.
 * @see {@link PibblController}
 * @see {@link PibblConfig}
 */
export function pibblSync(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): PibblController {
  validateMountArguments(canvas, element, config);
  const request = reserveMountRequest(canvas, config?.signal);
  try {
    request.assertCurrent();
    prepareLayoutEngineSync();
    request.assertCurrent();
    return mountPreparedRoot(canvas, element, config);
  } finally {
    request.finish();
  }
}
