import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import type { CRCEventHandlers } from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEventTarget } from '../hooks/crc-event-target';
import { mountCRC } from '../mount-crc';
import type { CRCController } from '../types';
import type { CRCFocusManager } from './focus-manager';
import { withFocusManagement } from './with-focus-management';

const activeControllers = new Set<CRCController>();

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  for (const controller of activeControllers) controller.dispose();
  activeControllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('press-to-focus defaults', () => {
  it.each(['mouse', 'pen', 'touch'] as const)(
    'focuses a focusable target from a primary %s pointerdown with pointer modality',
    pointerType => {
      const mounted = mountScene();

      dispatchPointer(mounted.canvas, 1, 10, pointerType);

      expect(document.activeElement).toBe(mounted.canvas);
      expect(focusedLabel(mounted.manager)).toBe('focusable');
      expect(mounted.manager.snapshot(mounted.manager.candidates[0].target)).toEqual({
        isFocused: true,
        isFocusVisible: false,
      });
    },
  );

  it('publishes the intended target before synchronous Canvas focus dispatch', () => {
    const Root = defineComp(() => [
      Target({ key: 'first', label: 'first', x: 0, keyboardFocusable: true, handlers: {} }),
      Target({ key: 'pressed', label: 'pressed', x: 50, keyboardFocusable: true, handlers: {} }),
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({})));

    dispatchPointer(mounted.canvas, 7, 60, 'mouse');

    expect(document.activeElement).toBe(mounted.canvas);
    expect(focusedLabel(mounted.manager)).toBe('pressed');
  });

  it('runs after full propagation and honors prevention, handler errors, and target removal', () => {
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => reported.push(error));
    let prevent = true;
    let remove = false;
    let visible = true;
    let canvas!: HTMLCanvasElement;
    const Root = defineComp(() => visible ? Target({
      label: 'focusable', x: 0, keyboardFocusable: true,
      handlers: {
        onPointerDown: event => {
          if (remove) {
            visible = false;
            executeRender(canvas, 2, withFocusManagement(Root({})));
          }
          if (prevent) event.preventDefault();
          throw new Error('expected pointer handler failure');
        },
      },
    }) : undefined);
    canvas = createCanvas();
    const mounted = mountAndRender(withFocusManagement(Root({})), canvas);

    const prevented = dispatchPointer(canvas, 1, 10, 'mouse');
    expect(prevented.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(canvas);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();

    prevent = false;
    remove = true;
    dispatchPointer(canvas, 2, 10, 'mouse');
    expect(document.activeElement).toBe(canvas);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
    expect(reported).toHaveLength(2);
  });

  it('focuses the Canvas and clears logical focus on non-focusable geometry or background', () => {
    const mounted = mountScene();
    mounted.canvas.focus({ preventScroll: true });
    expect(focusedLabel(mounted.manager)).toBe('focusable');

    dispatchMouse(mounted.canvas, 60, 0);
    expect(document.activeElement).toBe(mounted.canvas);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();

    mounted.manager.setFocusState(mounted.manager.candidates[0].target, true);
    dispatchMouse(mounted.canvas, 95, 0);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
  });

  it('uses mouse and touchstart as fallbacks and deduplicates represented compatibility presses', () => {
    const mounted = mountScene();
    const focus = vi.spyOn(mounted.canvas, 'focus');

    dispatchPointer(mounted.canvas, 31, 10, 'touch');
    dispatchTouch(mounted.canvas, 31, 10);
    dispatchMouse(mounted.canvas, 10, 0);
    dispatchTouchSequence(
      mounted.canvas,
      'touchend',
      [{ identifier: 31, x: 10 }],
      [],
    );
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focusedLabel(mounted.manager)).toBe('focusable');

    mounted.canvas.blur();
    dispatchMouse(mounted.canvas, 10, 0);
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focusedLabel(mounted.manager)).toBe('focusable');

    mounted.canvas.blur();
    dispatchTouch(mounted.canvas, 44, 10);
    dispatchTouch(mounted.canvas, 44, 10);
    expect(focus).toHaveBeenCalledTimes(3);
    expect(focusedLabel(mounted.manager)).toBe('focusable');
  });

  it('keeps the first touch primary until every contact ends and permits its identifier in a later sequence', () => {
    const mounted = mountScene();
    const focus = vi.spyOn(mounted.canvas, 'focus');

    dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 1, x: 10 }],
      [{ identifier: 1, x: 10 }],
    );
    mounted.canvas.blur();
    dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 2, x: 60 }],
      [{ identifier: 1, x: 10 }, { identifier: 2, x: 60 }],
    );
    dispatchTouchSequence(
      mounted.canvas,
      'touchend',
      [{ identifier: 1, x: 10 }],
      [{ identifier: 2, x: 60 }],
    );
    dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 3, x: 10 }],
      [{ identifier: 2, x: 60 }, { identifier: 3, x: 10 }],
    );
    dispatchTouchSequence(
      mounted.canvas,
      'touchend',
      [{ identifier: 2, x: 60 }, { identifier: 3, x: 10 }],
      [],
    );
    dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 1, x: 10 }],
      [{ identifier: 1, x: 10 }],
    );

    expect(focus).toHaveBeenCalledTimes(2);
    expect(focusedLabel(mounted.manager)).toBe('focusable');
  });

  it('clears a canceled primary contact so the same identifier starts a new sequence', () => {
    const mounted = mountScene();
    const focus = vi.spyOn(mounted.canvas, 'focus');
    dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 9, x: 10 }],
      [{ identifier: 9, x: 10 }],
    );
    mounted.canvas.blur();

    dispatchTouchSequence(
      mounted.canvas,
      'touchcancel',
      [{ identifier: 9, x: 10 }],
      [],
    );
    dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 9, x: 10 }],
      [{ identifier: 9, x: 10 }],
    );

    expect(focus).toHaveBeenCalledTimes(2);
    expect(focusedLabel(mounted.manager)).toBe('focusable');
  });

  it('uses only the first simultaneous contact and honors prevention from a later target group', () => {
    let preventSecondary = false;
    const Root = defineComp(() => [
      Target({
        key: 'first', label: 'first', x: 0, keyboardFocusable: true,
        handlers: { onTouchStart: () => undefined },
      }),
      Target({
        key: 'second', label: 'second', x: 50, keyboardFocusable: true,
        handlers: {
          onTouchStart: event => {
            if (preventSecondary) event.preventDefault();
          },
        },
      }),
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({})));
    const first = dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 20, x: 10 }, { identifier: 21, x: 60 }],
      [{ identifier: 20, x: 10 }, { identifier: 21, x: 60 }],
    );
    expect(first.defaultPrevented).toBe(false);
    expect(focusedLabel(mounted.manager)).toBe('first');
    dispatchTouchSequence(
      mounted.canvas,
      'touchend',
      [{ identifier: 20, x: 10 }, { identifier: 21, x: 60 }],
      [],
    );
    mounted.canvas.blur();
    preventSecondary = true;

    const prevented = dispatchTouchSequence(
      mounted.canvas,
      'touchstart',
      [{ identifier: 22, x: 10 }, { identifier: 23, x: 60 }],
      [{ identifier: 22, x: 10 }, { identifier: 23, x: 60 }],
    );

    expect(prevented.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(mounted.canvas);
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
  });

  it('ignores non-primary presses and never uses pointer-capture routing as the focus target', () => {
    const mounted = mountScene();
    const [focusable, captured] = targetsByLabel(mounted.manager, 'focusable', 'captured');

    dispatchPointer(mounted.canvas, 50, 10, 'mouse', { isPrimary: false });
    dispatchPointer(mounted.canvas, 51, 10, 'mouse', { button: 1 });
    dispatchMouse(mounted.canvas, 10, 1);
    expect(document.activeElement).not.toBe(mounted.canvas);

    getCRCInstance(mounted.canvas).eventRoot.pointerCaptures.set(52, captured);
    dispatchPointer(mounted.canvas, 52, 10, 'mouse');
    expect(mounted.manager.resolveKeyboardTarget()).toBe(focusable);
  });

  it('clears logical state only after the native Canvas blur reaches its target', () => {
    const snapshots: boolean[] = [];
    let manager!: CRCFocusManager;
    const Root = defineComp(() => Target({
      label: 'focusable', x: 0, keyboardFocusable: true,
      handlers: {
        onBlur: () => snapshots.push(Boolean(manager.resolveKeyboardTarget())),
      },
    }));
    const mounted = mountAndRender(withFocusManagement(Root({})));
    manager = mounted.manager;
    mounted.canvas.focus({ preventScroll: true });

    mounted.canvas.blur();

    expect(snapshots[0]).toBe(true);
    expect(manager.resolveKeyboardTarget()).toBeUndefined();
  });
});

interface TargetProps {
  readonly label: string;
  readonly x: number;
  readonly keyboardFocusable: boolean;
  readonly handlers: CRCEventHandlers;
}

const Target = defineComp<TargetProps>(({
  x,
  keyboardFocusable,
  handlers,
}) => {
  crcEventTarget(handlers, {
    path: rectanglePath(x, 0, 40, 40),
    fill: true,
    keyboardFocusable,
  });
});

function mountScene() {
  const Root = defineComp(() => [
    Target({ key: 'focusable', label: 'focusable', x: 0, keyboardFocusable: true, handlers: {} }),
    Target({
      key: 'captured', label: 'captured', x: 50, keyboardFocusable: false,
      handlers: { onPointerDown: () => undefined, onMouseDown: () => undefined },
    }),
  ]);
  return mountAndRender(withFocusManagement(Root({})));
}

function mountAndRender(element: ReturnType<typeof withFocusManagement>, canvas = createCanvas()) {
  const controller = mountCRC(canvas, element);
  activeControllers.add(controller);
  executeRender(canvas, 1);
  const manager = getCRCInstance(canvas).eventRoot.focusPolicy as CRCFocusManager | undefined;
  if (!manager) throw new Error('Expected a focus manager.');
  return { canvas, controller, manager };
}

function focusedLabel(manager: CRCFocusManager): string | undefined {
  const target = manager.resolveKeyboardTarget();
  return target ? (target.component.element.props as { label: string }).label : undefined;
}

function targetsByLabel(
  manager: CRCFocusManager,
  first: string,
  second: string,
) {
  const all = Array.from(getCRCInstance(manager.candidates[0].target.owner.canvas).eventRoot.targets);
  const find = (label: string) => all.find(target =>
    (target.component.element.props as { label: string }).label === label
  )!;
  return [find(first), find(second)] as const;
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  pointerId: number,
  x: number,
  pointerType: string,
  init: PointerEventInit = {},
): PointerEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: bounds.left + x,
    clientY: bounds.top + 10,
    isPrimary: true,
    pointerId,
    pointerType,
    ...init,
  });
  canvas.dispatchEvent(event);
  return event;
}

function dispatchMouse(canvas: HTMLCanvasElement, x: number, button: number): MouseEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    button,
    clientX: bounds.left + x,
    clientY: bounds.top + 10,
  });
  canvas.dispatchEvent(event);
  return event;
}

function dispatchTouch(canvas: HTMLCanvasElement, identifier: number, x: number): TouchEvent {
  return dispatchTouchSequence(
    canvas,
    'touchstart',
    [{ identifier, x }],
    [{ identifier, x }],
  );
}

interface TouchPoint {
  readonly identifier: number;
  readonly x: number;
}

function dispatchTouchSequence(
  canvas: HTMLCanvasElement,
  type: 'touchcancel' | 'touchend' | 'touchstart',
  changed: readonly TouchPoint[],
  active: readonly TouchPoint[],
): TouchEvent {
  const bounds = canvas.getBoundingClientRect();
  const createTouch = ({ identifier, x }: TouchPoint) => new Touch({
    identifier,
    target: canvas,
    clientX: bounds.left + x,
    clientY: bounds.top + 10,
  });
  const changedTouches = changed.map(createTouch);
  const touches = active.map(createTouch);
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    changedTouches,
    targetTouches: touches,
    touches,
  });
  canvas.dispatchEvent(event);
  return event;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = 'display:block;width:100px;height:100px';
  document.body.appendChild(canvas);
  return canvas;
}

function rectanglePath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}
