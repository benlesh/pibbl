import { afterEach, expect, it } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
import type { CRCController, CRCNode } from "@crc/core";

let mount: CRCController | undefined;
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
afterEach(async () => {
  mount?.dispose();
  mount = undefined;
  await settle();
  document.body.replaceChildren();
});

it("starts only from a painted DragHandle child and respects its pointer cancellation", async () => {
  const box = CRC.signal({ left: 40, top: 50, width: 160, height: 100 });
  const cancelled = CRC.signal(false);
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 200;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  function Scene(): CRCNode {
    const control = CRC.useManipulation({ box, move: {} });
    return (
      <CRC.ManipulationFrame {...control.frameProps}>
        <CRC.DragHandle
          controller={control}
          style={{ width: 160, height: 100 }}
        >
          <CRC.Rectangle
            style={{
              left: 60,
              top: 30,
              width: 40,
              height: 40,
              fill: "#2563eb",
            }}
            onPointerDown={(event) => {
              if (cancelled.get()) event.preventDefault();
            }}
          />
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
    { type: "move", x: 45, y: 55 },
    { type: "down" },
    { type: "move", x: 70, y: 75 },
    { type: "up" },
  ]);
  expect(box.get()).toEqual({ left: 40, top: 50, width: 160, height: 100 });
  await commands.manipulationPointer([
    { type: "move", x: 120, y: 100 },
    { type: "down" },
    { type: "move", x: 145, y: 120 },
  ]);
  expect(box.get()).toEqual({ left: 65, top: 70, width: 160, height: 100 });
  await commands.manipulationPointer([{ type: "up" }]);
  cancelled.set(true);
  await settle();
  await commands.manipulationPointer([
    { type: "move", x: 145, y: 120 },
    { type: "down" },
    { type: "move", x: 170, y: 140 },
    { type: "up" },
  ]);
  expect(box.get()).toEqual({ left: 65, top: 70, width: 160, height: 100 });
});
