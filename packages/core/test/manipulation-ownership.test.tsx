import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as Pibbl from "@pibbl/core";
import type {
  PibblController,
  PibblManipulationController,
  PibblManipulationCancelEvent,
  PibblManipulationOptions,
} from "@pibbl/core";

let mounted: PibblController | undefined;
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
afterEach(async () => {
  mounted?.dispose();
  mounted = undefined;
  await settle();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
async function setup(
  extra: Partial<PibblManipulationOptions> = {},
  expectedLeft = 60,
  box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 120 }),
) {
  const enabled = Pibbl.signal(true);
  const visible = Pibbl.signal(true);
  const frameVisible = Pibbl.signal(true);
  const cancelled: PibblManipulationCancelEvent[] = [];
  let controller!: PibblManipulationController;
  function Owner() {
    controller = Pibbl.useManipulation({
      box,
      move: { enabled },
      onCancel: (event) => cancelled.push(event),
      ...extra,
    });
    return frameVisible.get() ? (
      <Pibbl.ManipulationFrame {...controller.frameProps}>
        <Pibbl.DragHandle controller={controller}>
          <Pibbl.Rectangle
            pointerEvents="auto"
            keyboardFocusable
            style={{ width: 160, height: 120, fill: "transparent" }}
          />
        </Pibbl.DragHandle>
      </Pibbl.ManipulationFrame>
    ) : null;
  }
  function Scene() {
    return visible.get() ? <Owner /> : null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.dataset.manipulationTest = "";
  let captures = 0;
  canvas.addEventListener("gotpointercapture", () => captures++);
  document.body.append(canvas);
  mounted = Pibbl.pibbl(
    canvas,
    <Pibbl.FocusManagement>
      <Scene />
    </Pibbl.FocusManagement>,
  );
  await settle();
  await commands.manipulationPointer([
    { type: "move", x: 80, y: 80 },
    { type: "down" },
    { type: "move", x: 100, y: 100 },
  ]);
  expect(box.get().left).toBe(expectedLeft);
  return {
    box,
    enabled,
    visible,
    frameVisible,
    cancelled,
    controller,
    captures: () => captures,
  };
}
it("ends synchronously on an external write before another pointer event and preserves that write", async () => {
  const { box, controller, cancelled } = await setup();
  box.set({ left: 200, top: 180, width: 160, height: 120 });
  expect(controller.active.get()).toBe(null);
  expect(cancelled.map((event) => event.reason)).toEqual(["external-change"]);
  await commands.manipulationPointer([{ type: "up" }]);
  expect(box.get().left).toBe(200);
});

it("rejects a second controller that tries to own active shared geometry", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 120 });
  const { controller } = await setup({}, 60, box);
  const errors: unknown[] = [];
  vi.spyOn(globalThis, "reportError").mockImplementation((error) => {
    errors.push(error);
  });

  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  document.body.append(canvas);
  const capture = vi.spyOn(canvas, "setPointerCapture");
  let competing!: Pibbl.PibblManipulationController;
  function Competing() {
    competing = Pibbl.useManipulation({ box, move: {} });
    return (
      <Pibbl.ManipulationFrame {...competing.frameProps}>
        <Pibbl.DragHandle controller={competing}>
          <Pibbl.Rectangle
            pointerEvents="auto"
            keyboardFocusable
            style={{ width: 160, height: 120, fill: "transparent" }}
          />
        </Pibbl.DragHandle>
      </Pibbl.ManipulationFrame>
    );
  }
  const competingMount = Pibbl.pibbl(
    canvas,
    <Pibbl.FocusManagement>
      <Competing />
    </Pibbl.FocusManagement>,
  );
  try {
    await settle();
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 42,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: bounds.left + 80,
        clientY: bounds.top + 80,
      }),
    );

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(
      (error) =>
        error instanceof Error &&
        error.message === "Pibbl manipulation geometry already has an active owner.",
    )).toBe(true);
    expect(capture).not.toHaveBeenCalled();
    expect(competing.active.get()).toBe(null);
    expect(controller.active.get()?.operation).toBe("move");
    expect(box.get()).toEqual({ left: 60, top: 70, width: 160, height: 120 });
    await commands.manipulationPointer([{ type: "up" }]);
    expect(controller.active.get()).toBe(null);
  } finally {
    competingMount.dispose();
    canvas.remove();
  }
});

it("lets newer geometry written during onStart cancel the gesture and win", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 120 });
  const replacement = { left: 280, top: 190, width: 140, height: 100 };
  const { controller, cancelled } = await setup(
    { onStart: () => box.set(replacement) },
    replacement.left,
    box,
  );
  expect(controller.active.get()).toBe(null);
  expect(box.get()).toEqual(replacement);
  expect(cancelled.map((event) => event.reason)).toEqual(["external-change"]);
  await commands.manipulationPointer([{ type: "up" }]);
  expect(box.get()).toEqual(replacement);
});

it("lets newer geometry written during onChange cancel the gesture and win", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 120 });
  const replacement = { left: 260, top: 170, width: 140, height: 100 };
  let changes = 0;
  const { controller, cancelled } = await setup(
    {
      onChange: () => {
        changes++;
        box.set(replacement);
      },
    },
    replacement.left,
    box,
  );
  expect(changes).toBe(1);
  expect(controller.active.get()).toBe(null);
  expect(box.get()).toEqual(replacement);
  expect(cancelled.map((event) => event.reason)).toEqual(["external-change"]);
  await commands.manipulationPointer([{ type: "up" }]);
  expect(box.get()).toEqual(replacement);
});

it("does not cancel equal geometry, but disabling an active operation restores the starting box", async () => {
  const { box, enabled, controller, cancelled } = await setup();
  box.set({ ...box.get() });
  expect(controller.active.get()?.operation).toBe("move");
  enabled.set(false);
  expect(controller.active.get()).toBe(null);
  expect(box.get()).toEqual({ left: 40, top: 50, width: 160, height: 120 });
  expect(cancelled.map((event) => event.reason)).toEqual(["disabled"]);
  await commands.manipulationPointer([{ type: "up" }]);
});
it("releases a removed frame even while its controller stays mounted", async () => {
  const { box, frameVisible, controller } = await setup();
  frameVisible.set(false);
  await settle();
  await settle();
  expect(controller.active.get()).toBe(null);
  expect(box.get().left).toBe(40);
  await commands.manipulationPointer([{ type: "up" }]);
});
it("does not roll back a newer external value when disposal queues guarded cleanup", async () => {
  const { box, visible, cancelled } = await setup();
  visible.set(false);
  box.set({ left: 200, top: 180, width: 160, height: 120 });
  await settle();
  await settle();
  expect(box.get().left).toBe(200);
  expect(cancelled.map((event) => event.reason)).toEqual(["external-change"]);
  await commands.manipulationPointer([{ type: "up" }]);
});

it("cleans up capture and preview even when an onStart callback throws", async () => {
  const errors: unknown[] = [];
  vi.spyOn(globalThis, "reportError").mockImplementation((error) => {
    errors.push(error);
  });
  const { box, controller } = await setup(
    {
      onStart() {
        throw new Error("start failure");
      },
    },
    40,
  );
  expect(controller.active.get()).toBe(null);
  expect(box.get().left).toBe(40);
  expect(errors).toHaveLength(1);
  await commands.manipulationPointer([{ type: "up" }]);
});
it("rejects invalid static snap settings before acquiring capture", async () => {
  const errors: unknown[] = [];
  vi.spyOn(globalThis, "reportError").mockImplementation((error) => {
    errors.push(error);
  });
  const { controller, captures } = await setup(
    { move: { snap: { step: 0, when: "shift" } } },
    40,
  );
  expect(controller.active.get()).toBe(null);
  expect(captures()).toBe(0);
  expect(errors.length).toBeGreaterThan(0);
  await commands.manipulationPointer([{ type: "up" }]);
});

it("recomputes modifiers without pointer movement through logical focus and cancels on Escape", async () => {
  const { box, controller, cancelled } = await setup({
    move: { snap: { step: 16, when: "shift" } },
  });
  await commands.manipulationPointer([{ type: "keyDown", key: "Shift" }]);
  expect(box.get()).toEqual({ left: 64, top: 64, width: 160, height: 120 });
  await commands.manipulationPointer([{ type: "keyUp", key: "Shift" }]);
  expect(box.get()).toEqual({ left: 60, top: 70, width: 160, height: 120 });
  await commands.manipulationPointer([
    { type: "keyDown", key: "Escape" },
    { type: "keyUp", key: "Escape" },
  ]);
  expect(controller.active.get()).toBe(null);
  expect(box.get()).toEqual({ left: 40, top: 50, width: 160, height: 120 });
  expect(cancelled.map((event) => event.reason)).toEqual(["escape"]);
  await commands.manipulationPointer([{ type: "up" }]);
});

it("cancels with constraints-unsatisfiable when live bounds stop containing the initial box", async () => {
  const bounds = { left: 0, top: 0, width: 400, height: 300 };
  const errors: unknown[] = [];
  vi.spyOn(globalThis, "reportError").mockImplementation((error) => {
    errors.push(error);
  });
  const { box, controller, cancelled } = await setup({ move: { bounds } });
  bounds.width = 100;
  await commands.manipulationPointer([
    { type: "move", x: 110, y: 110 },
    { type: "up" },
  ]);
  expect(controller.active.get()).toBe(null);
  expect(box.get()).toEqual({ left: 40, top: 50, width: 160, height: 120 });
  expect(cancelled.map((event) => event.reason)).toEqual([
    "constraints-unsatisfiable",
  ]);
  expect(errors).toEqual([]);
});
