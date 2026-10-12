import { pibbl, createElement, signal } from '@pibbl/core';
import {
  CELEBRATION_SEED,
  PARTICLE_CELEBRATION_LAB_SOURCE_ID,
  ParticleCelebrationLabRoot,
  emitCelebrationBurst,
  type CelebrationPoint,
  type ParticleCelebrationLabAction,
  type ParticleCelebrationLabModel,
  type ParticleCelebrationLabState,
} from './particle-celebration-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

/**
 * Stable action identifiers accepted by the particle celebration lab scenario.
 *
 * @see {@link ParticleCelebrationLabAction}
 */
export const PARTICLE_CELEBRATION_LAB_ACTION_IDS = [
  'launch',
  'pause',
  'resume',
  'replay',
  'clear',
  'toggle-glow',
] as const satisfies readonly ParticleCelebrationLabAction[];

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function createModel(): ParticleCelebrationLabModel {
  return {
    glowEnabled: signal(true, {
      debugName: 'particle celebration glow enabled',
    }),
    selectedPoints: signal<readonly CelebrationPoint[]>([], {
      debugName: 'particle celebration launch points',
    }),
    system: undefined,
    celebrations: 0,
    lastAction: 'Choose up to two launch points.',
    lastLaunchPoints: [],
    pendingLaunchPoints: 0,
    acceptedLaunchPoints: 0,
    publish: undefined,
  };
}

function snapshot(
  model: ParticleCelebrationLabModel,
): ParticleCelebrationLabState {
  const status = model.system?.status.get() ?? 'idle';
  return {
    animation:
      status === 'paused'
        ? 'paused'
        : status === 'scheduled' ||
            status === 'running' ||
            status === 'draining'
          ? 'playing'
          : 'ready',
    selectedPoints: model.selectedPoints.get().length,
    celebrations: model.celebrations,
    lastAction: model.lastAction,
    glow: model.glowEnabled.get(),
  };
}

async function mountParticleCelebrationLab(
  context: ScenarioMountContext<ParticleCelebrationLabState>,
): Promise<ScenarioController<ParticleCelebrationLabState>> {
  let disposed = false;
  let model = createModel();
  let root: ReturnType<typeof pibbl> | undefined;
  let actionQueue = Promise.resolve();

  const assertActive = (): void => {
    if (disposed) {
      throw new Error(
        'Cannot operate on a disposed particle celebration laboratory.',
      );
    }
  };
  const publish = (): void => context.onStateChange?.(snapshot(model));
  const render = (): void => {
    assertActive();
    root = pibbl(
      context.canvas,
      createElement(ParticleCelebrationLabRoot, { model }),
      { pixelRatio: 1 },
    );
  };
  const mountRoot = (): void => {
    model = createModel();
    model.publish = publish;
    render();
  };
  const requireSystem = () => {
    if (!model.system) {
      throw new Error('The particle celebration system has not rendered yet.');
    }
    return model.system;
  };
  const launch = (
    system: NonNullable<ParticleCelebrationLabModel['system']>,
    requestedPoints?: readonly CelebrationPoint[],
  ): void => {
    const sourcePoints = requestedPoints ?? model.selectedPoints.get();
    const points =
      sourcePoints.length > 0 ? sourcePoints : ([[320, 198]] as const);
    model.lastLaunchPoints = Object.freeze(
      points.map(([x, y]) => Object.freeze([x, y]) as CelebrationPoint),
    );
    model.pendingLaunchPoints = model.lastLaunchPoints.length;
    model.acceptedLaunchPoints = 0;
    model.selectedPoints.set([]);
    for (const [x, y] of model.lastLaunchPoints) {
      emitCelebrationBurst(system, x, y);
    }
  };
  const execute = async (
    action: ParticleCelebrationLabAction,
  ): Promise<void> => {
    const system = requireSystem();
    switch (action) {
      case 'launch':
        launch(system);
        break;
      case 'pause':
        system.pause();
        model.lastAction = 'Animation paused.';
        break;
      case 'resume':
        system.resume();
        model.lastAction = 'Animation resumed.';
        break;
      case 'replay':
        system.restart({ seed: CELEBRATION_SEED });
        launch(system, model.lastLaunchPoints);
        break;
      case 'clear':
        system.stop({ mode: 'clear' });
        model.selectedPoints.set([]);
        model.pendingLaunchPoints = 0;
        model.acceptedLaunchPoints = 0;
        model.lastAction = 'Stage cleared.';
        break;
      case 'toggle-glow': {
        const enabled = !model.glowEnabled.get();
        model.glowEnabled.set(enabled);
        model.lastAction = enabled ? 'Glow turned on.' : 'Glow turned off.';
        break;
      }
    }
    await nextPaint();
    publish();
  };

  mountRoot();
  await nextPaint();
  await nextPaint();
  publish();

  return {
    getState: () => snapshot(model),
    perform: (actionId) => {
      assertActive();
      if (
        !(PARTICLE_CELEBRATION_LAB_ACTION_IDS as readonly string[]).includes(
          actionId,
        )
      ) {
        return Promise.reject(
          new Error(
            `Particle celebration laboratory does not support action "${actionId}".`,
          ),
        );
      }
      const current = actionQueue.then(() =>
        execute(actionId as ParticleCelebrationLabAction),
      );
      actionQueue = current.catch(() => {});
      return current;
    },
    reset: () => {
      assertActive();
      const current = actionQueue.then(async () => {
        root?.dispose();
        root = undefined;
        mountRoot();
        await nextPaint();
        publish();
      });
      actionQueue = current.catch(() => {});
      return current;
    },
    settled: async () => {
      await actionQueue;
      await nextPaint();
      await nextPaint();
      publish();
    },
    dispose: async () => {
      if (disposed) return;
      await actionQueue.catch(() => {});
      root?.dispose();
      root = undefined;
      disposed = true;
    },
  };
}

export const particleCelebrationLabScenario: ScenarioDefinition<ParticleCelebrationLabState> =
  {
    id: 'first-class-particle-celebration',
    sourceId: PARTICLE_CELEBRATION_LAB_SOURCE_ID,
    actionIds: PARTICLE_CELEBRATION_LAB_ACTION_IDS,
    mount: mountParticleCelebrationLab,
    formatState: (state) => [
      { label: 'Animation', value: state.animation },
      { label: 'Launch points', value: `${state.selectedPoints} selected` },
      { label: 'Celebrations', value: String(state.celebrations) },
      { label: 'Last action', value: state.lastAction },
      { label: 'Glow', value: state.glow ? 'on' : 'off' },
    ],
  };
