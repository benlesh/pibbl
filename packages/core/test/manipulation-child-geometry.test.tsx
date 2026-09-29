import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
let mount: CRC.CRCController | undefined;
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
    const box = CRC.signal({ left: 40, top: 50, width: 200, height: 140 });
    const canvas = surface();
    const clip = new Path2D();
    clip.rect(20, 20, 20, 40);
    function Shape(): CRC.CRCNode {
      return (
        <CRC.Circle
          keyboardFocusable
          pointerEvents={kind === "opt-out" ? "none" : "auto"}
          style={{ cx: 40, cy: 40, radius: 20, fill: "blue" }}
        />
      );
    }
    function Scene(): CRC.CRCNode {
      const control = CRC.useManipulation({ box, move: {} });
      return (
        <CRC.ManipulationFrame {...control.frameProps}>
          <CRC.DragHandle controller={control} style={{ translateX: 20 }}>
            {kind === "empty" ? null : kind === "clip" ? (
              <CRC.Clip style={{ d: clip }}>
                <Shape />
              </CRC.Clip>
            ) : (
              <Shape />
            )}
            {kind === "gap" && (
              <CRC.Circle
                style={{ cx: 120, cy: 40, radius: 20, fill: "blue" }}
              />
            )}
          </CRC.DragHandle>
        </CRC.ManipulationFrame>
      );
    }
    mount = CRC.crc(canvas, <Scene />, { pixelRatio: 1 });
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
    const box = CRC.signal({ left: 40, top: 50, width: 160, height: 100 });
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
      <CRC.Circle
        keyboardFocusable
        style={{ cx: 40, cy: 40, radius: 20, fill: "blue" }}
      />
    );
    function Scene(): CRC.CRCNode {
      const control = CRC.useManipulation({ box, move: {} });
      return (
        <CRC.ManipulationFrame {...control.frameProps}>
          <CRC.DragHandle
            controller={control}
            formatReadout={() => "position"}
            style={{ readout: { focused: { visible: true, fill: "#ff0000" } } }}
          >
            {clipped ? (
              <CRC.Clip style={{ d: focusClip }}>{circle}</CRC.Clip>
            ) : (
              circle
            )}
          </CRC.DragHandle>
        </CRC.ManipulationFrame>
      );
    }
    mount = CRC.crc(
      canvas,
      <CRC.FocusManagement>
        <Scene />
      </CRC.FocusManagement>,
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
