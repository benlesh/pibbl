import { describe, expect, it } from 'vitest';
import {
  PIBBL_EVENT_TYPES,
  getPibblEventDefinition,
} from './event-definitions';
import type {
  PibblEventHandlers,
  PibblEventMap,
  PibblInputEvent,
  PibblPointerEvent,
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

const handlers: PibblEventHandlers = {
  onPointerDownCapture(event) {
    const pointer: PibblPointerEvent = event;
    void pointer;
  },
  onBeforeInput(event) {
    const input: PibblInputEvent = event;
    void input;
  },
};
void handlers;

type Assert<T extends true> = T;
type KeypressIsNotAnEvent = Assert<
  'keypress' extends keyof PibblEventMap ? false : true
>;
const keypressIsNotAnEvent: KeypressIsNotAnEvent = true;
void keypressIsNotAnEvent;

describe('Pibbl event definitions', () => {
  it('freezes the DOM-aligned event vocabulary', () => {
    expect(PIBBL_EVENT_TYPES).toEqual(EXPECTED_TYPES);
    expect(getPibblEventDefinition('pointerenter')).toMatchObject({
      bubbles: false,
    });
    expect(getPibblEventDefinition('focusin')).toMatchObject({ bubbles: true });
    expect(getPibblEventDefinition('keypress' as never)).toBeUndefined();
  });
});
