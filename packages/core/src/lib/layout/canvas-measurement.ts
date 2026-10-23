import type { RenderingContext2D, CanvasMeasurementService } from '../types.js';

/** @internal Pure Canvas metrics with explicit state isolation. */
export function canvasMeasurementService(
  context: RenderingContext2D,
): CanvasMeasurementService {
  return {
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
}
