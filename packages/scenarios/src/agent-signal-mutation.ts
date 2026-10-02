import { crc, createElement, signal } from '@crc/core';
import { AgentSignalMutationScene, AGENT_SIGNAL_MUTATION_SOURCE_ID } from './agent-signal-mutation.example';
import type { ScenarioDefinition } from './types';
export interface AgentSignalMutationState {
  status: 'pending' | 'ready' | 'disposed' | 'error';
  revision: number;
  action: string;
  expectedAmount: number;
  sourceAmount: number;
  evaluatedAmount: number | null;
  componentEvaluations: number;
  signalVersion: number | null;
  equality: { policy: 'Object.is-default'; sameReference: boolean; amountBefore: number; amountAfter: number } | null;
  assertion: 'pass' | 'fail' | 'unavailable';
  diagnosis: string;
  observationWindow: { kind: 'two-host-animation-frames'; completedFrames: number; scope: 'finite-observation-not-future-guarantee' };
}
const fixtureIdentity = null;
export const agentSignalMutationScenario: ScenarioDefinition<AgentSignalMutationState> = {
  id: 'agent-signal-mutation', sourceId: AGENT_SIGNAL_MUTATION_SOURCE_ID,
  actionIds: ['equal-noop', 'in-place', 'replace', 'reset'],
  async mount({ canvas, referenceHost, onStateChange }) {
    if (!canvas.getContext('2d')) throw new Error('Signal mutation fixture requires a Canvas 2D context.');
    const amount = signal({ amount: 10 }); // Deliberately use the actual default equality.
    let disposed = false;
    let inFlight: Promise<void> | null = null;
    let cancelWait: (() => void) | null = null;
    let evaluatedAmount: number | null = null, componentEvaluations = 0;
    const sourceTools = import.meta.env.DEV && import.meta.env.MODE !== 'built' ? await import('../../../tooling/agent-verification/signals') : null;
    const inspector = sourceTools?.createSignalInspector(canvas);
    const signalId = inspector?.register(amount);
    const version = () => {
      const record = inspector?.snapshot().records.find(record => record.id === signalId);
      return record?.status === 'available' ? record.version : null;
    };
    const evidence = document.createElement('pre'); evidence.dataset.testid = 'agent-signal-mutation-evidence'; referenceHost?.append(evidence);
    let state: AgentSignalMutationState = { status: 'pending', revision: 0, action: 'mount', expectedAmount: 10, sourceAmount: 10, evaluatedAmount, componentEvaluations, signalVersion: version(), equality: null, assertion: 'unavailable', diagnosis: 'not-observed', observationWindow: { kind: 'two-host-animation-frames', completedFrames: 0, scope: 'finite-observation-not-future-guarantee' } };
    const publish = () => { evidence.textContent = JSON.stringify({ schema: 'crc-signal-mutation-fixture/1', identity: fixtureIdentity, state }); onStateChange?.(structuredClone(state)); };
    const waitWindow = () => new Promise<void>((resolve, reject) => {
      let frame = 0, count = 0;
      const finish = (error?: Error) => { cancelAnimationFrame(frame); clearTimeout(timeout); cancelWait = null; if (error) reject(error); else resolve(); };
      const timeout = setTimeout(() => finish(new Error('Signal mutation observation exceeded five seconds.')), 5000);
      cancelWait = () => finish(new Error('Signal mutation fixture disposed.'));
      const tick = () => { if (disposed) return finish(new Error('Signal mutation fixture disposed.')); if (++count === 2) finish(); else frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick);
    });
    let controller: ReturnType<typeof crc> | null = null;
    function perform(action: string): Promise<void> {
      if (disposed) return Promise.reject(new Error('Signal mutation fixture disposed.'));
      if (inFlight) return Promise.reject(new Error('Signal mutation action already running.'));
      if (!['equal-noop', 'in-place', 'replace', 'reset'].includes(action)) return Promise.reject(new Error('Unknown signal mutation action.'));
      state = { ...state, status: 'pending', action, revision: state.revision + 1, assertion: 'unavailable', diagnosis: 'pending', observationWindow: { ...state.observationWindow, completedFrames: 0 } };
      const operation = Promise.resolve().then(async () => {
        if (disposed) throw new Error('Signal mutation fixture disposed.');
        publish();
        if (disposed) throw new Error('Signal mutation fixture disposed.');
        const beforeVersion = version();
        const previous = amount.get(), amountBefore = previous.amount;
        const next = action === 'reset' ? { amount: 10 } : action === 'replace' ? { ...previous } : previous;
        if (action === 'in-place') next.amount = 42;
        const equality = { policy: 'Object.is-default' as const, sameReference: Object.is(previous, next), amountBefore, amountAfter: next.amount };
        const expectedAmount = action === 'reset' ? 10 : action === 'in-place' ? 42 : state.expectedAmount;
        amount.set(next);
        await waitWindow();
        if (disposed) throw new Error('Signal mutation fixture disposed.');
        const signalVersion = version();
        const assertion = evaluatedAmount === null ? 'unavailable' : evaluatedAmount === expectedAmount ? 'pass' : 'fail';
        const observedVersion = beforeVersion !== null && signalVersion !== null;
        const diagnosis = !observedVersion ? 'signal-version-unavailable'
          : action === 'in-place' && equality.sameReference && amountBefore !== next.amount && signalVersion === beforeVersion && assertion === 'fail' ? 'same-reference-mutation-suppressed'
          : equality.sameReference && signalVersion === beforeVersion && assertion === 'fail' ? 'equal-write-keeps-stale-display'
          : action === 'equal-noop' && equality.sameReference && assertion === 'pass' && signalVersion === beforeVersion ? 'intentional-equal-write'
          : action === 'replace' && !equality.sameReference && signalVersion! > beforeVersion! && assertion === 'pass' ? 'replacement-published'
          : 'application-observation';
        state = { ...state, status: 'ready', expectedAmount, sourceAmount: amount.get().amount, evaluatedAmount, componentEvaluations, signalVersion, equality, assertion, diagnosis, observationWindow: { ...state.observationWindow, completedFrames: 2 } };
        publish();
      }).catch(error => { if (!disposed) { state = { ...state, status: 'error', assertion: 'unavailable', diagnosis: 'observation-failed' }; evidence.textContent = JSON.stringify({ schema: 'crc-signal-mutation-fixture/1', identity: fixtureIdentity, state }); } throw error; }).finally(() => { inFlight = null; });
      inFlight = operation; return operation;
    }
    async function dispose() { if (disposed) return; disposed = true; cancelWait?.(); controller?.dispose(); inspector?.dispose(); evidence.remove(); state = { ...state, status: 'disposed', assertion: 'unavailable', diagnosis: 'disposed' }; }
    try {
      controller = crc(canvas, createElement(AgentSignalMutationScene, { amount, onRender(value: number) { evaluatedAmount = value; componentEvaluations++; } }), { viewport: { width: 480, height: 180 }, fit: 'contain' });
      await perform('reset');
    } catch (error) { await dispose(); throw error; }
    return { getState: () => structuredClone(state), perform, reset: () => perform('reset'), settled: async () => { if (disposed) throw new Error('Signal mutation fixture disposed.'); await inFlight; }, dispose };
  },
  formatState: state => [
    { label: 'App assertion', value: `${state.assertion}: expected ${state.expectedAmount}, evaluated ${state.evaluatedAmount}` },
    { label: 'Diagnosis', value: state.diagnosis },
    { label: 'Evidence', value: JSON.stringify(state) },
  ],
};
