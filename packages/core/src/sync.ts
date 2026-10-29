import { prepareLayoutEngineSync } from './lib/layout/wasm/embedded.js';
import { cancelPendingMount } from './lib/mount-request.js';
import { assertMountRequest, mountPreparedPibbl } from './lib/mount-prepared-pibbl.js';
import type { PibblController, PibblNode } from './lib/types.js';
import type { PibblConfig } from './lib/surface/types.js';

/**
 * Mounts or updates synchronously using the embedded layout WASM binary.
 * Import from @pibbl/core/sync to opt into its Base64 payload. Reuses a compatible
 * module prepared by prepareLayoutEngine() or a prior mount. Imports are inert.
 * @param canvas The HTML Canvas owned by the mount.
 * @param element The branded recursive root descriptor. See {@link PibblNode}.
 * @param config Surface and lifetime options. See {@link PibblConfig}.
 * @returns The stable {@link PibblController}, synchronously.
 * @throws Throws on compilation/mount failure, or AbortError for a pre-aborted signal.
 * Supersedes pending asynchronous requests for this Canvas.
 * @see {@link PibblController}
 * @see {@link PibblConfig}
 */
export function pibblSync(canvas: HTMLCanvasElement, element: PibblNode, config?: PibblConfig): PibblController {
  assertMountRequest(canvas, element, config);
  cancelPendingMount(canvas);
  prepareLayoutEngineSync();
  return mountPreparedPibbl(canvas, element, config);
}
