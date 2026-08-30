import type { CRCEventHandlers } from '../events/types.js';
import { crcEventTarget } from '../hooks/crc-event-target.js';

export function wireCommonEvents(
  props: CRCEventHandlers,
  path: Path2D | undefined,
  fill: boolean,
  lineInteractionWidth: number,
  cursor: string | undefined,
): void {
  crcEventTarget(props, {
    path: path ?? new Path2D(),
    cursor,
    fill,
    lineInteractionWidth,
  });
}
