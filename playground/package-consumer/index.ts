import type { RectProps } from '@crc/core';
import type * as CoreTypes from '@crc/core/types';
import { crc, rect } from '@crc/core';

const props = {
  x: 10,
  y: 10,
  width: 40,
  height: 20,
  fillStyle: '#2563eb',
} satisfies RectProps;

export type PublicCoreTypes = typeof CoreTypes;
export const scene = rect(props);
export const mount = crc;
