import type { createEventTrace } from '../../../tooling/agent-verification/events.js';
import type { createSchedulerHistory } from '../../../tooling/agent-verification/scheduler.js';
import type { probeHostPoint } from '../../../tooling/agent-verification/browser.js';
import type { createSignalInspector } from '../../../tooling/agent-verification/signals.js';
import { crc, createElement, computed, signal, type CRCLogicalMouseEvent, type CRCPointerEvent } from '@crc/core';
import type {
  createTargetingInspector,
  TargetingProbe,
  InteractionPointSearch,
  CoordinateConversion,
  TargetingSnapshot,
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
  | 'capture-sources'
  | 'trace-start'
  | 'trace-stop'
  | 'keyboard-focus'
  | 'dom-overlay'
  | 'remove-dom-overlay'
  | 'capture-drag'
  | 'inspect'
  | 'inspect-outside-layer'
  | 'inspection-off'
  | 'inspection-on'
  | 'intentional-block'
  | 'repair'
  | 'reset'
  | 'seed';

export interface AgentTargetingDeliveryRecord {
  readonly targetId: number | null;
  readonly generation: TargetingSnapshot['generation'];
  readonly input: {
    readonly original: { readonly type: string; readonly isTrusted: boolean };
    readonly source: { readonly type: string; readonly isTrusted: boolean } | null;
    readonly userActivation:
      | { readonly status: 'available'; readonly scope: 'window-at-delivery'; readonly isActive: boolean; readonly hasBeenActive: boolean }
      | { readonly status: 'unavailable'; readonly scope: 'window-at-delivery' };
    readonly permissions: 'not-observed';
  } | null;
}

export interface AgentTargetingState {
  readonly componentChanges: ReturnType<ReturnType<typeof createSignalInspector>['compareComponents']> | null;
  readonly eventTrace: ReturnType<ReturnType<typeof createEventTrace>['snapshot']> | null;
  readonly schedulerHistory: ReturnType<ReturnType<typeof createSchedulerHistory>['snapshot']> | null;
  readonly coordinateMappings: { readonly backing: CoordinateConversion; readonly cssContent: CoordinateConversion } | null;
  readonly signalInspection: ReturnType<ReturnType<typeof createSignalInspector>['snapshot']> | null;
  readonly focusObservationError: string | null;
  readonly browserProbe: ReturnType<typeof probeHostPoint> | null;
  readonly domOverlayClicks: number;
  readonly capturedDelivery: { readonly pointerId: number; readonly targetId: number | null; readonly x: number; readonly y: number } | null;
  readonly pointSearch: InteractionPointSearch | null;
  readonly probePoint: { readonly x: number; readonly y: number } | null;
  readonly mode: AgentTargetingMode;
  readonly expectedSelection: boolean;
  readonly selectedItem: 'item-a' | null;
  readonly selections: number;
  readonly deliveredTo: AgentTargetingDelivery;
  readonly delivery: AgentTargetingDeliveryRecord;
  readonly inspection: TargetingSnapshot | { readonly status: 'unavailable'; readonly generation: null };
  readonly probe: TargetingProbe | { readonly status: 'unavailable'; readonly targetId: null; readonly candidates: readonly [] };
  readonly inspectionEnabled: boolean;
  readonly inspectionAvailability: 'source-runtime' | 'unsupported-build';
  readonly renderCount: number;
  readonly dormantMetricEvaluations: number;
}

export const AGENT_TARGETING_ACTION_IDS: readonly AgentTargetingAction[] = [
  'keyboard-focus',
  'dom-overlay',
  'remove-dom-overlay',
  'capture-drag',
  'inspect',
  'inspect-outside-layer',
  'repair',
  'seed',
  'intentional-block',
  'inspection-off',
  'inspection-on',
  'capture-sources', 'trace-start', 'trace-stop',
  'reset',
];

const TARGET_POINT = { x: 144, y: 112 } as const;

function unavailableState() {
  return {
    componentChanges: null,
    schedulerHistory: null,
    eventTrace: null,
    coordinateMappings: null,
    focusObservationError: null,
    browserProbe: null,
    capturedDelivery: null,
    signalInspection: null,
    pointSearch: null,
    probePoint: null,
    inspection: { status: 'unavailable' as const, generation: null },
    probe: { status: 'unavailable' as const, targetId: null, candidates: [] as const },
  };
}

const fixtureIdentity = null;

export const agentTargetingVerificationScenario: ScenarioDefinition<AgentTargetingState> = {
  id: 'agent-targeting-verification',
  sourceId: AGENT_TARGETING_VERIFICATION_SOURCE_ID,
  actionIds: AGENT_TARGETING_ACTION_IDS,
  async mount(context: ScenarioMountContext<AgentTargetingState>) {
    const inspectorFactory = import.meta.env.DEV && import.meta.env.MODE !== 'built' ?
      (await import('../../../tooling/agent-verification/targeting.js')).createTargetingInspector : undefined;
    const signalInspectorFactory = import.meta.env.DEV && import.meta.env.MODE !== 'built' ?
      (await import('../../../tooling/agent-verification/signals.js')).createSignalInspector : undefined;
    const historyFactory = import.meta.env.DEV && import.meta.env.MODE !== 'built' ?
      (await import('../../../tooling/agent-verification/scheduler.js')).createSchedulerHistory : undefined;
    const eventTraceFactory = import.meta.env.DEV && import.meta.env.MODE !== 'built' ?
      (await import('../../../tooling/agent-verification/events.js')).createEventTrace : undefined;
    let eventTrace: ReturnType<typeof createEventTrace> | undefined;
    let history: ReturnType<typeof createSchedulerHistory> | undefined;
    let signalInspector: ReturnType<typeof createSignalInspector> | undefined;
    let previousSignalSnapshot: ReturnType<ReturnType<typeof createSignalInspector>['snapshot']> | undefined;
    const browserProbe = import.meta.env.DEV && import.meta.env.MODE !== 'built' ?
      (await import('../../../tooling/agent-verification/browser.js')).probeHostPoint : undefined;
    let removeOverlay = () => {};
    let disposed = false;
    let inspector: ReturnType<typeof createTargetingInspector> | undefined;
    const mapCoordinates = (inspection: TargetingSnapshot, point: { readonly x: number; readonly y: number }) => inspection.generation && inspector ? {
      backing: inspector.convert(inspection.generation, 'root-logical', 'backing', point),
      cssContent: inspector.convert(inspection.generation, 'root-logical', 'css-content', point),
    } : null;
    let renderCount = 0;
    let rendered: { mode: AgentTargetingMode; selectedItem: 'item-a' | null; selections: number; deliveredTo: AgentTargetingDelivery } | undefined;
    const evidence = context.referenceHost ? document.createElement('script') : undefined;
    if (evidence) {
      evidence.type = 'application/json';
      evidence.dataset.testid = 'agent-targeting-evidence';
      context.referenceHost!.append(evidence);
    }
    let dormantMetricEvaluations = 0;
    const mode = signal<AgentTargetingMode>('seed');
    const selectedItem = signal<'item-a' | null>(null);
    const selections = signal(0);
    const deliveredTo = signal<AgentTargetingDelivery>(null);
    const selectionLabel = computed(() => mode.get() === 'intentional-block' ? 'intentionally blocked' : selectedItem.get() ?? 'none', { debugName: 'selection label' });
    // This metric is intentionally never read by either rendering or inspection.
    const dormantMetric = createDormantTargetingMetric(selections, () => dormantMetricEvaluations++);
    const labelScene = () => {
      if (!signalInspector) return;
      const snapshot = signalInspector.snapshot();
      const typeId = signalInspector.identifyType(AgentTargetingVerificationScene);
      const root = snapshot.ownership.components.records.find(record => record.typeId === typeId);
      if (root) signalInspector.labelComponent({ session: snapshot.session, componentId: root.componentId, renderGeneration: root.renderGeneration }, 'targeting-scene');
    };
    const enableSignalInspection = () => {
      if (!signalInspectorFactory || signalInspector) return;
      previousSignalSnapshot = undefined;
      signalInspector = signalInspectorFactory(context.canvas);
      for (const value of [mode, selectedItem, selections, deliveredTo, dormantMetric, selectionLabel]) signalInspector.register(value);
    };
    let latest: AgentTargetingState = {
      mode: 'seed',
      domOverlayClicks: 0,
      expectedSelection: true,
      selectedItem: null,
      selections: 0,
      deliveredTo: null,
      delivery: { targetId: null, generation: null, input: null },
      inspectionEnabled: !!inspectorFactory,
      inspectionAvailability: inspectorFactory ? 'source-runtime' : 'unsupported-build',
      renderCount: 0,
      dormantMetricEvaluations: 0,
      ...unavailableState(),
    };

    const copyState = (): AgentTargetingState => structuredClone(latest);
    const publish = () => {
      if (evidence) evidence.textContent = JSON.stringify({ schema: 'crc-targeting-fixture/1', identity: fixtureIdentity, state: latest });
      context.onStateChange?.(copyState());
    };
    const pendingWaits = new Set<() => void>();
    const settled = () => new Promise<void>((resolve, reject) => {
      let frame = 0;
      const finish = (error?: Error) => {
        cancelAnimationFrame(frame); clearTimeout(timeout); pendingWaits.delete(cancel);
        if (error) reject(error); else resolve();
      };
      const cancel = () => finish(new Error('Targeting fixture disposed while awaiting paint.'));
      const timeout = setTimeout(() => finish(new Error('Targeting fixture did not paint the expected state within 5 seconds.')), 5000);
      pendingWaits.add(cancel);
      const poll = () => {
        try {
        if (disposed) return cancel();
        if (rendered && rendered.mode === latest.mode && rendered.selectedItem === latest.selectedItem &&
          rendered.selections === latest.selections && rendered.deliveredTo === latest.deliveredTo &&
          (!inspector || inspector.snapshot().status === 'ready')) {
          latest = { ...latest, renderCount, dormantMetricEvaluations };
          publish(); finish();
        } else frame = requestAnimationFrame(poll);
        } catch (error) { finish(error instanceof Error ? error : new Error('Fixture observation failed', { cause: error })); }
      };
      frame = requestAnimationFrame(poll);
    });
    const updateLatest = (update: Partial<AgentTargetingState>) => {
      latest = { ...latest, ...update, renderCount, dormantMetricEvaluations, schedulerHistory: history?.snapshot() ?? null, eventTrace: eventTrace?.snapshot() ?? null };
      publish();
    };
    const setMode = (nextMode: AgentTargetingMode) => {
      removeOverlay();
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
        delivery: { targetId: null, generation: null, input: null },
        ...unavailableState(),
      });
    };
    const onDelivery = (
      target: Exclude<AgentTargetingDelivery, null>,
      event: CRCLogicalMouseEvent,
    ) => {
      // Capture synchronously. Window activation can come from earlier input and
      // does not certify this event's trust or grant a particular permission.
      const activation = context.canvas.ownerDocument.defaultView?.navigator.userActivation;
      const input: NonNullable<AgentTargetingDeliveryRecord['input']> = {
        original: { type: event.originalEvent.type, isTrusted: event.originalEvent.isTrusted },
        source: event.sourceEvent ? { type: event.sourceEvent.type, isTrusted: event.sourceEvent.isTrusted } : null,
        userActivation: activation ? {
          status: 'available', scope: 'window-at-delivery',
          isActive: activation.isActive, hasBeenActive: activation.hasBeenActive,
        } : { status: 'unavailable', scope: 'window-at-delivery' },
        permissions: 'not-observed',
      };
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
        delivery: { targetId, generation, input },
      });
    };

    let focusObservationPending = false;
    const onFocusEvidence = () => {
      if (disposed || focusObservationPending) return;
      focusObservationPending = true;
      void settled().then(() => {
        if (!disposed && inspector) updateLatest({ inspection: inspector.snapshot() });
      }).catch(error => {
        if (!disposed) updateLatest({ focusObservationError: String(error).slice(0, 500) });
      }).finally(() => { focusObservationPending = false; });
    };
    let crcController: ReturnType<typeof crc> | undefined;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      removeOverlay();
      history?.dispose(); history = undefined;
      eventTrace?.dispose(); eventTrace = undefined;
      inspector?.dispose();
      inspector = undefined;
      signalInspector?.dispose(); signalInspector = undefined; previousSignalSnapshot = undefined;
      for (const cancel of pendingWaits) cancel();
      evidence?.remove();
      crcController?.dispose();
    };
    try {
      crcController = crc(
      context.canvas,
      createElement(AgentTargetingVerificationScene, {
        mode,
        selectionLabel,
        selectedItem,
        selections,
        deliveredTo,
        onDelivery,
        wrapClick: (label, handler) => event => {
          if (!eventTrace) { handler(event); return; }
          try { eventTrace.wrap(label, handler)(event); }
          finally { if (!disposed) updateLatest({}); }
        },
        onFocusEvidence,
        onCapturedMove: (event: CRCPointerEvent) => {
          if (!inspector) return;
          const inspection = inspector.snapshot();
          const probe = inspection.generation ? inspector.probe(inspection.generation, event.x, event.y) : unavailableState().probe;
          updateLatest({ inspection, probe, coordinateMappings: mapCoordinates(inspection, { x: event.x, y: event.y }), probePoint: { x: event.x, y: event.y }, capturedDelivery: {
            pointerId: event.pointerId, targetId: inspector.identifyTarget(event.target), x: event.x, y: event.y,
          } });
        },
        onRender: (state) => {
          rendered = state;
          renderCount++;
        },
      }),
      { pixelRatio: 1 },
    );
    // Bind after CRC has installed this exact mount. The prototype owns no hooks
    // into rendering, signals, scheduling, or native event delivery.
    inspector = inspectorFactory?.(context.canvas);
    enableSignalInspection();
    await settled();
    labelScene();
    updateLatest({});
    } catch (error) {
      dispose();
      throw error;
    }

    const assertActive = () => {
      if (disposed) throw new Error('Cannot operate on a disposed targeting verification scenario.');
    };
    const inspect = (point = TARGET_POINT as { readonly x: number; readonly y: number }) => {
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
        inspector.probe(inspection.generation, point.x, point.y) :
        { status: 'unavailable' as const, targetId: null, candidates: [] as const };
      // This searches for the observed winner, not an inferred semantic action.
      const pointSearch = inspection.generation && probe.targetId !== null ?
        inspector.findInteractionPoint(inspection.generation, probe.targetId, { x: 80, y: 64, width: 128, height: 96 }) : null;
      const bounds = context.canvas.getBoundingClientRect();
      const signalInspection = signalInspector?.snapshot() ?? null;
      const componentChanges = signalInspector && previousSignalSnapshot && signalInspection ?
        signalInspector.compareComponents(previousSignalSnapshot, signalInspection) : null;
      previousSignalSnapshot = signalInspection ?? undefined;
      updateLatest({ inspection, probe, pointSearch, coordinateMappings: mapCoordinates(inspection, point), probePoint: point, signalInspection, componentChanges,
        browserProbe: browserProbe?.(context.canvas, bounds.left + point.x * bounds.width / 480, bounds.top + point.y * bounds.height / 240) ?? null });
    };

    return {
      // This is a plain, bounded application/evidence snapshot. It never reads
      // a signal, computed value, runtime registry, or inspector on demand.
      getState: copyState,
      async perform(actionId) {
        assertActive();
        switch (actionId as AgentTargetingAction) {
          case 'capture-sources': {
            if (!signalInspector) throw new Error('Source capture requires enabled source-runtime inspection.');
            const snapshot = signalInspector.snapshot();
            for (const record of snapshot.ownership.components.records) {
              signalInspector.captureComponentSource({ session: snapshot.session, componentId: record.componentId, renderGeneration: record.renderGeneration });
            }
            updateLatest({ signalInspection: signalInspector.snapshot() }); break;
          }
          case 'trace-start': {
            if (!historyFactory || !eventTraceFactory) throw new Error('Recording requires the source runtime.');
            history?.dispose(); history = undefined; history = historyFactory(128); eventTrace?.dispose(); eventTrace = eventTraceFactory({ capacity: 32 }); updateLatest({}); break;
          }
          case 'trace-stop': history?.stop(); eventTrace?.stop(); updateLatest({}); break;
          case 'keyboard-focus': setMode('keyboard-focus'); await settled(); break;
          case 'dom-overlay': {
            setMode('repair'); await settled();
            const parent = context.canvas.parentElement!;
            const position = parent.style.position;
            const ownedPosition = getComputedStyle(parent).position === 'static';
            if (ownedPosition) parent.style.position = 'relative';
            const overlay = document.createElement('div');
            overlay.style.cssText = `position:absolute;z-index:10;left:${context.canvas.offsetLeft + context.canvas.clientWidth / 6}px;top:${context.canvas.offsetTop + context.canvas.clientHeight * 64 / 240}px;width:${context.canvas.clientWidth * 128 / 480}px;height:${context.canvas.clientHeight * 96 / 240}px;background:rgba(255,170,0,.2)`;
            overlay.dataset.testid = 'agent-dom-overlay';
            overlay.onclick = event => updateLatest({ domOverlayClicks: latest.domOverlayClicks + 1,
              browserProbe: browserProbe?.(context.canvas, event.clientX, event.clientY) ?? null });
            parent.append(overlay);
            removeOverlay = () => {
              overlay.remove();
              if (ownedPosition && parent.style.position === 'relative') parent.style.position = position;
              removeOverlay = () => {};
            };
            updateLatest({ domOverlayClicks: 0 });
            break;
          }
          case 'remove-dom-overlay': removeOverlay(); break;
          case 'capture-drag': setMode('capture-drag'); await settled(); break;
          case 'inspect': inspect(); break;
          case 'inspect-outside-layer': inspect({ x: 300, y: 112 }); break;
          case 'repair': setMode('repair'); await settled(); break;
          case 'seed': setMode('seed'); await settled(); break;
          case 'intentional-block': setMode('intentional-block'); await settled(); break;
          case 'inspection-off': signalInspector?.dispose(); signalInspector = undefined; previousSignalSnapshot = undefined; inspector?.dispose(); inspector = undefined; updateLatest({ inspectionEnabled: false, ...unavailableState() }); break;
          case 'inspection-on': enableSignalInspection(); labelScene(); inspector ??= inspectorFactory?.(context.canvas); updateLatest({ inspectionEnabled: !!inspector }); break;
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
      async dispose() { dispose();
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
      state.probe.candidates.map((candidate) => `${candidate.targetId}:${candidate.outcome}${candidate.exclusion ? ` (${candidate.exclusion.kind} at record ${candidate.exclusion.entryOrder}${candidate.exclusion.stackIndex === null ? '' : `, clip ${candidate.exclusion.stackIndex}`})` : ''}`).join(', ') || 'no candidates' :
      'unavailable';
    const requirement = !state.expectedSelection ?
      state.deliveredTo === null ? 'not tested (intentional block)' :
      state.selectedItem === null && state.selections === 0 && state.deliveredTo === 'decoration' ? 'pass: intentional block preserved' : 'fail: intentional block selected an item' :
      state.deliveredTo === null ? 'not tested' :
      state.selectedItem === 'item-a' && state.deliveredTo === 'action' ? 'pass: item-a selected' :
      `fail: expected item-a, observed ${state.deliveredTo ?? 'no target'}`;
    return [
      { label: 'Mode', value: state.mode },
      { label: 'Browser point', value: state.browserProbe ? JSON.stringify(state.browserProbe) : 'not captured' },
      { label: 'DOM overlay clicks', value: String(state.domOverlayClicks) },
      { label: 'Focus observation', value: snapshotAvailable ? JSON.stringify(state.inspection.focus) : 'unavailable' },
      { label: 'Captured move', value: state.capturedDelivery ? JSON.stringify(state.capturedDelivery) : 'not captured' },
      { label: 'Logical capture owners', value: snapshotAvailable ? JSON.stringify(state.inspection.pointerCapture) : 'unavailable' },
      { label: 'Signal observation', value: state.signalInspection ? state.signalInspection.records.map(record => record.status === 'available' ? `${record.id}: ${record.kind} ${record.cache}/${record.validation} ${JSON.stringify(record.preview)} deps:${record.dependencies.edges.map(edge => edge.sourceId ?? '?').join(',') || 'none'} (${record.dependencies.completeness})` : `${record.id}: released`).join(' · ') : 'not captured' },
      { label: 'Probe point', value: state.probePoint ? `${state.probePoint.x}, ${state.probePoint.y} (root logical)` : 'not captured' },
      { label: 'Inspection capability', value: state.inspectionAvailability },
      { label: 'Independent requirement', value: requirement },
      { label: 'Delivered to', value: `${state.deliveredTo ?? 'none'} · target ${state.delivery.targetId ?? 'unavailable'}` },
      { label: 'Selected item', value: state.selectedItem ?? 'none' },
      { label: 'Selection count', value: String(state.selections) },
      { label: 'Delivery generation', value: state.delivery.generation ? `${state.delivery.generation.session}/${state.delivery.generation.render}/${state.delivery.generation.requested}/${state.delivery.generation.completed}` : 'unavailable' },
      {
        label: 'Inspection snapshot',
        value: `${state.inspection.status} · generation ${generation ? `${generation.session}/${generation.render}/${generation.requested}/${generation.completed}` : 'unavailable'} · ${snapshotAvailable ? `${state.inspection.records.length} records` : 'records unavailable'} · ${!snapshotAvailable ? 'realm work unavailable' : pendingRealmWork ? 'pending realm work' : 'no pending realm work'}`,
      },
      {
        label: 'Probe',
        value: `${state.probe.status} · winner ${winner} · ${candidates} · ${!('pendingRealmWork' in state.probe) ? 'realm work unavailable' : state.probe.pendingRealmWork ? 'pending realm work' : 'no pending realm work'}`,
      },
    ];
  },
};
