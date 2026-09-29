import { batch, signal } from "@crc/core";
import mount from "./learning/composition/viz-points-and-inspection.example.js";
import type { ScenarioDefinition } from "./types.js";
export interface VizPointsState {
  panels: readonly {
    width: number;
    height: number;
    anchors: readonly { id: string; x: number; y: number }[];
  }[];
  selected: string;
  customClicks: number;
  marks: Readonly<Record<string, number>>;
}
const seed = [
  { id: "a", x: 8, y: 22, label: "ALPHA", color: "#3972e9" },
  { id: "b", x: 16, y: 40, label: "BETA", color: "#3972e9" },
  { id: "c", x: 28, y: 62, label: "GAMMA", color: "#e77939" },
  { id: "gap", x: 49, y: null, label: "GAP", color: "#3972e9" },
  { id: "d", x: 56, y: 71, label: "DELTA", color: "#3972e9" },
];
export const vizPointsScenario: ScenarioDefinition<VizPointsState> = {
  id: "viz-points-lab",
  sourceId: "viz-points-example",
  actionIds: ["reorder", "remove-selected", "reset", "next", "previous"],
  async mount({ canvas, onStateChange }) {
    const rows = signal<readonly (typeof seed)[number][]>(seed),
      selected = signal("c"),
      clicks = signal(0);
    let state: VizPointsState = {
      panels: [],
      selected: "c",
      customClicks: 0,
      marks: {},
    };
    let disposed = false;
    const controller = mount(canvas, {
      xDomain: [0, 100],
      yDomain: [0, 100],
      rows,
      selected,
      clicks,
      onPanel(index, panel) {
        const panels = [...state.panels];
        panels[index] = panel;
        state = { ...state, panels };
      },
      onMark(id, count) {
        state = { ...state, marks: { ...state.marks, [id]: count } };
      },
      onReading(id, count) {
        state = { ...state, selected: id, customClicks: count };
      },
    });
    const settled = async () => {
      for (let i = 0; i < 3; i++)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      onStateChange?.(state);
    };
    const reset = async () => {
      if (disposed) return;
      batch(() => {
        rows.set(seed);
        selected.set("c");
        clicks.set(0);
      });
      await settled();
    };
    await settled();
    return {
      getState: () => state,
      settled,
      reset,
      async perform(action) {
        if (disposed) throw new Error("Visualization lab is disposed.");
        if (action === "reset") return reset();
        if (action === "reorder") rows.update((v) => [...v].reverse());
        else if (action === "remove-selected")
          rows.update((v) => v.filter((d) => d.id !== selected.get()));
        else if (action === "next" || action === "previous") {
          const valid = rows.get().filter((d) => d.y !== null);
          const index = valid.findIndex((d) => d.id === selected.get());
          if (valid.length)
            selected.set(
              valid[
                (index + (action === "next" ? 1 : -1) + valid.length) %
                  valid.length
              ].id,
            );
        } else throw new Error(`Unknown visualization action ${action}`);
        await settled();
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
      },
    };
  },
  formatState: (state) => [
    { label: "Selection", value: state.selected },
    { label: "Custom clicks", value: String(state.customClicks) },
    ...state.panels.map((p, i) => ({
      label: `Plot ${i + 1}`,
      value: `${p.width.toFixed(1)} × ${p.height.toFixed(1)}`,
    })),
  ],
};
