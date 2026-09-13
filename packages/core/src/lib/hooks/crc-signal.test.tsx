import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computed,
  crc,
  crcSignal,
  definePrimitive,
  Rectangle,
  signal,
  type SignalOptions,
  type WritableSignal,
} from '../../index.js';
import { clearSharedState } from '../global-state.js';
import { crcRef } from './crc-ref.js';
import { crcState } from './crc-state.js';
import type { SystemStyle } from '../types.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('component signal reads', () => {
  it('schedules one deferred full-root render for a changed signal value', () => {
    const frames = new ManualFrames();
    const x = signal(1);
    const values: number[] = [];
    function Scene() {
      const value = x.get();
      values.push(value);
      return <Rectangle style={{ x: value, width: 10, height: 10 }} />;
    }

    const controller = crc(createCanvas(), <Scene />);
    expect(values).toEqual([]);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    expect(values).toEqual([1]);

    x.set(2);
    expect(values).toEqual([1]);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    expect(values).toEqual([1, 2]);
    expect(frames.pendingCount).toBe(0);

    x.set(2);
    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    frames.restore();
  });

  it('treats a signal read before crc construction as an untracked snapshot', () => {
    const frames = new ManualFrames();
    const x = signal(1);
    const snapshot = x.get();
    const renders = vi.fn();
    function Scene() {
      renders();
      return <Rectangle style={{ x: snapshot, width: 10, height: 10 }} />;
    }

    const controller = crc(createCanvas(), <Scene />);
    frames.flush();
    x.set(2);

    expect(renders).toHaveBeenCalledOnce();
    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    frames.restore();
  });

  it('schedules computed-only Plan work and renders only when its value changes', () => {
    const frames = new ManualFrames();
    const source = signal(1);
    const parity = computed(() => source.get() % 2);
    const renders = vi.fn();
    function Scene() {
      renders();
      return (
        <Rectangle
          style={{ x: parity.get() * 10, width: 10, height: 10 }}
        />
      );
    }

    const controller = crc(createCanvas(), <Scene />);
    frames.flush();

    source.set(3);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    expect(renders).toHaveBeenCalledOnce();
    expect(frames.pendingCount).toBe(0);

    source.set(4);
    expect(frames.pendingCount).toBe(1);
    expect(renders).toHaveBeenCalledOnce();
    frames.flush();
    expect(renders).toHaveBeenCalledTimes(2);
    controller.dispose();
    frames.restore();
  });

  it('replaces conditional dependencies after a successful render', () => {
    const frames = new ManualFrames();
    const chooseLeft = signal(true);
    const left = signal(1);
    const right = signal(20);
    function Scene() {
      const value = chooseLeft.get() ? left.get() : right.get();
      return <Rectangle style={{ x: value, width: 10, height: 10 }} />;
    }

    const controller = crc(createCanvas(), <Scene />);
    frames.flush();
    chooseLeft.set(false);
    frames.flush();

    left.set(2);
    expect(frames.pendingCount).toBe(0);
    right.set(21);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    controller.dispose();
    frames.restore();
  });

  it('collects primitive style-resolution and render-callback reads together', () => {
    const frames = new ManualFrames();
    const styleRead = signal(1);
    const renderRead = signal(10);
    const renders = vi.fn();
    interface ProbeStyle extends SystemStyle {
      value: number;
    }
    const Probe = definePrimitive<{}, ProbeStyle>(() => {
      renderRead.get();
      renders();
    }, {
      resolveStyle: style => {
        styleRead.get();
        return style;
      },
    });

    const controller = crc(createCanvas(), <Probe style={{ value: 1 }} />);
    frames.flush();
    styleRead.set(2);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    renderRead.set(11);
    expect(frames.pendingCount).toBe(1);
    frames.flush();

    expect(renders).toHaveBeenCalledTimes(3);
    controller.dispose();
    frames.restore();
  });

  it('detaches every signal edge when a component is removed', () => {
    const frames = new ManualFrames();
    const x = signal(1);
    const canvas = createCanvas();
    function Scene() {
      return <Rectangle style={{ x: x.get(), width: 10, height: 10 }} />;
    }

    const controller = crc(canvas, <Scene />);
    frames.flush();
    crc(canvas, undefined);
    frames.flush();

    x.set(2);
    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    frames.restore();
  });

  it('discards provisional reads when a root render fails', () => {
    const frames = new ManualFrames();
    const x = signal(1);
    const failure = new Error('render failed');
    function Broken(): never {
      x.get();
      throw failure;
    }

    const controller = crc(createCanvas(), <Broken />);
    expect(() => frames.flush()).toThrow(failure);
    x.set(2);

    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    frames.restore();
  });
});

describe('signal write guard', () => {
  it('rejects a no-op set before equality suppression during CRC render', () => {
    const target = signal(0);
    const frames = new ManualFrames();
    function Broken() {
      target.set(target.get());
    }

    const controller = crc(createCanvas(), <Broken />);
    expect(() => frames.flush()).toThrowError('CRC render');
    expect(target.get()).toBe(0);
    controller.dispose();
    frames.restore();
  });

  it('rejects a no-op update before invoking its updater during CRC render', () => {
    const target = signal(0);
    const updater = vi.fn((value: number) => value);
    const frames = new ManualFrames();
    function Broken() {
      target.update(updater);
    }

    const controller = crc(createCanvas(), <Broken />);
    expect(() => frames.flush()).toThrowError('CRC render');
    expect(updater).not.toHaveBeenCalled();
    expect(target.get()).toBe(0);
    controller.dispose();
    frames.restore();
  });

  for (const write of ['set', 'update'] as const) {
    it(`rejects signal ${write} from an ordinary component without changing the value`, () => {
      const target = signal(0);
      const frames = new ManualFrames();
      function Broken() {
        writeSignal(target, write);
      }

      const controller = crc(createCanvas(), <Broken />);
      expect(() => frames.flush()).toThrowError(/CRC render/);
      expect(target.get()).toBe(0);
      controller.dispose();
      frames.restore();
    });

    it(`rejects signal ${write} from primitive style resolution without changing the value`, () => {
      const target = signal(0);
      const frames = new ManualFrames();
      interface ProbeStyle extends SystemStyle {
        value: number;
      }
      const Broken = definePrimitive<{}, ProbeStyle>(() => undefined, {
        resolveStyle: style => {
          writeSignal(target, write);
          return style;
        },
      });

      const controller = crc(
        createCanvas(),
        <Broken style={{ value: 1 }} />,
      );
      expect(() => frames.flush()).toThrowError(/CRC render/);
      expect(target.get()).toBe(0);
      controller.dispose();
      frames.restore();
    });

    it(`rejects signal ${write} from a primitive render callback without changing the value`, () => {
      const target = signal(0);
      const frames = new ManualFrames();
      const Broken = definePrimitive<{}>(() => {
        writeSignal(target, write);
      });

      const controller = crc(createCanvas(), <Broken />);
      expect(() => frames.flush()).toThrowError(/CRC render/);
      expect(target.get()).toBe(0);
      controller.dispose();
      frames.restore();
    });

    it(`rejects signal ${write} from a computed callback without changing the value`, () => {
      const target = signal(0);
      const derived = computed(() => {
        writeSignal(target, write);
        return 1;
      });
      const frames = new ManualFrames();
      function Broken() {
        derived.get();
      }

      const controller = crc(createCanvas(), <Broken />);
      expect(() => frames.flush()).toThrowError(/computed signal/);
      expect(target.get()).toBe(0);
      controller.dispose();
      frames.restore();
    });
  }
});

describe('crcSignal', () => {
  it('keeps one identity per hook slot and captures initial configuration only on mount', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const identities: WritableSignal<number>[] = [];
    const values: number[] = [];
    const frozenOptions: SignalOptions<number> = {
      debugName: 'first',
      equals: () => true,
    };
    function Probe({
      initial,
      options,
    }: {
      initial: number;
      options: SignalOptions<number>;
    }) {
      const value = crcSignal(initial, options);
      identities.push(value);
      values.push(value.get());
    }

    const controller = crc(
      canvas,
      <Probe key="same" initial={1} options={frozenOptions} />,
    );
    frames.flush();
    crc(
      canvas,
      <Probe key="same" initial={2} options={{ equals: Object.is }} />,
    );
    frames.flush();

    expect(identities[1]).toBe(identities[0]);
    expect(values).toEqual([1, 1]);
    identities[0].set(9);
    expect(identities[0].get()).toBe(1);
    expect(frames.pendingCount).toBe(0);

    crc(
      canvas,
      <Probe key="replacement" initial={3} options={{ equals: Object.is }} />,
    );
    frames.flush();
    expect(identities[2]).not.toBe(identities[0]);
    expect(values).toEqual([1, 1, 3]);
    controller.dispose();
    frames.restore();
  });

  it('reports normal fewer, more, and changed hook-order diagnostics', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    function Fewer({ include }: { include: boolean }) {
      crcState(0);
      if (include) crcSignal(0);
    }
    const controller = crc(canvas, <Fewer include />);
    frames.flush();
    crc(canvas, <Fewer include={false} />);
    expect(() => frames.flush()).toThrowError(/fewer CRC hooks/i);

    function More({ include }: { include: boolean }) {
      crcState(0);
      if (include) crcSignal(0);
    }
    crc(canvas, <More include={false} />);
    frames.flush();
    crc(canvas, <More include />);
    expect(() => frames.flush()).toThrowError(/more CRC hooks/i);

    function Reordered({ swap }: { swap: boolean }) {
      if (swap) {
        crcRef(0);
        crcSignal(0);
      } else {
        crcSignal(0);
        crcRef(0);
      }
    }
    crc(canvas, <Reordered swap={false} />);
    frames.flush();
    crc(canvas, <Reordered swap />);
    expect(() => frames.flush()).toThrowError(/hook order changed/i);
    controller.dispose();
    frames.restore();
  });

  it('keeps a retained hook signal usable but inert after owner removal', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const renders = vi.fn();
    let retained: WritableSignal<number> | undefined;
    function Probe() {
      renders();
      retained = crcSignal(1);
      retained.get();
    }

    const controller = crc(canvas, <Probe />);
    frames.flush();
    retained!.set(2);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    expect(renders).toHaveBeenCalledTimes(2);

    crc(canvas, undefined);
    frames.flush();
    retained!.update(value => value + 1);
    expect(retained!.get()).toBe(3);
    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    frames.restore();
  });
});

function writeSignal(
  target: WritableSignal<number>,
  write: 'set' | 'update',
): void {
  if (write === 'set') {
    target.set(1);
  } else {
    target.update(value => value + 1);
  }
}

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

  get pendingCount(): number {
    return this.callbacks.size;
  }

  flush(): void {
    const entry = this.callbacks.entries().next().value;
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
