import {
  MANIPULATION_LAB_ACTION_IDS,
  manipulationLabScenarioEntry,
  getScenarioRoute,
  loadScenario,
  type ManipulationLabState,
  type ScenarioController,
} from "@pibbl/scenarios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

const INITIAL_BOX = { left: 64, top: 72, width: 180, height: 120 };
const controllers = new Set<ScenarioController<ManipulationLabState>>();

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(async () => {
  for (const controller of controllers) await controller.dispose();
  controllers.clear();
  document.body.replaceChildren();
});

async function mountManipulationLab(): Promise<{
  readonly canvas: HTMLCanvasElement;
  readonly controller: ScenarioController<ManipulationLabState>;
}> {
  const canvas = document.createElement("canvas");
  canvas.width = manipulationLabScenarioEntry.canvas.width;
  canvas.height = manipulationLabScenarioEntry.canvas.height;
  canvas.style.cssText = "display:block;width:480px;height:300px";
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  const definition = await loadScenario(manipulationLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  controllers.add(controller);
  await controller.settled();
  return { canvas, controller };
}

describe("component manipulation public laboratory", () => {
  it("registers a private route and public authoring source without an input adapter", () => {
    expect(getScenarioRoute(manipulationLabScenarioEntry)).toBe("#/testing/manipulation");
    expect(manipulationLabScenarioEntry).toMatchObject({
      metadata: {
        id: "component-manipulation",
        visibility: "test-laboratory",
      },
      source: {
        id: "component-manipulation-laboratory-example",
        path: "packages/scenarios/src/manipulation-lab.example.tsx",
      },
    });
    expect(MANIPULATION_LAB_ACTION_IDS).toEqual([
      "toggle-snap",
      "cancel",
      "external-write",
    ]);
    expect(manipulationLabScenarioEntry.actions.map(action => action.id)).toEqual(
      MANIPULATION_LAB_ACTION_IDS,
    );
  });

  it("drives the mounted public frame through snap, cancellation, external writes, and reset", async () => {
    const { controller } = await mountManipulationLab();
    expect(controller.getState()).toMatchObject({
      box: INITIAL_BOX,
      snapEnabled: false,
      active: "idle",
      changes: 0,
      commits: 0,
      cancellation: null,
    });

    await controller.perform("toggle-snap");
    await commands.manipulationPointer([
      { type: "move", x: 84, y: 92 },
      { type: "down" },
      { type: "move", x: 105, y: 104 },
      { type: "up" },
    ]);
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      box: { left: 80, top: 80, width: 180, height: 120 },
      snapEnabled: true,
      active: "idle",
      commits: 1,
      cancellation: null,
    });

    await controller.reset();
    await commands.manipulationPointer([
      { type: "move", x: 84, y: 92 },
      { type: "down" },
      { type: "move", x: 108, y: 106 },
    ]);
    await controller.settled();
    expect(controller.getState().active).toBe("move");
    await controller.perform("cancel");
    expect(controller.getState()).toMatchObject({
      box: INITIAL_BOX,
      active: "idle",
      cancellation: "explicit",
    });
    await commands.manipulationPointer([{ type: "up" }]);

    await commands.manipulationPointer([
      { type: "move", x: 84, y: 92 },
      { type: "down" },
      { type: "move", x: 108, y: 106 },
    ]);
    await controller.settled();
    expect(controller.getState().active).toBe("move");
    await controller.perform("external-write");
    expect(controller.getState()).toMatchObject({
      box: { left: 280, top: 156, width: 180, height: 120 },
      active: "idle",
      cancellation: "external-change",
    });
    await commands.manipulationPointer([{ type: "up" }]);

    await controller.reset();
    expect(controller.getState()).toEqual({
      box: INITIAL_BOX,
      snapEnabled: false,
      active: "idle",
      changes: 0,
      commits: 0,
      cancellation: null,
      lastAction: "reset",
    });
  });
});
