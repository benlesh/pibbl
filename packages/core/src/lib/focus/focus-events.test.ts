import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComp } from '../define-comp';
import type { CRCEventTargetRegistration } from '../events/registrations';
import type { CRCEvent, CRCEventHandlers, CRCEventTarget } from '../events/types';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEventListener } from '../hooks/crc-event-listener';
import { crcEventTarget } from '../hooks/crc-event-target';
import { crcState, type StateUpdater } from '../hooks/crc-state';
import { mountCRC } from '../mount-crc';
import type { CompEl, CRCController } from '../types';
import type { CRCFocusManager } from './focus-manager';
import { transitionLogicalFocus } from './focus-events';
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

describe('logical focus transitions', () => {
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
    const mounted = mountAndRender(withFocusManagement(Root));
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

  it('uses live dispatcher mutation, removal, and error isolation throughout a transition', async () => {
    const trace: string[] = [];
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => reported.push(error));
    let generation = 0;
    let canvas!: HTMLCanvasElement;
    const Root = defineComp(() => {
      const current = generation;
      crcEventListener({
        onFocusOut: () => {
          trace.push('ancestor-focusout');
          generation = 1;
          executeRender(canvas, 2, withFocusManagement(Root({})));
          throw new Error('expected focusout failure');
        },
        onBlur: () => trace.push('ancestor-blur'),
      });
      return [
        current === 0 ? Target({
          key: 'A', label: 'A', x: 0,
          handlers: { onFocusOut: () => trace.push('old-focusout') },
        }) : undefined,
        Target({
          key: 'B', label: 'B', x: 50,
          handlers: current === 0 ?
            { onFocusIn: () => trace.push('old-focusin') } :
            { onFocusIn: () => trace.push('new-focusin'), onFocus: () => trace.push('new-focus') },
        }),
      ];
    });
    canvas = createCanvas();
    const mounted = mountAndRender(withFocusManagement(Root({})), canvas);
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
    const mounted = mountAndRender(withFocusManagement(Root));
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
    const Root = defineComp(() => {
      renders++;
      const [, setState] = crcState(0);
      setValue = setState;
      return [
        Target({
          key: 'A', label: 'A', x: 0,
          handlers: { onFocusOut: () => setValue(value => value + 1) },
        }),
        Target({ key: 'B', label: 'B', x: 50, handlers: {} }),
      ];
    });
    const mounted = mountAndRender(withFocusManagement(Root({})));
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

const Target = defineComp<TargetProps>(({ handlers, x }) => {
  crcEventTarget(handlers, {
    path: rectanglePath(x, 0, 40, 40),
    keyboardFocusable: true,
  });
});

function focusScene({
  listenerHandlers = {},
  targetHandlers = {},
}: {
  readonly listenerHandlers?: CRCEventHandlers;
  readonly targetHandlers?: CRCEventHandlers;
}): CompEl<any, any> {
  const Root = defineComp(() => {
    crcEventListener(listenerHandlers);
    return [
      Target({ key: 'A', label: 'A', x: 0, handlers: targetHandlers }),
      Target({ key: 'B', label: 'B', x: 50, handlers: targetHandlers }),
    ];
  });
  return Root({});
}

function mountAndRender(
  element: CompEl<any, any>,
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
