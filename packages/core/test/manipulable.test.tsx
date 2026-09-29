import { afterEach, expect, it } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
import type { CRCController } from "@crc/core";

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
it("offers the convenience component through the public signal binding without an Absolute host", async () => {
  const Manipulable = Reflect.get(CRC, "Manipulable");
  expect(Manipulable).toBeTypeOf("function");
  const box = CRC.signal({ left: 40, top: 50, width: 160, height: 120 });
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  mount = CRC.crc(
    canvas,
    CRC.createElement(Manipulable, {
      style: box,
      draggable: true,
      resizable: { minWidth: 80, minHeight: 60 },
      children: (
        <CRC.Rectangle
          style={{ width: "100%", height: "100%", fill: "blue" }}
        />
      ),
    }),
  );
  await settle();
  await commands.manipulationPointer([
    { type: "move", x: 80, y: 80 },
    { type: "down" },
    { type: "move", x: 100, y: 100 },
    { type: "up" },
  ]);
  await settle();
  expect(box.get()).toEqual({ left: 60, top: 70, width: 160, height: 120 });
  await commands.manipulationPointer([
    { type: "move", x: 220, y: 190 },
    { type: "down" },
    { type: "move", x: 250, y: 210 },
    { type: "up" },
  ]);
  await settle();
  expect(box.get()).toEqual({ left: 60, top: 70, width: 190, height: 140 });
});
