import { crcRegion } from '../hooks/crc-region.js';
import { CRCBasicMouseEvents } from '../types.js';

export function wireCommonEvents(
  props: CRCBasicMouseEvents,
  path: Path2D | undefined,
  fill: boolean,
  lineInteractionWidth: number,
  cursor: string | undefined,
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

  crcRegion({
    handlers: {
      click: onClick,
      contextmenu: onContextMenu,
      dblclick: onDblClick,
      mousemove: onMouseMove,
      mousedown: onMouseDown,
      mouseup: onMouseUp,
      mouseover: onMouseOver,
      mouseout: onMouseOut,
    },
    path,
    cursor,
    fill,
    lineInteractionWidth,
  });
}
