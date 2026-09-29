import type { CRCManipulationBox, CRCManipulationPoint } from './types.js';

export function assertFiniteBox(box: CRCManipulationBox, label = 'box'): void {
  for (const [property, value] of Object.entries(box)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${label}.${property} must be finite, received ${value}`);
    }
  }
  if (box.width <= 0 || box.height <= 0) {
    throw new Error(`${label}.width and ${label}.height must be greater than zero`);
  }
}

export function assertFinitePoint(point: CRCManipulationPoint, label: string): void {
  for (const [property, value] of Object.entries(point)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${label}.${property} must be finite, received ${value}`);
    }
  }
}

export function freezeBox(box: CRCManipulationBox): CRCManipulationBox {
  return Object.freeze({ ...box });
}
