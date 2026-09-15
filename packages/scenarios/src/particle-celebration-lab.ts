import { crc, createElement, signal } from '@crc/core';
import {
  CELEBRATION_SEED,
  PARTICLE_CELEBRATION_LAB_SOURCE_ID,
  ParticleCelebrationLabRoot,
  emitCelebrationBurst,
  type ParticleCelebrationLabAction,
  type ParticleCelebrationLabModel,
  type ParticleCelebrationLabState,
} from './particle-celebration-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export const PARTICLE_CELEBRATION_LAB_ACTION_IDS = [
  'burst',
  'pause',
  'resume',
  'restart',
  'drain',
  'clear',
  'toggle-filter',
  'remove-owner',
  'reset',
] as const satisfies readonly ParticleCelebrationLabAction[];

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function createModel(): ParticleCelebrationLabModel {
  return {
    filterEnabled: signal(true, {
      debugName: 'particle celebration filter enabled',
    }),
    system: undefined,
    acceptedBursts: 0,
    rejectedParticles: 0,
    lastEvent: 'mount',
    ownerVisible: true,
    staleHandleInert: false,
    publish: undefined,
  };
}

function snapshot(model: ParticleCelebrationLabModel): ParticleCelebrationLabState {
  return {
    status: model.system?.status.get() ?? 'idle',
    execution: model.system?.execution.get() ?? 'unbound',
    acceptedBursts: model.acceptedBursts,
    rejectedParticles: model.rejectedParticles,
    lastEvent: model.lastEvent,
    owner: model.ownerVisible ? 'mounted' : 'removed',
    staleHandleInert: model.staleHandleInert,
  };
}

async function mountParticleCelebrationLab(
  context: ScenarioMountContext<ParticleCelebrationLabState>,
): Promise<ScenarioController<ParticleCelebrationLabState>> {
  let disposed = false;
  let model = createModel();
  let root: ReturnType<typeof crc> | undefined;
  let actionQueue = Promise.resolve();

  const assertActive = (): void => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed particle celebration laboratory.');
    }
  };
  const publish = (): void => context.onStateChange?.(snapshot(model));
  const render = (): void => {
    assertActive();
    root = crc(
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
  const execute = async (action: ParticleCelebrationLabAction): Promise<void> => {
    const system = action === 'reset' ? model.system : requireSystem();
    switch (action) {
      case 'burst':
        if (system) emitCelebrationBurst(system, 320, 180);
        break;
      case 'pause':
        system?.pause();
        break;
      case 'resume':
        system?.resume();
        break;
      case 'restart':
        system?.restart({ seed: CELEBRATION_SEED });
        break;
      case 'drain':
        system?.stop({ mode: 'drain' });
        break;
      case 'clear':
        system?.stop({ mode: 'clear' });
        break;
      case 'toggle-filter':
        model.filterEnabled.update(value => !value);
        break;
      case 'remove-owner': {
        const stale = system;
        const acceptedBefore = model.acceptedBursts;
        const rejectedBefore = model.rejectedParticles;
        model.ownerVisible = false;
        render();
        await nextPaint();
        stale?.play();
        stale?.pause();
        stale?.resume();
        stale?.restart({ seed: CELEBRATION_SEED });
        stale?.emit('impact', { count: 1, position: [320, 180] });
        stale?.stop({ mode: 'clear' });
        model.staleHandleInert =
          stale?.status.get() === 'disposed' &&
          stale.execution.get() === 'unbound' &&
          model.acceptedBursts === acceptedBefore &&
          model.rejectedParticles === rejectedBefore;
        break;
      }
      case 'reset':
        root?.dispose();
        root = undefined;
        mountRoot();
        break;
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
    perform: actionId => {
      assertActive();
      if (!(PARTICLE_CELEBRATION_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
        return Promise.reject(
          new Error(`Particle celebration laboratory does not support action "${actionId}".`),
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
      const current = actionQueue.then(() => execute('reset'));
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

export const particleCelebrationLabScenario: ScenarioDefinition<ParticleCelebrationLabState> = {
  id: 'first-class-particle-celebration',
  sourceId: PARTICLE_CELEBRATION_LAB_SOURCE_ID,
  actionIds: PARTICLE_CELEBRATION_LAB_ACTION_IDS,
  mount: mountParticleCelebrationLab,
  formatState: state => [
    { label: 'System', value: `${state.status} · ${state.execution}` },
    { label: 'Accepted bursts', value: String(state.acceptedBursts) },
    { label: 'Rejected particles', value: String(state.rejectedParticles) },
    { label: 'Last event', value: state.lastEvent },
    { label: 'Owner', value: state.owner },
    { label: 'Stale handle inert', value: state.staleHandleInert ? 'yes' : 'no' },
  ],
};
