import {
  getCurrentFrameTimestamp,
  requestCurrentInstanceFrame,
  useInternalHookSlot,
} from '@crc/core/internal';

/** Returns the current CRC timestamp and keeps this component rendering. */
export function crcAnimationFrame(): number {
  useInternalHookSlot('webglAnimationFrame', () => undefined);
  const timestamp = getCurrentFrameTimestamp();
  requestCurrentInstanceFrame(true);
  return timestamp;
}
