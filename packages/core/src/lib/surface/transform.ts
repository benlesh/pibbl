import type { CRCInstance } from '../types.js';
import { rootRenderTarget } from '../render-target.js';
import type { CRCSurfaceSnapshot } from './types.js';

export function toLogicalTransform(
  surface: CRCSurfaceSnapshot,
  current: DOMMatrix,
): DOMMatrix {
  return rootRenderTarget(surface).inverseRenderTransform.multiply(current);
}

export function getSurfaceSnapshot(
  instance: CRCInstance,
): CRCSurfaceSnapshot {
  const snapshot = instance.surface.snapshot;
  if (!snapshot) {
    throw new Error('No visible CRC surface is available.');
  }
  return snapshot;
}
