import { prepareLayoutEngine } from "./layout/wasm/loader.js";
import { reserveMountRequest } from "./mount-requests.js";
import {
  mountPreparedRoot,
  validateMountArguments,
} from "./mount-prepared-root.js";
import type { PibblController, PibblNode } from "./types.js";
import type { PibblConfig } from "./surface/types.js";

/**
 * Prepares the external layout engine, then mounts or updates a canvas.
 * No component, event owner or frame is admitted before preparation succeeds.
 * The first mount captures surface configuration; later calls update its root.
 * @param canvas - The canvas to render on. See {@link PibblConfig}.
 * @param element - The branded root tree. See {@link PibblNode}.
 * @param config - Surface options and the caller's pending-load cancellation signal.
 * The original mounted signal continues to govern the mount lifetime. See {@link PibblConfig}.
 * @returns A Promise for the stable {@link PibblController}; call dispose to release it.
 * @throws Rejects on loading or mount failure, or with AbortError when cancelled or superseded.
 * @see {@link prepareLayoutEngine}
 * @see {@link PibblController}
 */
export async function pibbl(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): Promise<PibblController> {
  validateMountArguments(canvas, element, config);
  const request = reserveMountRequest(canvas, config?.signal);
  try {
    request.assertCurrent();
    await request.waitUntilReady(prepareLayoutEngine());
    request.assertCurrent();
    return mountPreparedRoot(canvas, element, config);
  } finally {
    request.finish();
  }
}
