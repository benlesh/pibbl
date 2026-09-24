import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import {
  clearSharedState,
  getCRCInstance,
  GLOBAL_STATE,
} from '../global-state';
import type { CRCMouseEventListener, RenderingContext2D } from '../types';
import { useCursor } from './use-cursor';
import { useComputed } from './use-computed';
import { useConst } from './use-const';
import { useEvent } from './use-event';
import { useEventListener } from './use-event-listener';
import { useEventTarget } from './use-event-target';
import { useLinePath } from './use-line-path';
import { useMemo } from './use-memo';
import { usePlayback } from './use-playback';
import { useTransition } from './use-transition';
import { useRectPath } from './use-rect-path';
import { useRef } from './use-ref';
import { useSignal } from './use-signal';
import { useState, type StateUpdater } from './use-state';
import { useSvgPath } from './use-svg-path';
import { useWhenChanged } from './use-when-changed';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';
import { track } from '../animation/program';
import { tween } from '../animation/definition';
import { signal } from '../signals/graph';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('useState', () => {
  it('keeps one setter, batches functional updates, and resets on key replacement', async () => {
    const canvas = createCanvas();
    const renders: Array<{ key: string; setter: StateUpdater<number>; value: number }> = [];
    interface StateProbeProps {
      label: string;
    }
    const StateProbe = (props: StateProbeProps) => {
      const [value, setter] = useState(0);
      renders.push({ key: props.label, setter, value });
    };
    const controller = crc(canvas, createElement(StateProbe, { key: 'first', label: 'first' }));
    await nextFrame();
    const setter = renders[0].setter;

    setter(value => value + 1);
    setter(value => value + 1);
    setter(value => value + 1);
    await nextFrame();
    expect(renders.at(-1)).toMatchObject({ key: 'first', value: 3 });
    expect(renders.at(-1)?.setter).toBe(setter);

    crc(canvas, createElement(StateProbe, { key: 'second', label: 'second' }));
    await nextFrame();
    expect(renders.at(-1)).toMatchObject({ key: 'second', value: 0 });
    expect(renders.at(-1)?.setter).not.toBe(setter);
    controller.dispose();
  });
});

describe('useMemo', () => {
  it('reuses empty dependencies and recomputes for value or length changes', async () => {
    const canvas = createCanvas();
    const factory = vi.fn(() => ({ call: factory.mock.calls.length }));
    const values: object[] = [];
    const Probe = ({ deps }: { deps: unknown[] }) => {
      values.push(useMemo(factory, deps));
    };
    const controller = crc(canvas, createElement(Probe, { deps: [] }));
    await nextFrame();
    crc(canvas, createElement(Probe, { deps: [] }));
    await nextFrame();
    expect(factory).toHaveBeenCalledOnce();
    expect(values[1]).toBe(values[0]);

    crc(canvas, createElement(Probe, { deps: [1] }));
    await nextFrame();
    crc(canvas, createElement(Probe, { deps: [1, 2] }));
    await nextFrame();
    expect(factory).toHaveBeenCalledTimes(3);
    controller.dispose();
  });

  it('uses strict-equality dependency semantics', async () => {
    const canvas = createCanvas();
    const factory = vi.fn(() => factory.mock.calls.length);
    const Probe = ({ dependency }: { dependency: number }) => {
      useMemo(factory, [dependency]);
    };
    const controller = crc(canvas, createElement(Probe, { dependency: Number.NaN }));
    await nextFrame();
    crc(canvas, createElement(Probe, { dependency: Number.NaN }));
    await nextFrame();
    crc(canvas, createElement(Probe, { dependency: 0 }));
    await nextFrame();
    crc(canvas, createElement(Probe, { dependency: -0 }));
    await nextFrame();

    expect(factory).toHaveBeenCalledTimes(3);
    controller.dispose();
  });
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
    const controller = crc(canvas, createElement(RefProbe, { initial: 1, key: 'first' }));
    await nextFrame();
    crc(canvas, createElement(RefProbe, { initial: 2, key: 'first' }));
    await nextFrame();
    crc(canvas, createElement(RefProbe, { initial: 3, key: 'second' }));
    await nextFrame();

    expect(values).toEqual([1, 1, 3]);
    expect(refs[1]).toBe(refs[0]);
    expect(refs[2]).not.toBe(refs[0]);
    controller.dispose();
  });
});

describe('useWhenChanged', () => {
  it('runs without dependencies on every render and cleans up first', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const Probe = ({ render }: { render: number }) => {
      useWhenChanged(() => {
        events.push(`setup:${render}`);
        return () => events.push(`cleanup:${render}`);
      });
    };
    const controller = crc(canvas, createElement(Probe, { render: 1 }));
    await nextFrame();
    crc(canvas, createElement(Probe, { render: 2 }));
    await nextFrame();

    expect(events).toEqual(['setup:1', 'cleanup:1', 'setup:2']);
    controller.dispose();
    expect(events).toEqual([
      'setup:1',
      'cleanup:1',
      'setup:2',
      'cleanup:2',
    ]);
  });

  it('does not repeat the previous cleanup when the next callback throws', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const cleanup = vi.fn();
    const error = new Error('setup failed');
    const Probe = ({ fail }: { fail: boolean }) => {
      useWhenChanged(() => {
        if (fail) throw error;
        return cleanup;
      }, [fail]);
    };
    const controller = crc(canvas, createElement(Probe, { fail: false }));
    frames.flush();

    crc(canvas, createElement(Probe, { fail: true }));
    expect(() => frames.flush()).toThrow(error);
    expect(cleanup).toHaveBeenCalledOnce();

    crc(canvas, createElement(Probe, { fail: false }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    expect(cleanup).toHaveBeenCalledTimes(2);
    frames.restore();
  });
});

describe('hook ordering and render errors', () => {
  it('releases an omitted hook resource, reports fewer hooks, and retries cleanly', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const cleanup = vi.fn();
    const Probe = ({ include }: { include: boolean }) => {
      useState(0);
      if (include) useWhenChanged(() => cleanup, []);
    };
    const controller = crc(canvas, createElement(Probe, { include: true }));
    frames.flush();

    crc(canvas, createElement(Probe, { include: false }));
    expect(() => frames.flush()).toThrowError(/fewer CRC hooks/i);
    expect(cleanup).toHaveBeenCalledOnce();

    crc(canvas, createElement(Probe, { include: false }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('reports more hooks and changed hook order, with valid retries', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const MoreProbe = ({ more }: { more: boolean }) => {
      useState(0);
      if (more) useRef(0);
    };
    const controller = crc(canvas, createElement(MoreProbe, { more: false }));
    frames.flush();
    crc(canvas, createElement(MoreProbe, { more: true }));
    expect(() => frames.flush()).toThrowError(/more CRC hooks/i);
    crc(canvas, createElement(MoreProbe, { more: true }));
    expect(() => frames.flush()).not.toThrow();

    const OrderProbe = ({ swapped }: { swapped: boolean }) => {
      if (swapped) {
        useRef(0);
        useState(0);
      } else {
        useState(0);
        useRef(0);
      }
    };
    crc(canvas, createElement(OrderProbe, { swapped: false }));
    frames.flush();
    crc(canvas, createElement(OrderProbe, { swapped: true }));
    expect(() => frames.flush()).toThrowError(/hook order changed/i);
    crc(canvas, createElement(OrderProbe, { swapped: true }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('recovers context, globals, and component state after render and memo factory errors', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const renderError = new Error('render failed');
    const Broken = definePrimitive<{}>((_props: {}, _style, ctx: RenderingContext2D) => {
      ctx.translate(20, 30);
      useState(1);
      throw renderError;
    });
    const transforms: DOMMatrix[] = [];
    const Healthy = definePrimitive<{}>((_props: {}, _style, ctx: RenderingContext2D) => {
      transforms.push(ctx.getTransform());
      useState(2);
    });
    const controller = crc(canvas, createElement(Broken, {}));
    expect(() => frames.flush()).toThrow(renderError);
    expect(GLOBAL_STATE.currentCRCInstance).toBeUndefined();
    expect(GLOBAL_STATE.componentRefs).toBeUndefined();

    crc(canvas, createElement(Healthy, {}));
    expect(() => frames.flush()).not.toThrow();
    expect(transforms[0].isIdentity).toBe(true);

    const memoError = new Error('memo failed');
    const MemoProbe = ({ fail }: { fail: boolean }) => {
      useMemo(() => {
        if (fail) throw memoError;
        return 'ok';
      }, [fail]);
    };
    crc(canvas, createElement(MemoProbe, { fail: true }));
    expect(() => frames.flush()).toThrow(memoError);
    crc(canvas, createElement(MemoProbe, { fail: false }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('uses one intentional diagnostic for every public hook outside render', () => {
    const calls = [
      () => useState(0),
      () => useConst(() => 1),
      () => useComputed(() => 1),
      () => useMemo(() => 1, []),
      () => useRef(0),
      () => useSignal(0),
      () => usePlayback(track(signal(0), tween({ to: 1, duration: 1 }))),
      () => useTransition(1, { type: 'tween', duration: 1 }),
      () => useWhenChanged(() => {}, []),
      () => useRectPath(0, 0, 1, 1),
      () => useLinePath([[0, 0], [1, 1]]),
      () => useSvgPath('M0 0'),
      () => useEvent('click', () => {}),
      () => useEventListener({ onClick: () => {} }),
      () => useEventTarget(
        { onClick: () => {} },
        { path: new Path2D() },
      ),
      () => useCursor({ style: 'pointer' }),
    ];

    for (const call of calls) {
      expect(call).toThrowError(
        'CRC hooks can only be called while rendering a component.',
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
    const controller = crc(canvas, createElement(Probe, { swapped: false }));
    frames.flush();

    crc(canvas, createElement(Probe, { swapped: true }));
    expect(() => frames.flush()).toThrowError(/hook order changed/i);
    expect(getCRCInstance(canvas).eventRoot.targets.size).toBe(0);
    expect(getCRCInstance(canvas).eventRoot.listenersByComponent.size).toBe(0);

    crc(canvas, createElement(Probe, { swapped: true }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('keeps event and cursor slots stable when switching between global and path modes', async () => {
    const canvas = createCanvas();
    const path = new Path2D();
    path.rect(0, 0, 20, 20);
    const Probe = ({ local }: { local: boolean }) => {
      useEvent('click', () => {}, local ? path : undefined, true);
      useCursor({ path: local ? path : undefined, style: 'pointer', fill: true });
    };
    const controller = crc(canvas, createElement(Probe, { local: false }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    expect(instance.eventRoot.observers.get('click')?.size).toBe(1);
    expect(instance.regions.size).toBe(0);
    expect(instance.cursorDefaults.size).toBe(1);

    crc(canvas, createElement(Probe, { local: true }));
    await nextFrame();
    expect(instance.eventRoot.observers.get('click')?.size).toBe(0);
    expect(instance.regions.size).toBe(2);
    expect(instance.cursorDefaults.size).toBe(0);

    crc(canvas, createElement(Probe, { local: false }));
    await nextFrame();
    expect(instance.eventRoot.observers.get('click')?.size).toBe(1);
    expect(instance.regions.size).toBe(0);
    expect(instance.cursorDefaults.size).toBe(1);
    controller.dispose();
  });

  it('keeps one legacy target slot while replacing and removing a path-bound useEvent handler', async () => {
    const canvas = createCanvas();
    const path = new Path2D();
    path.rect(0, 0, 20, 20);
    const trace: string[] = [];
    const Probe = ({
      handler,
    }: {
      handler: CRCMouseEventListener | undefined;
    }) => {
      useEvent('mousemove', handler, path, true);
    };
    const firstHandler = () => trace.push('first');
    const controller = crc(canvas, createElement(Probe, { handler: firstHandler }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    const firstTarget = Array.from(instance.eventRoot.targets)[0];

    expect(instance.eventRoot.targets.size).toBe(1);
    expect(instance.regions.size).toBe(1);

    const replacementHandler = () => trace.push('replacement');
    crc(canvas, createElement(Probe, { handler: replacementHandler }));
    await nextFrame();

    expect(instance.eventRoot.targets.size).toBe(1);
    expect(Array.from(instance.eventRoot.targets)[0]).toBe(firstTarget);
    dispatchMouseMove(canvas, 10, 10);
    expect(trace).toEqual(['replacement']);

    crc(canvas, createElement(Probe, { handler: undefined }));
    await nextFrame();
    expect(instance.eventRoot.targets.size).toBe(0);
    expect(instance.regions.size).toBe(0);
    controller.dispose();
  });

  it('orders no-path useEvent observers after targets and isolates replacement, removal, and throws', async () => {
    const reportError = vi.spyOn(globalThis, 'reportError').mockImplementation(
      () => undefined,
    );
    const canvas = createCanvas();
    const path = new Path2D();
    path.rect(0, 0, 20, 20);
    const trace: string[] = [];
    const Probe = ({
      first,
      generation,
    }: {
      first: boolean;
      generation: string;
    }) => {
      useEventTarget({
        onMouseMove: () => trace.push('target'),
      }, { path, fill: true });
      useEvent('mousemove', first ? () => {
        trace.push(`first-${generation}`);
        if (generation === 'throw') {
          throw new Error('expected observer failure');
        }
      } : undefined);
      useEvent('mousemove', () => trace.push('second'));
    };
    const controller = crc(canvas, createElement(Probe, { first: true, generation: 'throw' }));
    await nextFrame();

    dispatchMouseMove(canvas, 10, 10);
    expect(trace).toEqual(['target', 'first-throw', 'second']);
    expect(reportError).toHaveBeenCalledOnce();

    trace.length = 0;
    crc(canvas, createElement(Probe, { first: true, generation: 'replacement' }));
    await nextFrame();
    dispatchMouseMove(canvas, 10, 10);
    expect(trace).toEqual(['target', 'first-replacement', 'second']);

    trace.length = 0;
    crc(canvas, createElement(Probe, { first: false, generation: 'removed' }));
    await nextFrame();
    dispatchMouseMove(canvas, 10, 10);
    expect(trace).toEqual(['target', 'second']);
    controller.dispose();
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
    if (!entry) throw new Error('No pending CRC frame');
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

function dispatchMouseMove(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): void {
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    clientX,
    clientY,
  }));
}
