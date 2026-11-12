import { markVolatileAllocationQuery } from './allocation-checkpoint.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { RenderingContext2D, CanvasMeasurementService } from '../types.js';

/** Matches the existing retained Text metric policy; application faces are external inputs. */
export function isGenericCanvasFont(font: string): boolean {
  return /^(?:(?:bold|italic|normal) )?\d+(?:\.\d+)?px (?:sans-serif|serif|monospace)$/.test(font);
}

const serviceContexts = new WeakMap<CanvasMeasurementService, RenderingContext2D>();

/** @internal Pure Canvas metrics with explicit state isolation. */
export function canvasMeasurementService(
  context: RenderingContext2D,
): CanvasMeasurementService {
  const service: CanvasMeasurementService = {
    measureText(text: string, font: string): TextMetrics {
      if (!isGenericCanvasFont(font)) markVolatileAllocationQuery();
      context.save();
      try {
        context.font = font;
        return context.measureText(text);
      } finally {
        context.restore();
      }
    },
    measureTextAtBaseline(
      text: string,
      options: Readonly<{ font: string; textBaseline: CanvasTextBaseline }>,
    ): TextMetrics {
      if (!isGenericCanvasFont(options.font)) markVolatileAllocationQuery();
      context.save();
      try {
        context.font = options.font;
        context.textBaseline = options.textBaseline;
        return context.measureText(text);
      } finally {
        context.restore();
      }
    },
  };
  serviceContexts.set(service, context);
  return service;
}

/** Internal wrappers are equivalent only when they target the same Canvas.
 * Pure measurement clears render state, so compare the bound targets directly.
 * Independent custom services retain strict identity semantics.
 */
export function sameCanvasMeasurementService(left: CanvasMeasurementService, right: CanvasMeasurementService): boolean {
  if (left === right) return true;
  const context = serviceContexts.get(left);
  return context !== undefined && context === serviceContexts.get(right);
}

export function isCurrentCanvasMeasurementService(service: CanvasMeasurementService): boolean {
  return GLOBAL_STATE.renderContext !== undefined && serviceContexts.get(service) === GLOBAL_STATE.renderContext;
}
function currentCanvasMeasurementService(): CanvasMeasurementService {
  const context = GLOBAL_STATE.renderContext;
  if (!context) throw new Error('A mounted measurement replay requires its current Canvas context.');
  return canvasMeasurementService(context);
}
/** Avoid retaining a previous frame's temporary Canvas measurement target. */
export function bindCanvasMeasurementService(service: CanvasMeasurementService): () => CanvasMeasurementService {
  return isCurrentCanvasMeasurementService(service) ? currentCanvasMeasurementService : () => service;
}
