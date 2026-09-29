import { crc, createElement, signal, type CRCLogicalMouseEvent } from '@crc/core';
import {
  createTargetingInspector,
  type TargetingProbe,
  type TargetingSnapshot,
} from '../../../tooling/agent-verification/targeting.js';
import {
  AgentTargetingVerificationScene,
  createDormantTargetingMetric,
  type AgentTargetingDelivery,
  type AgentTargetingMode,
  AGENT_TARGETING_VERIFICATION_SOURCE_ID,
} from './agent-targeting-verification.example.js';
import type {
  ScenarioDefinition,
  ScenarioMountContext,
} from './types.js';

export type AgentTargetingAction =
  | 'inspect'
  | 'inspection-off'
  | 'inspection-on'
  | 'intentional-block'
  | 'repair'
  | 'reset'
  | 'seed';

export interface AgentTargetingDeliveryRecord {
  readonly targetId: number | null;
  readonly generation: TargetingSnapshot['generation'];
}

export interface AgentTargetingState {
  readonly mode: AgentTargetingMode;
  readonly expectedSelection: boolean;
  readonly selectedItem: 'item-a' | null;
  readonly selections: number;
  readonly deliveredTo: AgentTargetingDelivery;
  readonly delivery: AgentTargetingDeliveryRecord;
  readonly inspection: TargetingSnapshot | { readonly status: 'unavailable'; readonly generation: null };
  readonly probe: TargetingProbe | { readonly status: 'unavailable'; readonly targetId: null; readonly candidates: readonly [] };
  readonly inspectionEnabled: boolean;
  readonly renderCount: number;
  readonly dormantMetricEvaluations: number;
}

export const AGENT_TARGETING_ACTION_IDS: readonly AgentTargetingAction[] = [
  'inspect',
  'repair',
  'seed',
  'intentional-block',
  'inspection-off',
  'inspection-on',
  'reset',
];

const TARGET_POINT = { x: 144, y: 112 } as const;

function unavailableState() {
  return {
    inspection: { status: 'unavailable' as const, generation: null },
    probe: { status: 'unavailable' as const, targetId: null, candidates: [] as const },
  };
}

function settled(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export const agentTargetingVerificationScenario: ScenarioDefinition<AgentTargetingState> = {
  id: 'agent-targeting-verification',
  sourceId: AGENT_TARGETING_VERIFICATION_SOURCE_ID,
  actionIds: AGENT_TARGETING_ACTION_IDS,
  async mount(context: ScenarioMountContext<AgentTargetingState>) {
    let disposed = false;
    let inspector: ReturnType<typeof createTargetingInspector> | undefined;
    let renderCount = 0;
    let dormantMetricEvaluations = 0;
    const mode = signal<AgentTargetingMode>('seed');
    const selectedItem = signal<'item-a' | null>(null);
    const selections = signal(0);
    const deliveredTo = signal<AgentTargetingDelivery>(null);
    // This metric is intentionally never read by either rendering or inspection.
    createDormantTargetingMetric(selections, () => dormantMetricEvaluations++);
    let latest: AgentTargetingState = {
      mode: 'seed',
      expectedSelection: true,
      selectedItem: null,
      selections: 0,
      deliveredTo: null,
      delivery: { targetId: null, generation: null },
      inspectionEnabled: true,
      renderCount: 0,
      dormantMetricEvaluations: 0,
      ...unavailableState(),
    };

    const copyState = (): AgentTargetingState => structuredClone(latest);
    const publish = () => context.onStateChange?.(copyState());
    const updateLatest = (update: Partial<AgentTargetingState>) => {
      latest = { ...latest, ...update, renderCount, dormantMetricEvaluations };
      publish();
    };
    const setMode = (nextMode: AgentTargetingMode) => {
      mode.set(nextMode);
      selectedItem.set(null);
      selections.set(0);
      deliveredTo.set(null);
      updateLatest({
        mode: nextMode,
        expectedSelection: nextMode !== 'intentional-block',
        selectedItem: null,
        selections: 0,
        deliveredTo: null,
        delivery: { targetId: null, generation: null },
        ...unavailableState(),
      });
    };
    const onDelivery = (
      target: Exclude<AgentTargetingDelivery, null>,
      event: CRCLogicalMouseEvent,
    ) => {
      const targetId = latest.inspectionEnabled && inspector ?
        inspector.identifyTarget(event.target) : null;
      const generation = latest.inspectionEnabled && inspector ?
        inspector.snapshot().generation : null;
      if (target === 'action') {
        selectedItem.set('item-a');
        selections.set(latest.selections + 1);
      }
      deliveredTo.set(target);
      updateLatest({
        selectedItem: target === 'action' ? 'item-a' : null,
        selections: target === 'action' ? latest.selections + 1 : latest.selections,
        deliveredTo: target,
        delivery: { targetId, generation },
      });
    };

    const crcController = crc(
      context.canvas,
      createElement(AgentTargetingVerificationScene, {
        mode,
        selectedItem,
        selections,
        deliveredTo,
        onDelivery,
        onRender: () => {
          renderCount++;
        },
      }),
      { pixelRatio: 1 },
    );
    // Bind after CRC has installed this exact mount. The prototype owns no hooks
    // into rendering, signals, scheduling, or native event delivery.
    inspector = createTargetingInspector(context.canvas);
    await settled();
    updateLatest({});

    const assertActive = () => {
      if (disposed) throw new Error('Cannot operate on a disposed targeting verification scenario.');
    };
    const inspect = () => {
      if (!latest.inspectionEnabled) {
        updateLatest(unavailableState());
        return;
      }
      if (!inspector) {
        updateLatest(unavailableState());
        return;
      }
      const inspection = inspector.snapshot();
      const probe = inspection.generation ?
        inspector.probe(inspection.generation, TARGET_POINT.x, TARGET_POINT.y) :
        { status: 'unavailable' as const, targetId: null, candidates: [] as const };
      updateLatest({ inspection, probe });
    };

    return {
      // This is a plain, bounded application/evidence snapshot. It never reads
      // a signal, computed value, runtime registry, or inspector on demand.
      getState: copyState,
      async perform(actionId) {
        assertActive();
        switch (actionId as AgentTargetingAction) {
          case 'inspect': inspect(); break;
          case 'repair': setMode('repair'); await settled(); break;
          case 'seed': setMode('seed'); await settled(); break;
          case 'intentional-block': setMode('intentional-block'); await settled(); break;
          case 'inspection-off': updateLatest({ inspectionEnabled: false, ...unavailableState() }); break;
          case 'inspection-on': updateLatest({ inspectionEnabled: true }); break;
          case 'reset': setMode('seed'); await settled(); break;
          default: throw new Error(`Unknown targeting verification action "${actionId}".`);
        }
      },
      async reset() {
        assertActive();
        setMode('seed');
        await settled();
      },
      async settled() {
        assertActive();
        await settled();
        updateLatest({});
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        inspector?.dispose();
        inspector = undefined;
        crcController.dispose();
      },
    };
  },
  formatState: (state) => {
    const generation = state.inspection.generation;
    const snapshotAvailable = 'records' in state.inspection;
    const pendingRealmWork = snapshotAvailable && state.inspection.pendingRealmWork;
    const winner = state.probe.status === 'target' ?
      String(state.probe.targetId) :
      state.probe.status === 'miss' ? 'none (verified)' : 'unavailable';
    const candidates = state.probe.status === 'target' || state.probe.status === 'miss' ?
      state.probe.candidates.map((candidate) => `${candidate.targetId}:${candidate.outcome}`).join(', ') || 'no candidates' :
      'unavailable';
    const requirement = !state.expectedSelection ?
      state.deliveredTo === null ? 'not tested (intentional block)' :
      state.selectedItem === null && state.selections === 0 && state.deliveredTo === 'decoration' ? 'pass: intentional block preserved' : 'fail: intentional block selected an item' :
      state.deliveredTo === null ? 'not tested' :
      state.selectedItem === 'item-a' && state.deliveredTo === 'action' ? 'pass: item-a selected' :
      `fail: expected item-a, observed ${state.deliveredTo ?? 'no target'}`;
    return [
      { label: 'Mode', value: state.mode },
      { label: 'Independent requirement', value: requirement },
      { label: 'Delivered to', value: `${state.deliveredTo ?? 'none'} · target ${state.delivery.targetId ?? 'unavailable'}` },
      { label: 'Selected item', value: state.selectedItem ?? 'none' },
      { label: 'Selection count', value: String(state.selections) },
      { label: 'Delivery generation', value: state.delivery.generation ? `${state.delivery.generation.session}/${state.delivery.generation.render}/${state.delivery.generation.requested}/${state.delivery.generation.completed}` : 'unavailable' },
      {
        label: 'Inspection snapshot',
        value: `${state.inspection.status} · generation ${generation ? `${generation.session}/${generation.render}/${generation.requested}/${generation.completed}` : 'unavailable'} · ${snapshotAvailable ? `${state.inspection.records.length} records` : 'records unavailable'} · ${pendingRealmWork ? 'pending realm work' : 'no pending realm work'}`,
      },
      {
        label: 'Probe',
        value: `${state.probe.status} · winner ${winner} · ${candidates} · ${'pendingRealmWork' in state.probe && state.probe.pendingRealmWork ? 'pending realm work' : 'no pending realm work'}`,
      },
    ];
  },
};
