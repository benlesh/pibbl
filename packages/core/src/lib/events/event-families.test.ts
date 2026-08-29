import { afterEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEventListener } from '../hooks/crc-event-listener';
import { crcEventTarget } from '../hooks/crc-event-target';
import {
  classifyNativeEventType,
  dispatchToLogicalTarget,
} from './dispatch';
import { CRC_EVENT_TYPES } from './event-definitions';
import type { CRCEventNode } from './registrations';
import type {
  CRCClipboardEvent,
  CRCCompositionEvent,
  CRCDragEvent,
  CRCEventTarget,
  CRCEventType,
  CRCFocusEvent,
  CRCInputEvent,
  CRCKeyboardEvent,
  CRCTouchEvent,
} from './types';

type ExplicitDispatch = (
  type: CRCEventType,
  target: CRCEventNode,
  originalEvent: Event,
  relatedTarget?: CRCEventNode | null,
) => unknown;

type NativeEventRoute =
  | 'clipboard'
  | 'drag'
  | 'editing'
  | 'keyboard-focus'
  | 'mouse'
  | 'pointer'
  | 'touch'
  | 'wheel';

const explicitTargetDispatch = dispatchToLogicalTarget as ExplicitDispatch;

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('touch event dispatch', () => {
  it('retains each contact target through move and end and releases it on end or cancel', async () => {
    const trace: string[] = [];
    const Target = defineComp<{ label: string; x: number }>(({ label, x }) => {
      const record = (event: CRCTouchEvent) => {
        trace.push(
          `${label}:${event.type}:${touchIdentifiers(event.changedTouches).join(',')}:${event.x},${event.y}`,
        );
      };
      crcEventTarget({
        onTouchStart: record,
        onTouchMove: record,
        onTouchEnd: record,
        onTouchCancel: record,
      }, {
        path: rectanglePath(x, 0, 50, 50),
        fill: true,
      });
    });
    const Root = defineComp(() => [
      Target({ label: 'a', x: 0 }),
      Target({ label: 'b', x: 50 }),
    ]);
    const canvas = createCanvas();
    crc(canvas, Root({}));
    await nextFrame();

    const startOne = createTouch(canvas, 1, 20, 20);
    dispatchTouch(canvas, 'touchstart', [startOne], [startOne]);
    const moveOne = createTouch(canvas, 1, 80, 20);
    dispatchTouch(canvas, 'touchmove', [moveOne], [moveOne]);
    dispatchTouch(canvas, 'touchend', [], [moveOne]);
    dispatchTouch(canvas, 'touchmove', [moveOne], [moveOne]);

    const startTwo = createTouch(canvas, 2, 20, 20);
    dispatchTouch(canvas, 'touchstart', [startTwo], [startTwo]);
    const cancelTwo = createTouch(canvas, 2, 80, 20);
    dispatchTouch(canvas, 'touchcancel', [], [cancelTwo]);
    dispatchTouch(canvas, 'touchmove', [cancelTwo], [cancelTwo]);

    expect(trace).toEqual([
      'a:touchstart:1:20,20',
      'a:touchmove:1:80,20',
      'a:touchend:1:80,20',
      'a:touchstart:2:20,20',
      'a:touchcancel:2:80,20',
    ]);
  });

  it('groups changed contacts by retained target while preserving native lists and observing once', async () => {
    const groups: Array<{
      label: string;
      x: number;
      changedTouches: TouchList;
      targetTouches: TouchList;
      touches: TouchList;
    }> = [];
    const Target = defineComp<{ label: string; x: number }>(({ label, x }) => {
      const record = (event: CRCTouchEvent) => groups.push({
        label,
        x: event.x,
        changedTouches: event.changedTouches,
        targetTouches: event.targetTouches,
        touches: event.touches,
      });
      crcEventTarget({
        onTouchStart: record,
        onTouchMove: record,
      }, {
        path: rectanglePath(x, 0, 50, 50),
        fill: true,
      });
    });
    const Root = defineComp(() => [
      Target({ label: 'a', x: 0 }),
      Target({ label: 'b', x: 50 }),
    ]);
    const canvas = createCanvas();
    crc(canvas, Root({}));
    await nextFrame();

    const observer = vi.fn();
    getCRCInstance(canvas).eventRoot.observers.get('touchstart')!.add(observer);
    const changed = [
      createTouch(canvas, 1, 10, 20),
      createTouch(canvas, 2, 30, 20),
      createTouch(canvas, 3, 75, 20),
    ];
    const nativeEvent = dispatchTouch(
      canvas,
      'touchstart',
      changed,
      changed,
    );

    expect(groups.map(({ label, x }) => ({ label, x }))).toEqual([
      { label: 'a', x: 10 },
      { label: 'b', x: 75 },
    ]);
    for (const group of groups) {
      expect(group.touches).toBe(nativeEvent.touches);
      expect(group.targetTouches).toBe(nativeEvent.targetTouches);
      expect(group.changedTouches).toBe(nativeEvent.changedTouches);
      expect(touchIdentifiers(group.changedTouches)).toEqual([1, 2, 3]);
    }
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(nativeEvent);

    groups.length = 0;
    const moved = [
      createTouch(canvas, 1, 70, 20),
      createTouch(canvas, 2, 90, 20),
      createTouch(canvas, 3, 20, 20),
    ];
    dispatchTouch(canvas, 'touchmove', moved, moved);
    expect(groups.map(({ label, x }) => ({ label, x }))).toEqual([
      { label: 'a', x: 70 },
      { label: 'b', x: 20 },
    ]);
  });
});

describe('non-coordinate logical transport', () => {
  it('projects keyboard fields and modifiers to an explicit target', async () => {
    let received: CRCKeyboardEvent | undefined;
    const { target } = await mountExplicitTarget({
      onKeyDown: event => received = event,
    });
    const originalEvent = new KeyboardEvent('keydown', {
      altKey: true,
      code: 'KeyK',
      ctrlKey: true,
      isComposing: true,
      key: 'k',
      location: KeyboardEvent.DOM_KEY_LOCATION_RIGHT,
      metaKey: false,
      repeat: true,
      shiftKey: true,
    });

    explicitTargetDispatch(
      'keydown',
      target,
      originalEvent,
    );

    expect(received).toMatchObject({
      altKey: true,
      code: 'KeyK',
      ctrlKey: true,
      isComposing: true,
      key: 'k',
      location: KeyboardEvent.DOM_KEY_LOCATION_RIGHT,
      metaKey: false,
      originalEvent,
      repeat: true,
      shiftKey: true,
      type: 'keydown',
    });
  });

  it('preserves a logical related target for explicit focus dispatch', async () => {
    let received: CRCFocusEvent | undefined;
    const Target = defineComp<{ label: string }>(({ label }) => {
      crcEventTarget({
        onFocusOut: label === 'a' ? event => received = event : () => undefined,
      }, {
        path: rectanglePath(label === 'a' ? 0 : 50, 0, 50, 50),
        fill: true,
      });
    });
    const Root = defineComp(() => [
      Target({ label: 'a' }),
      Target({ label: 'b' }),
    ]);
    const canvas = createCanvas();
    crc(canvas, Root({}));
    await nextFrame();
    const [targetA, targetB] = Array.from(
      getCRCInstance(canvas).eventRoot.targets,
    );
    const originalEvent = new FocusEvent('focusout', { bubbles: true });

    explicitTargetDispatch(
      'focusout',
      targetA,
      originalEvent,
      targetB,
    );

    expect(received).toMatchObject({
      originalEvent,
      relatedTarget: targetB.publicTarget,
      target: targetA.publicTarget,
      type: 'focusout',
    });
  });

  it('projects input and composition fields and transports plain editing events', async () => {
    const inputEvents: CRCInputEvent[] = [];
    const compositionEvents: CRCCompositionEvent[] = [];
    const plainTypes: string[] = [];
    const { target } = await mountExplicitTarget({
      onBeforeInput: event => inputEvents.push(event),
      onInput: event => inputEvents.push(event),
      onChange: event => plainTypes.push(event.type),
      onCompositionStart: event => compositionEvents.push(event),
      onCompositionUpdate: event => compositionEvents.push(event),
      onCompositionEnd: event => compositionEvents.push(event),
      onSelect: event => plainTypes.push(event.type),
      onSelectionChange: event => plainTypes.push(event.type),
    });
    const dataTransfer = createDataTransfer('input payload');
    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: 'before',
      dataTransfer,
      inputType: 'insertFromPaste',
      isComposing: true,
    });
    const input = new InputEvent('input', {
      bubbles: true,
      data: 'after',
      dataTransfer,
      inputType: 'insertText',
      isComposing: false,
    });

    explicitDispatch('beforeinput', target, beforeInput);
    explicitDispatch('input', target, input);
    explicitDispatch('change', target, new Event('change', { bubbles: true }));
    for (const [type, data] of [
      ['compositionstart', 's'],
      ['compositionupdate', 'u'],
      ['compositionend', 'e'],
    ] as const) {
      explicitDispatch(
        type,
        target,
        new CompositionEvent(type, { bubbles: true, data }),
      );
    }
    explicitDispatch('select', target, new Event('select', { bubbles: true }));
    explicitDispatch(
      'selectionchange',
      target,
      new Event('selectionchange'),
    );

    expect(inputEvents).toHaveLength(2);
    expect(inputEvents[0]).toMatchObject({
      data: 'before',
      dataTransfer,
      inputType: 'insertFromPaste',
      isComposing: true,
      originalEvent: beforeInput,
      type: 'beforeinput',
    });
    expect(inputEvents[1]).toMatchObject({
      data: 'after',
      dataTransfer,
      inputType: 'insertText',
      isComposing: false,
      originalEvent: input,
      type: 'input',
    });
    expect(compositionEvents.map(event => [event.type, event.data])).toEqual([
      ['compositionstart', 's'],
      ['compositionupdate', 'u'],
      ['compositionend', 'e'],
    ]);
    expect(plainTypes).toEqual(['change', 'select', 'selectionchange']);
  });

  it('projects clipboard data unchanged to an explicit target', async () => {
    let received: CRCClipboardEvent | undefined;
    const { target } = await mountExplicitTarget({
      onPaste: event => received = event,
    });
    const clipboardData = createDataTransfer('clipboard payload');
    const originalEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });

    explicitDispatch('paste', target, originalEvent);

    expect(received).toMatchObject({
      clipboardData,
      originalEvent,
      type: 'paste',
    });
  });

  it('routes native keyboard, focus, editing, and clipboard input only to Canvas observers without focus policy', async () => {
    const logical: string[] = [];
    const Target = defineComp(() => {
      crcEventTarget({
        onKeyDown: event => logical.push(event.type),
        onFocus: event => logical.push(event.type),
        onBeforeInput: event => logical.push(event.type),
        onCompositionStart: event => logical.push(event.type),
        onPaste: event => logical.push(event.type),
      }, {
        path: rectanglePath(0, 0, 100, 100),
        fill: true,
      });
    });
    const canvas = createCanvas();
    crc(canvas, Target({}));
    await nextFrame();
    const observed: string[] = [];
    const eventRoot = getCRCInstance(canvas).eventRoot;
    const nativeEvents = [
      new KeyboardEvent('keydown', { key: 'x' }),
      new FocusEvent('focus'),
      new InputEvent('beforeinput', { data: 'x' }),
      new CompositionEvent('compositionstart', { data: 'x' }),
      new ClipboardEvent('paste'),
    ];
    for (const event of nativeEvents) {
      eventRoot.observers.get(event.type as CRCEventType)!.add(
        observedEvent => observed.push(observedEvent.type),
      );
      canvas.dispatchEvent(event);
    }

    expect(logical).toEqual([]);
    expect(observed).toEqual([
      'keydown',
      'focus',
      'beforeinput',
      'compositionstart',
      'paste',
    ]);
  });
});

describe('drag event dispatch', () => {
  it('projects coordinate, modifier, and data-transfer fields unchanged', async () => {
    let received: CRCDragEvent | undefined;
    const Target = defineComp(() => {
      crcEventTarget({ onDragStart: event => received = event }, {
        path: rectanglePath(0, 0, 100, 100),
        fill: true,
      });
    });
    const canvas = createCanvas(200);
    crc(canvas, Target({}));
    await nextFrame();
    const dataTransfer = createDataTransfer('drag payload');
    const originalEvent = dispatchDrag(canvas, 'dragstart', 50, 70, {
      altKey: true,
      ctrlKey: true,
      dataTransfer,
      metaKey: false,
      shiftKey: true,
    });

    expect(received).toMatchObject({
      altKey: true,
      ctrlKey: true,
      dataTransfer,
      metaKey: false,
      originalEvent,
      shiftKey: true,
      type: 'dragstart',
      x: 25,
      y: 35,
    });
  });

  it('derives sibling drag boundaries by path difference and propagates them', async () => {
    const trace: string[] = [];
    let targetA: CRCEventTarget | undefined;
    let targetB: CRCEventTarget | undefined;
    const relatedLabel = (event: CRCDragEvent) =>
      event.relatedTarget === targetA ? 'a' :
        event.relatedTarget === targetB ? 'b' : 'none';
    const Target = defineComp<{ label: string; x: number }>(({ label, x }) => {
      crcEventTarget({
        onDragEnter: event => trace.push(
          `${label}-enter:${event.eventPhase}:${relatedLabel(event)}`,
        ),
        onDragLeave: event => trace.push(
          `${label}-leave:${event.eventPhase}:${relatedLabel(event)}`,
        ),
        onDragOver: event => trace.push(
          `${label}-over:${event.eventPhase}`,
        ),
      }, {
        path: rectanglePath(x, 0, 50, 50),
        fill: true,
      });
    });
    const Parent = defineComp(() => {
      crcEventListener({
        onDragEnter: event => trace.push(
          `parent-enter:${event.eventPhase}:${relatedLabel(event)}`,
        ),
        onDragLeave: event => trace.push(
          `parent-leave:${event.eventPhase}:${relatedLabel(event)}`,
        ),
        onDragOver: event => trace.push(`parent-over:${event.eventPhase}`),
      });
      return [
        Target({ label: 'a', x: 0 }),
        Target({ label: 'b', x: 50 }),
      ];
    });
    const canvas = createCanvas();
    crc(canvas, Parent({}));
    await nextFrame();
    [targetA, targetB] = Array.from(getCRCInstance(canvas).eventRoot.targets)
      .map(target => target.publicTarget);

    dispatchDrag(canvas, 'dragover', 25, 25);
    trace.length = 0;
    dispatchDrag(canvas, 'dragover', 75, 25);

    expect(trace).toEqual([
      'a-leave:2:b',
      'parent-leave:3:b',
      'b-enter:2:a',
      'parent-enter:3:a',
      'b-over:2',
      'parent-over:3',
    ]);
  });
});

describe('native event route exhaustiveness', () => {
  it('assigns every supported event type to exactly one explicit adapter route', () => {
    const expected = Object.freeze([
      ['pointer', [
        'pointerover', 'pointerenter', 'pointerdown', 'pointermove',
        'pointerrawupdate', 'pointerup', 'pointercancel', 'pointerout',
        'pointerleave', 'gotpointercapture', 'lostpointercapture',
      ]],
      ['mouse', [
        'click', 'dblclick', 'auxclick', 'contextmenu', 'mouseover',
        'mouseenter', 'mousedown', 'mousemove', 'mouseup', 'mouseout',
        'mouseleave',
      ]],
      ['touch', ['touchstart', 'touchmove', 'touchend', 'touchcancel']],
      ['wheel', ['wheel']],
      ['keyboard-focus', [
        'keydown', 'keyup', 'focus', 'blur', 'focusin', 'focusout',
      ]],
      ['editing', [
        'beforeinput', 'input', 'change', 'compositionstart',
        'compositionupdate', 'compositionend', 'select', 'selectionchange',
      ]],
      ['clipboard', ['copy', 'cut', 'paste']],
      ['drag', [
        'dragstart', 'drag', 'dragend', 'dragenter', 'dragleave',
        'dragover', 'drop',
      ]],
    ] as const satisfies readonly [NativeEventRoute, readonly CRCEventType[]][]);
    const expectedByType = new Map<CRCEventType, NativeEventRoute>();
    for (const [route, types] of expected) {
      for (const type of types) {
        expect(expectedByType.has(type), `${type} has one expected route`)
          .toBe(false);
        expectedByType.set(type, route);
      }
    }

    expect(Array.from(expectedByType.keys())).toEqual(CRC_EVENT_TYPES);
    expect(
      CRC_EVENT_TYPES.map(type => [
        type,
        classifyNativeEventType(type),
      ]),
    ).toEqual(
      CRC_EVENT_TYPES.map(type => [type, expectedByType.get(type)]),
    );
  });
});

async function mountExplicitTarget(
  handlers: Parameters<typeof crcEventTarget>[0],
): Promise<{ canvas: HTMLCanvasElement; target: CRCEventNode }> {
  const Target = defineComp(() => {
    crcEventTarget(handlers, {
      path: rectanglePath(0, 0, 100, 100),
      fill: true,
    });
  });
  const canvas = createCanvas();
  crc(canvas, Target({}));
  await nextFrame();
  return {
    canvas,
    target: Array.from(getCRCInstance(canvas).eventRoot.targets)[0],
  };
}

function explicitDispatch(
  type: CRCEventType,
  target: CRCEventNode,
  originalEvent: Event,
  relatedTarget?: CRCEventNode | null,
): void {
  explicitTargetDispatch(
    type,
    target,
    originalEvent,
    relatedTarget,
  );
}

function createDataTransfer(value: string): DataTransfer {
  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', value);
  return dataTransfer;
}

function createTouch(
  canvas: HTMLCanvasElement,
  identifier: number,
  x: number,
  y: number,
): Touch {
  const bounds = canvas.getBoundingClientRect();
  return new Touch({
    identifier,
    target: canvas,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    pageX: bounds.left + x,
    pageY: bounds.top + y,
    screenX: x,
    screenY: y,
  });
}

function dispatchTouch(
  canvas: HTMLCanvasElement,
  type: 'touchcancel' | 'touchend' | 'touchmove' | 'touchstart',
  touches: Touch[],
  changedTouches: Touch[],
): TouchEvent {
  const event = new TouchEvent(type, {
    altKey: true,
    bubbles: true,
    cancelable: type !== 'touchcancel',
    changedTouches,
    ctrlKey: false,
    metaKey: false,
    shiftKey: true,
    targetTouches: touches,
    touches,
  });
  canvas.dispatchEvent(event);
  return event;
}

function dispatchDrag(
  canvas: HTMLCanvasElement,
  type:
    | 'drag'
    | 'dragend'
    | 'dragenter'
    | 'dragleave'
    | 'dragover'
    | 'dragstart'
    | 'drop',
  x: number,
  y: number,
  init: DragEventInit = {},
): DragEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: type !== 'dragend' && type !== 'dragleave',
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    ...init,
  });
  canvas.dispatchEvent(event);
  return event;
}

function touchIdentifiers(touches: TouchList): number[] {
  return Array.from(touches, touch => touch.identifier);
}

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function createCanvas(cssSize = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = `display:block; width:${cssSize}px; height:${cssSize}px`;
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
