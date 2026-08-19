import { GLOBAL_STATE } from './global-state.js';
import { mountCRC } from './mount-crc.js';
import { CompEl, CRCController } from './types.js';
import { update } from './update.js';
import type { CRCConfig } from './surface/types.js';

/**
 * Mounts or updates a canvas render component on a given HTMLCanvasElement.
 * The first mount captures the surface configuration; later calls update only
 * the root element until that controller is disposed.
 * @param canvas The canvas to render on
 * @param element The CRC element to render
 * @param config The mount lifetime, logical viewport, fit, and pixel density
 */
export function crc<P>(
  canvas: HTMLCanvasElement,
  element: CompEl<P, any>,
  config?: CRCConfig,
): CRCController {
  const mountedInstance = GLOBAL_STATE.crcInstances.get(canvas);
  if (mountedInstance) {
    update(canvas, element);
    return mountedInstance.controller;
  }

  const controller = mountCRC<P>(canvas, element, config);
  if (GLOBAL_STATE.crcInstances.has(canvas)) {
    update(canvas, element);
  }
  return controller;
}
