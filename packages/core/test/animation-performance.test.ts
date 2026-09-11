import {
  animationPlaybackSnapshot,
} from '../src/lib/animation/playback';
import {
  Group,
  Layer,
  Rectangle,
  crc,
  crcPlayback,
  createElement,
  keyframes,
  sequence,
  signal,
  spring,
  stepper,
  track,
  tween,
  type CRCController,
  type CRCNode,
  type CRCPlayback,
} from '@crc/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as animationDefinition from '../src/lib/animation/definition';
import { writerLeaseSnapshot } from '../src/lib/animation/writer-leases';
import { clearSharedState, GLOBAL_STATE } from '../src/lib/global-state';
import {
  installSchedulerDriverForTest,
  installSchedulerTraceCollectorForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
  type CRCSchedulerTraceRecord,
} from '../src/lib/scheduler/testing';

const REPORT_TIMING = import.meta.env.VITE_CRC_REPORT_PERF === '1';
const controllers = new Set<CRCController>();
let driver: ManualSchedulerDriver;
let restoreDriver: () => void;

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  restoreDriver();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('animation structural performance', () => {
  it('advances 1,000 numeric tracks with one host callback, one sample and batch output record each, and one root traversal', () => {
    const outputs = Array.from({ length: 1_000 }, (_, index) =>
      signal(0, { debugName: `bulk output ${index}` })
    );
    const handles: CRCPlayback[] = [];
    const trace: CRCSchedulerTraceRecord[] = [];
    let traversals = 0;
    function Root(): CRCNode {
      traversals += 1;
      handles.length = 0;
      for (const [index, output] of outputs.entries()) {
        handles.push(crcPlayback(track(output, tween({
          from: 0,
          to: index + 1,
          duration: 100,
        })), { debugName: `bulk playback ${index}` }));
        output.get();
      }
      return undefined;
    }

    const controller = mount(createCanvas(), createElement(Root, {}));
    driver.flush(-1);
    traversals = 0;
    const restoreTrace = installSchedulerTraceCollectorForTest(record => {
      trace.push(record);
    });
    const requestsBefore = driver.requestCount;
    const playbackBefore = animationPerformanceSnapshot();
    const started = performance.now();
    for (const handle of handles) handle.play();
    const enqueueMilliseconds = performance.now() - started;

    expect(driver.requestCount - requestsBefore).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(0);
    expect(traversals).toBe(0);
    expect(frameRecords(trace, 'animation-sample')).toHaveLength(1_000);
    expect(outputWrites(trace)).toHaveLength(1_000);
    expect(new Set(outputWrites(trace).map(record => record.target))).toHaveLength(1_000);
    expect(outputWrites(trace).every(record =>
      record.outcome === 'equality-suppressed'
    )).toBe(true);
    expect(
      animationPerformanceSnapshot().outputStageAttempts -
        playbackBefore.outputStageAttempts,
    ).toBe(1_000);

    trace.length = 0;
    expect(driver.pendingHostFrames).toBe(1);
    const requestsBeforePresentedFrame = driver.requestCount;
    driver.flush(50);
    expect(driver.requestCount - requestsBeforePresentedFrame).toBe(1);
    expect(traversals).toBe(1);
    expect(frameRecords(trace, 'animation-sample')).toHaveLength(1_000);
    expect(outputWrites(trace)).toHaveLength(1_000);
    expect(new Set(outputWrites(trace).map(record => record.target))).toHaveLength(1_000);
    expect(outputWrites(trace).every(record => record.outcome === 'staged')).toBe(true);
    expect(
      animationPerformanceSnapshot().outputStageAttempts -
        playbackBefore.outputStageAttempts,
    ).toBe(2_000);
    expect(outputs[0].get()).toBe(0.5);
    expect(outputs[999].get()).toBe(500);
    expect(snapshotRealmScheduler().pendingHostFrames).toBe(1);
    reportTiming('enqueue 1,000 animation tracks', enqueueMilliseconds);
    restoreTrace();
    controller.dispose();
    controllers.delete(controller);
  });

  it('reserves one lease for 100 sequential writers to one signal', () => {
    const output = signal(0, { debugName: 'sequential output' });
    const before = writerLeaseSnapshot();
    const tracks = Array.from({ length: 100 }, (_, index) =>
      track(output, tween({
        from: index,
        to: index + 1,
        duration: 1,
      }))
    );
    let playback!: CRCPlayback;
    function Root(): CRCNode {
      playback = crcPlayback(sequence(...tracks));
      output.get();
      return undefined;
    }
    const controller = mount(createCanvas(), createElement(Root, {}));
    driver.flush(-1);

    playback.play();
    driver.flush(0);
    expect(writerLeaseSnapshot()).toMatchObject({
      active: before.active + 1,
      acquired: before.acquired + 1,
      released: before.released,
    });
    driver.flush(100);
    expect(output.get()).toBe(100);
    expect(writerLeaseSnapshot()).toMatchObject({
      active: before.active,
      acquired: before.acquired + 1,
      released: before.released + 1,
    });
    controller.dispose();
    controllers.delete(controller);
  });

  it('samples ten normalized keyframes without allocating per-sample arrays', () => {
    const before = animationDefinitionPerformanceSnapshot();
    const definition = keyframes({
      values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      duration: 900,
    });
    const activation = animationDefinition.activateSeekableDefinition(definition, 0);
    const samples: number[] = [];
    for (let time = 0; time <= 900; time += 100) {
      samples.push(animationDefinition.sampleActivatedSeekableDefinition(
        activation,
        time,
      ));
    }

    expect(samples).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const after = animationDefinitionPerformanceSnapshot();
    expect(after.keyframeDefinitions - before.keyframeDefinitions).toBe(1);
    expect(
      after.keyframeStorageArrayAllocations -
        before.keyframeStorageArrayAllocations,
    ).toBe(3);
    expect(after.keyframeSamples - before.keyframeSamples).toBe(10);
    expect(
      after.keyframeSampleArrayAllocations -
        before.keyframeSampleArrayAllocations,
    ).toBe(0);
  });

  it('samples analytic springs with constant gap-independent closed-form work', () => {
    const definition = spring({
      from: 0,
      to: 1,
      mass: 1,
      stiffness: 1,
      damping: 0,
      restSpeed: 0,
      restDelta: 0,
      maxDuration: 10_000,
    });
    const activation = animationDefinition.activateSeekableDefinition(definition, 0);
    const exponential = vi.spyOn(Math, 'exp');

    const first = animationDefinition.sampleActivatedSeekableDefinition(activation, 16);
    const firstCalls = exponential.mock.calls.length;
    exponential.mockClear();
    const afterLongGap = animationDefinition.sampleActivatedSeekableDefinition(
      activation,
      9_000,
    );
    const longGapCalls = exponential.mock.calls.length;

    expect(first).toBeCloseTo(0.0001279973, 9);
    expect(afterLongGap).toBeCloseTo(1.9111302619, 9);
    expect(firstCalls).toBe(2);
    expect(longGapCalls).toBe(firstCalls);
  });

  it('caps a fixed-step frame gap and records the exact discarded duration', () => {
    const output = signal(0, { debugName: 'bounded stepper output' });
    const traces: CRCSchedulerTraceRecord[] = [];
    let steps = 0;
    let playback!: CRCPlayback;
    function Root(): CRCNode {
      playback = crcPlayback(track(output, stepper({
        stepMilliseconds: 10,
        maxElapsedMilliseconds: 40,
        initial: current => current,
        step: state => {
          steps += 1;
          return state + 1;
        },
        read: state => state,
      })));
      output.get();
      return undefined;
    }
    const controller = mount(createCanvas(), createElement(Root, {}));
    driver.flush(-1);
    const restoreTrace = installSchedulerTraceCollectorForTest(record => {
      traces.push(record);
    });
    playback.play();
    driver.flush(0);
    traces.length = 0;

    driver.flush(1_000);

    expect(steps).toBe(4);
    expect(output.get()).toBe(4);
    expect(traces).toContainEqual(expect.objectContaining({
      kind: 'animation-stepper',
      appliedSteps: 4,
      clampedElapsedMilliseconds: 40,
      discardedElapsedMilliseconds: 960,
    }));
    restoreTrace();
    playback.cancel();
    driver.flush(1_001);
    controller.dispose();
    controllers.delete(controller);
  });

  it('adds no offscreen allocation, pixel readback, or bitmap transfer to ordinary animation', () => {
    const NativeOffscreenCanvas = globalThis.OffscreenCanvas;
    const transfer = vi.spyOn(
      NativeOffscreenCanvas.prototype,
      'transferToImageBitmap',
    );
    const offscreenConstructions = vi.fn(function (
      width: number,
      height: number,
    ) {
      return new NativeOffscreenCanvas(width, height);
    });
    vi.stubGlobal('OffscreenCanvas', offscreenConstructions);
    const htmlReadback = vi.spyOn(CanvasRenderingContext2D.prototype, 'getImageData');
    const htmlWriteback = vi.spyOn(CanvasRenderingContext2D.prototype, 'putImageData');
    const offscreenReadback = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'getImageData',
    );
    const offscreenWriteback = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'putImageData',
    );
    const output = signal(0);
    let playback!: CRCPlayback;
    function Root(): CRCNode {
      playback = crcPlayback(track(output, tween({
        from: 0,
        to: 10,
        duration: 100,
      })));
      return createElement(Rectangle, {
        style: {
          x: output.get(),
          width: 2,
          height: 2,
          fill: 'red',
        },
      });
    }
    const controller = mount(createCanvas(), createElement(Root, {}));
    driver.flush(-1);
    playback.play();
    driver.flush(0);
    driver.flush(50);

    expect(offscreenConstructions).not.toHaveBeenCalled();
    expect(htmlReadback).not.toHaveBeenCalled();
    expect(htmlWriteback).not.toHaveBeenCalled();
    expect(offscreenReadback).not.toHaveBeenCalled();
    expect(offscreenWriteback).not.toHaveBeenCalled();
    expect(transfer).not.toHaveBeenCalled();
    controller.dispose();
    controllers.delete(controller);
  });

  it('re-composites a presentation-only Layer animation without repainting its child', () => {
    const offset = signal(0);
    let playback!: CRCPlayback;
    let rootTraversals = 0;
    let childTraversals = 0;
    function Child(): CRCNode {
      childTraversals += 1;
      return createElement(Rectangle, {
        style: { width: 4, height: 4, fill: 'red' },
      });
    }
    function Root(): CRCNode {
      rootTraversals += 1;
      playback = crcPlayback(track(offset, tween({
        from: 0,
        to: 4,
        duration: 100,
      })));
      return createElement(Group, {
        style: { translateX: offset.get() },
        children: createElement(Layer, {
          style: { width: 4, height: 4 },
          children: createElement(Child, {}),
        }),
      });
    }
    const controller = mount(createCanvas(), createElement(Root, {}));
    driver.flush(-1);
    const layer = Array.from(GLOBAL_STATE.crcInstances.values())
      .find(instance => instance.parent !== undefined)!;
    const childRevision = layer.requestedRenderRevision;
    rootTraversals = 0;
    childTraversals = 0;

    playback.play();
    driver.flush(0);
    driver.flush(50);

    expect(rootTraversals).toBe(1);
    expect(childTraversals).toBe(0);
    expect(layer.requestedRenderRevision).toBe(childRevision);
    expect(layer.completedRenderRevision).toBe(childRevision);
    controller.dispose();
    controllers.delete(controller);
  });
});

function frameRecords<K extends CRCSchedulerTraceRecord['kind']>(
  records: readonly CRCSchedulerTraceRecord[],
  kind: K,
): Array<Extract<CRCSchedulerTraceRecord, { readonly kind: K }>> {
  return records.filter(
    (record): record is Extract<CRCSchedulerTraceRecord, { readonly kind: K }> =>
      record.kind === kind,
  );
}

function outputWrites(records: readonly CRCSchedulerTraceRecord[]) {
  return frameRecords(records, 'animation-write').filter(record =>
    record.target.startsWith('bulk output ')
  );
}

function animationDefinitionPerformanceSnapshot(): {
  readonly keyframeDefinitions: number;
  readonly keyframeStorageArrayAllocations: number;
  readonly keyframeSamples: number;
  readonly keyframeSampleArrayAllocations: number;
} {
  const snapshot = (
    animationDefinition as typeof animationDefinition & {
      animationDefinitionPerformanceSnapshot?: () => {
        readonly keyframeDefinitions: number;
        readonly keyframeStorageArrayAllocations: number;
        readonly keyframeSamples: number;
        readonly keyframeSampleArrayAllocations: number;
      };
    }
  ).animationDefinitionPerformanceSnapshot;
  expect(
    snapshot,
    'Animation definitions must expose exact keyframe allocation counters.',
  ).toBeTypeOf('function');
  return snapshot!();
}

function animationPerformanceSnapshot(): AnimationPlaybackSnapshotWithWork {
  const snapshot = animationPlaybackSnapshot() as Partial<
    AnimationPlaybackSnapshotWithWork
  >;
  expect(
    snapshot.outputStageAttempts,
    'Animation playback must count actual user-output stage attempts.',
  ).toBeTypeOf('number');
  return snapshot as AnimationPlaybackSnapshotWithWork;
}

interface AnimationPlaybackSnapshotWithWork extends ReturnType<
  typeof animationPlaybackSnapshot
> {
  readonly outputStageAttempts: number;
}

function reportTiming(label: string, elapsedMilliseconds: number): void {
  if (REPORT_TIMING) {
    console.warn(
      `[crc animation structural diagnostic] ${label}: ` +
        `${elapsedMilliseconds.toFixed(3)}ms`,
    );
  }
}

function mount(canvas: HTMLCanvasElement, node: CRCNode): CRCController {
  const controller = crc(canvas, node, { pixelRatio: 1 });
  controllers.add(controller);
  return controller;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 12;
  canvas.height = 8;
  canvas.style.cssText = 'display:block;width:12px;height:8px';
  document.body.appendChild(canvas);
  return canvas;
}
