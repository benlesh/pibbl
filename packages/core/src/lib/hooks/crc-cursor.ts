import { crcEvent } from './crc-event.js';
import { GLOBAL_STATE } from '../global-state.js';

interface CursorSlot {
  canvas: HTMLCanvasElement | undefined;
}

/**
 * Hook: For wiring up changes to the CSS cursor style while over a corresponding path.
 * NOTE: If the path reference changes between, the click event will be
 * torn down and re-registered. Be sure use the same instance of a Path if
 * it doesn't change. {@link crcMemo} may be useful for this.
 */
export function crcCursor({
  path,
  style,
  fill = false,
  lineInteractionWidth = 0,
}: {
  path?: Path2D;
  style?: string;
  fill?: boolean;
  lineInteractionWidth?: number;
}): void {
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  let slot = componentRefs.refs[hookIndex] as CursorSlot | undefined;

  if (GLOBAL_STATE.componentIsMounting) {
    slot = { canvas: undefined };
    componentRefs.refs[hookIndex] = slot;
    componentRefs.teardowns.add(() => {
      slot?.canvas?.style.removeProperty('cursor');
      if (slot) {
        slot.canvas = undefined;
      }
      componentRefs.refs[hookIndex] = null;
    });
  } else if (!slot) {
    throw new Error(`CRC cursor hook slot ${hookIndex} is unavailable`);
  }

  slot.canvas?.style.removeProperty('cursor');
  slot.canvas = undefined;

  crcEvent(
    'mousemove',
    style ?
        (e) => {
          const canvas = e.originalEvent.target as HTMLCanvasElement;
          if (!canvas.style.cursor) {
            // If something has already set it, don't confuse it.
            canvas.style.cursor = style;
            slot.canvas = canvas;
          }
        } :
      undefined,
    path,
    fill,
    lineInteractionWidth,
  );

  crcEvent(
    'mouseout',
    style ?
        (e) => {
          const canvas = e.originalEvent.target as HTMLCanvasElement;
          canvas.style.removeProperty('cursor');
          if (slot.canvas === canvas) {
            slot.canvas = undefined;
          }
        } :
      undefined,
    path,
    fill,
    lineInteractionWidth,
  );
}
