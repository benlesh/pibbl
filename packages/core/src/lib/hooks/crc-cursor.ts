import { getInteractionRoot } from '../global-state.js';
import {
  refreshCursorDefault,
  removeCursorDefault,
  updateCursorDefault,
} from '../interaction-dispatch.js';
import type {
  CRCCursorDefault,
  CRCInteractionRegion,
} from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';
import { createRegion, releaseRegion, updateRegion } from './crc-region.js';

interface CRCCursorDefaultSlot {
  cursorDefault: CRCCursorDefault;
  region: CRCInteractionRegion;
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
  const { crcInstance } = requireHookContext();
  const interactionRoot = getInteractionRoot(crcInstance);
  const slot = useHookSlot<CRCCursorDefaultSlot>('cursor', teardowns => {
    const cursorDefault = { style: '' };
    const region = createRegion(crcInstance);
    teardowns.add(() => {
      removeCursorDefault(interactionRoot, cursorDefault);
      releaseRegion(crcInstance, region);
    });
    return { cursorDefault, region };
  });

  const { cursorDefault, region } = slot.value;
  if (path) {
    removeCursorDefault(interactionRoot, cursorDefault);
    updateRegion(crcInstance, region, {
      handlers: {},
      path,
      cursor: style,
      fill,
      lineInteractionWidth,
    });
    return;
  }

  releaseRegion(crcInstance, region);
  interactionRoot.cursorDefaults.delete(cursorDefault);
  if (!style) {
    removeCursorDefault(interactionRoot, cursorDefault);
    return;
  }

  cursorDefault.style = style;
  interactionRoot.cursorDefaults.add(cursorDefault);
  updateCursorDefault(interactionRoot, cursorDefault);
  refreshCursorDefault(interactionRoot);
}
