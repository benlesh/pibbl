import {
  ANIMATION_LAB_ACTION_IDS,
  animationLabScenarioEntry,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadLearningExample,
  loadScenario,
  type AnimationLabState,
  type ScenarioController,
} from '@crc/scenarios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from '../src/lib/scheduler/testing.js';
import { writerLeaseSnapshot } from '../src/lib/animation/writer-leases.js';
import { loadLearningSource } from '../../../playground/src/learning-sources';
import { loadScenarioSource } from '../../../playground/src/scenario-sources';
import {
  mountScenarioSurface,
  scenarioSurfaceStyles,
} from '../../scenarios/src/surface';
import { clickLogicalPoint, pressKey } from './support/user-input';
import { expectVisualMatch } from './visual-compare';

const EXPECTED_ACTION_IDS = [
  'play',
  'pause',
  'step',
  'seek-start',
  'seek-middle',
  'seek-end',
  'reverse',
  'retarget',
  'repeat',
  'simulate',
  'show-layer',
  'show-shared-roots',
  'cancel',
  'remove-owner',
  'reset',
] as const;

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
let hostTime: number;
const controllers = new Set<ScenarioController<AnimationLabState>>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
  hostTime = -10;
});

afterEach(async () => {
  for (const controller of controllers) await controller.dispose();
  controllers.clear();
  restoreDriver();
  document.body.replaceChildren();
});

function flushAfter(milliseconds = 1): void {
  hostTime += milliseconds;
  expect(driver.pendingHostFrames).toBe(1);
  driver.flush(hostTime);
}

async function mountAnimationLab() {
  const canvas = document.createElement('canvas');
  canvas.width = animationLabScenarioEntry.canvas.width;
  canvas.height = animationLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block;width:480px;height:240px';
  const referenceHost = document.createElement('div');
  document.body.append(canvas, referenceHost);
  const definition = await loadScenario(animationLabScenarioEntry);
  const controller = await definition.mount({ canvas, referenceHost });
  controllers.add(controller);
  flushAfter();
  return { canvas, controller, definition, referenceHost };
}

async function resetAndFlush(
  controller: ScenarioController<AnimationLabState>,
): Promise<void> {
  await controller.reset();
  flushAfter();
}

async function performAdoptedAction(
  controller: ScenarioController<AnimationLabState>,
  action: 'retarget' | 'repeat' | 'simulate',
): Promise<void> {
  const pending = controller.perform(action);
  await Promise.resolve();
  flushAfter();
  await pending;
  flushAfter();
}

describe('first-class animation public scenarios', () => {
  it('registers the learning and laboratory routes with exact public source identities', async () => {
    const learning = getLearningExampleBySlug('signals-and-animation');
    expect(learning).toMatchObject({
      slug: 'signals-and-animation',
      section: 'composition',
      api: [
        'useSignal',
        'useAnimatedValue',
        'usePlayback',
        'parallel',
        'sequence',
        'marker',
        'spring',
      ],
      source: {
        path: 'packages/scenarios/src/learning/composition/signals-and-animation.example.tsx',
      },
    });
    expect(learning && getLearningExampleRoute(learning)).toBe(
      '#/examples/composition/signals-and-animation',
    );

    expect(getScenarioRoute(animationLabScenarioEntry)).toBe('#/testing/animation');
    expect(animationLabScenarioEntry).toMatchObject({
      metadata: {
        id: 'first-class-animation',
        slug: 'animation',
      },
      canvas: { width: 480, height: 240 },
      source: {
        id: 'first-class-animation-laboratory-example',
        marker: "ANIMATION_LAB_SOURCE_ID = 'first-class-animation-laboratory-example'",
        path: 'packages/scenarios/src/animation-lab.example.tsx',
      },
    });
    expect(ANIMATION_LAB_ACTION_IDS).toEqual(EXPECTED_ACTION_IDS);
    expect(animationLabScenarioEntry.actions.map(action => action.id)).toEqual(
      EXPECTED_ACTION_IDS,
    );

    if (!learning) throw new Error('Missing signals-and-animation learning example.');
    const [learningSource, labSource] = await Promise.all([
      loadLearningSource(learning),
      loadScenarioSource(animationLabScenarioEntry),
    ]);
    for (const source of [learningSource, labSource]) {
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).not.toMatch(/@crc\/core\/(?:internal|lib|src)\b/u);
    }
    expect(learningSource).toContain('.get()');
    expect(labSource).toContain('.get()');
    expect(labSource).not.toMatch(/ManualSchedulerDriver|installSchedulerDriverForTest/u);
    expect(labSource).toContain(
      "ANIMATION_LAB_SOURCE_ID = 'first-class-animation-laboratory-example'",
    );
  });

  it('resets an active learning pulse on FocusManagement Enter without a delayed snap', async () => {
    const learning = getLearningExampleBySlug('signals-and-animation');
    if (!learning) throw new Error('Missing signals-and-animation learning example.');
    const beforeLeases = writerLeaseSnapshot().active;
    const canvas = document.createElement('canvas');
    canvas.width = learning.canvas.width;
    canvas.height = learning.canvas.height;
    canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
    document.body.appendChild(canvas);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The signals-and-animation lesson has no 2D context.');
    const textPaints: Array<{ readonly scale: number; readonly text: string }> = [];
    const fillText = context.fillText;
    context.fillText = function(text, ...args) {
      textPaints.push({ scale: this.getTransform().a, text });
      return fillText.call(this, text, ...args);
    };
    const latestCardScale = (): number => {
      const scale = textPaints
        .filter(paint => paint.text === 'EXPLICIT .get()')
        .at(-1)?.scale;
      if (scale === undefined) throw new Error('The animated learning card was not painted.');
      return scale;
    };

    const hostErrors: unknown[] = [];
    const captureError = (event: ErrorEvent): void => {
      event.preventDefault();
      hostErrors.push(event.error ?? event.message);
    };
    const captureRejection = (event: PromiseRejectionEvent): void => {
      event.preventDefault();
      hostErrors.push(event.reason);
    };
    window.addEventListener('error', captureError);
    window.addEventListener('unhandledrejection', captureRejection);
    const module = await loadLearningExample(learning);
    const controller = module.default(canvas);

    try {
      flushAfter();
      await expect(
        clickLogicalPoint(canvas, { x: 180, y: 180 }),
      ).resolves.toBeUndefined();
      expect(document.activeElement).toBe(canvas);
      expect(driver.pendingHostFrames).toBe(1);
      flushAfter();
      expect(writerLeaseSnapshot().active).toBeGreaterThan(beforeLeases);

      flushAfter();
      flushAfter(500);
      const advancedPulseScale = latestCardScale();
      expect(advancedPulseScale).toBeGreaterThan(0.96);
      expect(Array.from(context.getImageData(120, 160, 1, 1).data)).toEqual([
        238,
        242,
        255,
        255,
      ]);

      await expect(pressKey('Enter')).resolves.toBeUndefined();
      expect(hostErrors).toEqual([]);
      expect(driver.pendingHostFrames).toBe(1);
      flushAfter();
      const replacementStartScale = latestCardScale();
      expect(Array.from(context.getImageData(120, 160, 1, 1).data)).not.toEqual([
        238,
        242,
        255,
        255,
      ]);

      flushAfter(359);
      const scaleBeforePulse = latestCardScale();
      expect(Array.from(context.getImageData(120, 160, 1, 1).data)).toEqual([
        238,
        242,
        255,
        255,
      ]);
      flushAfter(1);
      const scaleAtPulseStart = latestCardScale();
      flushAfter();
      expect(textPaints.map(paint => paint.text)).toContain(
        'ARRIVED · ONE COMMITTED FRAME',
      );
      expect({
        delayedPulseSnap: Math.abs(scaleAtPulseStart - scaleBeforePulse) > 0.01,
        replacementStartScale,
      }).toEqual({
        delayedPulseSnap: false,
        replacementStartScale: expect.closeTo(0.96, 6),
      });
      expect(writerLeaseSnapshot().active).toBeGreaterThan(beforeLeases);
    } finally {
      controller.dispose();
      window.removeEventListener('error', captureError);
      window.removeEventListener('unhandledrejection', captureRejection);
    }
    expect(writerLeaseSnapshot().active).toBe(beforeLeases);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('drives play, pause, step, fixed seeks, cancel, and reset independently', async () => {
    const { controller } = await mountAnimationLab();
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      currentTime: 0,
      x: 0,
      opacity: 1,
      targetScale: 1,
      presentedScale: 1,
      iteration: 0,
      milestones: [],
      owner: 'mounted',
      staleStatus: 'none',
      lastAction: 'mount',
    });

    await controller.perform('play');
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 0,
      x: 0,
      opacity: 1,
      milestones: ['start@0:root:0'],
      lastAction: 'play',
    });
    flushAfter(100);
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 100,
      x: 90,
      opacity: 0.7,
    });

    await resetAndFlush(controller);
    await controller.perform('pause');
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'paused',
      currentTime: 0,
      x: 0,
      milestones: ['start@0:root:0'],
      lastAction: 'pause',
    });

    await resetAndFlush(controller);
    await controller.perform('step');
    flushAfter();
    const stepped = controller.getState();
    expect(stepped).toMatchObject({
      status: 'paused',
      currentTime: 16.6666666667,
      lastAction: 'step',
    });
    expect(stepped.x).toBeCloseTo(15, 10);
    expect(stepped.opacity).toBeCloseTo(0.95, 10);

    for (const [action, time, x, opacity] of [
      ['seek-start', 0, 0, 1],
      ['seek-middle', 150, 135, 0.55],
      ['seek-end', 300, 180, 0.4],
    ] as const) {
      await resetAndFlush(controller);
      await controller.perform(action);
      flushAfter();
      expect(controller.getState()).toMatchObject({
        status: 'paused',
        currentTime: time,
        x,
        opacity,
        lastAction: action,
      });
    }

    await resetAndFlush(controller);
    const cancel = controller.perform('cancel');
    await Promise.resolve();
    flushAfter();
    await cancel;
    const retained = controller.getState();
    expect(retained).toMatchObject({
      status: 'paused',
      currentTime: 120,
      x: 108,
      opacity: 0.64,
    });
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'cancelled',
      currentTime: 120,
      x: retained.x,
      opacity: retained.opacity,
      lastAction: 'cancel',
    });

    await controller.perform('reset');
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      currentTime: 0,
      x: 0,
      opacity: 1,
      milestones: [],
      owner: 'mounted',
      lastAction: 'reset',
    });
  });

  it('pauses a progressed playback at its exact committed time and values', async () => {
    const { controller } = await mountAnimationLab();

    await controller.perform('play');
    flushAfter();
    flushAfter(100);
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 100,
      x: 90,
      opacity: 0.7,
    });

    await controller.perform('pause');
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'paused',
      currentTime: 100,
      x: 90,
      opacity: 0.7,
      lastAction: 'pause',
    });
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('drives reverse, render-adopted retarget and repeat, and fixed-step simulation independently', async () => {
    const { controller } = await mountAnimationLab();

    await controller.perform('reverse');
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 300,
      x: 180,
      opacity: 0.4,
      pulseScale: 1.25,
      milestones: [
        'start@0:root:0',
        'marker(arrived)@0:1:0',
      ],
      lastAction: 'reverse',
    });
    flushAfter(50);
    expect(controller.getState()).toMatchObject({
      currentTime: 250,
      x: 180,
      opacity: 0.4,
      pulseScale: 1.125,
    });

    await resetAndFlush(controller);
    await performAdoptedAction(controller, 'retarget');
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      targetScale: 1.6,
      presentedScale: 1,
      lastAction: 'retarget',
    });
    flushAfter(60);
    expect(controller.getState().presentedScale).toBe(1.3);

    await resetAndFlush(controller);
    await performAdoptedAction(controller, 'repeat');
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 0,
      x: 0,
      milestones: ['start@0:root:0'],
      lastAction: 'repeat',
    });
    flushAfter(100);
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 100,
      x: 120,
      iteration: 1,
      milestones: [
        'start@0:root:0',
        'marker(turn)@100:0.1:0',
        'iteration@100:root:1',
      ],
    });
    flushAfter(50);
    const repeated = controller.getState();
    expect(repeated).toMatchObject({
      currentTime: 150,
      iteration: 1,
    });
    expect(repeated.x).toBeCloseTo(66.6666666667, 10);

    await resetAndFlush(controller);
    await performAdoptedAction(controller, 'simulate');
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 0,
      stepper: { value: 0, steps: 0 },
      milestones: ['start@0:root:0'],
      lastAction: 'simulate',
    });
    flushAfter(25);
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 25,
      stepper: { value: 4, steps: 2 },
    });
  });

  it('replaces an active Repeat with reset samples and remains resettable', async () => {
    const { controller } = await mountAnimationLab();

    await performAdoptedAction(controller, 'repeat');
    flushAfter(25);
    const firstRun = controller.getState();
    expect(firstRun.currentTime).toBe(25);
    expect(firstRun.x).toBeCloseTo(33.3333333333, 10);

    await performAdoptedAction(controller, 'repeat');
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 0,
      x: 0,
      iteration: 0,
      milestones: ['cancel@0:root:0', 'start@0:root:0'],
      lastAction: 'repeat',
    });

    await resetAndFlush(controller);
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      currentTime: 0,
      x: 0,
      iteration: 0,
      milestones: [],
      lastAction: 'reset',
    });
  });

  it('replaces an active Simulate with initial stepper state and remains resettable', async () => {
    const { controller } = await mountAnimationLab();

    await performAdoptedAction(controller, 'simulate');
    flushAfter(25);
    expect(controller.getState()).toMatchObject({
      currentTime: 25,
      stepper: { value: 4, steps: 2 },
    });

    await performAdoptedAction(controller, 'simulate');
    expect(controller.getState()).toMatchObject({
      status: 'running',
      currentTime: 0,
      stepper: { value: 0, steps: 0 },
      milestones: ['cancel@0:root:0', 'start@0:root:0'],
      lastAction: 'simulate',
    });

    await resetAndFlush(controller);
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      currentTime: 0,
      stepper: { value: 0, steps: 0 },
      milestones: [],
      lastAction: 'reset',
    });
  });

  it('returns one action rejection without poisoning a later Reset', async () => {
    const { controller, referenceHost } = await mountAnimationLab();
    const inducedFailure = new Error('induced reference host failure');
    Object.defineProperty(referenceHost, 'appendChild', {
      configurable: true,
      value: () => {
        throw inducedFailure;
      },
    });

    await expect(controller.perform('show-shared-roots')).rejects.toBe(
      inducedFailure,
    );
    delete (referenceHost as unknown as Record<string, unknown>).appendChild;

    await expect(controller.perform('reset')).resolves.toBeUndefined();
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      currentTime: 0,
      x: 0,
      stepper: { value: 0, steps: 0 },
      lastAction: 'reset',
    });
  });

  it('shows Layer cache reuse and one shared Commit across an optional second root', async () => {
    const { controller, referenceHost } = await mountAnimationLab();

    const showLayer = controller.perform('show-layer');
    await Promise.resolve();
    flushAfter();
    await showLayer;
    flushAfter();
    expect(controller.getState()).toMatchObject({
      layer: {
        visible: true,
        childRenders: 1,
        presentations: 2,
      },
      rootRenders: { primary: 3, secondary: 0 },
      lastAction: 'show-layer',
    });

    await resetAndFlush(controller);
    const showSharedRoots = controller.perform('show-shared-roots');
    await Promise.resolve();
    flushAfter();
    await showSharedRoots;
    flushAfter();
    expect(referenceHost.querySelectorAll('canvas')).toHaveLength(1);
    expect(controller.getState()).toMatchObject({
      rootRenders: { primary: 2, secondary: 2 },
      sharedRoots: {
        visible: true,
        value: 1,
        primaryRenders: 2,
        secondaryRenders: 2,
      },
      lastAction: 'show-shared-roots',
    });
  });

  it('disposes a removed owner and leaves its saved playback handle inert', async () => {
    const { controller } = await mountAnimationLab();

    const removal = controller.perform('remove-owner');
    await Promise.resolve();
    flushAfter();
    flushAfter();
    await removal;

    expect(controller.getState()).toMatchObject({
      owner: 'removed',
      staleStatus: 'disposed',
      staleActionInert: true,
      rootRenders: { primary: 2, secondary: 0 },
      lastAction: 'remove-owner',
    });
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('resets to a fresh owner and replays the same normalized public transcript', async () => {
    const { controller } = await mountAnimationLab();

    const playToEnd = async (): Promise<readonly string[]> => {
      await controller.perform('play');
      flushAfter();
      flushAfter(200);
      flushAfter(100);
      const state = controller.getState();
      expect(state).toMatchObject({
        status: 'finished',
        currentTime: 300,
        x: 180,
        opacity: 0.4,
        pulseScale: 1.25,
        milestones: [
          'start@0:root:0',
          'marker(arrived)@200:1:0',
          'finish@300:root:0',
        ],
      });
      return state.milestones;
    };

    const firstTranscript = await playToEnd();
    await resetAndFlush(controller);
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      currentTime: 0,
      x: 0,
      opacity: 1,
      pulseScale: 1,
      milestones: [],
      rootRenders: { primary: 1, secondary: 0 },
      owner: 'mounted',
      staleStatus: 'none',
      lastAction: 'reset',
    });
    const replayTranscript = await playToEnd();
    expect(replayTranscript).toEqual(firstTranscript);
  });

  it('presents every action as a native, focus-visible runner control with live state', async () => {
    const container = document.createElement('main');
    document.body.appendChild(container);
    const definition = await loadScenario(animationLabScenarioEntry);
    const sourceText = await loadScenarioSource(animationLabScenarioEntry);
    const surface = await mountScenarioSurface({
      container,
      entry: animationLabScenarioEntry,
      definition,
      sourceText,
    });

    try {
      flushAfter();
      expect([...surface.actionButtons.keys()]).toEqual(EXPECTED_ACTION_IDS);
      for (const button of surface.actionButtons.values()) {
        expect(button).toBeInstanceOf(HTMLButtonElement);
        expect(button.type).toBe('button');
      }
      expect(surface.resetButton).toBeInstanceOf(HTMLButtonElement);
      expect(surface.resetButton.type).toBe('button');
      expect(surface.canvas.getAttribute('aria-label')).toBe(
        'First-class animation laboratory canvas',
      );
      expect(
        container.querySelector('.scenario-runner')?.getAttribute('aria-label'),
      ).toBe('First-class animation laboratory interactive example');
      expect(
        container.querySelector('.scenario-runner__state')?.getAttribute('aria-live'),
      ).toBe('polite');
      expect(scenarioSurfaceStyles).toContain(
        '.scenario-runner__button:focus-visible',
      );

      surface.actionButtons.get('seek-middle')?.click();
      await Promise.resolve();
      flushAfter();
      expect(container.querySelector('.scenario-runner__state')?.textContent).toContain(
        'paused · 150 ms',
      );
    } finally {
      await surface.dispose();
    }
  });

  it('matches the reviewed laboratory at one exact finite logical time', async () => {
    const { canvas, controller } = await mountAnimationLab();
    await controller.perform('seek-middle');
    flushAfter();
    expect(controller.getState()).toMatchObject({
      status: 'paused',
      currentTime: 150,
      x: 135,
      opacity: 0.55,
      targetScale: 1,
      presentedScale: 1,
      pulseScale: 1,
      stepper: { value: 0, steps: 0 },
    });

    await expectVisualMatch({
      element: canvas,
      expectedPath: 'packages/core/test/visual-baselines/first-class-animation.expected.png',
      expectedArtifactPath:
        'test-screenshots/first-class-animation/animation.expected.png',
      actualPath:
        '../../../test-screenshots/first-class-animation/animation.actual.png',
      diffPath: 'test-screenshots/first-class-animation/animation.diff.png',
    });
  });
});
