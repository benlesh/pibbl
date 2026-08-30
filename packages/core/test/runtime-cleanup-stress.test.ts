import type {
  CleanupStressState,
  ScenarioController,
} from '@crc/scenarios';
import {
  CLEANUP_IMAGE_SOURCES,
  cleanupStressScenarioEntry,
  loadScenario,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import cleanupStressSource from '../../scenarios/src/cleanup-stress.example.ts?raw';
import { absolute, rect, type CRCController } from '../src/index';
import { executeRender } from '../src/lib/execute-render';
import { GLOBAL_STATE, getCRCInstance } from '../src/lib/global-state';
import {
  resetLayoutDiagnostics,
  snapshotLayoutDiagnostics,
} from '../src/lib/layout/diagnostics';
import { mountCRC } from '../src/lib/mount-crc';
import type { Canvas, CRCInstance } from '../src/lib/types';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';
import { CRC_EVENT_TYPES } from '../src/lib/events/event-definitions';

const EMPTY_HANDLERS = Object.fromEntries(
  CRC_EVENT_TYPES.map(type => [type, 0]),
);

interface ControlledImageRecord {
  element: HTMLImageElement;
  getSource: () => string;
  completeError: () => void;
  completeLoad: () => void;
}

class ControlledImages {
  readonly records: ControlledImageRecord[] = [];
  private readonly originalImage = window.Image;
  private restored = false;

  constructor() {
    const records = this.records;
    window.Image = function ControlledImage() {
      const element = document.createElement('img');
      let source = '';
      Object.defineProperty(element, 'src', {
        configurable: true,
        get: () => source,
        set: value => {
          source = String(value);
        },
      });
      records.push({
        element,
        getSource: () => source,
        completeError: () => {
          element.onerror?.call(element, new Event('error'));
        },
        completeLoad: () => {
          element.onload?.call(element, new Event('load'));
        },
      });
      return element;
    } as unknown as typeof Image;
  }

  restore(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    window.Image = this.originalImage;
  }
}

interface StructureLedgerSnapshot {
  instances: {
    acquired: number;
    live: number;
    released: number;
  };
  refs: {
    acquired: number;
    live: number;
    released: number;
  };
}

interface RefMapRecord {
  map: CRCInstance['refs'];
  originalClear: CRCInstance['refs']['clear'];
  originalDelete: CRCInstance['refs']['delete'];
  originalSet: CRCInstance['refs']['set'];
}

class StructureDiagnostics {
  private readonly records = new Set<RefMapRecord>();
  private readonly originalClear = GLOBAL_STATE.crcInstances.clear;
  private readonly originalDelete = GLOBAL_STATE.crcInstances.delete;
  private readonly originalSet = GLOBAL_STATE.crcInstances.set;
  private instancesAcquired = 0;
  private instancesReleased = 0;
  private refsAcquired = 0;
  private refsReleased = 0;
  private restored = false;

  constructor() {
    const instances = GLOBAL_STATE.crcInstances;
    instances.set = ((canvas: Canvas, instance: CRCInstance) => {
      if (!instances.has(canvas)) {
        this.instancesAcquired++;
        this.observeRefs(instance.refs);
      }
      return this.originalSet.call(instances, canvas, instance);
    }) as typeof instances.set;
    instances.delete = ((canvas: Canvas) => {
      if (instances.has(canvas)) {
        this.instancesReleased++;
      }
      return this.originalDelete.call(instances, canvas);
    }) as typeof instances.delete;
    instances.clear = (() => {
      this.instancesReleased += instances.size;
      this.originalClear.call(instances);
    }) as typeof instances.clear;
  }

  snapshot(): StructureLedgerSnapshot {
    let liveRefs = 0;
    for (const record of this.records) {
      liveRefs += record.map.size;
    }
    return {
      instances: {
        acquired: this.instancesAcquired,
        live: GLOBAL_STATE.crcInstances.size,
        released: this.instancesReleased,
      },
      refs: {
        acquired: this.refsAcquired,
        live: liveRefs,
        released: this.refsReleased,
      },
    };
  }

  restore(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    const instances = GLOBAL_STATE.crcInstances;
    instances.set = this.originalSet;
    instances.delete = this.originalDelete;
    instances.clear = this.originalClear;
    for (const record of this.records) {
      record.map.set = record.originalSet;
      record.map.delete = record.originalDelete;
      record.map.clear = record.originalClear;
    }
    this.records.clear();
  }

  private observeRefs(refs: CRCInstance['refs']): void {
    const record: RefMapRecord = {
      map: refs,
      originalClear: refs.clear,
      originalDelete: refs.delete,
      originalSet: refs.set,
    };
    this.records.add(record);
    refs.set = ((id, componentRefs) => {
      if (!refs.has(id)) {
        this.refsAcquired++;
      }
      return record.originalSet.call(refs, id, componentRefs);
    }) as typeof refs.set;
    refs.delete = ((id) => {
      if (refs.has(id)) {
        this.refsReleased++;
      }
      return record.originalDelete.call(refs, id);
    }) as typeof refs.delete;
    refs.clear = (() => {
      this.refsReleased += refs.size;
      record.originalClear.call(refs);
    }) as typeof refs.clear;
  }
}

const activeControllers = new Set<ScenarioController<CleanupStressState>>();
const activeDiagnostics = new Set<RuntimeDiagnostics>();
const activeImages = new Set<ControlledImages>();
const activeStructureDiagnostics = new Set<StructureDiagnostics>();
const activeRuntimeControllers = new Set<CRCController>();

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The cleanup stress Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function waitFrames(count: number): Promise<void> {
  for (let index = 0; index < count; index++) {
    await nextFrame();
  }
}

async function mountLab(options: {
  controlledImages?: boolean;
  structureDiagnostics?: boolean;
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = cleanupStressScenarioEntry.canvas.width;
  canvas.height = cleanupStressScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const diagnostics = new RuntimeDiagnostics(canvas);
  activeDiagnostics.add(diagnostics);
  const structureDiagnostics = options.structureDiagnostics ?
    new StructureDiagnostics() :
    undefined;
  if (structureDiagnostics) {
    activeStructureDiagnostics.add(structureDiagnostics);
  }
  const images = options.controlledImages ? new ControlledImages() : undefined;
  if (images) {
    activeImages.add(images);
  }
  const definition = await loadScenario(cleanupStressScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  return {
    canvas,
    controller,
    definition,
    diagnostics,
    images,
    structureDiagnostics,
  };
}

function expectFullyReleased(diagnostics: RuntimeDiagnostics): void {
  expect(diagnostics.snapshot()).toEqual({
    componentTeardowns: 0,
    eventTargets: 0,
    handlers: EMPTY_HANDLERS,
    instances: 0,
    mainTeardowns: 0,
    nativeListeners: 0,
    pointerCaptures: 0,
    propagationListeners: 0,
    scheduledFrames: 0,
  });
  const ledger = diagnostics.ledgerSnapshot();
  expect(ledger.nativeListeners).toMatchObject({
    duplicateReleases: 0,
    live: 0,
    released: ledger.nativeListeners.acquired,
  });
  expect(ledger.frames.pending).toBe(0);
}

function expectTemporaryRenderStateReleased(): void {
  expect(GLOBAL_STATE).toMatchObject({
    canvas: undefined,
    componentHookIndex: 0,
    componentIsMounting: false,
    componentRefs: undefined,
    currentCRCInstance: undefined,
    renderContext: undefined,
    seenIds: undefined,
    unseenIds: undefined,
  });
  expect(GLOBAL_STATE.clippingStack).toEqual([]);
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  for (const controller of activeRuntimeControllers) {
    controller.dispose();
  }
  activeRuntimeControllers.clear();
  for (const diagnostics of activeDiagnostics) {
    diagnostics.restore();
  }
  activeDiagnostics.clear();
  for (const images of activeImages) {
    images.restore();
  }
  activeImages.clear();
  for (const diagnostics of activeStructureDiagnostics) {
    diagnostics.restore();
  }
  activeStructureDiagnostics.clear();
  document.body.replaceChildren();
});

describe('shared runtime cleanup stress laboratory', () => {
  it('keeps exact ownership stable through 1,000 live layout reflows', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    document.body.replaceChildren(canvas);
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const structureDiagnostics = new StructureDiagnostics();
    activeStructureDiagnostics.add(structureDiagnostics);
    const createScene = () => absolute({
      style: { width: '100%', height: '100%' },
      children: [rect({
        key: 'stable-half',
        style: { width: '50%', height: '50%', fill: '#16a34a' },
        onMouseMove: () => undefined,
      })],
    });
    resetLayoutDiagnostics();
    const controller = mountCRC(canvas, createScene());
    activeRuntimeControllers.add(controller);
    executeRender(canvas, 0);
    const resourceBaseline = diagnostics.snapshot();
    const structureBaseline = structureDiagnostics.snapshot();
    expect(resourceBaseline).toMatchObject({
      eventTargets: 1,
      handlers: { ...EMPTY_HANDLERS, mousemove: 1 },
      instances: 1,
      nativeListeners: 2,
      pointerCaptures: 0,
      propagationListeners: 0,
      scheduledFrames: 0,
    });
    expect(snapshotLayoutDiagnostics()).toEqual({
      layoutEvaluations: 1,
      measurements: 0,
      placements: 1,
    });

    for (let index = 0; index < 1_000; index++) {
      canvas.width = index % 2 === 0 ? 320 : 400;
      canvas.height = index % 2 === 0 ? 240 : 300;
      executeRender(canvas, index + 1, createScene());
    }

    expect(diagnostics.snapshot()).toEqual(resourceBaseline);
    expect(structureDiagnostics.snapshot()).toEqual(structureBaseline);
    expect(snapshotLayoutDiagnostics()).toEqual({
      layoutEvaluations: 1_001,
      measurements: 0,
      placements: 1_001,
    });
    expect(pixelAt(canvas, 199, 149)).toEqual([22, 163, 74, 255]);
    expect(pixelAt(canvas, 201, 151)).toEqual([0, 0, 0, 0]);
    expectTemporaryRenderStateReleased();

    controller.dispose();
    activeRuntimeControllers.delete(controller);
    expectFullyReleased(diagnostics);
    expect(structureDiagnostics.snapshot()).toEqual({
      instances: { acquired: 1, live: 0, released: 1 },
      refs: {
        acquired: structureBaseline.refs.acquired,
        live: 0,
        released: structureBaseline.refs.acquired,
      },
    });
  });

  it('loads through the catalog/source adapter with deterministic initial and reset state', async () => {
    expect(cleanupStressSource).toContain(cleanupStressScenarioEntry.source.marker);
    expect(cleanupStressScenarioEntry.actions.map(action => action.id)).toEqual([
      'queue-frame',
      'dispose-with-frame',
      'show-image',
      'change-image-source',
      'show-broken-image',
      'remove-image',
      'add-layer',
      'add-nested-layer',
      'remove-layers',
      'change-hook-dependency',
      'replace-component-key',
      'remove-component',
      'restore-component',
      'replace-root',
      'abort-runtime',
      'dispose-runtime',
      'cleanup-again',
      'remount-runtime',
      'cycle-runtime-1000',
    ]);
    const { canvas, controller, definition, diagnostics } = await mountLab();
    expect(controller.getState()).toMatchObject({
      completedRenders: 1,
      componentKey: 1,
      componentVisible: true,
      hookAcquisitions: 1,
      hookCleanups: 0,
      hookDependency: 1,
      imageMode: 'hidden',
      layerMode: 'hidden',
      mountCycles: 0,
      mountGeneration: 1,
      rootVariant: 'a',
      runtime: 'mounted',
    });
    expect(definition.formatState(controller.getState())).toContainEqual({
      label: 'Hook ownership',
      value: '1 acquired · 0 cleaned',
    });
    expect(diagnostics.snapshot()).toMatchObject({
      eventTargets: 0,
      handlers: EMPTY_HANDLERS,
      instances: 1,
      nativeListeners: 0,
      pointerCaptures: 0,
      propagationListeners: 0,
      scheduledFrames: 0,
    });
    expect(pixelAt(canvas, 10, 10)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(canvas, 50, 60)).toEqual([124, 58, 237, 255]);

    await controller.perform('replace-root');
    expect(pixelAt(canvas, 10, 10)).toEqual([238, 242, 255, 255]);
    await controller.reset();
    expect(controller.getState()).toMatchObject({
      completedRenders: 1,
      hookAcquisitions: 1,
      hookCleanups: 0,
      lastAction: 'reset',
      mountGeneration: 1,
      rootVariant: 'a',
    });
    expect(pixelAt(canvas, 10, 10)).toEqual([248, 250, 252, 255]);
  });

  it('cancels pending frames across abort, dispose, repeated cleanup, and remount', async () => {
    const { controller, diagnostics } = await mountLab();
    const baseline = diagnostics.snapshot();

    await controller.perform('queue-frame');
    expect(controller.getState()).toMatchObject({
      completedRenders: 1,
      frameRequests: 1,
      revision: 1,
      runtime: 'mounted',
    });
    expect(diagnostics.snapshot().scheduledFrames).toBe(1);
    await controller.perform('abort-runtime');
    expect(controller.getState()).toMatchObject({
      completedRenders: 1,
      hookAcquisitions: 1,
      hookCleanups: 1,
      runtime: 'aborted',
    });
    expect(diagnostics.snapshot()).toMatchObject({ instances: 0, scheduledFrames: 0 });

    await controller.perform('cleanup-again');
    expect(controller.getState().hookCleanups).toBe(1);
    await controller.perform('remount-runtime');
    expect(controller.getState()).toMatchObject({
      completedRenders: 2,
      hookAcquisitions: 2,
      hookCleanups: 1,
      runtime: 'mounted',
    });
    expect(diagnostics.snapshot()).toEqual(baseline);

    await controller.perform('dispose-with-frame');
    expect(controller.getState()).toMatchObject({
      completedRenders: 2,
      frameDisposals: 1,
      frameRequests: 2,
      hookCleanups: 2,
      runtime: 'disposed',
    });
    expect(diagnostics.snapshot()).toMatchObject({ instances: 0, scheduledFrames: 0 });
    await controller.perform('cleanup-again');
    expect(controller.getState().hookCleanups).toBe(2);
  });

  it('releases single and nested layer instances with no stale pixels or references', async () => {
    const { canvas, controller, diagnostics } = await mountLab();
    const root = getCRCInstance(canvas);
    const baseline = diagnostics.snapshot();

    await controller.perform('add-layer');
    expect(controller.getState().layerMode).toBe('single');
    expect(diagnostics.snapshot().instances).toBe(2);
    expect(root.paintEntries.size).toBe(1);
    expect(pixelAt(canvas, 200, 60)).toEqual([245, 158, 11, 255]);

    await controller.perform('add-nested-layer');
    expect(controller.getState().layerMode).toBe('nested');
    expect(diagnostics.snapshot().instances).toBe(3);
    expect(GLOBAL_STATE.crcInstances.size).toBe(3);
    expect(pixelAt(canvas, 200, 60)).toEqual([248, 250, 252, 255]);
    expect(pixelAt(canvas, 350, 60)).toEqual([16, 185, 129, 255]);

    await controller.perform('remove-layers');
    expect(controller.getState().layerMode).toBe('hidden');
    expect(diagnostics.snapshot()).toEqual(baseline);
    expect(root.paintEntries.size).toBe(0);
    expect(GLOBAL_STATE.crcInstances.size).toBe(1);
    expect(pixelAt(canvas, 350, 60)).toEqual([248, 250, 252, 255]);

    for (let index = 0; index < 25; index++) {
      await controller.perform('add-nested-layer');
      await controller.perform('remove-layers');
      expect(diagnostics.snapshot(), `layer cycle ${index + 1}`).toEqual(baseline);
    }
  }, 30_000);

  it('executes hook cleanup exactly once for dependency, key, component, root, and runtime boundaries', async () => {
    const { controller, diagnostics } = await mountLab();
    const baseline = diagnostics.snapshot();

    await controller.perform('change-hook-dependency');
    expect(controller.getState()).toMatchObject({ hookAcquisitions: 2, hookCleanups: 1 });
    expect(diagnostics.snapshot()).toEqual(baseline);
    await controller.perform('replace-component-key');
    expect(controller.getState()).toMatchObject({ hookAcquisitions: 3, hookCleanups: 2 });
    expect(diagnostics.snapshot()).toEqual(baseline);
    await controller.perform('remove-component');
    expect(controller.getState()).toMatchObject({
      componentVisible: false,
      hookAcquisitions: 3,
      hookCleanups: 3,
    });
    await controller.perform('restore-component');
    expect(controller.getState()).toMatchObject({ hookAcquisitions: 4, hookCleanups: 3 });
    await controller.perform('replace-root');
    expect(controller.getState()).toMatchObject({
      hookAcquisitions: 5,
      hookCleanups: 4,
      rootVariant: 'b',
    });
    expect(diagnostics.snapshot()).toEqual(baseline);

    await controller.perform('dispose-runtime');
    expect(controller.getState()).toMatchObject({
      hookAcquisitions: 5,
      hookCleanups: 5,
      runtime: 'disposed',
    });
    await controller.perform('cleanup-again');
    expect(controller.getState().hookCleanups).toBe(5);
    expectFullyReleased(diagnostics);
  });

  it('renders deterministic data images and clears stale pixels for source changes and errors', async () => {
    const { canvas, controller } = await mountLab();

    await controller.perform('show-image');
    await waitFrames(3);
    expect(controller.getState().imageMode).toBe('primary');
    expect(pixelAt(canvas, 180, 140)).toEqual([14, 165, 233, 255]);
    await controller.perform('change-image-source');
    await waitFrames(3);
    expect(controller.getState().imageMode).toBe('secondary');
    expect(pixelAt(canvas, 180, 140)).toEqual([236, 72, 153, 255]);
    await controller.perform('show-broken-image');
    await waitFrames(3);
    expect(controller.getState().imageMode).toBe('broken');
    expect(pixelAt(canvas, 180, 140)).toEqual([248, 250, 252, 255]);
    await controller.perform('remove-image');
    expect(pixelAt(canvas, 180, 140)).toEqual([248, 250, 252, 255]);
  });

  it('detaches superseded and removed image callbacks so forced late completion cannot schedule work', async () => {
    const { controller, diagnostics, images } = await mountLab({ controlledImages: true });
    await controller.perform('show-image');
    expect(images!.records).toHaveLength(1);
    expect(images!.records[0].getSource()).toBe(CLEANUP_IMAGE_SOURCES.primary);
    await controller.perform('change-image-source');
    expect(images!.records).toHaveLength(2);
    expect(images!.records[1].getSource()).toBe(CLEANUP_IMAGE_SOURCES.secondary);
    await controller.perform('show-broken-image');
    expect(images!.records).toHaveLength(3);
    expect(images!.records[2].getSource()).toBe(CLEANUP_IMAGE_SOURCES.broken);
    await controller.perform('remove-image');
    const beforeLateCompletion = controller.getState();
    const resourcesBefore = diagnostics.snapshot();

    for (const record of images!.records) {
      record.completeLoad();
      record.completeError();
    }
    expect(diagnostics.snapshot()).toEqual(resourcesBefore);
    expect(controller.getState()).toEqual(beforeLateCompletion);

    await controller.perform('dispose-runtime');
    for (const record of images!.records) {
      record.completeLoad();
      record.completeError();
    }
    expect(diagnostics.snapshot()).toMatchObject({ instances: 0, scheduledFrames: 0 });
  });

  it('returns exact ownership ledgers to one live baseline after 1,000 mount/dispose cycles', async () => {
    const { canvas, controller, diagnostics, structureDiagnostics } = await mountLab({
      structureDiagnostics: true,
    });
    const baseline = diagnostics.snapshot();
    const baselineRefs = getCRCInstance(canvas).refs.size;
    diagnostics.ledgerSnapshot();

    await controller.perform('cycle-runtime-1000');
    expect(controller.getState()).toMatchObject({
      completedRenders: 1_002,
      hookAcquisitions: 1_002,
      hookCleanups: 1_001,
      mountCycles: 1_000,
      mountGeneration: 1_002,
      runtime: 'mounted',
    });
    expect(diagnostics.snapshot()).toEqual(baseline);
    const ledger = diagnostics.ledgerSnapshot();
    expect(ledger.nativeListeners).toEqual({
      acquired: 0,
      duplicateReleases: 0,
      live: 0,
      released: 0,
    });
    expect(ledger.frames).toEqual({
      canceled: 0,
      completed: 2_004,
      pending: 0,
      requested: 2_004,
    });
    expect(structureDiagnostics!.snapshot()).toEqual({
      instances: {
        acquired: 1_002,
        live: 1,
        released: 1_001,
      },
      refs: {
        acquired: baselineRefs * 1_002,
        live: baselineRefs,
        released: baselineRefs * 1_001,
      },
    });
    expectTemporaryRenderStateReleased();

    await controller.perform('cleanup-again');
    expect(controller.getState()).toMatchObject({
      completedRenders: 1_002,
      hookAcquisitions: 1_002,
      hookCleanups: 1_001,
      lastAction: 'cleanup-again',
      runtime: 'mounted',
    });
    expect(diagnostics.snapshot()).toEqual(baseline);
    expect(getCRCInstance(canvas).mainTeardowns.closed).toBe(false);
    expect(pixelAt(canvas, 50, 60)).toEqual([124, 58, 237, 255]);

    await controller.perform('change-hook-dependency');
    expect(controller.getState()).toMatchObject({
      completedRenders: 1_003,
      hookAcquisitions: 1_003,
      hookCleanups: 1_002,
      runtime: 'mounted',
    });
    expect(diagnostics.snapshot()).toEqual(baseline);
    expect(pixelAt(canvas, 50, 60)).toEqual([37, 99, 235, 255]);

    await controller.dispose();
    activeControllers.delete(controller);
    expectFullyReleased(diagnostics);
    expect(structureDiagnostics!.snapshot()).toEqual({
      instances: {
        acquired: 1_002,
        live: 0,
        released: 1_002,
      },
      refs: {
        acquired: baselineRefs * 1_002 + 1,
        live: 0,
        released: baselineRefs * 1_002 + 1,
      },
    });
    expectTemporaryRenderStateReleased();
  }, 40_000);
});
