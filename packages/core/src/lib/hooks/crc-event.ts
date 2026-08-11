import { GLOBAL_STATE } from '../global-state.js';
import { CRCEventRegistry, CRCMouseEventListener } from '../types.js';
import { getMouseCoordinates } from '../util/get-mouse-coordinates.js';
import { isHit } from '../util/is-hit.js';

interface CRCEventSlot {
  cleanup: (() => void) | undefined;
  isOver: boolean;
}

export function crcEvent<K extends keyof CRCEventRegistry>(
  type: K,
  handler?: CRCMouseEventListener,
  path?: Path2D,
  fill = false,
  lineInteractionWidth = 0,
): void {
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  let slot = componentRefs.refs[hookIndex] as CRCEventSlot | undefined;

  if (GLOBAL_STATE.componentIsMounting) {
    slot = { cleanup: undefined, isOver: false };
    componentRefs.refs[hookIndex] = slot;
    componentRefs.teardowns.add(() => {
      slot?.cleanup?.();
      if (slot) {
        slot.cleanup = undefined;
        slot.isOver = false;
      }
      componentRefs.refs[hookIndex] = null;
    });
  } else if (!slot) {
    throw new Error(`CRC event hook slot ${hookIndex} is unavailable`);
  }

  slot.cleanup?.();
  slot.cleanup = undefined;

  if (!handler) {
    slot.isOver = false;
    return;
  }

  const transform = GLOBAL_STATE.renderContext!.getTransform();
  const currentClippingStack = Array.from(GLOBAL_STATE.clippingStack);

  if (type === 'mouseover' || type === 'mouseout') {
    const mouseMoveHandlers = GLOBAL_STATE.currentCRCInstance!.events.mousemove;
    const overOrOutMoveHandler = (event: MouseEvent) => {
      const canvas = event.target as HTMLCanvasElement;
      const wasOver = slot.isOver;
      const [x, y] = getMouseCoordinates(event);

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
      slot.isOver = nowOver;

      if (type === 'mouseover') {
        if (!wasOver && nowOver) {
          handler({ originalEvent: event, x, y });
        }
      } else if (wasOver && !nowOver) {
        handler({ originalEvent: event, x, y });
      }
    };

    mouseMoveHandlers.add(overOrOutMoveHandler);

    const mouseOutHandlers = GLOBAL_STATE.currentCRCInstance!.events.mouseout;
    const canvasMouseOutHandler = (event: MouseEvent) => {
      const wasOver = slot.isOver;
      slot.isOver = false;
      if (type === 'mouseout' && wasOver) {
        const [x, y] = getMouseCoordinates(event);
        handler({ originalEvent: event, x, y });
      }
    };

    mouseOutHandlers.add(canvasMouseOutHandler);

    slot.cleanup = () => {
      mouseOutHandlers.delete(canvasMouseOutHandler);
      mouseMoveHandlers.delete(overOrOutMoveHandler);
    };
    return;
  }

  const handlers = GLOBAL_STATE.currentCRCInstance!.events[type];
  const actualHandler = (event: MouseEvent) => {
    const canvas = event.target as HTMLCanvasElement;
    const [x, y] = getMouseCoordinates(event);
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
      handler({ originalEvent: event, x, y });
    }
  };
  handlers.add(actualHandler);

  slot.cleanup = () => {
    handlers.delete(actualHandler);
  };
}
