import { afterEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEvent } from '../hooks/crc-event';
import { crcEventListener } from '../hooks/crc-event-listener';
import { crcEventTarget } from '../hooks/crc-event-target';
import type {
  CRCEventHandlers,
  CRCEventTarget,
  CRCMouseEvent,
} from './types';

const ACTIVATION_CASES = [
  { button: 0, label: 'click', type: 'click' },
  { button: 2, label: 'auxclick', type: 'auxclick' },
] as const;

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('DOM-aligned mouse dispatch', () => {
  it('bubbles over/out and separately targets non-bubbling enter/leave nodes', async () => {
    const trace: string[] = [];
    const scene = boundaryScene(trace, false);
    const canvas = createCanvas();
    crc(canvas, scene);
    await nextFrame();

    dispatchMouse(canvas, 'mousemove', 25, 25);
    expect(trace).toEqual([
      'a-over:2',
      'parent-over:3',
      'root-over:3',
      'root-enter:2',
      'parent-enter:2',
      'a-enter:2',
      'a-move:2',
    ]);

    trace.length = 0;
    dispatchMouse(canvas, 'mouseout', 125, 25);
    expect(trace).toEqual([
      'a-out:2',
      'parent-out:3',
      'root-out:3',
      'a-leave:2',
      'parent-leave:2',
      'root-leave:2',
    ]);
  });

  it('leaves and enters only sibling-exclusive nodes without re-entering the shared prefix', async () => {
    const trace: string[] = [];
    let aTarget: CRCEventTarget | undefined;
    let bTarget: CRCEventTarget | undefined;
    let outRelated: CRCEventTarget | null | undefined;
    let leaveRelated: CRCEventTarget | null | undefined;
    let overRelated: CRCEventTarget | null | undefined;
    let enterRelated: CRCEventTarget | null | undefined;
    const scene = boundaryScene(trace, true, {
      onATarget(event) {
        aTarget = event.target;
      },
      onBTarget(event) {
        bTarget = event.target;
      },
      onOut(event) {
        outRelated = event.relatedTarget;
      },
      onLeave(event) {
        leaveRelated = event.relatedTarget;
      },
      onOver(event) {
        overRelated = event.relatedTarget;
      },
      onEnter(event) {
        enterRelated = event.relatedTarget;
      },
    });
    const canvas = createCanvas();
    crc(canvas, scene);
    await nextFrame();

    dispatchMouse(canvas, 'mousemove', 25, 25);
    trace.length = 0;
    dispatchMouse(canvas, 'mousemove', 75, 25);

    expect(trace).toEqual([
      'a-out:2',
      'parent-out:3',
      'root-out:3',
      'a-leave:2',
      'b-over:2',
      'parent-over:3',
      'root-over:3',
      'b-enter:2',
      'b-move:2',
    ]);
    expect(aTarget).toBeDefined();
    expect(bTarget).toBeDefined();
    expect(outRelated).toBe(bTarget);
    expect(leaveRelated).toBe(bTarget);
    expect(overRelated).toBe(aTarget);
    expect(enterRelated).toBe(aTarget);
  });

  it('targets the deepest common live listener after down and up resolve to siblings', async () => {
    const trace: string[] = [];
    let activationTarget: CRCEventTarget | undefined;
    const Target = defineComp<{
      label: string;
      x: number;
    }>(({ label, x }) => {
      crcEventTarget({
        onClick: () => trace.push(`${label}-click`),
      }, {
        path: rectanglePath(x, 0, 50, 50),
        fill: true,
      });
    });
    const Parent = defineComp(() => {
      crcEventListener({
        onClickCapture: event => trace.push(`parent-capture:${event.eventPhase}`),
        onClick: event => {
          activationTarget = event.target;
          trace.push(`parent:${event.eventPhase}:${event.x},${event.y}`);
        },
      });
      return [Target({ label: 'a', x: 0 }), Target({ label: 'b', x: 50 })];
    });
    const Root = defineComp(() => {
      crcEventListener({
        onClickCapture: event => trace.push(`root-capture:${event.eventPhase}`),
        onClick: event => {
          expect(event.target).toBe(activationTarget);
          trace.push(`root:${event.eventPhase}`);
        },
      });
      return Parent({});
    });
    const canvas = createCanvas();
    crc(canvas, Root({}));
    await nextFrame();

    dispatchMouse(canvas, 'mousedown', 25, 25);
    dispatchMouse(canvas, 'mouseup', 75, 25);
    dispatchMouse(canvas, 'click', 75, 25);

    expect(trace).toEqual([
      'root-capture:1',
      'parent-capture:2',
      'parent:2:75,25',
      'root:3',
    ]);
  });

  it.each(ACTIVATION_CASES)(
    'rejects $label when browser activation coordinates move to a sibling target',
    async ({ button, type }) => {
      const trace: string[] = [];
      const Target = defineComp<{
        label: string;
        x: number;
      }>(({ label, x }) => {
        crcEventTarget({
          onClick: () => trace.push(`${label}-click`),
          onAuxClick: () => trace.push(`${label}-auxclick`),
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

      dispatchMouse(canvas, 'mousedown', 25, 25, button);
      dispatchMouse(canvas, 'mouseup', 25, 25, button);
      dispatchMouse(canvas, type, 75, 25, button);

      expect(trace).toEqual([]);
    },
  );

  it.each(ACTIVATION_CASES)(
    'rejects common-listener $label when browser activation lands on Canvas background',
    async ({ button, type }) => {
      const trace: string[] = [];
      const Target = defineComp<{ x: number }>(({ x }) => {
        crcEventTarget({
          onClick: () => trace.push('target-click'),
          onAuxClick: () => trace.push('target-auxclick'),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      });
      const Parent = defineComp(() => {
        crcEventListener({
          onClick: () => trace.push('parent-click'),
          onAuxClick: () => trace.push('parent-auxclick'),
        });
        return [Target({ x: 0 }), Target({ x: 50 })];
      });
      const canvas = createCanvas();
      crc(canvas, Parent({}));
      await nextFrame();

      dispatchMouse(canvas, 'mousedown', 25, 25, button);
      dispatchMouse(canvas, 'mouseup', 75, 25, button);
      dispatchMouse(canvas, type, 25, 75, button);

      expect(trace).toEqual([]);
    },
  );

  it.each(ACTIVATION_CASES)(
    'retains $label eligibility after leaving and re-entering the pressed target',
    async ({ button, label, type }) => {
      const trace: string[] = [];
      const Target = defineComp<{
        targetLabel: string;
        x: number;
      }>(({ targetLabel, x }) => {
        crcEventTarget({
          onClick: () => trace.push(`${targetLabel}-click`),
          onAuxClick: () => trace.push(`${targetLabel}-auxclick`),
          onMouseMove: () => undefined,
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      });
      const Root = defineComp(() => [
        Target({ targetLabel: 'a', x: 0 }),
        Target({ targetLabel: 'b', x: 50 }),
      ]);
      const canvas = createCanvas();
      crc(canvas, Root({}));
      await nextFrame();

      dispatchMouse(canvas, 'mousemove', 25, 25);
      dispatchMouse(canvas, 'mousedown', 25, 25, button);
      dispatchMouse(canvas, 'mousemove', 75, 25);
      dispatchMouse(canvas, 'mousemove', 25, 25);
      dispatchMouse(canvas, 'mouseup', 25, 25, button);
      dispatchMouse(canvas, type, 25, 25, button);

      expect(trace).toEqual([`a-${label}`]);
    },
  );

  it('keeps auxiliary activation history from replacing an in-progress primary activation', async () => {
    const trace: string[] = [];
    const Target = defineComp<{
      label: string;
      x: number;
    }>(({ label, x }) => {
      crcEventTarget({
        onClick: () => trace.push(`${label}-click`),
        onAuxClick: () => trace.push(`${label}-auxclick`),
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

    dispatchMouse(canvas, 'mousedown', 25, 25, 0);
    dispatchMouse(canvas, 'mousedown', 75, 25, 2);
    dispatchMouse(canvas, 'mouseup', 75, 25, 2);
    dispatchMouse(canvas, 'auxclick', 75, 25, 2);
    dispatchMouse(canvas, 'mouseup', 25, 25, 0);
    dispatchMouse(canvas, 'click', 25, 25, 0);

    expect(trace).toEqual(['b-auxclick', 'a-click']);
  });

  it('runs root observers after logical propagation and isolates observer mutation and throws', async () => {
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(
      () => undefined,
    );
    const trace: string[] = [];
    const Target = defineComp(() => {
      crcEventTarget({
        onMouseMove: () => trace.push('target'),
      }, {
        path: rectanglePath(0, 0, 100, 100),
        fill: true,
      });
    });
    const Root = defineComp(() => {
      crcEvent('mousemove', () => {
        trace.push('throws');
        throw new Error('expected observer failure');
      });
      crcEvent('mousemove', () => trace.push('safe'));
      return Target({});
    });
    const canvas = createCanvas();
    crc(canvas, Root({}));
    await nextFrame();

    dispatchMouse(canvas, 'mousemove', 25, 25);

    expect(trace).toEqual(['target', 'throws', 'safe']);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('owns movement and root-exit listeners for a boundary-only target', async () => {
    const Target = defineComp(() => {
      crcEventTarget({ onMouseEnter: () => undefined }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    });
    const canvas = createCanvas();
    crc(canvas, Target({}));
    await nextFrame();
    const hub = getCRCInstance(canvas).eventRoot.nativeListeners;

    expect(hub?.count('mousemove')).toBe(1);
    expect(hub?.count('mouseout')).toBe(1);
    expect(hub?.count('mouseenter')).toBe(0);
  });

  it.each([
    {
      handlers: { onClick: () => undefined },
      expected: ['mousedown', 'mouseup', 'click'],
      label: 'click',
    },
    {
      handlers: { onDblClick: () => undefined },
      expected: ['mousedown', 'mouseup', 'click', 'dblclick'],
      label: 'double-click',
    },
    {
      handlers: { onAuxClick: () => undefined },
      expected: ['mousedown', 'mouseup', 'auxclick'],
      label: 'auxiliary-click',
    },
  ] as const)(
    'owns down/up and native activation prerequisites for $label targets',
    async ({ handlers, expected }) => {
      const Target = defineComp(() => {
        crcEventTarget(handlers, {
          path: rectanglePath(0, 0, 50, 50),
          fill: true,
        });
      });
      const canvas = createCanvas();
      crc(canvas, Target({}));
      await nextFrame();
      const hub = getCRCInstance(canvas).eventRoot.nativeListeners;

      const owned = [
        'mousedown',
        'mouseup',
        'click',
        'dblclick',
        'auxclick',
      ].filter(type => hub?.count(type as never));
      expect(owned).toEqual(expected);
    },
  );
});

interface BoundaryHooks {
  readonly onATarget?: (event: CRCMouseEvent) => void;
  readonly onBTarget?: (event: CRCMouseEvent) => void;
  readonly onOut?: (event: CRCMouseEvent) => void;
  readonly onLeave?: (event: CRCMouseEvent) => void;
  readonly onOver?: (event: CRCMouseEvent) => void;
  readonly onEnter?: (event: CRCMouseEvent) => void;
}

function boundaryScene(
  trace: string[],
  includeB: boolean,
  hooks: BoundaryHooks = {},
) {
  const listenerHandlers = (label: string): CRCEventHandlers => ({
    onMouseOver: event => trace.push(`${label}-over:${event.eventPhase}`),
    onMouseOut: event => trace.push(`${label}-out:${event.eventPhase}`),
    onMouseEnter: event => trace.push(`${label}-enter:${event.eventPhase}`),
    onMouseLeave: event => trace.push(`${label}-leave:${event.eventPhase}`),
  });
  const Target = defineComp<{
    label: 'a' | 'b';
    x: number;
  }>(({ label, x }) => {
    crcEventTarget({
      ...listenerHandlers(label),
      onMouseOver: event => {
        hooks.onOver?.(event);
        (label === 'a' ? hooks.onATarget : hooks.onBTarget)?.(event);
        trace.push(`${label}-over:${event.eventPhase}`);
      },
      onMouseOut: event => {
        hooks.onOut?.(event);
        trace.push(`${label}-out:${event.eventPhase}`);
      },
      onMouseEnter: event => {
        hooks.onEnter?.(event);
        trace.push(`${label}-enter:${event.eventPhase}`);
      },
      onMouseLeave: event => {
        hooks.onLeave?.(event);
        trace.push(`${label}-leave:${event.eventPhase}`);
      },
      onMouseMove: event => {
        (label === 'a' ? hooks.onATarget : hooks.onBTarget)?.(event);
        trace.push(`${label}-move:${event.eventPhase}`);
      },
    }, {
      path: rectanglePath(x, 0, 50, 50),
      fill: true,
    });
  });
  const Parent = defineComp(() => {
    crcEventListener(listenerHandlers('parent'));
    return includeB ?
        [Target({ label: 'a', x: 0 }), Target({ label: 'b', x: 50 })] :
        Target({ label: 'a', x: 0 });
  });
  const Root = defineComp(() => {
    crcEventListener(listenerHandlers('root'));
    return Parent({});
  });
  return Root({});
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'auxclick' | 'click' | 'mousedown' | 'mousemove' | 'mouseout' | 'mouseup',
  x: number,
  y: number,
  button = 0,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    button,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  }));
}

function rectanglePath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = 'display:block; width:100px; height:100px';
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
