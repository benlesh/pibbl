import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pibbl } from '../pibbl.js';
import { clearSharedState } from '../global-state.js';
import { signal, signalGraphSnapshot } from '../signals/graph.js';
import { useSignal } from './use-signal.js';
import { useReaction } from './use-reaction.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('useReaction', () => {
  it('runs setup after a successful mount and never after a failed mount', () => {
    const frames = new ManualFrames();
    const events: string[] = [];
    function Healthy() {
      events.push('render');
      useReaction(() => {
        events.push('setup');
      });
    }

    const healthy = pibbl(createCanvas(), <Healthy />);
    expect(events).toEqual([]);
    frames.flush();
    expect(events).toEqual(['render', 'setup']);
    healthy.dispose();

    const failure = new Error('render failed');
    const failedSetup = vi.fn();
    function Broken() {
      useReaction(failedSetup);
      throw failure;
    }
    const broken = pibbl(createCanvas(), <Broken />);
    expect(() => frames.flush()).toThrow(failure);
    expect(failedSetup).not.toHaveBeenCalled();
    broken.dispose();
    frames.restore();
  });

  it('tracks dynamic signals and runs reaction-only frames without Canvas traversal', () => {
    const frames = new ManualFrames();
    const chooseLeft = signal(true);
    const left = signal(1);
    const right = signal(10);
    const events: string[] = [];
    let renders = 0;
    function Probe() {
      renders++;
      useReaction(() => {
        const value = chooseLeft.get() ? left.get() : right.get();
        events.push(`setup:${value}`);
        return () => events.push(`cleanup:${value}`);
      });
    }

    const controller = pibbl(createCanvas(), <Probe />);
    frames.flush();
    left.set(2);
    left.set(3);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    expect(renders).toBe(1);
    expect(events).toEqual(['setup:1', 'cleanup:1', 'setup:3']);

    chooseLeft.set(false);
    frames.flush();
    left.set(4);
    expect(frames.pendingCount).toBe(0);
    right.set(11);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    expect(renders).toBe(1);
    expect(events).toEqual([
      'setup:1',
      'cleanup:1',
      'setup:3',
      'cleanup:3',
      'setup:10',
      'cleanup:10',
      'setup:11',
    ]);
    controller.dispose();
    frames.restore();
  });

  it('uses Object.is dependencies and the latest successful callback', () => {
    const frames = new ManualFrames();
    const source = signal(0);
    const events: string[] = [];
    function Probe({ dependency, label }: { dependency: number; label: string }) {
      useReaction(() => {
        source.get();
        events.push(`setup:${label}`);
        return () => events.push(`cleanup:${label}`);
      }, [dependency]);
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe dependency={Number.NaN} label="first" />);
    frames.flush();
    pibbl(canvas, <Probe dependency={Number.NaN} label="latest" />);
    frames.flush();
    expect(events).toEqual(['setup:first']);

    source.set(1);
    frames.flush();
    expect(events).toEqual([
      'setup:first',
      'cleanup:first',
      'setup:latest',
    ]);

    pibbl(canvas, <Probe dependency={0} label="zero" />);
    frames.flush();
    pibbl(canvas, <Probe dependency={-0} label="negative-zero" />);
    frames.flush();
    expect(events.slice(-4)).toEqual([
      'cleanup:latest',
      'setup:zero',
      'cleanup:zero',
      'setup:negative-zero',
    ]);
    controller.dispose();
    frames.restore();
  });

  it('cleans the exact generation on replacement, removal, and disposal', () => {
    const frames = new ManualFrames();
    const events: string[] = [];
    function Child({ label }: { label: string }) {
      useReaction(() => {
        events.push(`setup:${label}`);
        return () => events.push(`cleanup:${label}`);
      }, [label]);
    }
    function Root({ label }: { label?: string }) {
      return label === undefined ? undefined : <Child label={label} />;
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Root label="first" />);
    frames.flush();
    pibbl(canvas, <Root label="second" />);
    frames.flush();
    pibbl(canvas, <Root />);
    frames.flush();
    expect(events).toEqual([
      'setup:first',
      'cleanup:first',
      'setup:second',
      'cleanup:second',
    ]);

    pibbl(canvas, <Root label="last" />);
    frames.flush();
    controller.dispose();
    expect(events.slice(-2)).toEqual(['setup:last', 'cleanup:last']);
    frames.restore();
  });

  it('commits reads from a throwing setup and retries on a later invalidation', () => {
    const frames = new ManualFrames();
    const source = signal(0);
    const failure = new Error('setup failed');
    const events: string[] = [];
    let fail = true;
    function Probe() {
      useReaction(() => {
        events.push(`setup:${source.get()}`);
        if (fail) throw failure;
        return () => events.push('cleanup');
      });
    }

    const controller = pibbl(createCanvas(), <Probe />);
    expect(() => frames.flush()).toThrow(failure);
    fail = false;
    source.set(1);
    frames.flush();
    expect(events).toEqual(['setup:0', 'setup:1']);
    controller.dispose();
    expect(events).toEqual(['setup:0', 'setup:1', 'cleanup']);
    frames.restore();
  });

  it('reports cleanup failure but still attempts replacement setup exactly once', () => {
    const frames = new ManualFrames();
    const failure = new Error('cleanup failed');
    const events: string[] = [];
    function Probe({ generation }: { generation: number }) {
      useReaction(() => {
        events.push(`setup:${generation}`);
        return () => {
          events.push(`cleanup:${generation}`);
          if (generation === 1) throw failure;
        };
      }, [generation]);
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe generation={1} />);
    frames.flush();
    pibbl(canvas, <Probe generation={2} />);
    expect(() => frames.flush()).toThrow(failure);
    expect(events).toEqual(['setup:1', 'cleanup:1', 'setup:2']);
    controller.dispose();
    expect(events).toEqual([
      'setup:1',
      'cleanup:1',
      'setup:2',
      'cleanup:2',
    ]);
    frames.restore();
  });

  it('releases the committed cleanup when a later owner render fails', () => {
    const frames = new ManualFrames();
    const failure = new Error('owner render failed');
    const events: string[] = [];
    function Probe({ fail }: { fail: boolean }) {
      useReaction(() => {
        events.push('setup');
        return () => events.push('cleanup');
      });
      if (fail) throw failure;
    }

    const canvas = createCanvas();
    const controller = pibbl(canvas, <Probe fail={false} />);
    frames.flush();
    pibbl(canvas, <Probe fail />);
    expect(() => frames.flush()).toThrow(failure);
    expect(events).toEqual(['setup', 'cleanup']);
    controller.dispose();
    expect(events).toEqual(['setup', 'cleanup']);
    frames.restore();
  });

  it('cancels pending work and cleans up exactly once when the mount aborts', () => {
    const frames = new ManualFrames();
    const abort = new AbortController();
    const source = signal(0);
    const cleanup = vi.fn();
    function Probe() {
      useReaction(() => {
        source.get();
        return cleanup;
      });
    }

    const controller = pibbl(createCanvas(), <Probe />, { signal: abort.signal });
    frames.flush();
    source.set(1);
    expect(frames.pendingCount).toBe(1);
    abort.abort();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(frames.pendingCount).toBe(0);
    controller.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
    frames.restore();
  });

  it('forbids writes and hooks in setup and cleanup without leaking ownership', () => {
    const frames = new ManualFrames();
    const target = signal(0);
    function SetupWrite() {
      useReaction(() => {
        target.set(0);
      });
    }
    const canvas = createCanvas();
    const controller = pibbl(canvas, <SetupWrite />);
    expect(() => frames.flush()).toThrowError(/useReaction setup/iu);
    expect(target.get()).toBe(0);

    function SetupHook() {
      useReaction(() => {
        useSignal(1);
      });
    }
    pibbl(canvas, <SetupHook />);
    expect(() => frames.flush()).toThrowError(/hooks.*useReaction setup/iu);

    const replacement = vi.fn();
    function CleanupWrite({ generation }: { generation: number }) {
      useReaction(() => {
        replacement(generation);
        return generation === 1 ? () => target.set(0) : undefined;
      }, [generation]);
    }
    pibbl(canvas, <CleanupWrite generation={1} />);
    frames.flush();
    pibbl(canvas, <CleanupWrite generation={2} />);
    expect(() => frames.flush()).toThrowError(/useReaction cleanup/iu);
    expect(replacement).toHaveBeenCalledTimes(2);
    expect(target.get()).toBe(0);
    controller.dispose();
    frames.restore();
  });

  it('balances reaction ownership counters after final teardown', () => {
    const frames = new ManualFrames();
    const baseline = signalGraphSnapshot();
    const source = signal(1);
    function Probe() {
      useReaction(() => {
        source.get();
        return () => undefined;
      });
    }

    const controller = pibbl(createCanvas(), <Probe />);
    frames.flush();
    expect(signalGraphSnapshot()).toMatchObject({
      reactionConsumers: baseline.reactionConsumers + 1,
      reactionEdges: baseline.reactionEdges + 1,
      reactionRuns: baseline.reactionRuns + 1,
    });
    controller.dispose();
    expect(signalGraphSnapshot()).toMatchObject({
      reactionConsumers: baseline.reactionConsumers,
      reactionEdges: baseline.reactionEdges,
      reactionCleanups: baseline.reactionCleanups + 1,
    });
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
