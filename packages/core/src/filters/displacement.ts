import { isSignal } from '../lib/signals/graph.js';
import { layoutDiagnostic } from '../lib/style/diagnostics.js';
import {
  CRC_FILTER_EXECUTOR,
  type CRCDisplacementFilterOptions,
  type CRCFilter,
  type CRCFilterExecutor,
  type CRCFilterRenderInput,
  type PreparedCRCFilter,
} from '../lib/style/filter-types.js';
import type { StyleResolutionContext } from '../lib/types.js';
import { validateTexturePaint, type TexturePaint } from '../lib/textures/texture-protocol.js';
import { renderDisplacementBoundary, type PreparedDisplacement } from './render-displacement-boundary.js';
import { nativeExecutor } from './native.js';

const definitions = new WeakMap<CRCFilter, Readonly<CRCDisplacementFilterOptions>>();
const executor: CRCFilterExecutor = nativeExecutor;
const displacementExecutor: CRCFilterExecutor = {
  prepare(value, property, context): PreparedCRCFilter {
    const options = definitions.get(value);
    if (!options) throw new Error('A displacement filter value was created by an incompatible CRC runtime.');
    const strengthValue = isSignal(options.strength) ? options.strength.get() : options.strength;
    if (typeof strengthValue !== 'number' || !Number.isFinite(strengthValue) || strengthValue < 0) {
      throw diagnostic(`${property}.strength`, strengthValue, 'must be a finite nonnegative number', context);
    }
    const { x, y, width, height } = options.region;
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw diagnostic(`${property}.region`, options.region, 'must have finite coordinates and positive finite dimensions', context);
    }
    const map = isSignal(options.map) ? options.map.get() : options.map;
    validateTexturePaint(map);
    return Object.freeze({ executor: nativeExecutor, map, strength: strengthValue, region: Object.freeze({ x, y, width, height }) }) as PreparedDisplacement;
  },
  render(input: Readonly<CRCFilterRenderInput>): void {
    renderDisplacementBoundary(input, input.filters as readonly PreparedDisplacement[]);
  },
};

export function displacement(options: CRCDisplacementFilterOptions): CRCFilter {
  const definition = Object.freeze({ map: options.map, strength: options.strength, region: Object.freeze({ ...options.region }) });
  const value = Object.freeze({ [CRC_FILTER_EXECUTOR]: displacementExecutor });
  definitions.set(value, definition);
  return value;
}

function diagnostic(property: string, value: unknown, reason: string, context: Readonly<StyleResolutionContext>): Error {
  return layoutDiagnostic({ component: context.component, property, value, algorithm: context.algorithm, constraints: context.constraints, reason });
}
