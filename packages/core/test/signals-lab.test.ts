import type { ScenarioController, SignalsLabState } from '@crc/scenarios';
import {
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadLearningExample,
  loadScenario,
  signalsLabScenarioEntry,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import signalsLabSource from '../../scenarios/src/signals-lab.example.tsx?raw';
import signalsLearningSource from '../../scenarios/src/learning/start/signals.example.tsx?raw';
import { clickLogicalPoint } from './support/user-input';

const activeControllers = new Set<ScenarioController<SignalsLabState>>();

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

  flushOne(): void {
    const entry = this.callbacks.entries().next().value;
    if (!entry) throw new Error('Expected one pending host frame.');
    const [id, callback] = entry;
    this.callbacks.delete(id);
    callback(0);
  }

  restore(): void {
    this.request.mockRestore();
    this.cancel.mockRestore();
  }
}

async function drainFrames<T>(frames: ManualFrames, pending: Promise<T>): Promise<T> {
  let resolved = false;
  let failure: unknown;
  let result: T | undefined;
  void pending.then(
    value => {
      result = value;
      resolved = true;
    },
    error => {
      failure = error;
      resolved = true;
    },
  );
  let emptyTurns = 0;
  for (let attempt = 0; attempt < 40 && !resolved; attempt += 1) {
    await Promise.resolve();
    if (resolved) break;
    if (frames.pendingCount === 0) {
      emptyTurns += 1;
      if (emptyTurns < 4) continue;
      throw new Error('Signal laboratory did not request a pending host frame.');
    }
    emptyTurns = 0;
    frames.flushOne();
  }
  if (failure) throw failure;
  if (!resolved) throw new Error('Signal laboratory did not settle through the host frame queue.');
  return result as T;
}

afterEach(async () => {
  for (const controller of activeControllers) await controller.dispose();
  activeControllers.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function mountSignalsLab() {
  const canvas = document.createElement('canvas');
  canvas.width = signalsLabScenarioEntry.canvas.width;
  canvas.height = signalsLabScenarioEntry.canvas.height;
  const referenceHost = document.createElement('div');
  document.body.replaceChildren(canvas, referenceHost);
  const definition = await loadScenario(signalsLabScenarioEntry);
  const controller = await definition.mount({ canvas, referenceHost });
  activeControllers.add(controller);
  await controller.settled();
  return { canvas, controller, definition, referenceHost };
}

describe('first-class signal public scenarios', () => {
  it('registers learning and laboratory routes with public-package-only sources', () => {
    const learning = getLearningExampleBySlug('signals');
    expect(learning).toMatchObject({
      slug: 'signals',
      section: 'start',
      api: ['signal', 'computed', 'crcSignal'],
      source: { path: 'packages/scenarios/src/learning/start/signals.example.tsx' },
    });
    expect(learning && getLearningExampleRoute(learning)).toBe('#/examples/start/signals');
    expect(getScenarioRoute(signalsLabScenarioEntry)).toBe('#/testing/signals');

    for (const source of [signalsLearningSource, signalsLabSource]) {
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).not.toMatch(/@crc\/core\/(?:internal|lib|src)\b/u);
      expect(source).not.toMatch(/(?:ManualFrames|flushPending|requestAnimationFrame)/u);
    }
    expect(signalsLearningSource).toContain('.get()');
    expect(signalsLearningSource).toContain('.update(');
    expect(signalsLearningSource).toContain('computed(');
    expect(signalsLabSource).toContain(
      "SIGNALS_LAB_SOURCE_ID = 'first-class-signals-laboratory-example'",
    );
  });

  it('mounts the learning example with explicit reads and updates its writable signals on click', async () => {
    const entry = getLearningExampleBySlug('signals');
    if (!entry) throw new Error('Missing signals learning example.');
    const canvas = document.createElement('canvas');
    canvas.width = entry.canvas.width;
    canvas.height = entry.canvas.height;
    document.body.appendChild(canvas);
    const controller = (await loadLearningExample(entry)).default(canvas);
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const before = Array.from(canvas.getContext('2d')!.getImageData(150, 200, 1, 1).data);
      await clickLogicalPoint(canvas, { x: 150, y: 200 });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const after = Array.from(canvas.getContext('2d')!.getImageData(150, 200, 1, 1).data);
      expect(before).not.toEqual(after);
    } finally {
      controller.dispose();
    }
  });

  it('drives every action through complete source, consumer, and render state vectors', async () => {
    const { canvas, controller, definition, referenceHost } = await mountSignalsLab();
    expect(referenceHost.querySelectorAll('canvas')).toHaveLength(1);
    expect(definition.actionIds).toEqual(signalsLabScenarioEntry.actions.map(action => action.id));
    expect(controller.getState()).toEqual({
      direct: 1,
      derivedSource: 0,
      left: 0,
      right: 20,
      shared: 0,
      layerA: 1,
      layerB: 1,
      retained: 0,
      selectedSource: 'left',
      computed: 0,
      computedEvaluations: 1,
      rootRenders: { a: 1, b: 1 },
      layerChildRenders: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'mount',
    });

    await controller.perform('direct-write');
    await controller.settled();
    expect(controller.getState()).toEqual({
      direct: 2,
      derivedSource: 0,
      left: 0,
      right: 20,
      shared: 0,
      layerA: 1,
      layerB: 1,
      retained: 0,
      selectedSource: 'left',
      computed: 0,
      computedEvaluations: 1,
      rootRenders: { a: 2, b: 1 },
      layerChildRenders: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'direct-write',
    });

    await controller.perform('equal-write');
    await controller.settled();
    expect(controller.getState()).toEqual({
      direct: 2,
      derivedSource: 0,
      left: 0,
      right: 20,
      shared: 0,
      layerA: 1,
      layerB: 1,
      retained: 0,
      selectedSource: 'left',
      computed: 0,
      computedEvaluations: 1,
      rootRenders: { a: 2, b: 1 },
      layerChildRenders: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'equal-write',
    });

    await controller.perform('computed-equal-write');
    await controller.settled();
    expect(controller.getState()).toEqual({
      direct: 2,
      derivedSource: 2,
      left: 0,
      right: 20,
      shared: 0,
      layerA: 1,
      layerB: 1,
      retained: 0,
      selectedSource: 'left',
      computed: 0,
      computedEvaluations: 2,
      rootRenders: { a: 2, b: 1 },
      layerChildRenders: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'computed-equal-write',
    });

    await controller.perform('dependency-switch');
    await controller.settled();
    expect(controller.getState()).toEqual({
      direct: 2,
      derivedSource: 2,
      left: 1,
      right: 20,
      shared: 0,
      layerA: 1,
      layerB: 1,
      retained: 0,
      selectedSource: 'right',
      computed: 20,
      computedEvaluations: 3,
      rootRenders: { a: 3, b: 1 },
      layerChildRenders: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'dependency-switch',
    });

    await controller.perform('shared-roots');
    await controller.settled();
    expect(controller.getState()).toEqual({
      direct: 2,
      derivedSource: 2,
      left: 1,
      right: 20,
      shared: 1,
      layerA: 1,
      layerB: 1,
      retained: 0,
      selectedSource: 'right',
      computed: 20,
      computedEvaluations: 3,
      rootRenders: { a: 4, b: 2 },
      layerChildRenders: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'shared-roots',
    });

    const primaryContext = canvas.getContext('2d');
    if (!primaryContext) throw new Error('Signals laboratory primary Canvas has no 2D context.');
    const nativeDrawImage = primaryContext.drawImage;
    let layerAChildPrecededParentComposite = false;
    const drawImage = vi.spyOn(primaryContext, 'drawImage').mockImplementation(function(
      this: CanvasRenderingContext2D,
      ...args
    ) {
      const beforeComposite = controller.getState();
      if (
        this.getTransform().e === 24 &&
        beforeComposite.layerChildRenders.a === 2 &&
        beforeComposite.layerChildRenders.b === 1
      ) {
        layerAChildPrecededParentComposite = true;
      }
      return Reflect.apply(nativeDrawImage, this, args);
    });
    await controller.perform('layer-local-write');
    await controller.settled();
    drawImage.mockRestore();
    expect(layerAChildPrecededParentComposite).toBe(true);
    expect(controller.getState()).toEqual({
      direct: 2,
      derivedSource: 2,
      left: 1,
      right: 20,
      shared: 1,
      layerA: 2,
      layerB: 1,
      retained: 0,
      selectedSource: 'right',
      computed: 20,
      computedEvaluations: 3,
      rootRenders: { a: 5, b: 2 },
      layerChildRenders: { a: 2, b: 1 },
      consumerCount: 5,
      lastAction: 'layer-local-write',
    });

    await controller.perform('remove-consumer');
    await controller.settled();
    expect(controller.getState()).toEqual({
      direct: 2,
      derivedSource: 2,
      left: 1,
      right: 20,
      shared: 1,
      layerA: 2,
      layerB: 1,
      retained: 1,
      selectedSource: 'right',
      computed: 20,
      computedEvaluations: 3,
      rootRenders: { a: 6, b: 2 },
      layerChildRenders: { a: 2, b: 1 },
      consumerCount: 4,
      lastAction: 'remove-consumer',
    });

    await controller.perform('reset');
    await controller.settled();
    expect(controller.getState()).toEqual({
      direct: 1,
      derivedSource: 0,
      left: 0,
      right: 20,
      shared: 0,
      layerA: 1,
      layerB: 1,
      retained: 0,
      selectedSource: 'left',
      computed: 0,
      computedEvaluations: 1,
      rootRenders: { a: 1, b: 1 },
      layerChildRenders: { a: 1, b: 1 },
      consumerCount: 5,
      lastAction: 'reset',
    });
  });

  it('uses one host callback for a shared write and none for a removed retained consumer', async () => {
    const frames = new ManualFrames();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = signalsLabScenarioEntry.canvas.width;
      canvas.height = signalsLabScenarioEntry.canvas.height;
      const referenceHost = document.createElement('div');
      document.body.replaceChildren(canvas, referenceHost);
      const definition = await loadScenario(signalsLabScenarioEntry);
      const controller = await drainFrames(frames, definition.mount({ canvas, referenceHost }));
      activeControllers.add(controller);

      const shared = controller.perform('shared-roots');
      expect(frames.pendingCount).toBe(2);
      frames.flushOne();
      expect(controller.getState().rootRenders).toEqual({ a: 2, b: 2 });
      expect(frames.pendingCount).toBe(1);
      await drainFrames(frames, shared);

      const removal = controller.perform('remove-consumer');
      expect(frames.pendingCount).toBe(2);
      frames.flushOne();
      expect(frames.pendingCount).toBe(1);
      frames.flushOne();
      for (let turn = 0; turn < 4 && frames.pendingCount === 0; turn += 1) {
        await Promise.resolve();
      }
      expect(frames.pendingCount).toBe(1);
      frames.flushOne();
      for (let turn = 0; turn < 4 && frames.pendingCount === 0; turn += 1) {
        await Promise.resolve();
      }
      expect(frames.pendingCount).toBe(1);
      await drainFrames(frames, removal);
    } finally {
      frames.restore();
    }
  });
});
