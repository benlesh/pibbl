import { describe, expect, it } from 'vitest';
import {
  CRC_EVENT_TYPES,
  getCRCEventDefinition,
} from './event-definitions';
import type {
  CRCEventHandlers,
  CRCEventMap,
  CRCInputEvent,
  CRCPointerEvent,
} from './types';

const EXPECTED_TYPES = [
  'pointerover',
  'pointerenter',
  'pointerdown',
  'pointermove',
  'pointerrawupdate',
  'pointerup',
  'pointercancel',
  'pointerout',
  'pointerleave',
  'gotpointercapture',
  'lostpointercapture',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'mouseover',
  'mouseenter',
  'mousedown',
  'mousemove',
  'mouseup',
  'mouseout',
  'mouseleave',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'wheel',
  'keydown',
  'keyup',
  'focus',
  'blur',
  'focusin',
  'focusout',
  'beforeinput',
  'input',
  'change',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'select',
  'selectionchange',
  'copy',
  'cut',
  'paste',
  'dragstart',
  'drag',
  'dragend',
  'dragenter',
  'dragleave',
  'dragover',
  'drop',
] as const;

const handlers: CRCEventHandlers = {
  onPointerDownCapture(event) {
    const pointer: CRCPointerEvent = event;
    void pointer;
  },
  onBeforeInput(event) {
    const input: CRCInputEvent = event;
    void input;
  },
};
void handlers;

type Assert<T extends true> = T;
type KeypressIsNotAnEvent = Assert<
  'keypress' extends keyof CRCEventMap ? false : true
>;
const keypressIsNotAnEvent: KeypressIsNotAnEvent = true;
void keypressIsNotAnEvent;

describe('CRC event definitions', () => {
  it('freezes the DOM-aligned event vocabulary', () => {
    expect(CRC_EVENT_TYPES).toEqual(EXPECTED_TYPES);
    expect(getCRCEventDefinition('pointerenter')).toMatchObject({
      bubbles: false,
    });
    expect(getCRCEventDefinition('focusin')).toMatchObject({ bubbles: true });
    expect(getCRCEventDefinition('keypress' as never)).toBeUndefined();
  });
});
