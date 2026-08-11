import { crcCursor } from '../hooks/crc-cursor.js';
import { crcEvent } from '../hooks/crc-event.js';
import { CRCBasicMouseEvents, CursorStyleProps } from '../types.js';

export function wireCommonEvents(
  props: CRCBasicMouseEvents & CursorStyleProps,
  path: Path2D | undefined,
  fill: boolean,
  lineInteractionWidth: number,
) {
  const {
    onClick,
    onContextMenu,
    onDblClick,
    onMouseMove,
    onMouseOut,
    onMouseOver,
    onMouseDown,
    onMouseUp,
  } = props;

  crcEvent('click', onClick, path, fill, lineInteractionWidth);
  crcEvent('contextmenu', onContextMenu, path, fill, lineInteractionWidth);
  crcEvent('dblclick', onDblClick, path, fill, lineInteractionWidth);
  crcEvent('mousemove', onMouseMove, path, fill, lineInteractionWidth);
  crcEvent('mousedown', onMouseDown, path, fill, lineInteractionWidth);
  crcEvent('mouseup', onMouseUp, path, fill, lineInteractionWidth);
  crcEvent('mouseover', onMouseOver, path, fill, lineInteractionWidth);
  crcEvent('mouseout', onMouseOut, path, fill, lineInteractionWidth);

  crcCursor({
    path,
    style: props.cursor,
    fill,
    lineInteractionWidth,
  });
}
