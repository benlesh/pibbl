import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pibbl } from '../pibbl';
import { Layer } from '../components/layer';
import { Rectangle } from '../components/rect';
import type { PibblFocusManager } from '../focus/focus-manager';
import { focusManaged } from '../focus/policy-test-support';
import { clearSharedState, getPibblInstance } from '../global-state';
import { useEventListener } from '../hooks/use-event-listener';
import { useEventTarget } from '../hooks/use-event-target';
import { getPointerCaptureStateCounts } from './pointer-capture';
import type {
  PibblEventHandlers,
  PibblEventTarget,
  PibblPointerEvent,
  PibblWheelEvent,
} from './types';
import { createElement } from '../element/create-element';

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('DOM-aligned pointer dispatch', () => {
  it.each([
    {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      pressure: 0.5,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      width: 1,
      height: 1,
    },
    {
      pointerId: 17,
      pointerType: 'pen',
      isPrimary: false,
      pressure: 0.75,
      tangentialPressure: -0.25,
      tiltX: 31,
      tiltY: -19,
      twist: 271,
      width: 4,
      height: 6,
    },
    {
      pointerId: 29,
      pointerType: 'touch',
      isPrimary: true,
      pressure: 0.625,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      width: 18,
      height: 22,
    },
  ] as const)(
    'projects $pointerType pointer data and root-logical coordinates',
    async pointer => {
      let received: PibblPointerEvent | undefined;
      const Target = (_props: {}) => {
        useEventTarget({ onPointerDown: event => received = event }, {
          path: rectanglePath(0, 0, 100, 100),
          fill: true,
        });
      };
      const canvas = createCanvas();
      pibbl(canvas, createElement(Target, {}));
      await nextFrame();

      dispatchPointer(canvas, 'pointerdown', 37, 43, {
        ...pointer,
        button: 2,
        buttons: 2,
        altKey: true,
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      });

      expect(received).toMatchObject({
        type: 'pointerdown',
        x: 37,
        y: 43,
        button: 2,
        buttons: 2,
        altKey: true,
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        ...pointer,
      });
    },
  );

  it('keeps hover paths independent for simultaneous pointer IDs', async () => {
    const trace: string[] = [];
    const scene = pointerBoundaryScene(trace);
    const canvas = createCanvas();
    pibbl(canvas, scene);
    await nextFrame();

    dispatchPointer(canvas, 'pointermove', 25, 25, { pointerId: 1 });
    dispatchPointer(canvas, 'pointermove', 75, 25, { pointerId: 2 });
    expect(trace).toEqual([
      'a-over:1:2',
      'parent-over:1:3',
      'root-over:1:3',
      'root-enter:1:2',
      'parent-enter:1:2',
      'a-enter:1:2',
      'a-move:1:2',
      'b-over:2:2',
      'parent-over:2:3',
      'root-over:2:3',
      'root-enter:2:2',
      'parent-enter:2:2',
      'b-enter:2:2',
      'b-move:2:2',
    ]);

    trace.length = 0;
    dispatchPointer(canvas, 'pointermove', 75, 25, { pointerId: 1 });
    expect(trace).toEqual([
      'a-out:1:2',
      'parent-out:1:3',
      'root-out:1:3',
      'a-leave:1:2',
      'b-over:1:2',
      'parent-over:1:3',
      'root-over:1:3',
      'b-enter:1:2',
      'b-move:1:2',
    ]);

    trace.length = 0;
    dispatchPointer(canvas, 'pointermove', 25, 25, { pointerId: 2 });
    expect(trace).toEqual([
      'b-out:2:2',
      'parent-out:2:3',
      'root-out:2:3',
      'b-leave:2:2',
      'a-over:2:2',
      'parent-over:2:3',
      'root-over:2:3',
      'a-enter:2:2',
      'a-move:2:2',
    ]);
  });

  it('keeps synthetic pointerenter non-cancelable while pointermove can cancel its source', async () => {
    const observed: Array<{
      type: string;
      cancelable: boolean;
      defaultPrevented: boolean;
    }> = [];
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerEnter: event => {
          event.preventDefault();
          observed.push({
            type: event.type,
            cancelable: event.cancelable,
            defaultPrevented: event.defaultPrevented,
          });
        },
        onPointerMove: event => {
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
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    const entry = dispatchPointer(canvas, 'pointerover', 25, 25, {
      pointerId: 101,
    });
    const move = dispatchPointer(canvas, 'pointermove', 25, 25, {
      pointerId: 101,
    });

    expect(observed).toEqual([
      { type: 'pointerenter', cancelable: false, defaultPrevented: false },
      { type: 'pointermove', cancelable: true, defaultPrevented: true },
    ]);
    expect(entry.event.defaultPrevented).toBe(false);
    expect(entry.dispatchResult).toBe(true);
    expect(move.event.defaultPrevented).toBe(true);
    expect(move.dispatchResult).toBe(false);
  });

  it('routes captured movement before geometry and resumes boundary planning after release', async () => {
    const trace: string[] = [];
    let capturedTarget: PibblEventTarget | undefined;
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerOver: event => trace.push(`${label}-over:${event.pointerId}`),
          onPointerEnter: event => trace.push(`${label}-enter:${event.pointerId}`),
          onPointerMove: event => trace.push(`${label}-move:${event.pointerId}`),
          onPointerOut: event => trace.push(`${label}-out:${event.pointerId}`),
          onPointerLeave: event => trace.push(`${label}-leave:${event.pointerId}`),
          onPointerDown: event => {
            if (label === 'a') {
              capturedTarget = event.currentTarget;
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          },
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
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Root, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointermove', 25, 25, { pointerId: 3 });
    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 3 });
    trace.length = 0;
    dispatchPointer(canvas, 'pointermove', 75, 25, { pointerId: 3 });

    expect(trace).toEqual(['a-move:3']);
    expect(native.active).toEqual(new Set([3]));
    expect(capturedTarget?.hasPointerCapture(3)).toBe(true);

    capturedTarget?.releasePointerCapture(3);
    trace.length = 0;
    dispatchPointer(canvas, 'pointermove', 75, 25, { pointerId: 3 });

    expect(trace).toEqual([
      'a-out:3',
      'a-leave:3',
      'b-over:3',
      'b-enter:3',
      'b-move:3',
    ]);
    expect(native.active.size).toBe(0);
    expect(capturedTarget?.hasPointerCapture(3)).toBe(false);
  });

  it('keeps capture ownership independent for two simultaneous pointer IDs', async () => {
    const moves: string[] = [];
    const publicTargets = new Map<string, PibblEventTarget>();
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => {
            publicTargets.set(label, event.currentTarget);
            event.currentTarget.setPointerCapture(event.pointerId);
          },
          onPointerMove: event => moves.push(`${label}:${event.pointerId}`),
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
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Root, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 11 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 22 });
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 11 });
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 22 });
    expect(moves).toEqual(['a:11', 'b:22']);
    expect(native.active).toEqual(new Set([11, 22]));

    publicTargets.get('a')?.releasePointerCapture(11);
    dispatchPointer(canvas, 'pointermove', 75, 25, { pointerId: 11 });
    dispatchPointer(canvas, 'pointermove', 25, 25, { pointerId: 22 });

    expect(moves).toEqual(['a:11', 'b:22', 'b:11', 'b:22']);
    expect(native.active).toEqual(new Set([22]));
    expect(publicTargets.get('b')?.hasPointerCapture(22)).toBe(true);
  });

  it('routes pointerup outside geometry to the captured owner', async () => {
    const trace: string[] = [];
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerUp: event => trace.push(
          `up:${event.pointerId}:${event.x},${event.y}`,
        ),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 23 });
    dispatchPointer(canvas, 'pointerup', 150, 150, { pointerId: 23 });

    expect(trace).toEqual(['up:23:150,150']);
  });

  it('allows a live propagation-listener currentTarget to own capture', async () => {
    const trace: string[] = [];
    let listenerTarget: PibblEventTarget | undefined;
    const Target = (_props: {}) => {
      useEventTarget({ onPointerDown: () => trace.push('target-down') }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const Root = (_props: {}) => {
      useEventListener({
        onPointerDownCapture: event => {
          listenerTarget = event.currentTarget;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: event => trace.push(
          `listener-move:${event.eventPhase}:${event.target === listenerTarget}`,
        ),
      });
      return createElement(Target, {});
    };
    const canvas = createCanvas();
    installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Root, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 7 });
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 7 });

    expect(trace).toEqual(['target-down', 'listener-move:2:true']);
    expect(listenerTarget?.hasPointerCapture(7)).toBe(true);
  });

  it('does not claim logical capture when native capture rejects the pointer ID', async () => {
    let caught: unknown;
    let hasCapture: boolean | undefined;
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch (error) {
            caught = error;
          }
          hasCapture = event.currentTarget.hasPointerCapture(event.pointerId);
        },
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => {
      throw new DOMException('No active pointer', 'NotFoundError');
    });
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 404 });

    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('NotFoundError');
    expect(hasCapture).toBe(false);
    expect(getPibblInstance(canvas).eventRoot.pointerCaptures.size).toBe(0);
  });

  it('routes native capture notifications to the logical owner and clears before loss callbacks', async () => {
    const trace: string[] = [];
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onGotPointerCapture: event => trace.push(
          `got:${event.pointerId}:${event.currentTarget.hasPointerCapture(event.pointerId)}`,
        ),
        onLostPointerCapture: event => trace.push(
          `lost:${event.pointerId}:${event.currentTarget.hasPointerCapture(event.pointerId)}`,
        ),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 8 });
    dispatchPointer(canvas, 'gotpointercapture', 150, 150, { pointerId: 8 });
    native.active.delete(8);
    dispatchPointer(canvas, 'lostpointercapture', 150, 150, { pointerId: 8 });

    expect(trace).toEqual(['got:8:true', 'lost:8:false']);
    expect(getPibblInstance(canvas).eventRoot.pointerCaptures.size).toBe(0);
  });

  it('routes native got notification delivered during the capture call', async () => {
    const trace: string[] = [];
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onGotPointerCapture: event => trace.push(`got:${event.pointerId}`),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();
    vi.mocked(canvas.setPointerCapture).mockImplementation(pointerId => {
      native.active.add(pointerId);
      dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId });
    });

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 12 });

    expect(trace).toEqual(['got:12']);
    expect(getPibblInstance(canvas).eventRoot.pointerCaptures.has(12)).toBe(true);
  });

  it('preserves a released logical owner long enough to route native loss', async () => {
    const trace: string[] = [];
    let target: PibblEventTarget | undefined;
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          target = event.currentTarget;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onLostPointerCapture: event => trace.push(`lost:${event.pointerId}`),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 9 });
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 9 });
    target?.releasePointerCapture(9);
    expect(target?.hasPointerCapture(9)).toBe(false);
    dispatchPointer(canvas, 'lostpointercapture', 150, 150, { pointerId: 9 });

    expect(trace).toEqual(['lost:9']);
  });

  it('does not recreate pending loss when native release delivers loss synchronously', async () => {
    const trace: string[] = [];
    let target: PibblEventTarget | undefined;
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          target = event.currentTarget;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onLostPointerCapture: event => trace.push(`lost:${event.pointerId}`),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 10 });
    vi.mocked(canvas.releasePointerCapture).mockImplementation(pointerId => {
      native.active.delete(pointerId);
      dispatchPointer(canvas, 'lostpointercapture', 150, 150, { pointerId });
    });
    target?.releasePointerCapture(10);
    dispatchPointer(canvas, 'lostpointercapture', 150, 150, { pointerId: 10 });

    expect(trace).toEqual(['lost:10']);
    expect(getPibblInstance(canvas).eventRoot.pointerCaptures.size).toBe(0);
  });

  it('observes got delivered synchronously during native release', async () => {
    const trace: string[] = [];
    let target: PibblEventTarget | undefined;
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          target = event.currentTarget;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onGotPointerCapture: event => trace.push(`got:${event.pointerId}`),
        onLostPointerCapture: event => trace.push(`lost:${event.pointerId}`),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 14 });
    vi.mocked(canvas.releasePointerCapture).mockImplementation(pointerId => {
      dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId });
      native.active.delete(pointerId);
    });
    target?.releasePointerCapture(14);
    dispatchPointer(canvas, 'lostpointercapture', 25, 25, { pointerId: 14 });

    expect(trace).toEqual(['got:14', 'lost:14']);
  });

  it('rolls back activated ownership when native release throws', async () => {
    const trace: string[] = [];
    let target: PibblEventTarget | undefined;
    let caught: unknown;
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          target = event.currentTarget;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onLostPointerCapture: event => trace.push(`lost:${event.pointerId}`),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 15 });
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 15 });
    vi.mocked(canvas.releasePointerCapture).mockImplementationOnce(() => {
      throw new DOMException('Native release failed', 'InvalidStateError');
    });
    try {
      target?.releasePointerCapture(15);
    } catch (error) {
      caught = error;
    }

    expect((caught as DOMException).name).toBe('InvalidStateError');
    expect(target?.hasPointerCapture(15)).toBe(true);
    expect(eventRoot.pointerCaptures.size).toBe(1);
    expect(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 1,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });

    target?.releasePointerCapture(15);
    expect(native.active.has(15)).toBe(false);
    dispatchPointer(canvas, 'lostpointercapture', 25, 25, { pointerId: 15 });
    expect(trace).toEqual(['lost:15']);
    expect(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 0,
      nativeListenerRequests: 0,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
  });

  it('clears provisional capture released before native activation', async () => {
    const trace: string[] = [];
    let pointerId: number | undefined;
    let publicHasCapture: boolean | undefined;
    let nativeHasCapture: boolean | undefined;
    let trustedPointerDown = false;
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          pointerId = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.releasePointerCapture(event.pointerId);
          publicHasCapture = event.currentTarget.hasPointerCapture(
            event.pointerId,
          );
          nativeHasCapture = canvas.hasPointerCapture(event.pointerId);
        },
        onGotPointerCapture: event => trace.push(`got:${event.pointerId}`),
        onLostPointerCapture: event => trace.push(`lost:${event.pointerId}`),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    canvas.addEventListener('pointerdown', event => {
      trustedPointerDown = event.isTrusted;
    }, { once: true });
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;
    const hub = eventRoot.nativeListeners;
    const subscribedGotCount = hub?.count('gotpointercapture');
    const subscribedLossCount = hub?.count('lostpointercapture');
    expect(subscribedGotCount).toBe(1);
    expect(subscribedLossCount).toBe(1);

    await userEvent.click(canvas, { position: { x: 25, y: 25 } });

    expect(trustedPointerDown).toBe(true);
    expect(pointerId).toBeTypeOf('number');
    expect(trace).toEqual([]);
    expect(publicHasCapture).toBe(false);
    expect(nativeHasCapture).toBe(false);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(getPointerCaptureStateCounts(eventRoot)).toEqual({
      activated: 0,
      nativeListenerRequests: 0,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
    expect(hub?.count('pointercancel')).toBe(0);
    expect(hub?.count('gotpointercapture')).toBe(subscribedGotCount);
    expect(hub?.count('lostpointercapture')).toBe(subscribedLossCount);

    dispatchPointer(canvas, 'gotpointercapture', 25, 25, {
      pointerId: pointerId!,
    });
    dispatchPointer(canvas, 'lostpointercapture', 25, 25, {
      pointerId: pointerId!,
    });
    expect(trace).toEqual([]);
  });

  it('clears capture on pointercancel without disturbing another pointer', async () => {
    const trace: string[] = [];
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => event.currentTarget.setPointerCapture(
            event.pointerId,
          ),
          onPointerCancel: event => trace.push(
            `${label}-cancel:${event.pointerId}`,
          ),
          onPointerMove: event => trace.push(`${label}-move:${event.pointerId}`),
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
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Root, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 1 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 2 });
    native.active.delete(1);
    dispatchPointer(canvas, 'pointercancel', 150, 150, { pointerId: 1 });
    dispatchPointer(canvas, 'pointermove', 75, 25, { pointerId: 1 });
    dispatchPointer(canvas, 'pointermove', 25, 25, { pointerId: 2 });

    expect(trace).toEqual(['a-cancel:1', 'b-move:1', 'b-move:2']);
    expect(getPibblInstance(canvas).eventRoot.pointerCaptures.has(1)).toBe(false);
    expect(getPibblInstance(canvas).eventRoot.pointerCaptures.has(2)).toBe(true);
  });

  it('dispatches pointerrawupdate only when the browser supplies it', async () => {
    const trace: string[] = [];
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerMove: event => trace.push(`move:${event.pointerId}`),
        onPointerRawUpdate: event => trace.push(`raw:${event.pointerId}`),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointermove', 25, 25, { pointerId: 31 });
    dispatchPointer(canvas, 'pointerrawupdate', 25, 25, { pointerId: 31 });

    expect(trace).toEqual(['move:31', 'raw:31']);
  });

  it('forwards native pointer and compatibility mouse sequences independently', async () => {
    const trace: string[] = [];
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: () => trace.push('pointerdown'),
        onMouseDown: () => trace.push('mousedown'),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 1 });
    dispatchMouse(canvas, 'mousedown', 25, 25);

    expect(trace).toEqual(['pointerdown', 'mousedown']);
  });

  it('owns movement and root-exit prerequisites for a boundary-only target', async () => {
    const Target = (_props: {}) => {
      useEventTarget({ onPointerEnter: () => undefined }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();
    const hub = getPibblInstance(canvas).eventRoot.nativeListeners;

    expect(hub?.count('pointerover')).toBe(1);
    expect(hub?.count('pointermove')).toBe(1);
    expect(hub?.count('pointerout')).toBe(1);
    expect(hub?.count('pointerenter')).toBe(0);
    expect(hub?.count('pointerleave')).toBe(0);
  });

  it('releases a built-in target’s hover, capture, focus, cursor, and native ownership when pointer events become none', async () => {
    let publicTarget: PibblEventTarget | undefined;
    let pointerEnters = 0;
    const Scene = ({ pointerEvents }: { pointerEvents: 'auto' | 'none' }) =>
      focusManaged(createElement(Rectangle, {
        pointerEvents,
        keyboardFocusable: true,
        style: {
          width: 50,
          height: 50,
          fill: 'red',
          cursor: 'pointer',
        },
        onPointerEnter: () => pointerEnters++,
        onPointerDown: event => {
          publicTarget = event.currentTarget;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
      }));
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Scene, { pointerEvents: 'auto' }));
    await nextFrame();
    const instance = getPibblInstance(canvas);
    const eventRoot = instance.eventRoot;
    const hub = eventRoot.nativeListeners!;
    const manager = eventRoot.focusPolicy as PibblFocusManager;

    dispatchPointer(canvas, 'pointerover', 25, 25, { pointerId: 87 });
    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 87 });
    dispatchMouse(canvas, 'mousemove', 25, 25);
    expect(pointerEnters).toBe(1);
    expect(instance.interaction.hoveredRegion).toBeDefined();
    expect(canvas.style.cursor).toBe('pointer');
    expect(native.active).toEqual(new Set([87]));
    expect(eventRoot.pointerCaptures.size).toBe(1);
    expect(publicTarget?.hasPointerCapture(87)).toBe(true);
    expect(manager.resolveKeyboardTarget()).toBeDefined();
    expect(hub.count('pointerdown')).toBe(2);
    expect(hub.count('pointermove')).toBe(1);
    expect(hub.count('pointerout')).toBe(1);
    expect(hub.count('pointerover')).toBe(1);
    expect(hub.count('mousemove')).toBe(1);
    expect(hub.count('mouseout')).toBe(1);

    pibbl(canvas, createElement(Scene, { pointerEvents: 'none' }));
    await nextFrame();

    expect(eventRoot.targets).toHaveLength(0);
    expect(instance.interaction.hoveredRegion).toBeUndefined();
    expect(canvas.style.cursor).toBe('');
    expect(native.active).toEqual(new Set());
    expect(eventRoot.pointerCaptures).toHaveLength(0);
    expect(publicTarget?.hasPointerCapture(87)).toBe(false);
    expect(manager.resolveKeyboardTarget()).toBeUndefined();
    expect(manager.candidates).toEqual([]);
    expect(hub.count('pointerdown')).toBe(1);
    expect(hub.count('pointermove')).toBe(0);
    expect(hub.count('pointerout')).toBe(0);
    expect(hub.count('pointerover')).toBe(0);
    expect(hub.count('mousemove')).toBe(0);
    expect(hub.count('mouseout')).toBe(0);
    dispatchPointer(canvas, 'pointerover', 25, 25, { pointerId: 88 });
    expect(pointerEnters).toBe(1);
  });
});

describe('pointer capture ownership', () => {
  it('transfers one active pointer between logical owners before the next pointer event', async () => {
    const trace: string[] = [];
    const targets = new Map<string, PibblEventTarget>();
    const captureState = (pointerId: number) =>
      `a=${targets.get('a')?.hasPointerCapture(pointerId)},` +
      `b=${targets.get('b')?.hasPointerCapture(pointerId)}`;
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => {
            targets.set(label, event.currentTarget);
            if (label === 'a' && event.pointerId === 51) {
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          },
          onGotPointerCapture: event => trace.push(
            `${label}-got:${event.pointerId}:${captureState(event.pointerId)}`,
          ),
          onLostPointerCapture: event => trace.push(
            `${label}-lost:${event.pointerId}:${captureState(event.pointerId)}`,
          ),
          onPointerMove: event => trace.push(
            `${label}-move:${event.pointerId}`,
          ),
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
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Root, {}));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;
    const hub = eventRoot.nativeListeners!;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 51 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 999 });
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 51 });
    targets.get('a')!.setPointerCapture(52);
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 52 });
    trace.length = 0;

    targets.get('b')!.setPointerCapture(51);
    expect(targets.get('a')!.hasPointerCapture(51)).toBe(false);
    expect(targets.get('b')!.hasPointerCapture(51)).toBe(true);
    expect(native.active).toEqual(new Set([51, 52]));
    expect(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 2,
      nativeListenerRequests: 3,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
    expect(hub.count('pointercancel')).toBe(1);
    expect(hub.count('gotpointercapture')).toBe(3);
    expect(hub.count('lostpointercapture')).toBe(3);

    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 51 });
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 52 });
    expect(trace).toEqual([
      'a-lost:51:a=false,b=true',
      'b-got:51:a=false,b=true',
      'b-move:51',
      'a-move:52',
    ]);

    dispatchPointer(canvas, 'pointercancel', 150, 150, { pointerId: 51 });
    expect(targets.get('b')!.hasPointerCapture(51)).toBe(false);
    native.active.delete(51);
    dispatchPointer(canvas, 'lostpointercapture', 150, 150, { pointerId: 51 });
    expect(trace).toEqual([
      'a-lost:51:a=false,b=true',
      'b-got:51:a=false,b=true',
      'b-move:51',
      'a-move:52',
      'b-lost:51:a=false,b=false',
    ]);
    expect(targets.get('a')!.hasPointerCapture(52)).toBe(true);

    targets.get('a')!.releasePointerCapture(52);
    dispatchPointer(canvas, 'lostpointercapture', 150, 150, { pointerId: 52 });
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 0,
      nativeListenerRequests: 0,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
    expect(hub.count('pointercancel')).toBe(0);
    expect(hub.count('gotpointercapture')).toBe(2);
    expect(hub.count('lostpointercapture')).toBe(2);
  });

  it('treats capture requested by the old owner during loss as a fresh regain', async () => {
    const trace: string[] = [];
    const targets = new Map<string, PibblEventTarget>();
    let regainDuringLoss = true;
    const captureState = (pointerId: number) =>
      `a=${targets.get('a')?.hasPointerCapture(pointerId)},` +
      `b=${targets.get('b')?.hasPointerCapture(pointerId)}`;
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => targets.set(label, event.currentTarget),
          onGotPointerCapture: event => trace.push(
            `${label}-got:${captureState(event.pointerId)}`,
          ),
          onLostPointerCapture: event => {
            trace.push(`${label}-lost:${captureState(event.pointerId)}`);
            if (label === 'a' && regainDuringLoss) {
              regainDuringLoss = false;
              event.currentTarget.setPointerCapture(event.pointerId);
              trace.push(`a-request:${captureState(event.pointerId)}`);
            }
          },
          onPointerMove: event => trace.push(
            `${label}-move:${event.pointerId}`,
          ),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement((_props: {}) => [
      createElement(Target, { label: 'a', x: 0 }),
      createElement(Target, { label: 'b', x: 50 }),
    ], {}));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;
    const hub = eventRoot.nativeListeners!;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 53 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 999 });
    targets.get('a')!.setPointerCapture(53);
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 53 });
    trace.length = 0;

    targets.get('b')!.setPointerCapture(53);
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 53 });

    expect(trace).toEqual([
      'a-lost:a=false,b=true',
      'a-request:a=true,b=false',
      'a-got:a=true,b=false',
      'a-move:53',
    ]);
    expect(targets.get('a')!.hasPointerCapture(53)).toBe(true);
    expect(targets.get('b')!.hasPointerCapture(53)).toBe(false);

    native.active.delete(53);
    dispatchPointer(canvas, 'lostpointercapture', 150, 150, {
      pointerId: 53,
    });
    expect(trace).toEqual([
      'a-lost:a=false,b=true',
      'a-request:a=true,b=false',
      'a-got:a=true,b=false',
      'a-move:53',
      'a-lost:a=false,b=false',
    ]);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 0,
      nativeListenerRequests: 0,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
    expect(hub.count('pointercancel')).toBe(0);
    expect(hub.count('gotpointercapture')).toBe(2);
    expect(hub.count('lostpointercapture')).toBe(2);
  });

  it('does not stage a second old-owner loss when pending capture is released during loss', async () => {
    const trace: string[] = [];
    const targets = new Map<string, PibblEventTarget>();
    let releaseDuringLoss = true;
    const captureState = (pointerId: number) =>
      `a=${targets.get('a')?.hasPointerCapture(pointerId)},` +
      `b=${targets.get('b')?.hasPointerCapture(pointerId)}`;
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => targets.set(label, event.currentTarget),
          onGotPointerCapture: event => trace.push(
            `${label}-got:${captureState(event.pointerId)}`,
          ),
          onLostPointerCapture: event => {
            trace.push(`${label}-lost:${captureState(event.pointerId)}`);
            if (label === 'a' && releaseDuringLoss) {
              releaseDuringLoss = false;
              targets.get('b')!.releasePointerCapture(event.pointerId);
              trace.push(`b-release:${captureState(event.pointerId)}`);
            }
          },
          onPointerMove: event => trace.push(
            `${label}-move:${event.pointerId}`,
          ),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement((_props: {}) => [
      createElement(Target, { label: 'a', x: 0 }),
      createElement(Target, { label: 'b', x: 50 }),
    ], {}));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;
    const hub = eventRoot.nativeListeners!;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 54 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 999 });
    targets.get('a')!.setPointerCapture(54);
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 54 });
    trace.length = 0;

    targets.get('b')!.setPointerCapture(54);
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 54 });

    expect(trace).toEqual([
      'a-lost:a=false,b=true',
      'b-release:a=false,b=false',
    ]);
    expect(native.active.size).toBe(0);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect.soft(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 0,
      nativeListenerRequests: 0,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
    expect.soft(hub.count('pointercancel')).toBe(0);
    expect.soft(hub.count('gotpointercapture')).toBe(2);
    expect.soft(hub.count('lostpointercapture')).toBe(2);

    dispatchPointer(canvas, 'lostpointercapture', 150, 150, {
      pointerId: 54,
    });
    expect(trace).toEqual([
      'a-lost:a=false,b=true',
      'b-release:a=false,b=false',
    ]);
    expect(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 0,
      nativeListenerRequests: 0,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
  });

  it('coalesces a transfer back before processing without capture notifications', async () => {
    const trace: string[] = [];
    const targets = new Map<string, PibblEventTarget>();
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => targets.set(label, event.currentTarget),
          onGotPointerCapture: () => trace.push(`${label}-got`),
          onLostPointerCapture: () => trace.push(`${label}-lost`),
          onPointerMove: () => trace.push(`${label}-move`),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
    const canvas = createCanvas();
    installNativePointerCapture(canvas);
    pibbl(canvas, createElement((_props: {}) => [
      createElement(Target, { label: 'a', x: 0 }),
      createElement(Target, { label: 'b', x: 50 }),
    ], {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 61 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 999 });
    targets.get('a')!.setPointerCapture(61);
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 61 });
    trace.length = 0;

    targets.get('b')!.setPointerCapture(61);
    targets.get('a')!.setPointerCapture(61);
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 61 });

    expect(trace).toEqual(['a-move']);
    expect(targets.get('a')!.hasPointerCapture(61)).toBe(true);
    expect(targets.get('b')!.hasPointerCapture(61)).toBe(false);

    trace.length = 0;
    targets.get('b')!.setPointerCapture(61);
    targets.get('b')!.releasePointerCapture(61);
    dispatchPointer(canvas, 'lostpointercapture', 150, 150, { pointerId: 61 });
    expect(trace).toEqual(['a-lost']);
    expect(targets.get('a')!.hasPointerCapture(61)).toBe(false);
    expect(targets.get('b')!.hasPointerCapture(61)).toBe(false);
  });

  it('ignores a reentrant native got during transfer and routes synchronous native loss to the active owner', async () => {
    const trace: string[] = [];
    const targets = new Map<string, PibblEventTarget>();
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => targets.set(label, event.currentTarget),
          onGotPointerCapture: () => trace.push(`${label}-got`),
          onLostPointerCapture: () => trace.push(`${label}-lost`),
          onPointerMove: () => trace.push(`${label}-move`),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement((_props: {}) => [
      createElement(Target, { label: 'a', x: 0 }),
      createElement(Target, { label: 'b', x: 50 }),
    ], {}));
    await nextFrame();

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 71 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 999 });
    targets.get('a')!.setPointerCapture(71);
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 71 });
    trace.length = 0;
    vi.mocked(canvas.setPointerCapture).mockImplementation(pointerId => {
      native.active.add(pointerId);
      dispatchPointer(canvas, 'gotpointercapture', 75, 25, { pointerId });
    });

    targets.get('b')!.setPointerCapture(71);
    expect(trace).toEqual([]);
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 71 });
    expect(trace).toEqual(['a-lost', 'b-got', 'b-move']);

    trace.length = 0;
    vi.mocked(canvas.setPointerCapture).mockImplementation(pointerId => {
      native.active.delete(pointerId);
      dispatchPointer(canvas, 'lostpointercapture', 75, 25, { pointerId });
    });
    targets.get('a')!.setPointerCapture(71);

    expect(trace).toEqual(['b-lost']);
    expect(targets.get('a')!.hasPointerCapture(71)).toBe(false);
    expect(targets.get('b')!.hasPointerCapture(71)).toBe(false);
    dispatchPointer(canvas, 'lostpointercapture', 75, 25, { pointerId: 71 });
    expect(trace).toEqual(['b-lost']);
  });

  it('settles transfer ownership when either owner unmounts and during root disposal', async () => {
    const trace: string[] = [];
    const targets = new Map<string, PibblEventTarget>();
    const Target = ({ label, x }: { label: string; x: number }) => {
        useEventTarget({
          onPointerDown: event => targets.set(label, event.currentTarget),
          onGotPointerCapture: () => trace.push(`${label}-got`),
          onLostPointerCapture: () => trace.push(`${label}-lost`),
          onPointerMove: () => trace.push(`${label}-move`),
        }, {
          path: rectanglePath(x, 0, 50, 50),
          fill: true,
        });
      };
    const Scene = ({ showA, showB }: { showA: boolean; showB: boolean }) => [
        showA ? createElement(Target, { key: 'a', label: 'a', x: 0 }) : undefined,
        showB ? createElement(Target, { key: 'b', label: 'b', x: 50 }) : undefined,
      ];
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    const controller = pibbl(canvas, createElement(Scene, { showA: true, showB: true }));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 81 });
    dispatchPointer(canvas, 'pointerdown', 75, 25, { pointerId: 999 });
    const oldA = targets.get('a')!;
    const b = targets.get('b')!;
    oldA.setPointerCapture(81);
    dispatchPointer(canvas, 'gotpointercapture', 25, 25, { pointerId: 81 });
    trace.length = 0;

    b.setPointerCapture(81);
    pibbl(canvas, createElement(Scene, { showA: false, showB: true }));
    await nextFrame();
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 81 });
    expect(trace).toEqual(['b-got', 'b-move']);
    expect(oldA.hasPointerCapture(81)).toBe(false);
    expect(b.hasPointerCapture(81)).toBe(true);

    pibbl(canvas, createElement(Scene, { showA: true, showB: true }));
    await nextFrame();
    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 998 });
    const newA = targets.get('a')!;
    trace.length = 0;
    newA.setPointerCapture(81);
    pibbl(canvas, createElement(Scene, { showA: false, showB: true }));
    await nextFrame();
    dispatchPointer(canvas, 'lostpointercapture', 75, 25, { pointerId: 81 });
    expect(trace).toEqual(['b-lost']);
    expect(newA.hasPointerCapture(81)).toBe(false);
    expect(b.hasPointerCapture(81)).toBe(false);

    b.setPointerCapture(82);
    dispatchPointer(canvas, 'gotpointercapture', 75, 25, { pointerId: 82 });
    pibbl(canvas, createElement(Scene, { showA: true, showB: true }));
    await nextFrame();
    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 997 });
    targets.get('a')!.setPointerCapture(82);
    trace.length = 0;
    controller.dispose();

    expect(trace).toEqual([]);
    expect(native.active.size).toBe(0);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(getPointerCaptureStateCounts(eventRoot)).toMatchObject({
      activated: 0,
      nativeListenerRequests: 0,
      pendingLoss: 0,
      provisional: 0,
      releaseTransactions: 0,
    });
  });

  it('owns cancel and native loss while capture is active without subscribers', async () => {
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          event.currentTarget.setPointerCapture(event.pointerId);
        },
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, {}));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;
    const hub = eventRoot.nativeListeners;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 39 });
    expect(hub?.count('pointercancel')).toBe(1);
    expect(hub?.count('gotpointercapture')).toBe(1);
    expect(hub?.count('lostpointercapture')).toBe(1);

    native.active.delete(39);
    dispatchPointer(canvas, 'lostpointercapture', 25, 25, { pointerId: 39 });

    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(hub?.count('pointercancel')).toBe(0);
    expect(hub?.count('gotpointercapture')).toBe(0);
    expect(hub?.count('lostpointercapture')).toBe(0);
  });

  it('clears capture when a propagation-listener owner unmounts', async () => {
    const trace: string[] = [];
    let listenerTarget: PibblEventTarget | undefined;
    const Target = (_props: {}) => {
      useEventTarget({ onPointerDown: () => undefined }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const ListenerOwner = (_props: {}) => {
      useEventListener({
        onPointerDownCapture: event => {
          listenerTarget = event.currentTarget;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onLostPointerCapture: () => trace.push('ghost-listener-loss'),
      });
      return createElement(Target, {});
    };
    const Scene = ({ show }: { show: boolean }) =>
      show ? createElement(ListenerOwner, {}) : undefined;
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Scene, { show: true }));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 43 });
    expect(native.active).toEqual(new Set([43]));
    expect(eventRoot.pointerCaptures.size).toBe(1);

    pibbl(canvas, createElement(Scene, { show: false }));
    await nextFrame();
    expect(native.active.size).toBe(0);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(listenerTarget?.hasPointerCapture(43)).toBe(false);

    dispatchPointer(canvas, 'lostpointercapture', 25, 25, { pointerId: 43 });
    expect(trace).toEqual([]);
  });

  it('clears native and logical capture when a live registration is removed', async () => {
    const trace: string[] = [];
    const Target = ({ enabled }: { enabled: boolean }) => {
      useEventTarget(enabled ? {
        onPointerDown: event => {
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onLostPointerCapture: () => trace.push('ghost-loss'),
      } : {}, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Target, { enabled: true }));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 40 });
    expect(native.active).toEqual(new Set([40]));
    expect(eventRoot.pointerCaptures.size).toBe(1);
    pibbl(canvas, createElement(Target, { enabled: false }));
    await nextFrame();
    dispatchPointer(canvas, 'lostpointercapture', 25, 25, { pointerId: 40 });

    expect(native.active.size).toBe(0);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(trace).toEqual([]);
  });

  it('uses the root Canvas for a layer target and clears capture on layer teardown', async () => {
    const trace: string[] = [];
    const LayerTarget = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: event => trace.push(`layer-move:${event.pointerId}`),
        onLostPointerCapture: () => trace.push('ghost-layer-loss'),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const Scene = ({ show }: { show: boolean }) => show ? createElement(Layer, {
      children: createElement(LayerTarget, {}),
    }) : undefined;
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    pibbl(canvas, createElement(Scene, { show: true }));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 41 });
    dispatchPointer(canvas, 'pointermove', 150, 150, { pointerId: 41 });
    expect(trace).toEqual(['layer-move:41']);
    expect(native.active).toEqual(new Set([41]));

    pibbl(canvas, createElement(Scene, { show: false }));
    await nextFrame();
    dispatchPointer(canvas, 'lostpointercapture', 25, 25, { pointerId: 41 });

    expect(native.active.size).toBe(0);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(trace).toEqual(['layer-move:41']);
  });

  it('clears capture and native ownership on root disposal', async () => {
    const trace: string[] = [];
    const Target = (_props: {}) => {
      useEventTarget({
        onPointerDown: event => {
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onLostPointerCapture: () => trace.push('ghost-disposal-loss'),
      }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    const canvas = createCanvas();
    const native = installNativePointerCapture(canvas);
    const controller = pibbl(canvas, createElement(Target, {}));
    await nextFrame();
    const eventRoot = getPibblInstance(canvas).eventRoot;

    dispatchPointer(canvas, 'pointerdown', 25, 25, { pointerId: 42 });
    expect(native.active).toEqual(new Set([42]));
    expect(eventRoot.pointerCaptures.size).toBe(1);
    controller.dispose();
    dispatchPointer(canvas, 'lostpointercapture', 25, 25, { pointerId: 42 });

    expect(native.active.size).toBe(0);
    expect(eventRoot.pointerCaptures.size).toBe(0);
    expect(trace).toEqual([]);
  });

  it('does not claim capture for an OffscreenCanvas root without a native source', async () => {
    const offscreen = new OffscreenCanvas(50, 50);
    const Target = (_props: {}) => {
      useEventTarget({ onPointerDown: () => undefined }, {
        path: rectanglePath(0, 0, 50, 50),
        fill: true,
      });
    };
    pibbl(offscreen as unknown as HTMLCanvasElement, createElement(Target, {}));
    await nextFrame();
    const instance = getPibblInstance(offscreen);
    const target = Array.from(instance.eventRoot.targets)[0];

    target.publicTarget.setPointerCapture(5);

    expect(instance.eventRoot.nativeListeners).toBeUndefined();
    expect(target.publicTarget.hasPointerCapture(5)).toBe(false);
    expect(instance.eventRoot.pointerCaptures.size).toBe(0);
  });
});

describe('DOM-aligned wheel dispatch', () => {
  it('projects root-logical coordinates and deltas, bubbles, and cancels natively', async () => {
    const trace: string[] = [];
    let received: PibblWheelEvent | undefined;
    const Target = (_props: {}) => {
      useEventTarget({
        onWheel: event => {
          received = event;
          trace.push(`target:${event.eventPhase}`);
          event.preventDefault();
        },
      }, {
        path: rectanglePath(0, 0, 100, 100),
        fill: true,
      });
    };
    const Root = (_props: {}) => {
      useEventListener({
        onWheelCapture: event => trace.push(`root-capture:${event.eventPhase}`),
        onWheel: event => trace.push(`root-bubble:${event.eventPhase}`),
      });
      return createElement(Target, {});
    };
    const canvas = createCanvas(200);
    pibbl(canvas, createElement(Root, {}));
    await nextFrame();
    const native = dispatchWheel(canvas, 50, 70, {
      deltaX: 1.25,
      deltaY: -6.5,
      deltaZ: 0.75,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
      altKey: true,
      shiftKey: true,
    });

    expect(trace).toEqual(['root-capture:1', 'target:2', 'root-bubble:3']);
    expect(received).toMatchObject({
      x: 25,
      y: 35,
      deltaX: 1.25,
      deltaY: -6.5,
      deltaZ: 0.75,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
      altKey: true,
      shiftKey: true,
      defaultPrevented: true,
    });
    expect(native.defaultPrevented).toBe(true);
  });
});

function pointerBoundaryScene(trace: string[]) {
  const handlers = (label: string): PibblEventHandlers => ({
    onPointerOver: event => trace.push(
      `${label}-over:${event.pointerId}:${event.eventPhase}`,
    ),
    onPointerEnter: event => trace.push(
      `${label}-enter:${event.pointerId}:${event.eventPhase}`,
    ),
    onPointerOut: event => trace.push(
      `${label}-out:${event.pointerId}:${event.eventPhase}`,
    ),
    onPointerLeave: event => trace.push(
      `${label}-leave:${event.pointerId}:${event.eventPhase}`,
    ),
  });
  const Target = ({ label, x }: { label: string; x: number }) => {
    useEventTarget({
      ...handlers(label),
      onPointerMove: event => trace.push(
        `${label}-move:${event.pointerId}:${event.eventPhase}`,
      ),
    }, {
      path: rectanglePath(x, 0, 50, 50),
      fill: true,
    });
  };
  const Parent = (_props: {}) => {
    useEventListener(handlers('parent'));
    return [createElement(Target, { label: 'a', x: 0 }), createElement(Target, { label: 'b', x: 50 })];
  };
  const Root = (_props: {}) => {
    useEventListener(handlers('root'));
    return createElement(Parent, {});
  };
  return createElement(Root, {});
}

interface NativePointerCaptureHarness {
  readonly active: Set<number>;
}

function installNativePointerCapture(
  canvas: HTMLCanvasElement,
): NativePointerCaptureHarness {
  const active = new Set<number>();
  vi.spyOn(canvas, 'setPointerCapture').mockImplementation(pointerId => {
    active.add(pointerId);
  });
  vi.spyOn(canvas, 'hasPointerCapture').mockImplementation(pointerId =>
    active.has(pointerId),
  );
  vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(pointerId => {
    if (!active.delete(pointerId)) {
      throw new DOMException('No active pointer', 'NotFoundError');
    }
  });
  return { active };
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type:
    | 'gotpointercapture'
    | 'lostpointercapture'
    | 'pointercancel'
    | 'pointerdown'
    | 'pointermove'
    | 'pointerover'
    | 'pointerrawupdate'
    | 'pointerup',
  x: number,
  y: number,
  init: PointerEventInit & { pointerId: number },
): { readonly dispatchResult: boolean; readonly event: PointerEvent } {
  const bounds = canvas.getBoundingClientRect();
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: type !== 'gotpointercapture' &&
      type !== 'lostpointercapture' &&
      type !== 'pointercancel' &&
      type !== 'pointerrawupdate',
    pointerType: 'touch',
    isPrimary: true,
    pressure: 0.5,
    width: 1,
    height: 1,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    ...init,
  });
  const dispatchResult = canvas.dispatchEvent(event);
  return { dispatchResult, event };
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'mousedown' | 'mousemove',
  x: number,
  y: number,
): MouseEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  });
  canvas.dispatchEvent(event);
  return event;
}

function dispatchWheel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  init: WheelEventInit,
): WheelEvent {
  const bounds = canvas.getBoundingClientRect();
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    ...init,
  });
  canvas.dispatchEvent(event);
  return event;
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
