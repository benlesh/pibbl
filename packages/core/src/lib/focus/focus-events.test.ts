import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CRCEventTargetRegistration } from '../events/registrations';
import type { CRCEvent, CRCEventHandlers, CRCEventTarget } from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { useEventListener } from '../hooks/use-event-listener';
import { useEventTarget } from '../hooks/use-event-target';
import { useState, type StateUpdater } from '../hooks/use-state';
import { mountCRC } from '../mount-crc';
import type { CRCElement, CRCController } from '../types';
import type { CRCFocusManager } from './focus-manager';
import { transitionLogicalFocus } from './focus-events';
import { focusManaged } from './policy-test-support';
import { createElement } from '../element/create-element';

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

describe('logical focus transitions', () => {
  it('canonicalizes real Canvas entry and exit without routing companion native focus events twice', () => {
    const trace: string[] = [];
    let manager!: CRCFocusManager;
    const record = (scope: string, event: CRCEvent) => {
      const target = manager.candidates[0].target;
      trace.push(
        `${scope}:${event.type}:` +
        `${event.relatedTarget === null ? 'null' : 'logical'}:` +
        `${manager.snapshot(target).isFocused ? 'focused' : 'unfocused'}`,
      );
    };
    const Root = (_props: {}) => {
      useEventListener({
        onFocusInCapture: event => record('root-capture', event),
        onFocusIn: event => record('root-bubble', event),
        onFocusCapture: event => record('root-capture', event),
        onFocusOutCapture: event => record('root-capture', event),
        onFocusOut: event => record('root-bubble', event),
        onBlurCapture: event => record('root-capture', event),
      });
      return createElement(Target, {
        label: 'only',
        x: 0,
        handlers: {
          onFocusIn: event => record('target', event),
          onFocus: event => record('target', event),
          onFocusOut: event => record('target', event),
          onBlur: event => record('target', event),
        },
      });
    };
    const mounted = mountAndRender(focusManaged(createElement(Root, {})));
    manager = mounted.manager;
    const before = document.createElement('button');
    const after = document.createElement('button');
    document.body.insertBefore(before, mounted.canvas);
    document.body.append(after);
    before.focus();

    mounted.canvas.focus({ preventScroll: true });
    after.focus();

    expect(trace).toEqual([
      'root-capture:focusin:null:focused',
      'target:focusin:null:focused',
      'root-bubble:focusin:null:focused',
      'root-capture:focus:null:focused',
      'target:focus:null:focused',
      'root-capture:focusout:null:focused',
      'target:focusout:null:focused',
      'root-bubble:focusout:null:focused',
      'root-capture:blur:null:focused',
      'target:blur:null:focused',
    ]);
    expect(manager.resolveKeyboardTarget()).toBeUndefined();
    expect(document.activeElement).toBe(after);
  });

  it('dispatches A -> B in canonical order with logical related targets and state boundaries', async () => {
    const trace: string[] = [];
    let manager!: CRCFocusManager;
    let targets!: readonly [CRCEventTargetRegistration, CRCEventTargetRegistration];
    const record = (event: CRCEvent) => {
      const [a, b] = targets;
      const target = event.target === a.publicTarget ? 'A' : 'B';
      const related = event.relatedTarget === a.publicTarget ? 'A' :
        event.relatedTarget === b.publicTarget ? 'B' : 'none';
      trace.push(
        `${event.type}:${target}->${related}:` +
        `${manager.snapshot(a).isFocused ? 'A' : manager.snapshot(b).isFocused ? 'B' : 'none'}`,
      );
    };
    const Root = focusScene({
      listenerHandlers: {
        onFocusOutCapture: event => trace.push(`root-capture:${event.type}`),
        onFocusOut: event => trace.push(`root-bubble:${event.type}`),
        onBlurCapture: event => trace.push(`root-capture:${event.type}`),
        onBlur: event => trace.push(`root-bubble:${event.type}`),
        onFocusInCapture: event => trace.push(`root-capture:${event.type}`),
        onFocusIn: event => trace.push(`root-bubble:${event.type}`),
        onFocusCapture: event => trace.push(`root-capture:${event.type}`),
        onFocus: event => trace.push(`root-bubble:${event.type}`),
      },
      targetHandlers: { onFocusOut: record, onBlur: record, onFocusIn: record, onFocus: record },
    });
    const mounted = mountAndRender(focusManaged(Root));
    manager = mounted.manager;
    targets = manager.candidates.map(candidate => candidate.target) as unknown as
      readonly [CRCEventTargetRegistration, CRCEventTargetRegistration];

    transitionLogicalFocus(manager, targets[0], 'keyboard');
    await nextFrame();
    trace.length = 0;
    transitionLogicalFocus(manager, targets[1], 'keyboard');

    expect(trace).toEqual([
      'root-capture:focusout',
      'focusout:A->B:A',
      'root-bubble:focusout',
      'root-capture:blur',
      'blur:A->B:A',
      'root-capture:focusin',
      'focusin:B->A:B',
      'root-bubble:focusin',
      'root-capture:focus',
      'focus:B->A:B',
    ]);
  });

  it('queues a nested request from an outgoing handler after the current transition completes', async () => {
    const trace: string[] = [];
    let manager!: CRCFocusManager;
    let targets!: readonly CRCEventTargetRegistration[];
    let requested = false;
    const label = (target: CRCEventTarget | null) => {
      const index = targets.findIndex(candidate => candidate.publicTarget === target);
      return index < 0 ? 'none' : ['A', 'B', 'C'][index];
    };
    const record = (event: CRCEvent) => {
      trace.push(`${event.type}:${label(event.target)}->${label(event.relatedTarget)}`);
    };
    const Root = (_props: {}) => [
      createElement(Target, {
        key: 'A', label: 'A', x: 0,
        handlers: {
          onFocusOut: event => {
            record(event);
            if (!requested) {
              requested = true;
              transitionLogicalFocus(manager, targets[2], 'pointer');
            }
          },
          onBlur: record,
        },
      }),
      createElement(Target, {
        key: 'B', label: 'B', x: 35,
        handlers: { onFocusIn: record, onFocus: record, onFocusOut: record, onBlur: record },
      }),
      createElement(Target, {
        key: 'C', label: 'C', x: 70,
        handlers: { onFocusIn: record, onFocus: record },
      }),
    ];
    const mounted = mountAndRender(focusManaged(createElement(Root, {})));
    manager = mounted.manager;
    targets = manager.candidates.map(candidate => candidate.target);
    transitionLogicalFocus(manager, targets[0], 'keyboard');
    await nextFrame();
    trace.length = 0;

    transitionLogicalFocus(manager, targets[1], 'keyboard');

    expect(trace).toEqual([
      'focusout:A->B',
      'blur:A->B',
      'focusin:B->A',
      'focus:B->A',
      'focusout:B->C',
      'blur:B->C',
      'focusin:C->B',
      'focus:C->B',
    ]);
    expect(manager.resolveKeyboardTarget()).toBe(targets[2]);
    expect(manager.snapshot(targets[2])).toEqual({
      isFocused: true,
      isFocusVisible: false,
    });
  });

  it('queues the latest nested request from incoming handlers without interrupting their transition', async () => {
    const trace: string[] = [];
    let manager!: CRCFocusManager;
    let targets!: readonly CRCEventTargetRegistration[];
    let requestedFromFocusIn = false;
    let requestedFromFocus = false;
    const label = (target: CRCEventTarget | null) => {
      const index = targets.findIndex(candidate => candidate.publicTarget === target);
      return index < 0 ? 'none' : ['A', 'B', 'C'][index];
    };
    const record = (event: CRCEvent) => {
      trace.push(`${event.type}:${label(event.target)}->${label(event.relatedTarget)}`);
    };
    const Root = (_props: {}) => [
      createElement(Target, {
        key: 'A', label: 'A', x: 0,
        handlers: {
          onFocusIn: record,
          onFocus: record,
          onFocusOut: record,
          onBlur: record,
        },
      }),
      createElement(Target, {
        key: 'B', label: 'B', x: 35,
        handlers: {
          onFocusIn: event => {
            record(event);
            if (!requestedFromFocusIn) {
              requestedFromFocusIn = true;
              transitionLogicalFocus(manager, targets[2], 'keyboard');
            }
          },
          onFocus: event => {
            record(event);
            if (!requestedFromFocus) {
              requestedFromFocus = true;
              transitionLogicalFocus(manager, targets[0], 'pointer');
            }
          },
          onFocusOut: record,
          onBlur: record,
        },
      }),
      createElement(Target, {
        key: 'C', label: 'C', x: 70,
        handlers: { onFocusIn: record, onFocus: record },
      }),
    ];
    const mounted = mountAndRender(focusManaged(createElement(Root, {})));
    manager = mounted.manager;
    targets = manager.candidates.map(candidate => candidate.target);
    transitionLogicalFocus(manager, targets[0], 'keyboard');
    await nextFrame();
    trace.length = 0;

    transitionLogicalFocus(manager, targets[1], 'keyboard');

    expect(trace).toEqual([
      'focusout:A->B',
      'blur:A->B',
      'focusin:B->A',
      'focus:B->A',
      'focusout:B->A',
      'blur:B->A',
      'focusin:A->B',
      'focus:A->B',
    ]);
    expect(manager.resolveKeyboardTarget()).toBe(targets[0]);
    expect(manager.snapshot(targets[0])).toEqual({
      isFocused: true,
      isFocusVisible: false,
    });
  });

  it('honors synchronous Canvas refocus requested from the canonical blur handler', () => {
    const trace: string[] = [];
    let manager!: CRCFocusManager;
    let canvas!: HTMLCanvasElement;
    const Root = (_props: {}) => createElement(Target, {
      label: 'only',
      x: 0,
      handlers: {
        onFocusIn: event => trace.push(`${event.type}:${manager.snapshot(manager.candidates[0].target).isFocused}`),
        onFocus: event => trace.push(`${event.type}:${manager.snapshot(manager.candidates[0].target).isFocused}`),
        onFocusOut: event => trace.push(`${event.type}:${manager.snapshot(manager.candidates[0].target).isFocused}`),
        onBlur: event => {
          trace.push(`${event.type}:${manager.snapshot(manager.candidates[0].target).isFocused}`);
          canvas.focus({ preventScroll: true });
        },
      },
    });
    const mounted = mountAndRender(focusManaged(createElement(Root, {})));
    manager = mounted.manager;
    canvas = mounted.canvas;
    canvas.focus({ preventScroll: true });
    trace.length = 0;

    canvas.blur();

    expect(trace).toEqual([
      'focusout:true',
      'blur:true',
      'focusin:true',
      'focus:true',
    ]);
    expect(document.activeElement).toBe(canvas);
    expect(manager.resolveKeyboardTarget()).toBe(manager.candidates[0].target);
  });

  it('uses live dispatcher mutation, removal, and error isolation throughout a transition', async () => {
    const trace: string[] = [];
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => reported.push(error));
    let generation = 0;
    let canvas!: HTMLCanvasElement;
    const Root = (_props: {}) => {
      const current = generation;
      useEventListener({
        onFocusOut: () => {
          trace.push('ancestor-focusout');
          generation = 1;
          executeRender(canvas, 2, focusManaged(createElement(Root, {})));
          throw new Error('expected focusout failure');
        },
        onBlur: () => trace.push('ancestor-blur'),
      });
      return [
        current === 0 ? createElement(Target, {
          key: 'A', label: 'A', x: 0,
          handlers: { onFocusOut: () => trace.push('old-focusout') },
        }) : undefined,
        createElement(Target, {
          key: 'B', label: 'B', x: 50,
          handlers: current === 0 ?
            { onFocusIn: () => trace.push('old-focusin') } :
            { onFocusIn: () => trace.push('new-focusin'), onFocus: () => trace.push('new-focus') },
        }),
      ];
    };
    canvas = createCanvas();
    const mounted = mountAndRender(focusManaged(createElement(Root, {})), canvas);
    const [a, b] = mounted.manager.candidates.map(candidate => candidate.target);
    transitionLogicalFocus(mounted.manager, a, 'keyboard');
    await nextFrame();
    trace.length = 0;

    transitionLogicalFocus(mounted.manager, b, 'keyboard');

    expect(trace).toEqual([
      'old-focusout',
      'ancestor-focusout',
      'new-focusin',
      'new-focus',
    ]);
    expect(reported).toEqual([expect.objectContaining({ message: 'expected focusout failure' })]);
    expect(mounted.manager.resolveKeyboardTarget()).toBe(b);
  });

  it('skips an already-dead previous target and exposes null as the incoming related target', async () => {
    const trace: Array<CRCEventTarget | null> = [];
    const Root = focusScene({
      targetHandlers: {
        onFocusOut: () => trace.push({} as CRCEventTarget),
        onBlur: () => trace.push({} as CRCEventTarget),
        onFocusIn: event => trace.push(event.relatedTarget),
        onFocus: event => trace.push(event.relatedTarget),
      },
    });
    const mounted = mountAndRender(focusManaged(Root));
    const [a, b] = mounted.manager.candidates.map(candidate => candidate.target);
    transitionLogicalFocus(mounted.manager, a, 'keyboard');
    await nextFrame();
    trace.length = 0;
    a.live = false;

    transitionLogicalFocus(mounted.manager, b, 'keyboard');

    expect(trace).toEqual([null, null]);
  });

  it('coalesces focus-handler state and transition updates into one ordinary render', async () => {
    let renders = 0;
    let setValue!: StateUpdater<number>;
    const Root = (_props: {}) => {
      renders++;
      const [, setState] = useState(0);
      setValue = setState;
      return [
        createElement(Target, {
          key: 'A', label: 'A', x: 0,
          handlers: { onFocusOut: () => setValue(value => value + 1) },
        }),
        createElement(Target, { key: 'B', label: 'B', x: 50, handlers: {} }),
      ];
    };
    const mounted = mountAndRender(focusManaged(createElement(Root, {})));
    const [a, b] = mounted.manager.candidates.map(candidate => candidate.target);
    transitionLogicalFocus(mounted.manager, a, 'keyboard');
    await nextFrame();
    const before = renders;

    transitionLogicalFocus(mounted.manager, b, 'keyboard');
    await nextFrame();

    expect(renders).toBe(before + 1);
  });
});

interface TargetProps {
  readonly label: string;
  readonly x: number;
  readonly handlers: CRCEventHandlers;
}

const Target = ({ handlers, x }: TargetProps) => {
  useEventTarget(handlers, {
    path: rectanglePath(x, 0, 40, 40),
    keyboardFocusable: true,
  });
};

function focusScene({
  listenerHandlers = {},
  targetHandlers = {},
}: {
  readonly listenerHandlers?: CRCEventHandlers;
  readonly targetHandlers?: CRCEventHandlers;
}): CRCElement<any> {
  const Root = (_props: {}) => {
    useEventListener(listenerHandlers);
    return [
      createElement(Target, { key: 'A', label: 'A', x: 0, handlers: targetHandlers }),
      createElement(Target, { key: 'B', label: 'B', x: 50, handlers: targetHandlers }),
    ];
  };
  return createElement(Root, {});
}

function mountAndRender(
  element: CRCElement<any>,
  canvas = createCanvas(),
) {
  const controller = mountCRC(canvas, element);
  activeControllers.add(controller);
  executeRender(canvas, 1);
  const manager = getCRCInstance(canvas).eventRoot.focusPolicy as CRCFocusManager | undefined;
  if (!manager) throw new Error('Expected a focus manager.');
  return { canvas, controller, manager };
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

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
