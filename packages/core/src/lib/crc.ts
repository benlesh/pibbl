import { GLOBAL_STATE } from './global-state.js';
import { mountCRC } from './mount-crc.js';
import { CompEl, CRCController } from './types.js';
import { update } from './update.js';

/**
 * Mounts or updates a canvas render component on a given HTMLCanvasElement
 * @param canvas The canvas to render on
 * @param element The CRC element to render
 */
export function crc<P>(
  canvas: HTMLCanvasElement,
  element: CompEl<P>,
  config?: { signal?: AbortSignal },
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
