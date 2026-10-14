import { batch, signal } from "@crc/core";
import mount from "./learning/composition/viz-hover-comparison.example.js";
import type { ScenarioDefinition } from "./types.js";
type Fixture = NonNullable<Parameters<typeof mount>[1]>;
type PipelineEvidence = {
  generation: number; operation: "weighted-mean"; units: "score"; rounding: "none";
  inputCount: number; includedCount: number; excludedCount: number; outputCount: number;
  aggregation: {
    policy: { grouping: 'exact-x'; order: 'ascending-x'; output: 'one-weighted-mean-per-included-group';
      preserves: readonly ['included-count', 'weight-sum', 'weighted-sum-per-group']; extrema: 'not-preserved'; gaps: 'not-present-in-fixture' };
    includedTotals: { count: number; weightSum: number; weightedSum: number };
    displayedTotals: { pointCount: number; representedCount: number; representedWeight: number; reconstructedWeightedSum: number };
    includedValueRange: readonly [number, number]; displayedValueRange: readonly [number, number];
    reconstruction: { x: number; sourceWeightedSum: number; displayedWeightedSum: number }[];
  };
  groups: { x: number; count: number; weightedSum: number; weightSum: number; value: number }[];
};
type RequestEvidence = {
  policy: 'latest-request-wins'; status: 'idle' | 'loading' | 'success' | 'error' | 'disposed';
  activeId: number | null; pending: number; error: string | null;
  lastCompletion: { id: number; outcome: 'applied' | 'error' | 'ignored-success' | 'ignored-error' } | null;
};
type MissingnessEvidence = {
  generation: number;
  policy: 'finite-including-zero;missing-and-invalid-break-segments';
  counts: { input: number; finite: number; zero: number; missing: number; invalid: number };
  rows: { id: string; x: number; value: { kind: 'number'; value: number } | { kind: 'missing-null' | 'missing-undefined' | 'invalid-nan' | 'invalid-positive-infinity' | 'invalid-negative-infinity' } }[];
};
export type VizHoverState = Parameters<NonNullable<Fixture["onSnapshot"]>>[0] & { pipeline: PipelineEvidence | null; request: RequestEvidence; missingness: MissingnessEvidence | null };
const fixtureIdentity = null;
export const vizHoverScenario: ScenarioDefinition<VizHoverState> = {
  id: "viz-hover-lab",
  sourceId: "viz-hover-example",
  actionIds: ["closest-point", "nearest-per-line", "interpolated-x", "update-data", "missing-data", "zero-missing-invalid", "duplicate-first", "duplicate-last", "duplicate-reordered", "nearest-unsorted", "empty-data", "weighted-data", "weighted-data-bug", "async-start-old", "async-start-new", "async-resolve-old", "async-resolve-new", "async-reject-old", "async-reject-new", "reset"],
  async mount({ canvas, onStateChange, referenceHost }) {
    const mode = signal<VizHoverState["mode"]>("nearest-per-line"),
      inspection = signal<number | null>(5);
    const seed = [{ x: 0, y: 10 }, { x: 10, y: 30 }];
    const first = signal<readonly { id?: string; x: number; y: number | null | undefined }[]>(seed);
    const generation = signal(0);
    const duplicateX = signal<"error" | "first" | "last">("error");
    const duplicates = [{ id: "start", x: 0, y: 10 }, { id: "low", x: 5, y: 10 }, { id: "high", x: 5, y: 30 }, { id: "end", x: 10, y: 30 }];
    let pipeline: PipelineEvidence | null = null;
    let missingness: MissingnessEvidence | null = null;
    let disposed = false;
    let requestSequence = 0;
    let request: RequestEvidence = { policy: 'latest-request-wins', status: 'idle', activeId: null, pending: 0, error: null, lastCompletion: null };
    // Two controlled transport slots keep this application fixture bounded.
    const pending = new Map<string, { finish: (success: boolean | null) => void; done: Promise<void> }>();
    const evidence = referenceHost ? document.createElement('script') : undefined;
    if (evidence) { evidence.type = 'application/json'; evidence.dataset.testid = 'agent-viz-evidence'; referenceHost!.append(evidence); }
    let state: VizHoverState = {
      pipeline: null,
      missingness: null,
      request: structuredClone(request),
      duplicateX: "error",
      generation: -1,
      viewport: { width: 0, height: 0 },
      mode: mode.get(),
      inspection: 5,
      pointer: null,
      results: [],
      plot: { x: 0, y: 0, width: 0, height: 0 },
    };
    const publish = () => {
      state.request = structuredClone(request);
      const snapshot = structuredClone(state);
      if (evidence) evidence.textContent = JSON.stringify({ schema: 'crc-viz-fixture/1', identity: fixtureIdentity, state: snapshot });
      onStateChange?.(snapshot);
    };
    let publishFrame = 0;
    let controller: ReturnType<typeof mount>;
    try { controller = mount(canvas, {
      first,
      generation,
      duplicateX,
      second: [
        { x: 2, y: 30 },
        { x: 8, y: 10 },
      ],
      xDomain: [0, 10],
      yDomain: [0, 40],
      mode,
      inspection,
      onSnapshot(value) {
        state = { ...value, missingness: missingness?.generation === value.generation ? structuredClone(missingness) : null, request: structuredClone(request), pipeline: pipeline?.generation === value.generation ? structuredClone(pipeline) : null };
        if (!publishFrame) publishFrame = requestAnimationFrame(() => {
          publishFrame = 0;
          if (!disposed) publish();
        });
      },
    }); } catch (error) { cancelAnimationFrame(publishFrame); evidence?.remove(); throw error; }
    const cancellations = new Set<() => void>();
    const settled = () => new Promise<void>((resolve, reject) => {
      let frame = 0;
      let done = false;
      const finish = (error?: Error) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(frame); clearTimeout(timeout); cancellations.delete(cancel);
        if (error) reject(error); else resolve();
      };
      const cancel = () => finish(new Error('Visualization fixture disposed while awaiting requested state.'));
      const timeout = setTimeout(() => finish(new Error('Visualization fixture did not render requested state within 5 seconds.')), 5000);
      cancellations.add(cancel);
      const poll = () => {
        if (disposed) return cancel();
        // This lab's host has no padding. client sizes round CSS fractions, so
        // compare rounded logical dimensions; do not accept an older viewport.
        if (Math.round(state.viewport.width) === canvas.clientWidth && Math.round(state.viewport.height) === canvas.clientHeight && state.generation === generation.get() && state.mode === mode.get() && Object.is(state.inspection, inspection.get())) {
          try { publish(); finish(); } catch (error) { finish(error instanceof Error ? error : new Error('Visualization publication failed', { cause: error })); }
        } else frame = requestAnimationFrame(poll);
      };
      frame = requestAnimationFrame(poll);
    });
    const cancelRequests = () => {
      request = { policy: 'latest-request-wins', status: 'idle', activeId: null, pending: 0, error: null, lastCompletion: null };
      for (const entry of pending.values()) entry.finish(null);
      pending.clear();
    };
    const startRequest = (slot: string) => {
      if (pending.has(slot)) throw new Error(`Request slot ${slot} is already pending`);
      const id = ++requestSequence;
      let finish!: (success: boolean | null) => void;
      const response = new Promise<boolean | null>(resolve => { finish = resolve; });
      const entry = { finish, done: response.then(success => {
        if (disposed || success === null || pending.get(slot) !== entry) return;
        pending.delete(slot);
        request.pending = pending.size;
        const current = request.activeId === id;
        request.lastCompletion = { id, outcome: current ? (success ? 'applied' : 'error') : (success ? 'ignored-success' : 'ignored-error') };
        if (current) {
          request.status = success ? 'success' : 'error';
          request.error = success ? null : 'Controlled data failure';
          if (success) batch(() => {
            pipeline = null;
            first.set(slot === 'new' ? [{ x: 0, y: 20 }, { x: 10, y: 40 }] : seed);
            generation.update(value => value + 1);
          });
        }
        publish();
      }) };
      pending.set(slot, entry);
      request = { ...request, status: 'loading', activeId: id, pending: pending.size, error: null };
      publish();
    };
    const reset = async () => {
      pipeline = null;
      missingness = null;
      if (disposed) throw new Error('Visualization fixture is disposed.');
      cancelRequests();
      batch(() => {
        mode.set("nearest-per-line");
        inspection.set(5);
        duplicateX.set("error"); first.set(seed); generation.update(value => value + 1);
      });
      await settled();
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      cancelRequests();
      request.status = 'disposed';
      state.request = structuredClone(request);
      cancelAnimationFrame(publishFrame);
      for (const cancel of cancellations) cancel();
      evidence?.remove(); controller.dispose();
    };
    try { await settled(); } catch (error) { dispose(); throw error; }
    return {
      getState: () => structuredClone(state),
      settled,
      reset,
      async perform(action) {
        if (disposed) throw new Error('Visualization fixture is disposed.');
        if (action === "reset") return reset();
        if (/^async-(start|resolve|reject)-(old|new)$/.test(action)) {
          const [, operation, slot] = action.split('-');
          if (operation === 'start') startRequest(slot);
          else {
            const entry = pending.get(slot);
            if (!entry) throw new Error(`No pending ${slot} request`);
            entry.finish(operation === 'resolve');
            await entry.done;
          }
          return settled();
        }
        if (action === "weighted-data" || action === "weighted-data-bug") {
          // Application-owned fixture pipeline, not a CRC aggregation API.
          // The bug action deliberately violates the declared weighted-mean intent.
          const rows = [
            { x: 0, value: 0, weight: 3, included: true },
            { x: 0, value: 40, weight: 1, included: true },
            { x: 10, value: 0, weight: 1, included: true },
            { x: 10, value: 40, weight: 3, included: true },
            { x: 10, value: 999, weight: 100, included: false },
          ];
          const included = rows.filter(row => row.included);
          const grouped = new Map<number, { x: number; count: number; sum: number; weightedSum: number; weightSum: number }>();
          for (const row of included) {
            const group = grouped.get(row.x) ?? { x: row.x, count: 0, sum: 0, weightedSum: 0, weightSum: 0 };
            group.count++; group.sum += row.value; group.weightedSum += row.value * row.weight; group.weightSum += row.weight;
            grouped.set(row.x, group);
          }
          const groups = [...grouped.values()].sort((a, b) => a.x - b.x).map(({ sum, ...group }) => ({ ...group, value: action === "weighted-data-bug" ? sum / group.count : group.weightedSum / group.weightSum }));
          pipeline = { generation: generation.get() + 1, operation: "weighted-mean", units: "score", rounding: "none",
            inputCount: rows.length, includedCount: included.length, excludedCount: rows.length - included.length, outputCount: groups.length, groups,
            aggregation: {
              // Intended contract, not a claim that the injected bug satisfies it.
              policy: { grouping: 'exact-x', order: 'ascending-x', output: 'one-weighted-mean-per-included-group',
                preserves: ['included-count', 'weight-sum', 'weighted-sum-per-group'], extrema: 'not-preserved', gaps: 'not-present-in-fixture' },
              includedTotals: { count: included.length, weightSum: included.reduce((sum, row) => sum + row.weight, 0),
                weightedSum: included.reduce((sum, row) => sum + row.value * row.weight, 0) },
              displayedTotals: { pointCount: groups.length, representedCount: groups.reduce((sum, group) => sum + group.count, 0),
                representedWeight: groups.reduce((sum, group) => sum + group.weightSum, 0),
                reconstructedWeightedSum: groups.reduce((sum, group) => sum + group.value * group.weightSum, 0) },
              includedValueRange: [Math.min(...included.map(row => row.value)), Math.max(...included.map(row => row.value))],
              displayedValueRange: [Math.min(...groups.map(group => group.value)), Math.max(...groups.map(group => group.value))],
              reconstruction: groups.map(group => ({ x: group.x, sourceWeightedSum: group.weightedSum, displayedWeightedSum: group.value * group.weightSum })),
            } };
          batch(() => {
            mode.set("interpolated-x"); duplicateX.set("error");
            first.set(groups.map(group => ({ id: `weighted-${group.x}`, x: group.x, y: group.value })));
            generation.update(value => value + 1);
          });
          return settled();
        }
        if (action === "nearest-unsorted" || action === "empty-data") {
          batch(() => {
            mode.set("nearest-per-line");
            first.set(action === "empty-data" ? [] : [duplicates[3], duplicates[2], duplicates[0], duplicates[1]]);
            generation.update(value => value + 1);
          });
          return settled();
        }
        if (action === "duplicate-first" || action === "duplicate-last" || action === "duplicate-reordered") {
          batch(() => {
            duplicateX.set(action === "duplicate-last" ? "last" : "first");
            first.set(action === "duplicate-reordered" ? [duplicates[0], duplicates[2], duplicates[1], duplicates[3]] : duplicates);
            generation.update(value => value + 1);
          });
          return settled();
        }
        if (action === "zero-missing-invalid") {
          // Application-owned data policy: preserve zero, never coerce gaps to zero.
          const rows = [
            { id: 'start', x: 0, y: 10 }, { id: 'zero', x: 1, y: 0 }, { id: 'before-gap', x: 2, y: 10 },
            { id: 'null', x: 3, y: null }, { id: 'undefined', x: 4, y: undefined },
            { id: 'nan', x: 5, y: NaN }, { id: 'positive-infinity', x: 6, y: Infinity },
            { id: 'negative-infinity', x: 7, y: -Infinity }, { id: 'after-gap', x: 8, y: 20 }, { id: 'end', x: 10, y: 30 },
          ];
          const evidenceRows: MissingnessEvidence['rows'] = rows.map(({ id, x, y }) => ({ id, x,
            value: y === null ? { kind: 'missing-null' } : y === undefined ? { kind: 'missing-undefined' }
              : Number.isNaN(y) ? { kind: 'invalid-nan' } : y === Infinity ? { kind: 'invalid-positive-infinity' }
                : y === -Infinity ? { kind: 'invalid-negative-infinity' } : { kind: 'number', value: y },
          }));
          missingness = { generation: generation.get() + 1, policy: 'finite-including-zero;missing-and-invalid-break-segments',
            counts: { input: rows.length, finite: rows.filter(row => typeof row.y === 'number' && Number.isFinite(row.y)).length,
              zero: rows.filter(row => row.y === 0).length, missing: rows.filter(row => row.y == null).length,
              invalid: rows.filter(row => typeof row.y === 'number' && !Number.isFinite(row.y)).length }, rows: evidenceRows };
          batch(() => { mode.set('interpolated-x'); inspection.set(1); duplicateX.set('error'); first.set(rows); generation.update(value => value + 1); });
          return settled();
        }
        if (action === "missing-data") {
          batch(() => { first.set([{ x: 0, y: 10 }, { x: 5, y: null }, { x: 10, y: 30 }]); generation.update(value => value + 1); });
          return settled();
        }
        if (action === "update-data") {
          batch(() => { first.set([{ x: 0, y: 20 }, { x: 10, y: 40 }]); generation.update(value => value + 1); });
          return settled();
        }
        if (
          action !== "closest-point" &&
          action !== "nearest-per-line" &&
          action !== "interpolated-x"
        )
          throw new Error(`Unknown hover action ${action}`);
        if (action === "closest-point") {
          const bounds = canvas.getBoundingClientRect();
          canvas.dispatchEvent(
            new PointerEvent("pointermove", {
              pointerId: 1,
              pointerType: "mouse",
              clientX: bounds.left + state.plot.x,
              clientY: bounds.top + state.plot.y + state.plot.height * 0.75,
              bubbles: true,
            }),
          );
        }
        mode.set(action);
        await settled();
      },
      async dispose() { dispose(); },
    };
  },
  formatState: (state) => [
    { label: "Async data request", value: JSON.stringify(state.request) },
    { label: "Missing-value policy", value: JSON.stringify(state.missingness) },
    { label: "Data pipeline", value: JSON.stringify(state.pipeline) },
    { label: "Duplicate x policy", value: state.duplicateX },
    { label: "Data generation", value: String(state.generation) },
    { label: "Mode", value: state.mode },
    { label: "Inspection x", value: String(state.inspection) },
    { label: "Results", value: JSON.stringify(state.results) },
  ],
};
