import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
import type {
  CRCController,
  CRCManipulationController,
  CRCManipulationCancelEvent,
  CRCManipulationOptions,
} from "@crc/core";

let mounted: CRCController | undefined;
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
  extra: Partial<CRCManipulationOptions> = {},
  expectedLeft = 60,
) {
  const box = CRC.signal({ left: 40, top: 50, width: 160, height: 120 });
  const enabled = CRC.signal(true);
  const visible = CRC.signal(true);
  const frameVisible = CRC.signal(true);
  const cancelled: CRCManipulationCancelEvent[] = [];
  let controller!: CRCManipulationController;
  function Owner() {
    controller = CRC.useManipulation({
      box,
      move: { enabled },
      onCancel: (event) => cancelled.push(event),
      ...extra,
    });
    return frameVisible.get() ? (
      <CRC.ManipulationFrame {...controller.frameProps}>
        <CRC.DragHandle
          controller={controller}
          style={{ width: 160, height: 120 }}
        />
      </CRC.ManipulationFrame>
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
  mounted = CRC.crc(
    canvas,
    <CRC.FocusManagement>
      <Scene />
    </CRC.FocusManagement>,
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
