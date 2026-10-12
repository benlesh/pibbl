import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pibbl } from '../pibbl';
import {
  clearSharedState,
  getPibblInstance,
  GLOBAL_STATE,
} from '../global-state';
import type { RenderingContext2D } from '../types';
import { useCursor } from './use-cursor';
import { useComputed } from './use-computed';
import { useConst } from './use-const';
import { useEventListener } from './use-event-listener';
import { useEventTarget } from './use-event-target';
import { useLinePath } from './use-line-path';
import { usePlayback } from './use-playback';
import { useAnimatedValue } from './use-animated-value';
import { useRectPath } from './use-rect-path';
import { useRef } from './use-ref';
import { useReaction } from './use-reaction';
import { useSignal } from './use-signal';
import { useSvgPath } from './use-svg-path';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';
import { drive } from '../animation/program';
import { tween } from '../animation/definition';
import { signal } from '../signals/graph';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('useRef', () => {
  it('uses the initializer only on mount and resets object identity with the key', async () => {
    const canvas = createCanvas();
    const refs: object[] = [];
    const values: number[] = [];
    interface RefProbeProps {
      initial: number;
    }
    const RefProbe = ({ initial }: RefProbeProps) => {
      const ref = useRef(initial);
      refs.push(ref);
      values.push(ref.current!);
    };
    const controller = pibbl(canvas, createElement(RefProbe, { initial: 1, key: 'first' }));
    await nextFrame();
    pibbl(canvas, createElement(RefProbe, { initial: 2, key: 'first' }));
    await nextFrame();
    pibbl(canvas, createElement(RefProbe, { initial: 3, key: 'second' }));
    await nextFrame();

    expect(values).toEqual([1, 1, 3]);
    expect(refs[1]).toBe(refs[0]);
    expect(refs[2]).not.toBe(refs[0]);
    controller.dispose();
  });
});

describe('hook ordering and render errors', () => {
  it('releases an omitted hook resource, reports fewer hooks, and retries cleanly', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const cleanup = vi.fn();
    const Probe = ({ include }: { include: boolean }) => {
      useSignal(0);
      if (include) useReaction(() => cleanup, []);
    };
    const controller = pibbl(canvas, createElement(Probe, { include: true }));
    frames.flush();

    pibbl(canvas, createElement(Probe, { include: false }));
    expect(() => frames.flush()).toThrowError(/fewer Pibbl hooks/i);
    expect(cleanup).toHaveBeenCalledOnce();

    pibbl(canvas, createElement(Probe, { include: false }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('reports more hooks and changed hook order, with valid retries', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const MoreProbe = ({ more }: { more: boolean }) => {
      useSignal(0);
      if (more) useRef(0);
    };
    const controller = pibbl(canvas, createElement(MoreProbe, { more: false }));
    frames.flush();
    pibbl(canvas, createElement(MoreProbe, { more: true }));
    expect(() => frames.flush()).toThrowError(/more Pibbl hooks/i);
    pibbl(canvas, createElement(MoreProbe, { more: true }));
    expect(() => frames.flush()).not.toThrow();

    const OrderProbe = ({ swapped }: { swapped: boolean }) => {
      if (swapped) {
        useRef(0);
        useSignal(0);
      } else {
        useSignal(0);
        useRef(0);
      }
    };
    pibbl(canvas, createElement(OrderProbe, { swapped: false }));
    frames.flush();
    pibbl(canvas, createElement(OrderProbe, { swapped: true }));
    expect(() => frames.flush()).toThrowError(/hook order changed/i);
    pibbl(canvas, createElement(OrderProbe, { swapped: true }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('recovers context, globals, and component state after render and const factory errors', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const renderError = new Error('render failed');
    const Broken = definePrimitive<{}>((_props: {}, _style, ctx: RenderingContext2D) => {
      ctx.translate(20, 30);
      useSignal(1);
      throw renderError;
    });
    const transforms: DOMMatrix[] = [];
    const Healthy = definePrimitive<{}>((_props: {}, _style, ctx: RenderingContext2D) => {
      transforms.push(ctx.getTransform());
      useSignal(2);
    });
    const controller = pibbl(canvas, createElement(Broken, {}));
    expect(() => frames.flush()).toThrow(renderError);
    expect(GLOBAL_STATE.currentPibblInstance).toBeUndefined();
    expect(GLOBAL_STATE.componentRefs).toBeUndefined();

    pibbl(canvas, createElement(Healthy, {}));
    expect(() => frames.flush()).not.toThrow();
    expect(transforms[0].isIdentity).toBe(true);

    const constError = new Error('const failed');
    const ConstProbe = ({ fail }: { fail: boolean }) => {
      useConst(() => {
        if (fail) throw constError;
        return 'ok';
      });
    };
    pibbl(canvas, createElement(ConstProbe, { fail: true }));
    expect(() => frames.flush()).toThrow(constError);
    pibbl(canvas, createElement(ConstProbe, { fail: false }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('uses one intentional diagnostic for every public hook outside render', () => {
    const calls = [
      () => useSignal(0),
      () => useConst(() => 1),
      () => useComputed(() => 1),
      () => useRef(0),
      () => useReaction(() => undefined),
      () => usePlayback(drive(signal(0), tween({ to: 1, duration: 1 }))),
      () => useAnimatedValue(1, { animation: tween({ duration: 1 }) }),
      () => useRectPath(0, 0, 1, 1),
      () => useLinePath([[0, 0], [1, 1]]),
      () => useSvgPath('M0 0'),
      () => useEventListener({ onClick: () => {} }),
      () => useEventTarget(
        { onClick: () => {} },
        { path: new Path2D() },
      ),
      () => useCursor({ style: 'pointer' }),
    ];

    for (const call of calls) {
      expect(call).toThrowError(
        'Pibbl hooks can only be called while rendering a component.',
      );
    }
  });

  it('reports changed order for grouped event target and listener hooks', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const path = new Path2D();
    path.rect(0, 0, 20, 20);
    const Probe = ({ swapped }: { swapped: boolean }) => {
      if (swapped) {
        useEventListener({ onClick: () => undefined });
        useEventTarget({ onClick: () => undefined }, { path });
      } else {
        useEventTarget({ onClick: () => undefined }, { path });
        useEventListener({ onClick: () => undefined });
      }
    };
    const controller = pibbl(canvas, createElement(Probe, { swapped: false }));
    frames.flush();

    pibbl(canvas, createElement(Probe, { swapped: true }));
    expect(() => frames.flush()).toThrowError(/hook order changed/i);
    expect(getPibblInstance(canvas).eventRoot.targets.size).toBe(0);
    expect(getPibblInstance(canvas).eventRoot.listenersByComponent.size).toBe(0);

    pibbl(canvas, createElement(Probe, { swapped: true }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

});

class ManualFrames {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 1;
  private readonly request = vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(callback => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
  private readonly cancel = vi
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation(id => {
      this.callbacks.delete(id);
    });

  flush(): void {
    const entry = Array.from(this.callbacks.entries()).at(-1);
    if (!entry) throw new Error('No pending Pibbl frame');
    const [id, callback] = entry;
    this.callbacks.delete(id);
    callback(performance.now());
  }

  restore(): void {
    this.request.mockRestore();
    this.cancel.mockRestore();
  }
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
