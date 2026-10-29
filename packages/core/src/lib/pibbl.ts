import { prepareLayoutModule } from './layout/wasm/module.js';
import { reserveMount } from './mount-request.js';
import { assertMountRequest, mountPreparedPibbl } from './mount-prepared-pibbl.js';
import type { PibblController, PibblNode } from './types.js';
import type { PibblConfig } from './surface/types.js';

/**
 * Fetches and compiles the external layout WASM ahead of mounting. Concurrent
 * calls share one attempt; a later call retries after failure. Creates no mount.
 * HTML preload can independently warm the network cache.
 * @returns A Promise fulfilled when the compatible compiled module is ready.
 * @throws Rejects on fetch, integrity or compilation failure, with the original cause.
 * @see {@link pibbl}
 */
export function prepareLayoutEngine(): Promise<void> { return prepareLayoutModule(); }

/**
 * Prepares the external layout engine, then mounts or updates one Canvas.
 * The first live mount owns surface configuration and its lifetime signal.
 * Layout, component evaluation and scheduled frames remain synchronous.
 * @param canvas The HTML Canvas owned by the mount.
 * @param element The branded recursive root descriptor. See {@link PibblNode}.
 * @param config Surface and lifetime options. See {@link PibblConfig}.
 * @returns A Promise for the stable {@link PibblController}; dispose releases the mount.
 * @throws Rejects on loading/mount failure, or with AbortError on cancellation,
 * supersession or disposal while pending. A later call retries failed loading.
 * @see {@link prepareLayoutEngine}
 * @see {@link PibblController}
 */
export async function pibbl(
  canvas: HTMLCanvasElement,
  element: PibblNode,
  config?: PibblConfig,
): Promise<PibblController> {
  assertMountRequest(canvas, element, config);
  const request = reserveMount(canvas, config?.signal);
  try {
    await Promise.race([prepareLayoutModule(), request.cancelled]);
    request.assertCurrent();
    // Clear only the pending reservation; mounted lifetime ownership takes over.
    request.finish();
    return mountPreparedPibbl(canvas, element, config);
  } finally {
    request.finish();
  }
}
