import { isSignal } from '../lib/signals/graph.js';
import { layoutDiagnostic } from '../lib/style/diagnostics.js';
import {
  CRC_FILTER_EXECUTOR,
  type CRCDisplacementFilterOptions,
  type CRCFilter,
  type CRCFilterExecutor,
  type PreparedCRCFilter,
} from '../lib/style/filter-types.js';
import type { StyleResolutionContext } from '../lib/types.js';
import { borrowTextureRaster, validateTexturePaint } from '../lib/textures/texture-protocol.js';
import { processDisplacement } from './render-displacement-boundary.js';
import { filterBoundaryExecutor, type CustomPreparedFilter } from './filter-executor.js';
import { expandDisplacementInput } from './displacement-math.js';

const definitions = new WeakMap<CRCFilter, Readonly<CRCDisplacementFilterOptions>>();
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
    try {
      validateTexturePaint(map);
      // Receiver preparation owns revision dependencies, before subtree execution
      // changes signal tracking to descendant consumers.
      if (strengthValue !== 0) borrowTextureRaster(map, () => undefined);
    }
    catch (error) {
      throw diagnostic(`${property}.map`, map, error instanceof Error ? error.message : String(error), context);
    }
    const region = Object.freeze({ x, y, width, height });
    return Object.freeze({
      executor: filterBoundaryExecutor,
      textureWarp: Object.freeze({ map, strength: strengthValue, region }),
      reverseInfluence: (output, density) => expandDisplacementInput(output, strengthValue, density),
      process: strengthValue === 0 ? undefined : (source, windows) => {
        try { return processDisplacement(source, windows, map, strengthValue, region); }
        catch (error) {
          const failure = diagnostic(property, { strength: strengthValue, region }, `displacement processing failed: ${error instanceof Error ? error.message : String(error)}`, context);
          Object.defineProperty(failure, 'cause', { value: error });
          throw failure;
        }
      },
    } satisfies CustomPreparedFilter);
  },
  render: filterBoundaryExecutor.render,
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
