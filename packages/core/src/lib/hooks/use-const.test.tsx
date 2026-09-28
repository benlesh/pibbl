import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc.js';
import { clearSharedState } from '../global-state.js';
import { signal } from '../signals/graph.js';
import { useRef } from './use-ref.js';
import { useSignal } from './use-signal.js';
import { useConst } from './use-const.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('useConst', () => {
  it('runs once per mount and ignores later factory identities', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    const factories: number[] = [];
    const values: object[] = [];
    function Probe({ generation }: { generation: number }) {
      values.push(useConst(() => {
        factories.push(generation);
        return { generation };
      }));
    }

    const controller = crc(canvas, <Probe generation={1} key="stable" />);
    frames.flush();
    crc(canvas, <Probe generation={2} key="stable" />);
    frames.flush();
    crc(canvas, <Probe generation={3} key="replacement" />);
    frames.flush();

    expect(factories).toEqual([1, 3]);
    expect(values[1]).toBe(values[0]);
    expect(values[2]).not.toBe(values[0]);
    controller.dispose();
    frames.restore();
  });

  it('runs its factory untracked and schedules no work for a later source write', () => {
    const frames = new ManualFrames();
    const source = signal(1);
    const snapshots: number[] = [];
    function Probe() {
      snapshots.push(useConst(() => source.get()));
    }

    const controller = crc(createCanvas(), <Probe />);
    frames.flush();
    source.set(2);

    expect(snapshots).toEqual([1]);
    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    frames.restore();
  });

  it('owns a distinct hook kind and forbids nested hooks in its factory', () => {
    const frames = new ManualFrames();
    const canvas = createCanvas();
    function Ordered({ useMutable }: { useMutable: boolean }) {
      if (useMutable) useRef(1);
      else useConst(() => 1);
    }
    const controller = crc(canvas, <Ordered useMutable={false} />);
    frames.flush();
    crc(canvas, <Ordered useMutable />);
    expect(() => frames.flush()).toThrowError(/expected const, received ref/iu);

    function NestedHook() {
      useConst(() => useSignal(1));
    }
    crc(canvas, <NestedHook />);
    expect(() => frames.flush()).toThrowError(/hooks.*useConst factory/iu);
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

  get pendingCount(): number {
    return this.callbacks.size;
  }

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
