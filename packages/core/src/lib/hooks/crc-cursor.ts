import { getCurrentCRCInstance, GLOBAL_STATE } from '../global-state.js';
import {
  refreshCursorDefault,
  removeCursorDefault,
} from '../interaction-dispatch.js';
import type { CRCCursorDefault } from '../types.js';
import { crcRegion } from './crc-region.js';

interface CRCCursorDefaultSlot {
  cursorDefault: CRCCursorDefault;
}

/**
 * Hook: wires a CSS cursor to the same logical target resolver used by mouse
 * events. The cursor is released when this hook slot is replaced or removed.
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
  if (!path) {
    crcCursorDefault(style);
    return;
  }

  crcRegion({
    handlers: {},
    path,
    cursor: style,
    fill,
    lineInteractionWidth,
  });
}

function crcCursorDefault(style: string | undefined): void {
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const componentRefs = GLOBAL_STATE.componentRefs!;
  const instance = getCurrentCRCInstance();
  let slot = componentRefs.refs[hookIndex] as CRCCursorDefaultSlot | undefined;

  if (GLOBAL_STATE.componentIsMounting) {
    const cursorDefault = { style: '' };
    slot = { cursorDefault };
    componentRefs.refs[hookIndex] = slot;
    componentRefs.teardowns.add(() => {
      removeCursorDefault(instance, cursorDefault);
      componentRefs.refs[hookIndex] = null;
    });
  } else if (!slot) {
    throw new Error(`CRC cursor hook slot ${hookIndex} is unavailable`);
  }

  const { cursorDefault } = slot;
  instance.cursorDefaults.delete(cursorDefault);
  if (!style) {
    removeCursorDefault(instance, cursorDefault);
    return;
  }

  cursorDefault.style = style;
  instance.cursorDefaults.add(cursorDefault);
  refreshCursorDefault(instance, cursorDefault);
}
