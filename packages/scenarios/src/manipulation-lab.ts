import { crc, createElement } from "@crc/core";
import {
  createManipulationLabModel,
  ManipulationLabRoot,
  MANIPULATION_LAB_SOURCE_ID,
  type ManipulationLabAction,
  type ManipulationLabModel,
  type ManipulationLabState,
} from "./manipulation-lab.example";
import type { ScenarioDefinition, ScenarioMountContext } from "./types";

/**
 * Stable action identifiers accepted by the manipulation lab scenario.
 *
 * @see {@link ManipulationLabAction}
 */
export const MANIPULATION_LAB_ACTION_IDS = [
  "toggle-snap",
  "cancel",
  "external-write",
] as const satisfies readonly Exclude<ManipulationLabAction, "reset">[];

const INITIAL_BOX = { left: 64, top: 72, width: 180, height: 120 };

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function snapshot(
  model: ManipulationLabModel,
  lastAction: ManipulationLabState["lastAction"],
): ManipulationLabState {
  return {
    box: { ...model.box.get() },
    snapEnabled: model.snapEnabled.get(),
    active: model.control?.active.get()?.operation ?? "idle",
    changes: model.changes,
    commits: model.commits,
    cancellation: model.cancellation,
    lastAction,
  };
}

export const manipulationLabScenario: ScenarioDefinition<ManipulationLabState> = {
  id: "component-manipulation",
  sourceId: MANIPULATION_LAB_SOURCE_ID,
  actionIds: MANIPULATION_LAB_ACTION_IDS,
  async mount(context: ScenarioMountContext<ManipulationLabState>) {
    let disposed = false;
    let lastAction: ManipulationLabState["lastAction"] = "mount";
    const model = createManipulationLabModel();
    const publish = () => context.onStateChange?.(snapshot(model, lastAction));
    model.publish = publish;
    const controller = crc(context.canvas, createElement(ManipulationLabRoot, { model }), { pixelRatio: 1 });
    await nextPaint();
    publish();
    const assertActive = () => {
      if (disposed) throw new Error("Cannot operate on a disposed manipulation laboratory.");
    };
    return {
      getState: () => snapshot(model, lastAction),
      async perform(actionId) {
        assertActive();
        if (!(MANIPULATION_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
          throw new Error(`Manipulation laboratory does not support action "${actionId}".`);
        }
        lastAction = actionId as ManipulationLabAction;
        switch (lastAction) {
          case "toggle-snap":
            model.snapEnabled.update(value => !value);
            break;
          case "cancel":
            model.control?.cancel();
            break;
          case "external-write":
            model.box.set({ left: 280, top: 156, width: 180, height: 120 });
            break;
        }
        await nextPaint();
        publish();
      },
      async reset() {
        assertActive();
        lastAction = "reset";
        model.box.set(INITIAL_BOX);
        model.snapEnabled.set(false);
        model.changes = 0;
        model.commits = 0;
        model.cancellation = null;
        await nextPaint();
        publish();
      },
      settled: async () => {
        await nextPaint();
        publish();
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
      },
    };
  },
  formatState: state => [
    { label: "Box", value: `${state.box.left}, ${state.box.top} · ${state.box.width} × ${state.box.height}` },
    { label: "Snap", value: state.snapEnabled ? "20 px lattice" : "off" },
    { label: "Gesture", value: `${state.active}; changes ${state.changes}; commits ${state.commits}` },
    { label: "Cancellation", value: state.cancellation ?? "none" },
  ],
};
