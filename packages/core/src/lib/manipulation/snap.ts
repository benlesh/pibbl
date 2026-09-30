import type { CRCManipulationModifiers, CRCManipulationWhen } from './types.js';

export function isSnapActive(
  enabled: boolean | undefined,
  when: CRCManipulationWhen | undefined,
  modifiers: CRCManipulationModifiers,
): boolean {
  if (enabled === false) return false;
  switch (when ?? 'always') {
    case 'always': return true;
    case 'shift': return modifiers.shift === true;
    case 'alt': return modifiers.alt === true;
    case 'ctrl': return modifiers.ctrl === true;
    case 'meta': return modifiers.meta === true;
  }
}

export function assertPositiveFiniteStep(step: number, label: string): void {
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error(`${label} must be finite and greater than zero, received ${step}`);
  }
}

export function assertFiniteOrigin(origin: number, label: string): void {
  if (!Number.isFinite(origin)) {
    throw new Error(`${label} must be finite, received ${origin}`);
  }
}

/** Rounds half-way values toward the larger lattice index. */
export function snapToLattice(value: number, step: number, origin = 0): number {
  assertPositiveFiniteStep(step, 'snap step');
  assertFiniteOrigin(origin, 'snap origin');
  const index = (value - origin) / step;
  const lower = Math.floor(index);
  const rounded = index - lower < 0.5 ? lower : lower + 1;
  return origin + rounded * step;
}
