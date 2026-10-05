import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as Pibbl from "@pibbl/core";
let mount: Pibbl.PibblController | undefined;
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
afterEach(async () => {
  mount?.dispose();
  mount = undefined;
  await settle();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function surface() {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  return canvas;
}
async function drag(x: number, y: number) {
  await commands.manipulationPointer([
    { type: "move", x, y },
    { type: "down" },
    { type: "move", x: x + 25, y: y + 15 },
    { type: "up" },
  ]);
  await settle();
}
it.each(["circle", "clip", "empty", "opt-out", "gap"] as const)(
  "uses actual child hit geometry: %s",
  async (kind) => {
    const box = Pibbl.signal({ left: 40, top: 50, width: 200, height: 140 });
    const canvas = surface();
    const clip = new Path2D();
    clip.rect(20, 20, 20, 40);
    function Shape(): Pibbl.PibblNode {
      return (
        <Pibbl.Circle
          keyboardFocusable
          pointerEvents={kind === "opt-out" ? "none" : "auto"}
          style={{ cx: 40, cy: 40, radius: 20, fill: "blue" }}
        />
      );
    }
    function Scene(): Pibbl.PibblNode {
      const control = Pibbl.useManipulation({ box, move: {} });
      return (
        <Pibbl.ManipulationFrame {...control.frameProps}>
          <Pibbl.DragHandle controller={control} style={{ translateX: 20 }}>
            {kind === "empty" ? null : kind === "clip" ? (
              <Pibbl.Clip style={{ d: clip }}>
                <Shape />
              </Pibbl.Clip>
            ) : (
              <Shape />
            )}
            {kind === "gap" && (
              <Pibbl.Circle
                style={{ cx: 120, cy: 40, radius: 20, fill: "blue" }}
              />
            )}
          </Pibbl.DragHandle>
        </Pibbl.ManipulationFrame>
      );
    }
    mount = Pibbl.pibbl(canvas, <Scene />, { pixelRatio: 1 });
    await settle();
    const miss =
      kind === "clip"
        ? [110, 90]
        : kind === "gap"
          ? [140, 90]
          : kind === "circle"
            ? [82, 72]
            : [100, 90];
    await drag(miss[0], miss[1]);
    expect(box.get()).toEqual({ left: 40, top: 50, width: 200, height: 140 });
    if (kind !== "empty" && kind !== "opt-out") {
      await drag(kind === "clip" ? 90 : 100, 90);
      expect(box.get()).toMatchObject({ left: 65, top: 65 });
    }
  },
);
it.each([false, true])(
  "bubbles Escape from the focused child and styles its readout as focused (clipped=%s)",
  async (clipped) => {
    const canvas = surface();
    const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 100 });
    const labels: { text: string; fill: unknown }[] = [];
    const ctx = canvas.getContext("2d")!;
    const draw = ctx.fillText.bind(ctx);
    vi.spyOn(ctx, "fillText").mockImplementation((text, x, y) => {
      labels.push({ text, fill: ctx.fillStyle });
      draw(text, x, y);
    });
    const focusClip = new Path2D();
    focusClip.rect(20, 20, 20, 40);
    const circle = (
      <Pibbl.Circle
        keyboardFocusable
        style={{ cx: 40, cy: 40, radius: 20, fill: "blue" }}
      />
    );
    function Scene(): Pibbl.PibblNode {
      const control = Pibbl.useManipulation({ box, move: {} });
      return (
        <Pibbl.ManipulationFrame {...control.frameProps}>
          <Pibbl.DragHandle
            controller={control}
            formatReadout={() => "position"}
            style={{ readout: { focused: { visible: true, fill: "#ff0000" } } }}
          >
            {clipped ? (
              <Pibbl.Clip style={{ d: focusClip }}>{circle}</Pibbl.Clip>
            ) : (
              circle
            )}
          </Pibbl.DragHandle>
        </Pibbl.ManipulationFrame>
      );
    }
    mount = Pibbl.pibbl(
      canvas,
      <Pibbl.FocusManagement>
        <Scene />
      </Pibbl.FocusManagement>,
      { pixelRatio: 1 },
    );
    await settle();
    await commands.manipulationPointer([
      { type: "move", x: 70, y: 90 },
      { type: "down" },
      { type: "move", x: 120, y: 140 },
    ]);
    await settle();
    expect(box.get()).toMatchObject({ left: 90, top: 100 });
    expect(labels).toContainEqual({ text: "position", fill: "#ff0000" });
    await commands.manipulationPointer([
      { type: "keyDown", key: "Escape" },
      { type: "keyUp", key: "Escape" },
      { type: "up" },
    ]);
    await settle();
    expect(box.get()).toMatchObject({ left: 40, top: 50 });
  },
);
