import type {
  InteractionLabAction,
  InteractionLabFixture,
  InteractionLabRecord,
  InteractionLabState,
} from './interaction-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { pibbl } from '@pibbl/core';
import { EventTraceRecorder } from './event-trace';
import type { EventTraceInput, TraceEventType } from './event-trace';
import {
  createInteractionLabScene,
  INTERACTION_LAB_SOURCE_ID,
} from './interaction-lab.example';

export type {
  InteractionLabAction,
  InteractionLabFixture,
  InteractionLabState,
} from './interaction-lab.example';

const FIXTURES: readonly InteractionLabFixture[] = [
  'propagation',
  'pointer-capture',
  'touch-retention',
  'wheel-cancellation',
  'keyboard-fields',
  'composition',
  'clipboard',
  'drag-drop',
  'regions',
  'overlap',
  'nested',
  'fill',
  'stroke',
  'fill-stroke',
  'transparent',
  'interaction-width',
  'no-hit',
  'remove-target-after-transition',
];

/**
 * Stable action identifiers accepted by the interaction lab scenario.
 *
 * @see {@link InteractionLabAction}
 */
export const INTERACTION_LAB_ACTION_IDS: readonly Exclude<
  InteractionLabAction,
  'mount' | 'reset'
>[] = [
  ...FIXTURES.map(fixture => `show-${fixture}` as const),
  'reorder-overlap',
  'remove-top',
  'replace-handler',
  'remove-handler',
  'clear-trace',
];

function initialState(lastAction: InteractionLabAction = 'mount'): InteractionLabState {
  return {
    fixture: 'regions',
    handlerGeneration: 1,
    lastAction,
    lastHandlerGeneration: null,
    leftHandlerEnabled: true,
    rightVisible: true,
    topPaintedLast: true,
    topVisible: true,
    trace: [],
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function mountNativeReference(
  host: HTMLElement,
  record: (input: EventTraceInput) => void,
): () => void {
  const title = document.createElement('p');
  title.textContent = 'Native DOM reference · same basic region geometry';
  title.style.cssText = 'font:700 13px/1.4 Arial,sans-serif; margin:0 0 10px; color:#334155';
  const stage = document.createElement('div');
  stage.dataset.region = 'outside';
  stage.dataset.testid = 'native-reference-stage';
  stage.style.cssText = 'box-sizing:border-box; position:relative; width:480px; height:240px; background:#f8fafc; border:1px solid #cbd5e1';
  const makeRegion = (region: 'left' | 'right', cssText: string, label: string) => {
    const element = document.createElement('div');
    element.dataset.region = region;
    element.style.cssText = `${cssText}; box-sizing:border-box; position:absolute; color:#fff; font:700 15px/1.4 Arial,sans-serif; padding:22px`;
    element.textContent = label;
    return element;
  };
  stage.append(
    makeRegion('left', 'left:28px; top:54px; width:184px; height:108px; background:#2563eb', 'native left'),
    makeRegion('right', 'left:268px; top:54px; width:184px; height:108px; background:#7c3aed', 'native right'),
  );
  host.replaceChildren(title, stage);

  const eventTypes = [
    'click',
    'contextmenu',
    'dblclick',
    'mousedown',
    'mousemove',
    'mouseout',
    'mouseover',
    'mouseup',
  ] as const;
  const listeners = eventTypes.map((type) => {
    const listener = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const region = target.dataset.region;
      if (region !== 'left' && region !== 'right') {
        return;
      }
      const bounds = stage.getBoundingClientRect();
      record({
        source: 'native',
        type: type as TraceEventType,
        target: region,
        x: Math.round(event.clientX - bounds.left),
        y: Math.round(event.clientY - bounds.top),
        event,
        relatedTarget: (event.relatedTarget as HTMLElement | null)?.dataset.region ?? null,
      });
    };
    stage.addEventListener(type, listener, true);
    return [type, listener] as const;
  });

  return () => {
    for (const [type, listener] of listeners) {
      stage.removeEventListener(type, listener, true);
    }
    host.replaceChildren();
  };
}

function fixtureFromAction(actionId: string): InteractionLabFixture | undefined {
  if (!actionId.startsWith('show-')) {
    return undefined;
  }
  const fixture = actionId.slice(5) as InteractionLabFixture;
  return FIXTURES.includes(fixture) ? fixture : undefined;
}

async function mountInteractionLab(
  context: ScenarioMountContext<InteractionLabState>,
): Promise<ScenarioController<InteractionLabState>> {
  const abortController = new AbortController();
  let disposed = false;
  let state = initialState();
  let pendingRender = Promise.resolve();
  let applyDispatchMutation: ((input: EventTraceInput) => void) | undefined;
  const recorder = new EventTraceRecorder();

  const publishTrace = (handlerGeneration: number | null = null) => {
    state = {
      ...state,
      lastHandlerGeneration: handlerGeneration ?? state.lastHandlerGeneration,
      trace: recorder.getEntries(),
    };
    context.onStateChange?.({ ...state });
  };
  const record: InteractionLabRecord = (input, handlerGeneration) => {
    recorder.record(input);
    publishTrace(handlerGeneration ?? null);
    applyDispatchMutation?.(input);
  };
  const disposeNativeReference = context.referenceHost ?
    mountNativeReference(context.referenceHost, input => record(input)) :
    () => undefined;

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed interaction lab.');
    }
  };

  const render = () => {
    assertActive();
    pibbl(context.canvas, createInteractionLabScene({ state, record }), {
      signal: abortController.signal,
    });
    context.onStateChange?.({ ...state });
    pendingRender = nextFrame();
    return pendingRender;
  };

  applyDispatchMutation = (input) => {
    if (
      state.fixture === 'remove-target-after-transition' &&
      state.rightVisible &&
      input.type === 'mouseout' &&
      input.target === 'left'
    ) {
      state = { ...state, rightVisible: false };
      void render();
      return;
    }
  };

  const transition = async (
    lastAction: InteractionLabAction,
    changes: Partial<InteractionLabState>,
    clearTrace = false,
  ) => {
    if (clearTrace) {
      recorder.reset();
    }
    state = {
      ...state,
      ...changes,
      lastAction,
      lastHandlerGeneration: clearTrace ? null : state.lastHandlerGeneration,
      trace: recorder.getEntries(),
    };
    await render();
  };

  await render();

  return {
    getState: () => ({ ...state, trace: [...state.trace] }),
    perform: async (actionId) => {
      assertActive();
      const fixture = fixtureFromAction(actionId);
      if (fixture) {
        await transition(actionId as InteractionLabAction, {
          fixture,
          leftHandlerEnabled: true,
          rightVisible: true,
          topPaintedLast: true,
          topVisible: true,
        }, true);
        return;
      }

      switch (actionId as InteractionLabAction) {
        case 'reorder-overlap':
          await transition('reorder-overlap', {
            topPaintedLast: !state.topPaintedLast,
          });
          break;
        case 'remove-top':
          await transition('remove-top', { topVisible: false });
          break;
        case 'replace-handler':
          await transition('replace-handler', {
            handlerGeneration: state.handlerGeneration + 1,
            leftHandlerEnabled: true,
          });
          break;
        case 'remove-handler':
          await transition('remove-handler', { leftHandlerEnabled: false });
          break;
        case 'clear-trace':
          recorder.reset();
          state = {
            ...state,
            lastAction: 'clear-trace',
            lastHandlerGeneration: null,
            trace: [],
          };
          context.onStateChange?.({ ...state });
          break;
        default:
          throw new Error(`Interaction lab does not support action "${actionId}".`);
      }
    },
    reset: async () => {
      assertActive();
      recorder.reset();
      state = initialState('reset');
      await render();
    },
    settled: async () => {
      await pendingRender;
    },
    dispose: async () => {
      if (disposed) {
        return;
      }
      await pendingRender;
      disposed = true;
      disposeNativeReference();
      abortController.abort();
    },
  };
}

function formatTrace(state: Readonly<InteractionLabState>): string {
  if (!state.trace.length) {
    return 'none';
  }
  return state.trace.map(entry => {
    const identity = [
      `target=${entry.target}`,
      `current=${entry.currentTarget}`,
      `related=${entry.relatedTarget ?? 'none'}`,
    ].join(';');
    const phase = entry.phase ? `;phase=${entry.phase}` : '';
    const canceled = entry.canceled ? ';canceled' : '';
    const fields = Object.entries(entry.fields)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(',');
    return `${entry.type}(${identity}${phase}${canceled}${fields ? `;${fields}` : ''})`;
  }).join(' → ');
}

/**
 * Runnable interaction lab scenario with observable state and deterministic actions.
 *
 * @see {@link ScenarioDefinition}
 * @see {@link InteractionLabState}
 */
export const interactionLabScenario: ScenarioDefinition<InteractionLabState> = {
  id: 'interaction-trace-lab',
  sourceId: INTERACTION_LAB_SOURCE_ID,
  actionIds: INTERACTION_LAB_ACTION_IDS,
  mount: mountInteractionLab,
  formatState: state => [
    { label: 'Fixture', value: state.fixture },
    { label: 'Actual trace', value: formatTrace(state) },
    { label: 'Last target', value: state.trace.at(-1)?.target ?? 'none' },
    { label: 'Handler', value: String(state.handlerGeneration) },
    { label: 'Last handler call', value: String(state.lastHandlerGeneration ?? 'none') },
    { label: 'Overlap order', value: state.topPaintedLast ? 'top above lower' : 'lower above top' },
    { label: 'Top region', value: state.topVisible ? 'mounted' : 'removed' },
    { label: 'Last action', value: state.lastAction },
  ],
};
