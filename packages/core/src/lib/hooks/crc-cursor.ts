import { crcEvent } from './crc-event.js';
import { GLOBAL_STATE } from '../global-state.js';

interface CursorSlot {
  canvas: HTMLCanvasElement | undefined;
  ownedStyle: string | undefined;
}

function releaseCursor(slot: CursorSlot): void {
  const { canvas, ownedStyle } = slot;
  if (canvas && ownedStyle && canvas.style.cursor === ownedStyle) {
    canvas.style.removeProperty('cursor');
  }
  slot.canvas = undefined;
  slot.ownedStyle = undefined;
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
    slot = { canvas: undefined, ownedStyle: undefined };
    componentRefs.refs[hookIndex] = slot;
    componentRefs.teardowns.add(() => {
      if (slot) {
        releaseCursor(slot);
      }
      componentRefs.refs[hookIndex] = null;
    });
  } else if (!slot) {
    throw new Error(`CRC cursor hook slot ${hookIndex} is unavailable`);
  }

  releaseCursor(slot);

  crcEvent(
    'mousemove',
    style ?
        (e) => {
          const canvas = e.originalEvent.target as HTMLCanvasElement;
          if (!canvas.style.cursor) {
            // If something has already set it, don't confuse it.
            canvas.style.cursor = style;
            if (canvas.style.cursor) {
              slot.canvas = canvas;
              slot.ownedStyle = canvas.style.cursor;
            }
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
          if (slot.canvas === canvas) {
            releaseCursor(slot);
          }
        } :
      undefined,
    path,
    fill,
    lineInteractionWidth,
  );
}
