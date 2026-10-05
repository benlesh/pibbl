import type { PibblInstance } from '../types.js';
import { rootRenderTarget } from '../render-target.js';
import type { PibblSurfaceSnapshot } from './types.js';

export function toLogicalTransform(
  surface: PibblSurfaceSnapshot,
  current: DOMMatrix,
): DOMMatrix {
  return rootRenderTarget(surface).inverseRenderTransform.multiply(current);
}

export function getSurfaceSnapshot(
  instance: PibblInstance,
): PibblSurfaceSnapshot {
  const snapshot = instance.surface.snapshot;
  if (!snapshot) {
    throw new Error('No visible Pibbl surface is available.');
  }
  return snapshot;
}
