import { GLOBAL_STATE } from '../global-state.js';
import type { RenderingContext2D } from '../types.js';

const CRC_CANVAS_CONTEXT_ERROR =
  'useCanvasContext() is available only during CRC rendering and cannot be ' +
  'used during pure measurement.';

/** Returns the current component's isolated Canvas 2D context. */
export function useCanvasContext(): RenderingContext2D {
  const context = GLOBAL_STATE.renderContext;
  if (
    !context ||
    GLOBAL_STATE.backendDriver?.name !== 'canvas2d' ||
    !GLOBAL_STATE.componentRefs ||
    !GLOBAL_STATE.currentCRCInstance ||
    !GLOBAL_STATE.canvas
  ) {
    throw new Error(CRC_CANVAS_CONTEXT_ERROR);
  }
  return context;
}
