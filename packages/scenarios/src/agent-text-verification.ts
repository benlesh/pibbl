import { crc, createElement } from '@crc/core';
import type { createTextRecorder } from '../../../tooling/agent-verification/text';
import { AgentTextScene, AGENT_TEXT_SOURCE_ID } from './agent-text-verification.example';
import type { ScenarioDefinition } from './types';
type Observation = ReturnType<ReturnType<typeof createTextRecorder>['snapshot']>;
export interface AgentTextState {
  mode: 'seed' | 'repair';
  status: 'pending' | 'ready' | 'error' | 'disposed';
  revision: number;
  assertion: 'pass' | 'fail' | 'unavailable';
  expected: 'Revenue: 42';
  observation: Observation | null;
}
const fixtureIdentity = null;
export const agentTextScenario: ScenarioDefinition<AgentTextState> = {
  id: 'agent-text-verification', sourceId: AGENT_TEXT_SOURCE_ID, actionIds: ['seed', 'repair'],
  async mount({ canvas, referenceHost, onStateChange }) {
    const factory = import.meta.env.DEV && import.meta.env.MODE !== 'built'
      ? (await import('../../../tooling/agent-verification/text')).createTextRecorder : null;
    let recorder: ReturnType<typeof createTextRecorder> | null = null;
    let controller: ReturnType<typeof crc> | null = null;
    let disposed = false;
    let inFlight: Promise<void> | null = null;
    let cancelWait: (() => void) | null = null;
    let state: AgentTextState = { mode: 'seed', status: 'pending', revision: 0, expected: 'Revenue: 42', assertion: 'unavailable', observation: null };
    const evidence = document.createElement('pre'); evidence.dataset.testid = 'agent-text-evidence'; referenceHost?.append(evidence);
    const publish = () => {
      evidence.textContent = JSON.stringify({ schema: 'crc-text-fixture/1', identity: fixtureIdentity, state });
      onStateChange?.(structuredClone(state));
    };
    const pause = () => new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { cancelWait = null; resolve(); }, 16);
      cancelWait = () => { clearTimeout(timeout); cancelWait = null; reject(new Error('Text fixture disposed while waiting for paint.')); };
    });
    function perform(action: string): Promise<void> {
      if (disposed) return Promise.reject(new Error('Text fixture disposed.'));
      if (inFlight) return Promise.reject(new Error('Text fixture action already running.'));
      if (action !== 'seed' && action !== 'repair') return Promise.reject(new Error('Unknown text fixture action.'));
      state = { mode: action, status: 'pending', revision: state.revision + 1, expected: 'Revenue: 42', assertion: 'unavailable', observation: null };
      // Reserve the operation before executing callbacks that might reenter.
      const operation = Promise.resolve().then(async () => {
        if (disposed) throw new Error('Text fixture disposed.');
        publish();
        if (disposed) throw new Error('Text fixture disposed.');
        recorder?.dispose();
        recorder = factory?.(canvas.getContext('2d')!, { fixtureText: ['Revenue: 42', 'Revenue: 24'], capacity: 8 }) ?? null;
        const capture = recorder;
        try {
          controller = crc(canvas, createElement(AgentTextScene, { repaired: action === 'repair' }));
          const deadline = performance.now() + 5000;
          do {
            await pause();
            if (disposed) throw new Error('Text fixture disposed while waiting for paint.');
            if (!capture || capture.snapshot().total >= 2) break;
            if (performance.now() > deadline) throw new Error('Text fixture did not emit expected calls.');
          } while (!disposed);
          capture?.stop();
          const observation = capture?.snapshot() ?? null;
          // Independent application expectation, never inferred from selected mode.
          const assertion = !observation || observation.completeness !== 'complete' ? 'unavailable'
            : observation.records.some(record => record.content.status === 'fixture' && record.content.value === 'Revenue: 42') ? 'pass' : 'fail';
          state = { ...state, status: 'ready', assertion, observation };
          publish();
        } finally { capture?.dispose(); }
      }).catch(error => {
        if (!disposed) {
          state = { ...state, status: 'error', assertion: 'unavailable', observation: null };
          // Do not serialize thrown application values or private text.
          evidence.textContent = JSON.stringify({ schema: 'crc-text-fixture/1', identity: fixtureIdentity, state });
        }
        throw error;
      }).finally(() => { inFlight = null; });
      inFlight = operation;
      return operation;
    }
    async function dispose() {
      if (disposed) return;
      disposed = true;
      cancelWait?.();
      recorder?.dispose(); controller?.dispose(); evidence.remove();
      state = { ...state, status: 'disposed', assertion: 'unavailable', observation: null };
    }
    try { await perform('seed'); } catch (error) { await dispose(); throw error; }
    return { getState: () => structuredClone(state), perform, reset: () => perform('seed'), settled: async () => { if (disposed) throw new Error('Text fixture disposed.'); await inFlight; }, dispose };
  },
  formatState: state => [{ label: 'Expected label', value: state.expected }, { label: 'Assertion', value: state.assertion }, { label: 'Text evidence', value: JSON.stringify(state.observation) }],
};
