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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWorkbenchSource } from '../../../playground/src/learning-sources';
import { loadScenarioSource } from '../../../playground/src/scenario-sources';
import { mountScenarioSurface } from '@crc/scenarios/surface';
import { clickLogicalPoint } from './support/user-input';

const activeControllers = new Set<
  ScenarioController<ParticleCelebrationLabState>
>();

afterEach(async () => {
  for (const controller of activeControllers) await controller.dispose();
  activeControllers.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function nextPaint(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
}

async function advanceVisibleTime(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  await nextPaint();
}

function pixels(
  canvas: HTMLCanvasElement,
  region: Readonly<{ x: number; y: number; width: number; height: number }>,
): Uint8ClampedArray {
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('The particle celebration Canvas has no 2D context.');
  return context.getImageData(region.x, region.y, region.width, region.height)
    .data;
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

function nonBackgroundPixelCount(
  image: Uint8ClampedArray,
  background: readonly [number, number, number],
): number {
  let count = 0;
  for (let offset = 0; offset < image.length; offset += 4) {
    if (
      image[offset] !== background[0] ||
      image[offset + 1] !== background[1] ||
      image[offset + 2] !== background[2]
    ) {
      count += 1;
    }
  }
  return count;
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
  pointerId = 17,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    pointerId,
    pointerType: 'mouse',
    buttons: type === 'pointerup' ? 0 : 1,
  }));
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

function overlapRatio(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number {
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
        'particleRange',
        'particleChoice',
        'particleCurve',
        'useParticleSystem',
        'Particles2D',
        'useSignal',
        'usePlayback',
        'repeat',
        'sequence',
        'wait',
        'marker',
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
      'launch',
      'pause',
      'resume',
      'replay',
      'clear',
      'toggle-glow',
    ]);
    expect(
      particleCelebrationLabScenarioEntry.actions.map((action) => action.id),
    ).toEqual(PARTICLE_CELEBRATION_LAB_ACTION_IDS);

    if (!learning)
      throw new Error('Missing particle-effects learning example.');
    const [learningSource, labSource] = await Promise.all([
      loadWorkbenchSource(learning),
      loadScenarioSource(particleCelebrationLabScenarioEntry),
    ]);
    for (const source of [learningSource, labSource]) {
      expect(source).toMatch(/from ['"]@crc\/core\/particles['"]/u);
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).not.toMatch(
        /@crc\/(?:particles|core)\/(?:internal|lib|src)\b/u,
      );
    }

    const definition = await loadScenario(particleCelebrationLabScenarioEntry);
    expect(definition).toMatchObject({
      id: 'first-class-particle-celebration',
      sourceId: 'first-class-particle-celebration-laboratory-example',
      actionIds: PARTICLE_CELEBRATION_LAB_ACTION_IDS,
    });
  });

  it('shows selected launch points, launches there, and exposes human-readable state', async () => {
    // Keep native frame delivery and input, but give each observed frame one
    // fixed duration so loaded CI cannot advance seeded replays by unequal time.
    const requestFrame = globalThis.requestAnimationFrame.bind(globalThis);
    let previousHostTime = -1;
    let logicalTime = 0;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback =>
      requestFrame(hostTime => {
        if (hostTime !== previousHostTime) {
          previousHostTime = hostTime;
          logicalTime += 1000 / 60;
        }
        callback(logicalTime);
      }),
    );
    const { canvas, controller } = await mountCelebrationLab();
    expect(controller.getState()).toEqual({
      animation: 'ready',
      selectedPoints: 0,
      celebrations: 0,
      lastAction: 'Choose up to two launch points.',
      glow: true,
    });

    const leftRegion = { x: 96, y: 116, width: 128, height: 128 };
    const rightRegion = { x: 416, y: 106, width: 128, height: 128 };
    const beforeLeft = pixels(canvas, leftRegion);
    const beforeRight = pixels(canvas, rightRegion);

    await clickLogicalPoint(canvas, { x: 160, y: 180 });
    await controller.settled();
    await clickLogicalPoint(canvas, { x: 480, y: 170 });
    await controller.settled();

    expect(controller.getState()).toEqual({
      animation: 'ready',
      selectedPoints: 2,
      celebrations: 0,
      lastAction: '2 launch points ready.',
      glow: true,
    });
    expect(
      changedPixelCount(beforeLeft, pixels(canvas, leftRegion)),
    ).toBeGreaterThan(10);
    expect(
      changedPixelCount(beforeRight, pixels(canvas, rightRegion)),
    ).toBeGreaterThan(10);

    await controller.perform('launch');
    await controller.settled();
    expect(controller.getState()).toEqual({
      animation: 'playing',
      selectedPoints: 0,
      celebrations: 2,
      lastAction: 'Celebration launched from 2 points.',
      glow: true,
    });
    expect(
      changedPixelCount(beforeLeft, pixels(canvas, leftRegion)),
    ).toBeGreaterThan(20);
    expect(
      changedPixelCount(beforeRight, pixels(canvas, rightRegion)),
    ).toBeGreaterThan(20);

    await controller.perform('pause');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      animation: 'paused',
      lastAction: 'Animation paused.',
    });

    await controller.perform('resume');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      animation: 'playing',
      lastAction: 'Animation resumed.',
    });

    await controller.perform('replay');
    await controller.settled();
    const replayRegion = { x: 12, y: 52, width: 616, height: 292 };
    const firstSeededBurst = pixels(canvas, replayRegion);

    await controller.perform('clear');
    await controller.perform('replay');
    await controller.settled();
    const repeatedSeededBurst = pixels(canvas, replayRegion);
    // Both captures now follow the same fixed-duration replay sequence.
    // Keep the existing spatial-overlap assertion unchanged.
    expect(
      overlapRatio(
        occupiedParticleCells(firstSeededBurst, replayRegion.width),
        occupiedParticleCells(repeatedSeededBurst, replayRegion.width),
      ),
    ).toBeGreaterThanOrEqual(0.75);

    await controller.perform('clear');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      animation: 'ready',
      selectedPoints: 0,
      lastAction: 'Stage cleared.',
    });

    await controller.perform('toggle-glow');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      glow: false,
      lastAction: 'Glow turned off.',
    });

    await controller.reset();
    await controller.settled();
    expect(controller.getState()).toEqual({
      animation: 'ready',
      selectedPoints: 0,
      celebrations: 0,
      lastAction: 'Choose up to two launch points.',
      glow: true,
    });
  });

  it('presents one Reset and only understandable particle controls', async () => {
    const container = document.createElement('main');
    document.body.appendChild(container);
    const definition = await loadScenario(particleCelebrationLabScenarioEntry);
    const sourceText = await loadScenarioSource(
      particleCelebrationLabScenarioEntry,
    );
    const surface = await mountScenarioSurface({
      container,
      entry: particleCelebrationLabScenarioEntry,
      definition,
      sourceText,
    });

    try {
      expect([...surface.actionButtons.keys()]).toEqual([
        'launch',
        'pause',
        'resume',
        'replay',
        'clear',
        'toggle-glow',
      ]);
      expect(
        [...container.querySelectorAll('button')].filter(
          (button) => button.textContent === 'Reset',
        ),
      ).toHaveLength(1);
      expect(
        container.querySelector('.scenario-runner__state')?.textContent,
      ).toContain('Choose up to two launch points.');
      expect(
        container.querySelector('.scenario-runner__state')?.textContent,
      ).not.toMatch(/unbound|owner|rejected|stale/iu);
    } finally {
      await surface.dispose();
    }
  });

  it('drags the burning square while leaving living fire and smoke at their birth positions', async () => {
    const entry = getLearningExampleBySlug('particle-effects');
    if (!entry) throw new Error('Missing particle-effects learning example.');
    const canvas = document.createElement('canvas');
    canvas.width = entry.canvas.width;
    canvas.height = entry.canvas.height;
    canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
    document.body.replaceChildren(canvas);
    const module = await loadLearningExample(entry);
    const controller = module.default(canvas);
    const capturedPointers = new Set<number>();
    vi.spyOn(canvas, 'setPointerCapture').mockImplementation((pointerId) => {
      capturedPointers.add(pointerId);
    });
    vi.spyOn(canvas, 'hasPointerCapture').mockImplementation((pointerId) =>
      capturedPointers.has(pointerId));
    vi.spyOn(canvas, 'releasePointerCapture').mockImplementation((pointerId) => {
      capturedPointers.delete(pointerId);
    });
    try {
      await advanceVisibleTime(240);
      expect(Array.from(pixels(canvas, {
        x: 360,
        y: 300,
        width: 1,
        height: 1,
      }))).toEqual([124, 45, 18, 255]);

      dispatchPointer(canvas, 'pointerdown', 360, 300);
      dispatchPointer(canvas, 'pointermove', 520, 320);
      dispatchPointer(canvas, 'pointerup', 520, 320);
      await advanceVisibleTime(200);

      expect(Array.from(pixels(canvas, {
        x: 520,
        y: 320,
        width: 1,
        height: 1,
      }))).toEqual([124, 45, 18, 255]);
      expect(nonBackgroundPixelCount(pixels(canvas, {
        x: 320,
        y: 170,
        width: 80,
        height: 80,
      }), [17, 24, 39])).toBeGreaterThan(10);
      expect(nonBackgroundPixelCount(pixels(canvas, {
        x: 480,
        y: 190,
        width: 80,
        height: 80,
      }), [17, 24, 39])).toBeGreaterThan(5);
    } finally {
      controller.dispose();
    }
  });
});
