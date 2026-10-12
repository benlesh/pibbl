import { getInteractionRoot } from '../global-state.js';
import type { PathGeometry } from '../geometry/path-geometry.js';
import {
  refreshCursorDefault,
  removeCursorDefault,
  updateCursorDefault,
} from '../events/dispatch.js';
import type {
  PibblCursorDefault,
  PibblInteractionRegion,
} from '../types.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';
import { createRegion, releaseRegion, updateRegion } from './use-region.js';

interface PibblCursorDefaultSlot {
  cursorDefault: PibblCursorDefault;
  region: PibblInteractionRegion;
}

/**
 * Hook: wires a CSS cursor to the same logical target resolver used by mouse
 * events. The cursor is released when this hook slot is replaced or removed.
 *
 * @param options - Cursor style and optional fill or stroke hit region for the current component.
 * See {@link PathGeometry} .
 *
 * @see {@link PathGeometry}
 */
export function useCursor({
  path,
  style,
  fill = false,
  lineInteractionWidth = 0,
}: {
  path?: Path2D | PathGeometry;
  style?: string;
  fill?: boolean;
  lineInteractionWidth?: number;
}): void {
  const { pibblInstance } = requireHookContext();
  const interactionRoot = getInteractionRoot(pibblInstance);
  const slot = useHookSlot<PibblCursorDefaultSlot>('cursor', teardowns => {
    const cursorDefault = { style: '' };
    const region = createRegion(pibblInstance);
    teardowns.add(() => {
      removeCursorDefault(interactionRoot, cursorDefault);
      releaseRegion(pibblInstance, region);
    });
    return { cursorDefault, region };
  });

  const { cursorDefault, region } = slot.value;
  if (path) {
    removeCursorDefault(interactionRoot, cursorDefault);
    updateRegion(pibblInstance, region, {
      path,
      cursor: style,
      fill,
      lineInteractionWidth,
    });
    return;
  }

  releaseRegion(pibblInstance, region);
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
