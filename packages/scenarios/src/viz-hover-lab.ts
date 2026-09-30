import { batch, signal } from "@crc/core";
import mount from "./learning/composition/viz-hover-comparison.example.js";
import type { ScenarioDefinition } from "./types.js";
type Fixture = NonNullable<Parameters<typeof mount>[1]>;
type PipelineEvidence = {
  generation: number; operation: "weighted-mean"; units: "score"; rounding: "none";
  inputCount: number; includedCount: number; excludedCount: number; outputCount: number;
  groups: { x: number; count: number; weightedSum: number; weightSum: number; value: number }[];
};
export type VizHoverState = Parameters<NonNullable<Fixture["onSnapshot"]>>[0] & { pipeline: PipelineEvidence | null };
const fixtureIdentity = null;
export const vizHoverScenario: ScenarioDefinition<VizHoverState> = {
  id: "viz-hover-lab",
  sourceId: "viz-hover-example",
  actionIds: ["closest-point", "nearest-per-line", "interpolated-x", "update-data", "missing-data", "duplicate-first", "duplicate-last", "duplicate-reordered", "nearest-unsorted", "empty-data", "weighted-data", "weighted-data-bug", "reset"],
  async mount({ canvas, onStateChange, referenceHost }) {
    const mode = signal<VizHoverState["mode"]>("nearest-per-line"),
      inspection = signal<number | null>(5);
    const seed = [{ x: 0, y: 10 }, { x: 10, y: 30 }];
    const first = signal<readonly { id?: string; x: number; y: number | null }[]>(seed);
    const generation = signal(0);
    const duplicateX = signal<"error" | "first" | "last">("error");
    const duplicates = [{ id: "start", x: 0, y: 10 }, { id: "low", x: 5, y: 10 }, { id: "high", x: 5, y: 30 }, { id: "end", x: 10, y: 30 }];
    let pipeline: PipelineEvidence | null = null;
    let disposed = false;
    const evidence = referenceHost ? document.createElement('script') : undefined;
    if (evidence) { evidence.type = 'application/json'; evidence.dataset.testid = 'agent-viz-evidence'; referenceHost!.append(evidence); }
    let state: VizHoverState = {
      pipeline: null,
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
        state = { ...value, pipeline: pipeline?.generation === value.generation ? structuredClone(pipeline) : null };
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
    const reset = async () => {
      pipeline = null;
      if (disposed) throw new Error('Visualization fixture is disposed.');
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
            inputCount: rows.length, includedCount: included.length, excludedCount: rows.length - included.length, outputCount: groups.length, groups };
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
    { label: "Data pipeline", value: JSON.stringify(state.pipeline) },
    { label: "Duplicate x policy", value: state.duplicateX },
    { label: "Data generation", value: String(state.generation) },
    { label: "Mode", value: state.mode },
    { label: "Inspection x", value: String(state.inspection) },
    { label: "Results", value: JSON.stringify(state.results) },
  ],
};
