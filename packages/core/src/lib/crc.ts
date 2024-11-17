import { GLOBAL_STATE } from './global-state';
import { mountCRC } from './mount-crc';
import { CompEl } from './types';
import { update } from './update';

/**
 * Mounts or updates a canvas render component on a given HTMLCanvasElement
 * @param canvas The canvas to render on
 * @param element The CRC element to render
 */
export function crc<P>(
  canvas: HTMLCanvasElement,
  element: CompEl<P>,
  config?: { signal?: AbortSignal },
) {
  if (!GLOBAL_STATE.crcInstances.has(canvas)) {
    mountCRC<P>(canvas, element, config);
  }

  update(canvas, element);
}
