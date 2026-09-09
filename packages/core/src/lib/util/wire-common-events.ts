import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import { crcPaintTarget } from '../hooks/crc-paint-target.js';

export function wireCommonEvents(
  props: CRCEventHandlers & CRCEventFocusOptions & CRCEventParticipationOptions,
  path: Path2D | undefined,
  fill: boolean,
  lineInteractionWidth: number,
  cursor: string | undefined,
  keyboardNavigationBounds?: CRCEventFocusOptions['keyboardNavigationBounds'],
): void {
  crcPaintTarget(props, {
    path: path ?? new Path2D(),
    cursor,
    fill,
    lineInteractionWidth,
    keyboardFocusable: props.keyboardFocusable,
    keyboardNavigationBounds:
      props.keyboardNavigationBounds ?? keyboardNavigationBounds,
  }, props.pointerEvents);
}
