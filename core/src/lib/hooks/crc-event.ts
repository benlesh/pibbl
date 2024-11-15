import { GLOBAL_STATE } from '../global-state';
import { CRCEventRegistry, CRCMouseEventListener } from '../types';
import { isHit } from '../util/is-hit';

export function crcEvent<K extends keyof CRCEventRegistry>(
  type: K,
  handler?: CRCMouseEventListener,
  path?: Path2D,
  fill = false,
  lineInteractionWidth = 0
) {
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const componentRefs = GLOBAL_STATE.componentRefs!;

  if (!GLOBAL_STATE.componentIsMounting) {
    componentRefs.refs[hookIndex]?.cleanup?.();
  }

  if (handler) {
    const transform = GLOBAL_STATE.renderContext!.getTransform();
    const currentClippingStack = Array.from(GLOBAL_STATE.clippingStack);

    if (type === 'mouseover' || type === 'mouseout') {
      if (!componentRefs.refs[hookIndex]) {
        componentRefs.refs[hookIndex] = { isOver: false, cleanup: null };
      }
      const state = componentRefs.refs[hookIndex];

      const mouseMoveHandlers =
        GLOBAL_STATE.currentCRCInstance!.events.mousemove;
      const overOrOutMoveHandler = (e: MouseEvent) => {
        const canvas = e.target as HTMLCanvasElement;
        const wasOver = state.isOver;
        const [x, y] = getMouseCoordinates(e);

        const nowOver =
          !path ||
          isHit({
            canvas,
            path,
            transform,
            x,
            y,
            fill,
            lineInteractionWidth,
            currentClippingStack,
          });
        state.isOver = nowOver;

        if (type === 'mouseover') {
          if (!wasOver && nowOver) {
            handler({ originalEvent: e, x, y });
          }
        } else if (type === 'mouseout') {
          if (wasOver && !nowOver) {
            handler({ originalEvent: e, x, y });
          }
        }
      };

      mouseMoveHandlers.add(overOrOutMoveHandler);

      const mouseOutHandlers = GLOBAL_STATE.currentCRCInstance!.events.mouseout;
      const canvasMouseOutHandler = (e: MouseEvent) => {
        const wasOver = state.isOver;
        state.isOver = false;
        if (type === 'mouseout' && wasOver) {
          const [x, y] = getMouseCoordinates(e);
          handler({ originalEvent: e, x, y });
        }
      };

      mouseOutHandlers.add(canvasMouseOutHandler);

      state.cleanup = () => {
        mouseOutHandlers.delete(canvasMouseOutHandler);
        mouseMoveHandlers.delete(overOrOutMoveHandler);
      };

      componentRefs.teardowns.add(() => {
        state.cleanup();
        componentRefs.refs[hookIndex] = null;
      });
    } else {
      const handlers = GLOBAL_STATE.currentCRCInstance!.events[type];
      const actualHandler = (e: MouseEvent) => {
        const canvas = e.target as HTMLCanvasElement;
        const [x, y] = getMouseCoordinates(e);
        if (
          !path ||
          isHit({
            canvas,
            path,
            transform,
            x,
            y,
            fill,
            lineInteractionWidth,
            currentClippingStack,
          })
        ) {
          handler({ originalEvent: e, x, y });
        }
      };
      handlers.add(actualHandler);

      const cleanup = () => handlers.delete(actualHandler);
      GLOBAL_STATE.componentRefs!.refs[hookIndex] = { cleanup };
    }
  } else {
    GLOBAL_STATE.componentRefs!.refs[hookIndex] = null;
  }
}
