import {
  PARTICLE_CELEBRATION_LAB_ACTION_IDS,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadLearningExample,
  loadScenario,
  particleCelebrationLabScenarioEntry,
  scenarioCatalog,
  type ParticleCelebrationLabState,
  type ScenarioController,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import { loadLearningSource } from '../../../playground/src/learning-sources';
import { loadScenarioSource } from '../../../playground/src/scenario-sources';
import { clickLogicalPoint } from './support/user-input';

const activeControllers = new Set<ScenarioController<ParticleCelebrationLabState>>();

afterEach(async () => {
  for (const controller of activeControllers) await controller.dispose();
  activeControllers.clear();
  document.body.replaceChildren();
});

async function nextPaint(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
}

function pixels(
  canvas: HTMLCanvasElement,
  region: Readonly<{ x: number; y: number; width: number; height: number }>,
): Uint8ClampedArray {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The particle celebration Canvas has no 2D context.');
  return context.getImageData(region.x, region.y, region.width, region.height).data;
}

function changedPixelCount(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
): number {
  let changed = 0;
  for (let offset = 0; offset < before.length; offset += 4) {
    if (
      before[offset] !== after[offset] ||
      before[offset + 1] !== after[offset + 1] ||
      before[offset + 2] !== after[offset + 2] ||
      before[offset + 3] !== after[offset + 3]
    ) {
      changed += 1;
    }
  }
  return changed;
}

function occupiedParticleCells(
  image: Uint8ClampedArray,
  width: number,
  cellSize = 10,
): ReadonlySet<string> {
  const occupied = new Set<string>();
  for (let offset = 0; offset < image.length; offset += 4) {
    const colorDistance =
      Math.abs(image[offset]! - 16) +
      Math.abs(image[offset + 1]! - 35) +
      Math.abs(image[offset + 2]! - 63);
    if (colorDistance < 36) continue;
    const pixel = offset / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    occupied.add(`${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`);
  }
  return occupied;
}

function overlapRatio(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  const union = new Set([...left, ...right]);
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return intersection / union.size;
}

async function mountCelebrationLab() {
  const canvas = document.createElement('canvas');
  canvas.width = particleCelebrationLabScenarioEntry.canvas.width;
  canvas.height = particleCelebrationLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block;width:640px;height:360px';
  document.body.replaceChildren(canvas);
  const definition = await loadScenario(particleCelebrationLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  await controller.settled();
  return { canvas, controller, definition };
}

describe('first-class Canvas particle public scenarios', () => {
  it('registers one runnable laboratory and one focused learning example', async () => {
    const learning = getLearningExampleBySlug('particle-effects');
    expect(learning).toMatchObject({
      slug: 'particle-effects',
      section: 'composition',
      api: [
        'defineParticleEffect2D',
        'particle',
        'crcParticleSystem',
        'Particles2D',
      ],
      source: {
        path: 'packages/scenarios/src/learning/composition/particle-effects.example.tsx',
      },
    });
    expect(learning && getLearningExampleRoute(learning)).toBe(
      '#/examples/composition/particle-effects',
    );

    expect(scenarioCatalog).toContain(particleCelebrationLabScenarioEntry);
    expect(getScenarioRoute(particleCelebrationLabScenarioEntry)).toBe(
      '#/testing/particle-celebration',
    );
    expect(particleCelebrationLabScenarioEntry).toMatchObject({
      metadata: {
        id: 'first-class-particle-celebration',
        slug: 'particle-celebration',
      },
      canvas: { width: 640, height: 360 },
      source: {
        id: 'first-class-particle-celebration-laboratory-example',
        marker:
          "PARTICLE_CELEBRATION_LAB_SOURCE_ID = 'first-class-particle-celebration-laboratory-example'",
        path: 'packages/scenarios/src/particle-celebration-lab.example.tsx',
      },
    });
    expect(PARTICLE_CELEBRATION_LAB_ACTION_IDS).toEqual([
      'burst',
      'pause',
      'resume',
      'restart',
      'drain',
      'clear',
      'toggle-filter',
      'remove-owner',
      'reset',
    ]);
    expect(particleCelebrationLabScenarioEntry.actions.map(action => action.id)).toEqual(
      PARTICLE_CELEBRATION_LAB_ACTION_IDS,
    );

    if (!learning) throw new Error('Missing particle-effects learning example.');
    const [learningSource, labSource] = await Promise.all([
      loadLearningSource(learning),
      loadScenarioSource(particleCelebrationLabScenarioEntry),
    ]);
    for (const source of [learningSource, labSource]) {
      expect(source).toMatch(/from ['"]@crc\/particles['"]/u);
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).not.toMatch(/@crc\/(?:particles|core)\/(?:internal|lib|src)\b/u);
    }

    const definition = await loadScenario(particleCelebrationLabScenarioEntry);
    expect(definition).toMatchObject({
      id: 'first-class-particle-celebration',
      sourceId: 'first-class-particle-celebration-laboratory-example',
      actionIds: PARTICLE_CELEBRATION_LAB_ACTION_IDS,
    });
  });

  it('runs positioned bursts and every lifecycle command through public state', async () => {
    const { canvas, controller } = await mountCelebrationLab();
    expect(controller.getState()).toEqual({
      status: 'idle',
      execution: 'stateless-canvas',
      acceptedBursts: 0,
      rejectedParticles: 0,
      lastEvent: 'mount',
      owner: 'mounted',
      staleHandleInert: false,
    });

    const leftRegion = { x: 96, y: 116, width: 128, height: 128 };
    const rightRegion = { x: 416, y: 106, width: 128, height: 128 };
    const beforeLeft = pixels(canvas, leftRegion);
    const beforeRight = pixels(canvas, rightRegion);

    await clickLogicalPoint(canvas, { x: 160, y: 180 });
    await controller.settled();
    await clickLogicalPoint(canvas, { x: 480, y: 170 });
    await controller.settled();

    expect(controller.getState()).toMatchObject({
      status: 'running',
      execution: 'stateless-canvas',
      acceptedBursts: 4,
      rejectedParticles: 0,
      lastEvent: 'burst-accepted',
    });
    expect(changedPixelCount(beforeLeft, pixels(canvas, leftRegion))).toBeGreaterThan(20);
    expect(changedPixelCount(beforeRight, pixels(canvas, rightRegion))).toBeGreaterThan(20);

    await controller.perform('pause');
    await controller.settled();
    expect(controller.getState().status).toBe('paused');

    await controller.perform('burst');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      status: 'paused',
      acceptedBursts: 4,
      rejectedParticles: 60,
      lastEvent: 'burst-rejected',
    });

    await controller.perform('resume');
    await controller.settled();
    expect(controller.getState().status).toBe('running');

    await controller.perform('restart');
    await controller.perform('burst');
    await controller.settled();
    const firstSeededBurst = pixels(canvas, { x: 240, y: 100, width: 160, height: 160 });

    await controller.perform('clear');
    await controller.perform('restart');
    await controller.perform('burst');
    await controller.settled();
    const repeatedSeededBurst = pixels(canvas, { x: 240, y: 100, width: 160, height: 160 });
    expect(
      overlapRatio(
        occupiedParticleCells(firstSeededBurst, 160),
        occupiedParticleCells(repeatedSeededBurst, 160),
      ),
    ).toBeGreaterThan(0.8);

    await controller.perform('drain');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      status: 'draining',
      lastEvent: 'drain-start',
    });

    await controller.perform('clear');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      status: 'finished',
      lastEvent: 'finish',
    });

    await controller.perform('toggle-filter');
    await controller.perform('remove-owner');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      status: 'disposed',
      execution: 'unbound',
      owner: 'removed',
      staleHandleInert: true,
    });

    await controller.reset();
    await controller.settled();
    expect(controller.getState()).toEqual({
      status: 'idle',
      execution: 'stateless-canvas',
      acceptedBursts: 0,
      rejectedParticles: 0,
      lastEvent: 'mount',
      owner: 'mounted',
      staleHandleInert: false,
    });
  });

  it('mounts the learning ambient effect and accepts an explicit click burst', async () => {
    const entry = getLearningExampleBySlug('particle-effects');
    if (!entry) throw new Error('Missing particle-effects learning example.');
    const canvas = document.createElement('canvas');
    canvas.width = entry.canvas.width;
    canvas.height = entry.canvas.height;
    canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
    document.body.replaceChildren(canvas);
    const module = await loadLearningExample(entry);
    const controller = module.default(canvas);
    try {
      await nextPaint(3);
      const before = pixels(canvas, { x: 260, y: 120, width: 200, height: 200 });
      await clickLogicalPoint(canvas, { x: 360, y: 220 });
      await nextPaint(3);
      expect(changedPixelCount(before, pixels(canvas, {
        x: 260,
        y: 120,
        width: 200,
        height: 200,
      }))).toBeGreaterThan(20);
    } finally {
      controller.dispose();
    }
  });
});
