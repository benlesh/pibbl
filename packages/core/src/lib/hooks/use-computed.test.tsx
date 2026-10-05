import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Signal } from '../signals/types.js';
import { Text } from '../components/text.js';
import { pibbl } from '../pibbl.js';
import { clearSharedState } from '../global-state.js';
import {
  getSignalNode,
  signal,
  signalGraphSnapshot,
} from '../signals/graph.js';
import { useSignal } from './use-signal.js';
import { useComputed } from './use-computed.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('useComputed', () => {
  it('keeps one lazy readonly identity and refreshes an unchanged formula callback', () => {
    const frames = new ManualFrames();
    const source = signal(2);
    const outputs: Signal<number>[] = [];
    const evaluations: string[] = [];
    function Probe({ generation }: { generation: string }) {
      outputs.push(useComputed(() => {
        evaluations.push(generation);
        return source.get() * 2;
      }, []));
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe generation="first" />);
    frames.flush();
    expect(evaluations).toEqual([]);
    pibbl(canvas, <Probe generation="latest" />);
    frames.flush();

    expect(outputs[1]).toBe(outputs[0]);
    expect(outputs[0].get()).toBe(4);
    expect(evaluations).toEqual(['latest']);
    const invalidTypeExample = () => {
      // @ts-expect-error useComputed is deliberately readonly
      outputs[0].set(5);
    };
    expect(invalidTypeExample).toBeTypeOf('function');
    controller.dispose();
    frames.restore();
  });

  it('tracks dynamic signal sources and preserves the last formula after teardown', () => {
    const frames = new ManualFrames();
    const chooseLeft = signal(true);
    const left = signal(1);
    const right = signal(10);
    let output!: Signal<number>;
    function Probe() {
      output = useComputed(() => chooseLeft.get() ? left.get() : right.get());
      return <Text>{output}</Text>;
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe />);
    frames.flush();
    expect(output.get()).toBe(1);
    chooseLeft.set(false);
    frames.flush();
    expect(output.get()).toBe(10);

    left.set(2);
    expect(frames.pendingCount).toBe(0);
    right.set(11);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    pibbl(canvas, undefined);
    frames.flush();

    right.set(12);
    expect(frames.pendingCount).toBe(0);
    expect(output.get()).toBe(12);
    controller.dispose();
    frames.restore();
  });

  it('uses Object.is dependency slots and evaluates changed dependencies provisionally', () => {
    const frames = new ManualFrames();
    const values: number[] = [];
    const evaluations: number[] = [];
    function Probe({ dependency }: { dependency: number }) {
      const value = useComputed(() => {
        evaluations.push(dependency);
        return Object.is(dependency, -0) ? -1 : 1;
      }, [dependency]);
      values.push(value.get());
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe dependency={Number.NaN} />);
    frames.flush();
    pibbl(canvas, <Probe dependency={Number.NaN} />);
    frames.flush();
    pibbl(canvas, <Probe dependency={0} />);
    frames.flush();
    pibbl(canvas, <Probe dependency={-0} />);
    frames.flush();

    expect(evaluations).toEqual([Number.NaN, 0, -0]);
    expect(values).toEqual([1, 1, 1, -1]);
    controller.dispose();
    frames.restore();
  });

  it('uses custom result equality as a downstream invalidation barrier', () => {
    const frames = new ManualFrames();
    const source = signal(1);
    let ownerRenders = 0;
    let receiverRenders = 0;
    function Receiver({ value }: { value: Signal<{ parity: number }> }) {
      receiverRenders++;
      return <Text>{value.get().parity}</Text>;
    }
    function Owner() {
      ownerRenders++;
      const parity = useComputed(
        () => ({ parity: source.get() % 2 }),
        undefined,
        { equals: (previous, next) => previous.parity === next.parity },
      );
      return <Receiver value={parity} />;
    }

    const controller = pibbl(createCanvas(), <Owner />);
    frames.flush();
    source.set(3);
    frames.flush();

    expect(ownerRenders).toBe(1);
    expect(receiverRenders).toBe(1);
    source.set(4);
    frames.flush();
    expect(ownerRenders).toBe(2);
    expect(receiverRenders).toBe(2);
    controller.dispose();
    frames.restore();
  });

  it('rolls back an evaluated dependency candidate when render fails', () => {
    const frames = new ManualFrames();
    const source = signal(2);
    const failure = new Error('candidate render failed');
    let output!: Signal<number>;
    function Probe({ multiplier, fail }: { multiplier: number; fail: boolean }) {
      output = useComputed(() => source.get() * multiplier, [multiplier]);
      output.get();
      if (fail) throw failure;
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe multiplier={2} fail={false} />);
    frames.flush();
    expect(output.get()).toBe(4);

    pibbl(canvas, <Probe multiplier={3} fail />);
    expect(() => frames.flush()).toThrow(failure);
    expect(output.get()).toBe(4);
    source.set(3);
    expect(output.get()).toBe(6);
    controller.dispose();
    frames.restore();
  });

  it('recovers from formula errors and rejects direct candidate cycles', () => {
    const frames = new ManualFrames();
    const shouldThrow = signal(false);
    const source = signal(1);
    const failure = new Error('formula failed');
    let output!: Signal<number>;
    function ErrorProbe() {
      output = useComputed(() => {
        if (shouldThrow.get()) throw failure;
        return source.get();
      });
      return <Text>{output}</Text>;
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <ErrorProbe />);
    frames.flush();
    shouldThrow.set(true);
    expect(() => frames.flush()).toThrow();
    shouldThrow.set(false);
    source.set(2);
    expect(output.get()).toBe(2);

    function CycleProbe({ cyclic }: { cyclic: boolean }) {
      output = useComputed(
        () => cyclic ? output.get() : source.get(),
        [cyclic],
        { debugName: 'hook cycle' },
      );
      output.get();
    }
    pibbl(canvas, <CycleProbe cyclic={false} />);
    frames.flush();
    pibbl(canvas, <CycleProbe cyclic />);
    expect(() => frames.flush()).toThrowError(/computed cycle.*hook cycle/iu);
    controller.dispose();
    frames.restore();
  });

  it('does not create another receiver invalidation for an equal dependency result', () => {
    const frames = new ManualFrames();
    const receiverRenders = vi.fn();
    let output!: Signal<number>;
    function Receiver({ value }: { value: Signal<number> }) {
      receiverRenders();
      return <Text>{value}</Text>;
    }
    function Owner({ raw }: { raw: number }) {
      output = useComputed(() => raw % 2, [raw]);
      return <Receiver value={output} />;
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Owner raw={1} />);
    frames.flush();
    const beforeVersion = getSignalNode(output).version;
    pibbl(canvas, <Owner raw={3} />);
    frames.flush();

    expect(getSignalNode(output).version).toBe(beforeVersion);
    expect(receiverRenders).toHaveBeenCalledTimes(2);
    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    frames.restore();
  });

  it('keeps graph ownership balanced after owner disposal', () => {
    const frames = new ManualFrames();
    const before = signalGraphSnapshot();
    const source = signal(1);
    let output!: Signal<number>;
    function Probe() {
      output = useComputed(() => source.get() + 1);
      return <Text>{output}</Text>;
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe />);
    frames.flush();
    pibbl(canvas, undefined);
    frames.flush();
    expect(output.get()).toBe(2);

    const afterRead = signalGraphSnapshot();
    expect(afterRead.rendererEdges).toBe(before.rendererEdges);
    expect(afterRead.computedSourceEdges).toBe(before.computedSourceEdges);
    controller.dispose();
    frames.restore();
  });

  it('forbids hooks and signal writes inside formulas', () => {
    const frames = new ManualFrames();
    const target = signal(0);
    function HookFormula() {
      const value = useComputed(() => useSignal(1).get());
      value.get();
    }
    const canvas = createCanvas();
    const controller = pibbl(canvas, <HookFormula />);
    expect(() => frames.flush()).toThrowError(/hooks.*useComputed formula/iu);

    function WriteFormula() {
      const value = useComputed(() => {
        target.set(1);
        return 1;
      });
      value.get();
    }
    pibbl(canvas, <WriteFormula />);
    expect(() => frames.flush()).toThrowError(/computed signal/iu);
    expect(target.get()).toBe(0);
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
