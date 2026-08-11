import { crcRegion } from './crc-region.js';

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
  crcRegion({
    handlers: {},
    path,
    cursor: style,
    fill,
    lineInteractionWidth,
  });
}
