import { batch, signal } from "@crc/core";
import mount from "./learning/composition/viz-hover-comparison.example.js";
import type { ScenarioDefinition } from "./types.js";
type Fixture = NonNullable<Parameters<typeof mount>[1]>;
export type VizHoverState = Parameters<NonNullable<Fixture["onSnapshot"]>>[0];
export const vizHoverScenario: ScenarioDefinition<VizHoverState> = {
  id: "viz-hover-lab",
  sourceId: "viz-hover-example",
  actionIds: ["closest-point", "nearest-per-line", "interpolated-x", "reset"],
  async mount({ canvas, onStateChange }) {
    const mode = signal<VizHoverState["mode"]>("nearest-per-line"),
      inspection = signal<number | null>(5);
    let state: VizHoverState = {
      mode: mode.get(),
      inspection: 5,
      results: [],
      plot: { x: 0, y: 0, width: 0, height: 0 },
    };
    const controller = mount(canvas, {
      first: [
        { x: 0, y: 10 },
        { x: 10, y: 30 },
      ],
      second: [
        { x: 2, y: 30 },
        { x: 8, y: 10 },
      ],
      xDomain: [0, 10],
      yDomain: [0, 40],
      mode,
      inspection,
      onSnapshot(value) {
        state = value;
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
      batch(() => {
        mode.set("nearest-per-line");
        inspection.set(5);
      });
      await settled();
    };
    await settled();
    return {
      getState: () => state,
      settled,
      reset,
      async perform(action) {
        if (action === "reset") return reset();
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
      async dispose() {
        controller.dispose();
      },
    };
  },
  formatState: (state) => [
    { label: "Mode", value: state.mode },
    { label: "Inspection x", value: String(state.inspection) },
    { label: "Results", value: JSON.stringify(state.results) },
  ],
};
