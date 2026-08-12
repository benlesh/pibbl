import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { defineComp } from '../define-comp';
import {
  clearSharedState,
  getCRCInstance,
  GLOBAL_STATE,
} from '../global-state';
import type { RenderingContext2D } from '../types';
import { crcCursor } from './crc-cursor';
import { crcEvent } from './crc-event';
import { crcLinePath } from './crc-line-path';
import { crcMemo } from './crc-memo';
import { crcRectPath } from './crc-rect-path';
import { crcRef } from './crc-ref';
import { crcState, type StateUpdater } from './crc-state';
import { crcSvgPath } from './crc-svg-path';
import { crcWhenChanged } from './crc-when-changed';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('crcState', () => {
  it('keeps one setter, batches functional updates, and resets on key replacement', async () => {
    const canvas = createCanvas();
    const renders: Array<{ key: string; setter: StateUpdater<number>; value: number }> = [];
    interface StateProbeProps {
      key: string;
    }
    const StateProbe = defineComp((props: StateProbeProps) => {
      const [value, setter] = crcState(0);
      renders.push({ key: props.key, setter, value });
    });
    const controller = crc(canvas, StateProbe({ key: 'first' }));
    await nextFrame();
    const setter = renders[0].setter;

    setter(value => value + 1);
    setter(value => value + 1);
    setter(value => value + 1);
    await nextFrame();
    expect(renders.at(-1)).toMatchObject({ key: 'first', value: 3 });
    expect(renders.at(-1)?.setter).toBe(setter);

    crc(canvas, StateProbe({ key: 'second' }));
    await nextFrame();
    expect(renders.at(-1)).toMatchObject({ key: 'second', value: 0 });
    expect(renders.at(-1)?.setter).not.toBe(setter);
    controller.dispose();
  });
});

describe('crcMemo', () => {
  it('reuses empty dependencies and recomputes for value or length changes', async () => {
    const canvas = createCanvas();
    const factory = vi.fn(() => ({ call: factory.mock.calls.length }));
    const values: object[] = [];
    const Probe = defineComp(({ deps }: { deps: unknown[] }) => {
      values.push(crcMemo(factory, deps));
    });
    const controller = crc(canvas, Probe({ deps: [] }));
    await nextFrame();
    crc(canvas, Probe({ deps: [] }));
    await nextFrame();
    expect(factory).toHaveBeenCalledOnce();
    expect(values[1]).toBe(values[0]);

    crc(canvas, Probe({ deps: [1] }));
    await nextFrame();
    crc(canvas, Probe({ deps: [1, 2] }));
    await nextFrame();
    expect(factory).toHaveBeenCalledTimes(3);
    controller.dispose();
  });

  it('uses strict-equality dependency semantics', async () => {
    const canvas = createCanvas();
    const factory = vi.fn(() => factory.mock.calls.length);
    const Probe = defineComp(({ dependency }: { dependency: number }) => {
      crcMemo(factory, [dependency]);
    });
    const controller = crc(canvas, Probe({ dependency: Number.NaN }));
    await nextFrame();
    crc(canvas, Probe({ dependency: Number.NaN }));
    await nextFrame();
    crc(canvas, Probe({ dependency: 0 }));
    await nextFrame();
    crc(canvas, Probe({ dependency: -0 }));
    await nextFrame();

    expect(factory).toHaveBeenCalledTimes(3);
    controller.dispose();
  });
});

describe('crcRef', () => {
  it('uses the initializer only on mount and resets object identity with the key', async () => {
    const canvas = createCanvas();
    const refs: object[] = [];
    const values: number[] = [];
    interface RefProbeProps {
      initial: number;
      key: string;
    }
    const RefProbe = defineComp(({ initial }: RefProbeProps) => {
      const ref = crcRef(initial);
      refs.push(ref);
      values.push(ref.current!);
    });
    const controller = crc(canvas, RefProbe({ initial: 1, key: 'first' }));
    await nextFrame();
    crc(canvas, RefProbe({ initial: 2, key: 'first' }));
    await nextFrame();
    crc(canvas, RefProbe({ initial: 3, key: 'second' }));
    await nextFrame();

    expect(values).toEqual([1, 1, 3]);
    expect(refs[1]).toBe(refs[0]);
    expect(refs[2]).not.toBe(refs[0]);
    controller.dispose();
  });
});

describe('crcWhenChanged', () => {
  it('runs without dependencies on every render and cleans up first', async () => {
    const canvas = createCanvas();
    const events: string[] = [];
    const Probe = defineComp(({ render }: { render: number }) => {
      crcWhenChanged(() => {
        events.push(`setup:${render}`);
        return () => events.push(`cleanup:${render}`);
      });
    });
    const controller = crc(canvas, Probe({ render: 1 }));
    await nextFrame();
    crc(canvas, Probe({ render: 2 }));
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
    const Probe = defineComp(({ fail }: { fail: boolean }) => {
      crcWhenChanged(() => {
        if (fail) throw error;
        return cleanup;
      }, [fail]);
    });
    const controller = crc(canvas, Probe({ fail: false }));
    frames.flush();

    crc(canvas, Probe({ fail: true }));
    expect(() => frames.flush()).toThrow(error);
    expect(cleanup).toHaveBeenCalledOnce();

    crc(canvas, Probe({ fail: false }));
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
    const Probe = defineComp(({ include }: { include: boolean }) => {
      crcState(0);
      if (include) crcWhenChanged(() => cleanup, []);
    });
    const controller = crc(canvas, Probe({ include: true }));
    frames.flush();

    crc(canvas, Probe({ include: false }));
    expect(() => frames.flush()).toThrowError(/fewer CRC hooks/i);
    expect(cleanup).toHaveBeenCalledOnce();

    crc(canvas, Probe({ include: false }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('reports more hooks and changed hook order, with valid retries', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const MoreProbe = defineComp(({ more }: { more: boolean }) => {
      crcState(0);
      if (more) crcRef(0);
    });
    const controller = crc(canvas, MoreProbe({ more: false }));
    frames.flush();
    crc(canvas, MoreProbe({ more: true }));
    expect(() => frames.flush()).toThrowError(/more CRC hooks/i);
    crc(canvas, MoreProbe({ more: true }));
    expect(() => frames.flush()).not.toThrow();

    const OrderProbe = defineComp(({ swapped }: { swapped: boolean }) => {
      if (swapped) {
        crcRef(0);
        crcState(0);
      } else {
        crcState(0);
        crcRef(0);
      }
    });
    crc(canvas, OrderProbe({ swapped: false }));
    frames.flush();
    crc(canvas, OrderProbe({ swapped: true }));
    expect(() => frames.flush()).toThrowError(/hook order changed/i);
    crc(canvas, OrderProbe({ swapped: true }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('recovers context, globals, and component state after render and memo factory errors', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const renderError = new Error('render failed');
    const Broken = defineComp((_props: {}, ctx: RenderingContext2D) => {
      ctx.translate(20, 30);
      crcState(1);
      throw renderError;
    });
    const transforms: DOMMatrix[] = [];
    const Healthy = defineComp((_props: {}, ctx: RenderingContext2D) => {
      transforms.push(ctx.getTransform());
      crcState(2);
    });
    const controller = crc(canvas, Broken({}));
    expect(() => frames.flush()).toThrow(renderError);
    expect(GLOBAL_STATE.currentCRCInstance).toBeUndefined();
    expect(GLOBAL_STATE.componentRefs).toBeUndefined();

    crc(canvas, Healthy({}));
    expect(() => frames.flush()).not.toThrow();
    expect(transforms[0].isIdentity).toBe(true);

    const memoError = new Error('memo failed');
    const MemoProbe = defineComp(({ fail }: { fail: boolean }) => {
      crcMemo(() => {
        if (fail) throw memoError;
        return 'ok';
      }, [fail]);
    });
    crc(canvas, MemoProbe({ fail: true }));
    expect(() => frames.flush()).toThrow(memoError);
    crc(canvas, MemoProbe({ fail: false }));
    expect(() => frames.flush()).not.toThrow();
    controller.dispose();
    frames.restore();
  });

  it('uses one intentional diagnostic for every public hook outside render', () => {
    const calls = [
      () => crcState(0),
      () => crcMemo(() => 1, []),
      () => crcRef(0),
      () => crcWhenChanged(() => {}, []),
      () => crcRectPath(0, 0, 1, 1),
      () => crcLinePath([[0, 0], [1, 1]]),
      () => crcSvgPath('M0 0'),
      () => crcEvent('click', () => {}),
      () => crcCursor({ style: 'pointer' }),
    ];

    for (const call of calls) {
      expect(call).toThrowError(
        'CRC hooks can only be called while rendering a component.',
      );
    }
  });

  it('keeps event and cursor slots stable when switching between global and path modes', async () => {
    const canvas = createCanvas();
    const path = new Path2D();
    path.rect(0, 0, 20, 20);
    const Probe = defineComp(({ local }: { local: boolean }) => {
      crcEvent('click', () => {}, local ? path : undefined, true);
      crcCursor({ path: local ? path : undefined, style: 'pointer', fill: true });
    });
    const controller = crc(canvas, Probe({ local: false }));
    await nextFrame();
    const instance = getCRCInstance(canvas);
    expect(instance.events.click.size).toBe(1);
    expect(instance.regions.size).toBe(0);
    expect(instance.cursorDefaults.size).toBe(1);

    crc(canvas, Probe({ local: true }));
    await nextFrame();
    expect(instance.events.click.size).toBe(0);
    expect(instance.regions.size).toBe(2);
    expect(instance.cursorDefaults.size).toBe(0);

    crc(canvas, Probe({ local: false }));
    await nextFrame();
    expect(instance.events.click.size).toBe(1);
    expect(instance.regions.size).toBe(0);
    expect(instance.cursorDefaults.size).toBe(1);
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
