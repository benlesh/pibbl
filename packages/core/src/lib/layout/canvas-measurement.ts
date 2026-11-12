import { GLOBAL_STATE } from '../global-state.js';
import type { RenderingContext2D, CanvasMeasurementService } from '../types.js';

const serviceContexts = new WeakMap<CanvasMeasurementService, RenderingContext2D>();

/** @internal Pure Canvas metrics with explicit state isolation. */
export function canvasMeasurementService(
  context: RenderingContext2D,
): CanvasMeasurementService {
  const service: CanvasMeasurementService = {
    measureText(text: string, font: string): TextMetrics {
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
