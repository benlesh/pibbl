import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CRCEventHandlers,
  CRCLogicalMouseEvent,
} from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { useEventListener } from '../hooks/use-event-listener';
import { useEventTarget } from '../hooks/use-event-target';
import { mountCRC } from '../mount-crc';
import type { CRCElement, CRCController } from '../types';
import type { CRCFocusManager } from './focus-manager';
import { focusManaged } from './policy-test-support';
import { createElement } from '../element/create-element';

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

describe('Enter keyboard activation', () => {
  it('runs key propagation before one synthetic click and preserves event provenance', () => {
    const trace: string[] = [];
    let clickEvent: CRCLogicalMouseEvent | undefined;
    const Target = targetComponent();
    const Root = (_props: {}) => {
      useEventListener({
        onKeyDown: () => trace.push('ancestor-keydown'),
        onClick: () => trace.push('ancestor-click'),
      });
      return createElement(Target, {
        label: 'target',
        handlers: {
          onKeyDown: () => trace.push('target-keydown'),
          onClick: event => {
            trace.push('target-click');
            clickEvent = event;
          },
        },
      });
    };
    const mounted = mountAndRender(focusManaged(createElement(Root, {})));
    mounted.canvas.focus({ preventScroll: true });
    const sourceEvent = keyEvent('keydown', 'Enter', 'Enter');

    mounted.canvas.dispatchEvent(sourceEvent);
    mounted.canvas.dispatchEvent(keyEvent('keydown', 'Enter', 'Enter', true));
    mounted.canvas.dispatchEvent(keyEvent('keyup', 'Enter', 'Enter'));

    expect(trace).toEqual([
      'target-keydown',
      'ancestor-keydown',
      'target-click',
      'ancestor-click',
      'target-keydown',
      'ancestor-keydown',
    ]);
    expect(clickEvent?.originalEvent).toBeInstanceOf(MouseEvent);
    expect(clickEvent?.originalEvent).toMatchObject({
      bubbles: true,
      cancelable: true,
      detail: 0,
    });
    expect(clickEvent?.sourceEvent).toBe(sourceEvent);
  });

  it.each(['target', 'ancestor'] as const)(
    'does not activate when the %s prevents Enter keydown',
    preventionSite => {
      const click = vi.fn();
      const Target = targetComponent();
      const Root = (_props: {}) => {
        useEventListener({
          onKeyDown: event => {
            if (preventionSite === 'ancestor') event.preventDefault();
          },
        });
        return createElement(Target, {
          label: 'target',
          handlers: {
            onKeyDown: event => {
              if (preventionSite === 'target') event.preventDefault();
            },
            onClick: click,
          },
        });
      };
      const mounted = mountAndRender(focusManaged(createElement(Root, {})));
      mounted.canvas.focus({ preventScroll: true });
      const event = keyEvent('keydown', 'Enter', 'Enter');

      mounted.canvas.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(click).not.toHaveBeenCalled();
    },
  );

  it('leaves native click provenance undefined', () => {
    let clickEvent: CRCLogicalMouseEvent | undefined;
    const Target = targetComponent();
    const mounted = mountAndRender(focusManaged(createElement(Target, {
      label: 'target',
      handlers: { onClick: event => clickEvent = event },
    })));

    dispatchMouse(mounted.canvas, 'mousedown', 10, 10);
    dispatchMouse(mounted.canvas, 'mouseup', 10, 10);
    const nativeClick = dispatchMouse(mounted.canvas, 'click', 10, 10);

    expect(clickEvent?.originalEvent).toBe(nativeClick);
    expect(clickEvent?.sourceEvent).toBeUndefined();
  });
});

describe('Space keyboard activation', () => {
  it('activates an onClick-only target from Space keydown and keyup', () => {
    let clickEvent: CRCLogicalMouseEvent | undefined;
    const Target = targetComponent();
    const mounted = mountAndRender(focusManaged(createElement(Target, {
      label: 'target',
      handlers: { onClick: event => clickEvent = event },
    })));
    mounted.canvas.focus({ preventScroll: true });
    const keydown = keyEvent('keydown', ' ', 'Space');
    const keyup = keyEvent('keyup', ' ', 'Space');

    mounted.canvas.dispatchEvent(keydown);
    mounted.canvas.dispatchEvent(keyup);

    expect(keydown.defaultPrevented).toBe(true);
    expect(clickEvent?.sourceEvent).toBe(keyup);
    expect(clickEvent?.originalEvent).toMatchObject({ detail: 0 });
  });

  it('prevents scrolling on keydown and activates once after matching keyup propagation', () => {
    const trace: string[] = [];
    let clickEvent: CRCLogicalMouseEvent | undefined;
    const Target = targetComponent();
    const mounted = mountAndRender(focusManaged(createElement(Target, {
      label: 'target',
      handlers: {
        onKeyDown: () => trace.push('keydown'),
        onKeyUp: () => trace.push('keyup'),
        onClick: event => {
          trace.push('click');
          clickEvent = event;
        },
      },
    })));
    mounted.canvas.focus({ preventScroll: true });
    const keydown = keyEvent('keydown', ' ', 'Space');
    const repeat = keyEvent('keydown', ' ', 'Space', true);
    const keyup = keyEvent('keyup', ' ', 'Space');

    mounted.canvas.dispatchEvent(keydown);
    mounted.canvas.dispatchEvent(repeat);
    mounted.canvas.dispatchEvent(keyup);
    mounted.canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

    expect(keydown.defaultPrevented).toBe(true);
    expect(trace).toEqual(['keydown', 'keydown', 'keyup', 'click', 'keyup']);
    expect(clickEvent?.sourceEvent).toBe(keyup);
    expect(clickEvent?.originalEvent).toMatchObject({ detail: 0 });
  });

  it.each(['target', 'ancestor'] as const)(
    'clears the pending activation when the %s prevents Space keyup',
    preventionSite => {
      let prevent = true;
      const click = vi.fn();
      const Target = targetComponent();
      const Root = (_props: {}) => {
        useEventListener({
          onKeyUp: event => {
            if (prevent && preventionSite === 'ancestor') event.preventDefault();
          },
        });
        return createElement(Target, {
          label: 'target',
          handlers: {
            onKeyUp: event => {
              if (prevent && preventionSite === 'target') event.preventDefault();
            },
            onClick: click,
          },
        });
      };
      const mounted = mountAndRender(focusManaged(createElement(Root, {})));
      mounted.canvas.focus({ preventScroll: true });

      mounted.canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
      const preventedKeyup = keyEvent('keyup', ' ', 'Space');
      mounted.canvas.dispatchEvent(preventedKeyup);
      prevent = false;
      mounted.canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

      expect(preventedKeyup.defaultPrevented).toBe(true);
      expect(click).not.toHaveBeenCalled();

      mounted.canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
      mounted.canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));
      expect(click).toHaveBeenCalledOnce();
    },
  );

  it('cancels on focus movement and Canvas blur', () => {
    const clicks: string[] = [];
    const Target = targetComponent();
    const Root = (_props: {}) => [
      createElement(Target, { key: 'a', label: 'a', handlers: { onClick: () => clicks.push('a') } }),
      createElement(Target, { key: 'b', label: 'b', handlers: { onClick: () => clicks.push('b') } }),
    ];
    const mounted = mountAndRender(focusManaged(createElement(Root, {})));
    mounted.canvas.focus({ preventScroll: true });
    const [a, b] = mounted.manager.candidates.map(candidate => candidate.target);

    mounted.canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
    mounted.manager.setFocusState(b, true);
    mounted.manager.setFocusState(a, true);
    mounted.canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

    mounted.canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
    mounted.canvas.blur();
    mounted.canvas.focus({ preventScroll: true });
    mounted.canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

    expect(clicks).toEqual([]);
  });

  it('cancels on unmount and onClick removal even when an apparent target returns', () => {
    let visible = true;
    let clickEnabled = true;
    const click = vi.fn();
    const Target = targetComponent();
    const Root = (_props: {}) => visible ? createElement(Target, {
      key: 'target',
      label: 'target',
      handlers: {
        onKeyDown: noop,
        onKeyUp: noop,
        ...(clickEnabled ? { onClick: click } : {}),
      },
    }) : undefined;
    const canvas = createCanvas();
    const mounted = mountAndRender(focusManaged(createElement(Root, {})), canvas);
    canvas.focus({ preventScroll: true });

    canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
    clickEnabled = false;
    executeRender(canvas, 2, focusManaged(createElement(Root, {})));
    clickEnabled = true;
    executeRender(canvas, 3, focusManaged(createElement(Root, {})));
    canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

    canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
    visible = false;
    executeRender(canvas, 4, focusManaged(createElement(Root, {})));
    visible = true;
    executeRender(canvas, 5, focusManaged(createElement(Root, {})));
    mounted.manager.setFocusState(mounted.manager.candidates[0].target, true);
    canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

    expect(click).not.toHaveBeenCalled();
  });

  it('does not carry pending activation across manager replacement or disposal', () => {
    const click = vi.fn();
    const Target = targetComponent();
    const First = (_props: {}) => createElement(Target, { label: 'first', handlers: { onClick: click } });
    const Second = (_props: {}) => createElement(Target, { label: 'second', handlers: { onClick: click } });
    const canvas = createCanvas();
    const mounted = mountAndRender(focusManaged(createElement(First, {})), canvas);
    canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
    const firstManager = mounted.manager;

    executeRender(canvas, 2, focusManaged(createElement(Second, {})));
    const secondManager = getCRCInstance(canvas).eventRoot.focusPolicy as CRCFocusManager;
    secondManager.setFocusState(secondManager.candidates[0].target, true);
    canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

    canvas.dispatchEvent(keyEvent('keydown', ' ', 'Space'));
    mounted.controller.dispose();
    canvas.dispatchEvent(keyEvent('keyup', ' ', 'Space'));

    expect(firstManager.isDestroyed).toBe(true);
    expect(click).not.toHaveBeenCalled();
  });
});

interface TargetProps {
  readonly label: string;
  readonly handlers: CRCEventHandlers;
}

function targetComponent() {
  return ({ handlers }: TargetProps) => {
    useEventTarget(handlers, {
      path: rectanglePath(0, 0, 40, 40),
      fill: true,
      keyboardFocusable: true,
    });
  };
}

function mountAndRender(
  element: CRCElement<any>,
  canvas = createCanvas(),
): {
  readonly canvas: HTMLCanvasElement;
  readonly controller: CRCController;
  readonly manager: CRCFocusManager;
} {
  const controller = mountCRC(canvas, element);
  activeControllers.add(controller);
  executeRender(canvas, 1);
  const manager = getCRCInstance(canvas).eventRoot.focusPolicy as CRCFocusManager | undefined;
  if (!manager) throw new Error('Expected a focus manager.');
  return { canvas, controller, manager };
}

function keyEvent(
  type: 'keydown' | 'keyup',
  key: string,
  code: string,
  repeat = false,
): KeyboardEvent {
  return new KeyboardEvent(type, {
    key,
    code,
    repeat,
    bubbles: true,
    cancelable: true,
  });
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'click' | 'mousedown' | 'mouseup',
  x: number,
  y: number,
): MouseEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  });
  canvas.dispatchEvent(event);
  return event;
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
