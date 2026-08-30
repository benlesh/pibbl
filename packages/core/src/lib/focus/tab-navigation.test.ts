import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import { dispatchNativeEvent } from '../events/dispatch';
import type {
  CRCEventHandlers,
  CRCEventType,
} from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEventTarget } from '../hooks/crc-event-target';
import { mountCRC } from '../mount-crc';
import type { CompEl, CRCController } from '../types';
import type { CRCFocusManager } from './focus-manager';
import { withFocusManagement } from './with-focus-management';
import { withKeyboardNavigation } from './with-keyboard-navigation';

const activeControllers = new Set<CRCController>();
const noop = () => undefined;

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

describe('source-order Tab defaults', () => {
  it('moves only within the global source list and prevents default only when moved', () => {
    const Boundary = defineComp(() => [
      Target({ key: 'inner-b', label: 'inner-b', handlers: { onClick: noop } }),
      Target({ key: 'inner-a', label: 'inner-a', handlers: { onClick: noop } }),
    ]);
    const Root = defineComp(() => [
      Target({ key: 'outside-first', label: 'outside-first', handlers: { onClick: noop } }),
      withKeyboardNavigation(Boundary({}), { mode: 'directional' }),
      Target({ key: 'outside-last', label: 'outside-last', handlers: { onClick: noop } }),
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({})));
    mounted.canvas.focus({ preventScroll: true });
    expect(focusedLabel(mounted.manager)).toBe('outside-first');

    for (const expected of ['inner-b', 'inner-a', 'outside-last']) {
      const event = tabEvent(false);
      expect(mounted.canvas.dispatchEvent(event)).toBe(false);
      expect(event.defaultPrevented).toBe(true);
      expect(focusedLabel(mounted.manager)).toBe(expected);
    }

    const forwardExit = tabEvent(false);
    expect(mounted.canvas.dispatchEvent(forwardExit)).toBe(true);
    expect(forwardExit.defaultPrevented).toBe(false);
    expect(focusedLabel(mounted.manager)).toBe('outside-last');

    for (const expected of ['inner-a', 'inner-b', 'outside-first']) {
      const event = tabEvent(true);
      expect(mounted.canvas.dispatchEvent(event)).toBe(false);
      expect(event.defaultPrevented).toBe(true);
      expect(focusedLabel(mounted.manager)).toBe(expected);
    }

    const reverseExit = tabEvent(true);
    expect(mounted.canvas.dispatchEvent(reverseExit)).toBe(true);
    expect(reverseExit.defaultPrevented).toBe(false);
    expect(focusedLabel(mounted.manager)).toBe('outside-first');
  });

  it('chooses the appropriate endpoint when the focused Canvas has no current target', () => {
    const mounted = mountAndRender(managed(['first', 'middle', 'last']));
    mounted.canvas.focus({ preventScroll: true });

    mounted.manager.setFocusState(undefined, false);
    const forward = tabEvent(false);
    mounted.canvas.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('first');

    mounted.manager.setFocusState(undefined, false);
    const reverse = tabEvent(true);
    mounted.canvas.dispatchEvent(reverse);
    expect(reverse.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('last');
  });

  it('does not run the Tab default after a logical handler prevents it', () => {
    const Root = defineComp(() => [
      Target({
        key: 'first',
        label: 'first',
        handlers: {
          onClick: noop,
          onKeyDown: event => {
            if (event.key === 'Tab') event.preventDefault();
          },
        },
      }),
      Target({ key: 'second', label: 'second', handlers: { onClick: noop } }),
    ]);
    const mounted = mountAndRender(withFocusManagement(Root({})));
    mounted.canvas.focus({ preventScroll: true });

    const event = tabEvent(false);
    mounted.canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('first');
  });

  it('restores no-current behavior after candidates dynamically reach zero', () => {
    const canvas = createCanvas();
    const mounted = mountAndRender(managed(['first']), canvas);
    canvas.focus({ preventScroll: true });
    expect(focusedLabel(mounted.manager)).toBe('first');

    executeRender(canvas, 2, managed([]));
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
    const emptyTab = tabEvent(false);
    canvas.dispatchEvent(emptyTab);
    expect(emptyTab.defaultPrevented).toBe(false);

    executeRender(canvas, 3, managed(['new-first', 'new-last']));
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
    const restoredTab = tabEvent(false);
    canvas.dispatchEvent(restoredTab);
    expect(restoredTab.defaultPrevented).toBe(true);
    expect(focusedLabel(mounted.manager)).toBe('new-first');
  });
});

describe('focus-policy native event routing', () => {
  it('routes keyboard, focus, editing, composition, and clipboard families to the current target', () => {
    const trace: string[] = [];
    const record = (event: { type: string }) => trace.push(event.type);
    const handlers: CRCEventHandlers = {
      onKeyDown: record,
      onKeyUp: record,
      onFocus: record,
      onBlur: record,
      onFocusIn: record,
      onFocusOut: record,
      onBeforeInput: record,
      onInput: record,
      onChange: record,
      onCompositionStart: record,
      onCompositionUpdate: record,
      onCompositionEnd: record,
      onSelect: record,
      onSelectionChange: record,
      onCopy: record,
      onCut: record,
      onPaste: record,
    };
    const Root = defineComp(() => Target({ label: 'target', handlers }));
    const mounted = mountAndRender(withFocusManagement(Root({})));
    const target = mounted.manager.candidates[0].target;
    mounted.manager.setFocusState(target, true);
    const instance = getCRCInstance(mounted.canvas);

    const inputs: readonly [CRCEventType, Event][] = [
      ['keydown', new KeyboardEvent('keydown', { key: 'a', bubbles: true })],
      ['keyup', new KeyboardEvent('keyup', { key: 'a', bubbles: true })],
      ['focus', new FocusEvent('focus')],
      ['blur', new FocusEvent('blur')],
      ['focusin', new FocusEvent('focusin', { bubbles: true })],
      ['focusout', new FocusEvent('focusout', { bubbles: true })],
      ['beforeinput', new InputEvent('beforeinput', { data: 'a', bubbles: true })],
      ['input', new InputEvent('input', { data: 'a', bubbles: true })],
      ['change', new Event('change', { bubbles: true })],
      ['compositionstart', new CompositionEvent('compositionstart', { data: 'a' })],
      ['compositionupdate', new CompositionEvent('compositionupdate', { data: 'ab' })],
      ['compositionend', new CompositionEvent('compositionend', { data: 'ab' })],
      ['select', new Event('select', { bubbles: true })],
      ['selectionchange', new Event('selectionchange', { bubbles: true })],
      ['copy', new ClipboardEvent('copy', { bubbles: true })],
      ['cut', new ClipboardEvent('cut', { bubbles: true })],
      ['paste', new ClipboardEvent('paste', { bubbles: true })],
    ];

    for (const [type, event] of inputs) {
      mounted.manager.setFocusState(target, true);
      dispatchNativeEvent(instance, type, event);
    }

    expect(trace).toEqual(inputs.map(([type]) => type));
  });

  it('runs the post-keydown policy after target dispatch while the target remains live', () => {
    const trace: string[] = [];
    const Root = defineComp(() => Target({
      label: 'target',
      handlers: { onKeyDown: () => trace.push('handler') },
    }));
    const mounted = mountAndRender(withFocusManagement(Root({})));
    mounted.canvas.focus({ preventScroll: true });
    const afterDispatch = vi.spyOn(mounted.manager, 'afterDispatch')
      .mockImplementation(event => {
        trace.push(`default:${event.type}`);
      });

    mounted.canvas.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    }));

    expect(trace).toEqual(['handler', 'default:keydown']);
    expect(afterDispatch).toHaveBeenCalledOnce();
  });

  it('does not run the post-keydown policy after the dispatched target is removed', () => {
    let visible = true;
    let canvas: HTMLCanvasElement;
    let renders = 1;
    const handler = vi.fn(() => {
      visible = false;
      executeRender(canvas, ++renders, withFocusManagement(Root({})));
    });
    const Root = defineComp(() => visible ? Target({
      label: 'removing',
      handlers: { onKeyDown: handler },
    }) : undefined);
    canvas = createCanvas();
    const mounted = mountAndRender(withFocusManagement(Root({})), canvas);
    canvas.focus({ preventScroll: true });
    const afterDispatch = vi.spyOn(mounted.manager, 'afterDispatch');

    canvas.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    }));

    expect(handler).toHaveBeenCalledOnce();
    expect(afterDispatch).not.toHaveBeenCalled();
    expect(mounted.manager.resolveKeyboardTarget()).toBeUndefined();
  });
});

interface TargetProps {
  readonly label: string;
  readonly handlers: CRCEventHandlers;
}

const Target = defineComp<TargetProps>(({ handlers }) => {
  crcEventTarget(handlers, {
    path: rectanglePath(0, 0, 10, 10),
    keyboardFocusable: true,
  });
});

const Scene = defineComp(({ labels }: { labels: readonly string[] }) =>
  labels.map(label => Target({
    key: label,
    label,
    handlers: { onClick: noop },
  }))
);

function managed(labels: readonly string[]): CompEl<any, any> {
  return withFocusManagement(Scene({ labels }));
}

function mountAndRender(
  element: CompEl<any, any>,
  canvas = createCanvas(),
): {
  readonly canvas: HTMLCanvasElement;
  readonly controller: CRCController;
  readonly manager: CRCFocusManager;
} {
  const controller = mountCRC(canvas, element);
  activeControllers.add(controller);
  executeRender(canvas, 1);
  const policy = getCRCInstance(canvas).eventRoot.focusPolicy;
  if (!policy) throw new Error('Expected a focus manager.');
  return { canvas, controller, manager: policy as CRCFocusManager };
}

function focusedLabel(manager: CRCFocusManager): string | undefined {
  const target = manager.resolveKeyboardTarget();
  return target ?
    (target.component.element.props as { label: string }).label :
    undefined;
}

function tabEvent(shiftKey: boolean): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'Tab',
    code: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  document.body.appendChild(canvas);
  return canvas;
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
