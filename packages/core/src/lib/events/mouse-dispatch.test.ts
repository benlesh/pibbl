import { afterEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { clearSharedState, getCRCInstance } from '../global-state';
import { crcEvent } from '../hooks/crc-event';
import { crcEventListener } from '../hooks/crc-event-listener';
import { crcEventTarget } from '../hooks/crc-event-target';
import type {
  CRCEventHandlers,
  CRCEventTarget,
  CRCLogicalMouseEvent,
} from './types';
import { createElement } from '../element/create-element';

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

  it('keeps synthetic mouseenter non-cancelable while mousemove can cancel its source', async () => {
    let cancelMove = false;
    const observed: Array<{
      type: string;
      cancelable: boolean;
      defaultPrevented: boolean;
    }> = [];
    const Target = (_props: {}) => {
      crcEventTarget({
        onMouseEnter: event => {
          event.preventDefault();
          observed.push({
            type: event.type,
            cancelable: event.cancelable,
            defaultPrevented: event.defaultPrevented,
          });
        },
        onMouseMove: event => {
          if (!cancelMove) return;
          event.preventDefault();
          observed.push({
            type: event.type,
            cancelable: event.cancelable,
            defaultPrevented: event.defaultPrevented,
          });
        },
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    crc(canvas, createElement(Target, {}));
    await nextFrame();

    const entry = dispatchMouse(canvas, 'mousemove', 25, 25);
    expect(observed[0]).toEqual({
      type: 'mouseenter',
      cancelable: false,
      defaultPrevented: false,
    });
    expect(entry.event.defaultPrevented).toBe(false);
    expect(entry.dispatchResult).toBe(true);

    observed.length = 0;
    cancelMove = true;
    const move = dispatchMouse(canvas, 'mousemove', 25, 25);
    expect(observed).toEqual([
      { type: 'mousemove', cancelable: true, defaultPrevented: true },
    ]);
    expect(move.event.defaultPrevented).toBe(true);
    expect(move.dispatchResult).toBe(false);
  });

  it('targets the deepest common live listener after down and up resolve to siblings', async () => {
    const trace: string[] = [];
    let activationTarget: CRCEventTarget | undefined;
    const Target = ({ label, x }: {
      label: string;
      x: number;
    }) => {
      crcEventTarget({
        onClick: () => trace.push(`${label}-click`),
      }, {
        path: rectanglePath(x, 0, 50, 50),
        fill: true,
      });
    };
    const Parent = (_props: {}) => {
      crcEventListener({
        onClickCapture: event => trace.push(`parent-capture:${event.eventPhase}`),
        onClick: event => {
          activationTarget = event.target;
          trace.push(`parent:${event.eventPhase}:${event.x},${event.y}`);
        },
      });
      return [createElement(Target, { label: 'a', x: 0 }), createElement(Target, { label: 'b', x: 50 })];
    };
    const Root = (_props: {}) => {
      crcEventListener({
        onClickCapture: event => trace.push(`root-capture:${event.eventPhase}`),
        onClick: event => {
          expect(event.target).toBe(activationTarget);
          trace.push(`root:${event.eventPhase}`);
        },
      });
      return createElement(Parent, {});
    };
    const canvas = createCanvas();
    crc(canvas, createElement(Root, {}));
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
      const Target = ({ label, x }: {
        label: string;
        x: number;
      }) => {
        crcEventTarget({
          onClick: () => trace.push(`${label}-click`),
          onAuxClick: () => trace.push(`${label}-auxclick`),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
      const Root = (_props: {}) => [
        createElement(Target, { label: 'a', x: 0 }),
        createElement(Target, { label: 'b', x: 50 }),
      ];
      const canvas = createCanvas();
      crc(canvas, createElement(Root, {}));
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
      const Target = ({ x }: { x: number }) => {
        crcEventTarget({
          onClick: () => trace.push('target-click'),
          onAuxClick: () => trace.push('target-auxclick'),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
      const Parent = (_props: {}) => {
        crcEventListener({
          onClick: () => trace.push('parent-click'),
          onAuxClick: () => trace.push('parent-auxclick'),
        });
        return [createElement(Target, { x: 0 }), createElement(Target, { x: 50 })];
      };
      const canvas = createCanvas();
      crc(canvas, createElement(Parent, {}));
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
      const Target = ({ targetLabel, x }: {
        targetLabel: string;
        x: number;
      }) => {
        crcEventTarget({
          onClick: () => trace.push(`${targetLabel}-click`),
          onAuxClick: () => trace.push(`${targetLabel}-auxclick`),
          onMouseMove: () => undefined,
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
      const Root = (_props: {}) => [
        createElement(Target, { targetLabel: 'a', x: 0 }),
        createElement(Target, { targetLabel: 'b', x: 50 }),
      ];
      const canvas = createCanvas();
      crc(canvas, createElement(Root, {}));
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
    const Target = ({ label, x }: {
      label: string;
      x: number;
    }) => {
      crcEventTarget({
        onClick: () => trace.push(`${label}-click`),
        onAuxClick: () => trace.push(`${label}-auxclick`),
      }, {
        path: rectanglePath(x, 0, 50, 50),
        fill: true,
      });
    };
    const Root = (_props: {}) => [
      createElement(Target, { label: 'a', x: 0 }),
      createElement(Target, { label: 'b', x: 50 }),
    ];
    const canvas = createCanvas();
    crc(canvas, createElement(Root, {}));
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
    const Target = (_props: {}) => {
      crcEventTarget({
        onMouseMove: () => trace.push('target'),
      }, {
        path: rectanglePath(0, 0, 100, 100),
        fill: true,
      });
    };
    const Root = (_props: {}) => {
      crcEvent('mousemove', () => {
        trace.push('throws');
        throw new Error('expected observer failure');
      });
      crcEvent('mousemove', () => trace.push('safe'));
      return createElement(Target, {});
    };
    const canvas = createCanvas();
    crc(canvas, createElement(Root, {}));
    await nextFrame();

    dispatchMouse(canvas, 'mousemove', 25, 25);

    expect(trace).toEqual(['target', 'throws', 'safe']);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('owns movement and root-exit listeners for a boundary-only target', async () => {
    const Target = (_props: {}) => {
      crcEventTarget({ onMouseEnter: () => undefined }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    crc(canvas, createElement(Target, {}));
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
      const Target = (_props: {}) => {
        crcEventTarget(handlers, {
          path: rectanglePath(0, 0, 50, 50),
          fill: true,
        });
      };
      const canvas = createCanvas();
      crc(canvas, createElement(Target, {}));
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
  readonly onATarget?: (event: CRCLogicalMouseEvent) => void;
  readonly onBTarget?: (event: CRCLogicalMouseEvent) => void;
  readonly onOut?: (event: CRCLogicalMouseEvent) => void;
  readonly onLeave?: (event: CRCLogicalMouseEvent) => void;
  readonly onOver?: (event: CRCLogicalMouseEvent) => void;
  readonly onEnter?: (event: CRCLogicalMouseEvent) => void;
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
  const Target = ({ label, x }: {
    label: 'a' | 'b';
    x: number;
  }) => {
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
  };
  const Parent = (_props: {}) => {
    crcEventListener(listenerHandlers('parent'));
    return includeB ?
        [createElement(Target, { label: 'a', x: 0 }), createElement(Target, { label: 'b', x: 50 })] :
        createElement(Target, { label: 'a', x: 0 });
  };
  const Root = (_props: {}) => {
    crcEventListener(listenerHandlers('root'));
    return createElement(Parent, {});
  };
  return createElement(Root, {});
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'auxclick' | 'click' | 'mousedown' | 'mousemove' | 'mouseout' | 'mouseup',
  x: number,
  y: number,
  button = 0,
): { readonly dispatchResult: boolean; readonly event: MouseEvent } {
  const bounds = canvas.getBoundingClientRect();
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  });
  const dispatchResult = canvas.dispatchEvent(event);
  return { dispatchResult, event };
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
