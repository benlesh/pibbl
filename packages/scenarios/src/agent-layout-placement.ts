import { crc, createElement, signal } from '@crc/core';
import { AgentLayoutPlacementScene, AGENT_LAYOUT_PLACEMENT_SOURCE_ID, type LayoutPlacementMode } from './agent-layout-placement.example';
import type { TargetingProbe, TargetingGeneration } from '../../../tooling/agent-verification/targeting';
import type { analyzeBoxRelations } from '../../../tooling/agent-verification/layout-box-relations.mjs';
import type { ScenarioDefinition } from './types';
type Box = Readonly<{ x: number; y: number; width: number; height: number }>;
export interface AgentLayoutPlacementState {
  status: 'pending' | 'ready' | 'error' | 'disposed';
  mode: LayoutPlacementMode;
  revision: number;
  clicks: number;
  lastActivated: 'primary' | 'peer' | null;
  relations: ReturnType<typeof analyzeBoxRelations> | null;
  assertion: 'pass' | 'fail' | 'unavailable';
  diagnosis: string;
  declared: { provenance: 'controlled-application-inputs'; parentPlacement: { left: number; top: number }; shapeLocal: Box; overflow: 'clip' | 'visible' };
  allocation: Box | null;
  observed: { generation: TargetingGeneration; transform: readonly number[]; center: { x: number; y: number }; probe: TargetingProbe } | null;
  explanation: string;
}
export const agentLayoutPlacementScenario: ScenarioDefinition<AgentLayoutPlacementState> = {
  id: 'agent-layout-placement', sourceId: AGENT_LAYOUT_PLACEMENT_SOURCE_ID,
  actionIds: ['clipped', 'overflow-visible', 'repaired', 'overlap-allowed', 'overlap-prohibited'],
  async mount({ canvas, referenceHost, onStateChange }) {
    if (!canvas.getContext('2d')) throw new Error('Layout fixture requires Canvas 2D.');
    const source = import.meta.env.DEV && import.meta.env.MODE !== 'built' ? await import('../../../tooling/agent-verification/targeting') : null;
    const relationTools = source ? await import('../../../tooling/agent-verification/layout-box-relations.mjs') : null;
    const mode = signal<LayoutPlacementMode>('clipped');
    let allocation: Box | null = null, disposed = false;
    let controller: ReturnType<typeof crc> | undefined;
    let inspector: ReturnType<NonNullable<typeof source>['createTargetingInspector']> | undefined;
    let inFlight: Promise<void> | null = null, cancelWait: (() => void) | null = null;
    const evidence = document.createElement('pre'); evidence.dataset.testid = 'agent-layout-placement-evidence'; referenceHost?.append(evidence);
    const declaration = (value: LayoutPlacementMode): AgentLayoutPlacementState['declared'] => ({ provenance: 'controlled-application-inputs', parentPlacement: { left: 30, top: 20 }, shapeLocal: { x: value === 'clipped' || value === 'overflow-visible' ? 90 : 0, y: 0, width: 20, height: 20 }, overflow: value === 'overflow-visible' ? 'visible' : 'clip' });
    let state: AgentLayoutPlacementState = { status: 'pending', mode: 'clipped', revision: 0, clicks: 0, lastActivated: null, relations: null, assertion: 'unavailable', diagnosis: 'pending', declared: declaration('clipped'), allocation: null, observed: null, explanation: '' };
    const publish = () => { evidence.textContent = JSON.stringify({ schema: 'crc-layout-placement-fixture/1', provenance: 'source-development-fixture-no-build-attestation', state }); onStateChange?.(structuredClone(state)); };
    function Scene() { return createElement(AgentLayoutPlacementScene, { mode: mode.get(), onAllocation(box: Box) { allocation = box; }, onActivate(id: 'primary' | 'peer') { if (!disposed) { state = { ...state, clicks: state.clicks + 1, lastActivated: id }; publish(); } } }); }
    const wait = () => new Promise<void>((resolve, reject) => {
      let frame = 0, count = 0;
      const finish = (error?: Error) => { cancelAnimationFrame(frame); clearTimeout(timeout); cancelWait = null; if (error) reject(error); else resolve(); };
      const timeout = setTimeout(() => finish(new Error('Layout observation timed out.')), 5000);
      cancelWait = () => finish(new Error('Layout fixture disposed.'));
      const tick = () => { if (++count === 2) finish(); else frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick);
    });
    function perform(action: string): Promise<void> {
      if (disposed) return Promise.reject(new Error('Layout fixture disposed.'));
      if (inFlight) return Promise.reject(new Error('Layout action already running.'));
      if (action !== 'clipped' && action !== 'overflow-visible' && action !== 'repaired' && action !== 'overlap-allowed' && action !== 'overlap-prohibited') return Promise.reject(new Error('Unknown layout action.'));
      state = { ...state, status: 'pending', mode: action, revision: state.revision + 1, declared: declaration(action), assertion: 'unavailable', observed: null, allocation: null, relations: null, diagnosis: 'pending' };
      const operation = Promise.resolve().then(async () => {
        if (disposed) throw new Error('Layout fixture disposed.');
        publish(); if (disposed) throw new Error('Layout fixture disposed.');
        mode.set(action); await wait();
        if (disposed) throw new Error('Layout fixture disposed.');
        const snapshot = inspector?.snapshot();
        const overlapMode = action === 'overlap-allowed' || action === 'overlap-prohibited';
        const entry = snapshot?.records.length === (overlapMode ? 2 : 1) ? snapshot.records[0] : null;
        const localCenter = { x: state.declared.shapeLocal.x + 10, y: 10 };
        const converted = snapshot?.status === 'ready' && snapshot.generation && entry ? inspector!.convert(snapshot.generation, 'entry-local', 'root-logical', localCenter, 'point', entry.order) : null;
        const observed = snapshot?.generation && entry && converted?.status === 'mapped' && converted.value ? { generation: snapshot.generation, transform: entry.transform, center: converted.value, probe: inspector!.probe(snapshot.generation, converted.value.x, converted.value.y) } : null;
        const candidate = observed?.probe.candidates[0];
        const clipped = candidate?.geometry === 'hit' && candidate.outcome === 'clip-excluded';
        const target = observed?.probe.status === 'target';
        const relations = allocation && relationTools ? relationTools.analyzeBoxRelations({ coordinateSpace: 'placed-child-local', allocation, drawing: state.declared.shapeLocal, peer: overlapMode ? { x: 10, y: 0, width: 20, height: 20 } : undefined, expectations: { ...(action === 'clipped' || action === 'repaired' ? { containment: 'required' as const } : {}), ...(action === 'overlap-prohibited' ? { separation: 'required' as const } : {}) } }) : null;
        const relationFailure = relations?.status === 'available' && (relations.assertions.containment === 'fail' || relations.assertions.separation === 'fail');
        const diagnosis = !observed ? 'inspection-unavailable' : overlapMode && relations?.status === 'available' && relations.overlap?.relation === 'overlap' ? action === 'overlap-prohibited' ? 'overlap-violates-separation' : 'overlap-explicitly-allowed' : clipped ? 'local-offset-outside-parent-clip' : target && action === 'overflow-visible' ? 'overflow-explicitly-allowed' : target && action === 'repaired' ? 'local-offset-repaired' : 'unexpected-geometry';
        state = { ...state, status: 'ready', allocation, observed, relations, assertion: !observed || !relations || relations.status !== 'available' ? 'unavailable' : target && !relationFailure ? 'pass' : 'fail', diagnosis,
          explanation: 'The app expects the shape center to be targetable. Parent left=30/top=20 places a local 20x20 allocation; Rectangle x is an additional local drawing offset. Translation (40,30) and scale 2 map these coordinates into root space. Allocation is not a paint bound. Declared overflow controls clipping; geometry probes do not prove pixel visibility. Box relations describe declared rectangles in one common local space. Overlap becomes an error only when separation is explicitly required.' };
        publish();
      }).catch(error => { if (!disposed) { state = { ...state, status: 'error', assertion: 'unavailable', observed: null, allocation: null, relations: null, diagnosis: 'observation-failed' }; evidence.textContent = JSON.stringify({ schema: 'crc-layout-placement-fixture/1', state }); } throw error; }).finally(() => { inFlight = null; });
      inFlight = operation; return operation;
    }
    async function dispose() { if (disposed) return; disposed = true; cancelWait?.(); inspector?.dispose(); controller?.dispose(); evidence.remove(); state = { ...state, status: 'disposed', assertion: 'unavailable', observed: null, allocation: null, relations: null, diagnosis: 'disposed' }; }
    try { controller = crc(canvas, createElement(Scene, {}), { viewport: { width: 400, height: 240 }, fit: 'contain' }); inspector = source?.createTargetingInspector(canvas); await perform('clipped'); }
    catch (error) { await dispose(); throw error; }
    return { getState: () => structuredClone(state), perform, reset: () => perform('clipped'), settled: async () => { if (disposed) throw new Error('Layout fixture disposed.'); await inFlight; }, dispose };
  },
  formatState: state => [{ label: 'Diagnosis', value: `${state.assertion}: ${state.diagnosis}` }, { label: 'Placement explanation', value: state.explanation }, { label: 'Evidence', value: JSON.stringify(state) }],
};
