import { batch, signal } from "@pibbl/core";
import mount from "./learning/composition/viz-responsive-line.example.js";
import type { ScenarioDefinition } from "./types.js";
export interface VizFoundationState {
  panels: readonly {
    width: number;
    height: number;
    domain: readonly [number, number];
  }[];
  samples: number;
  selected: {
    date: string;
    value: number;
    adjusted: number;
    interpolated: boolean;
  };
}
export const vizFoundationScenario: ScenarioDefinition<VizFoundationState> = {
  id: "viz-foundation-lab",
  sourceId: "viz-foundation-example",
  actionIds: ["full", "reset"],
  async mount({ canvas, onStateChange }) {
    const window = signal<readonly [number, number]>([384, 503]),
      selected = signal(503);
    let state: VizFoundationState = {
      panels: [],
      samples: 0,
      selected: { date: "", value: 0, adjusted: 0, interpolated: false },
    };
    let disposed = false;
    const controller = mount(canvas, {
      window,
      selected,
      onSnapshot(panel, value) {
        const panels = [...state.panels];
        panels[panel] = value;
        state = { ...state, panels };
      },
      onReading(reading, samples) {
        state = { ...state, selected: reading, samples };
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
        window.set([384, 503]);
        selected.set(503);
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
        if (action !== "full")
          throw new Error(`Unknown visualization action ${action}`);
        window.set([0, 503]);
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
    {
      label: state.selected.date,
      value: `${state.selected.value.toFixed(2)} ppm · ${state.samples} months`,
    },
    ...state.panels.map((panel, index) => ({
      label: index === 0 ? "Detail" : "Overview",
      value: `${panel.width.toFixed(1)} × ${panel.height.toFixed(1)} · months ${panel.domain.join("–")}`,
    })),
  ],
};
