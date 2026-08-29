/**
 * Narrow compatibility surface for hooks that predate the shared event
 * dispatcher. Task 8 migrates the remaining call sites.
 */
export {
  refreshCursorDefault,
  refreshInteractionCursor,
  removeCursorDefault,
  removeInteractionRegion,
  updateCursorDefault,
} from './events/dispatch.js';
