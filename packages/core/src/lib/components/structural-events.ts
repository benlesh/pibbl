import type { CRCEventHandlers } from '../events/types.js';
import { crcEventListener } from '../hooks/crc-event-listener.js';

/** Event props shared by child-bearing Canvas built-ins. */
export interface CRCStructuralEventProps extends CRCEventHandlers {}

/** Registers a structural ancestor without creating hit-test geometry. */
export function wireStructuralEvents(handlers: CRCEventHandlers): void {
  crcEventListener(handlers);
}
