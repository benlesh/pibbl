import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
import type { CRCController, CRCNode } from "@crc/core";

let mount: CRCController | undefined;
const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
afterEach(async () => { mount?.dispose(); mount = undefined; await settle(); document.body.replaceChildren(); vi.restoreAllMocks(); });

it("paints an active rotation readout in the visible CSS canvas rectangle", async () => {
  const box = CRC.signal({ left: 40, top: 50, width: 160, height: 100 });
  const rotation = CRC.signal(0);
  const canvas = document.createElement("canvas");
  canvas.width = 240; canvas.height = 180; canvas.dataset.manipulationTest = ""; document.body.append(canvas);
  function Scene(): CRCNode {
    const control = CRC.useManipulation({ box, rotation, rotate: {} });
    return <CRC.ManipulationFrame {...control.frameProps}>
      <CRC.RotationHandle controller={control} formatReadout={() => "turn"} style={{ readout: true }} />
    </CRC.ManipulationFrame>;
  }
  mount = CRC.crc(canvas, <CRC.FocusManagement><Scene /></CRC.FocusManagement>, { pixelRatio: 1 });
  await settle();
  const draw = vi.spyOn(canvas.getContext("2d")!, "fillText");
  await commands.manipulationPointer([{ type: "move", x: 120, y: 26 }, { type: "down" }, { type: "move", x: 175, y: 70 }]);
  await settle();
  const call = draw.mock.calls.find(([text]) => text === "turn");
  expect(call).toBeDefined();
  const [, x, y] = call!;
  expect(x).toBeGreaterThanOrEqual(4);
  expect(x).toBeLessThanOrEqual(236);
  expect(y).toBeGreaterThanOrEqual(4);
  expect(y).toBeLessThanOrEqual(176);
  await commands.manipulationPointer([{ type: "up" }]);
});

it("paints one active combined resize readout for a handle collection", async () => {
  const box = CRC.signal({ left: 40, top: 50, width: 160, height: 100 });
  const canvas = document.createElement("canvas");
  canvas.width = 260; canvas.height = 190; canvas.dataset.manipulationTest = ""; document.body.append(canvas);
  function Scene(): CRCNode {
    const control = CRC.useManipulation({ box, resize: {} });
    return <CRC.ManipulationFrame {...control.frameProps}>
      <CRC.ResizeHandles controller={control} formatReadout={() => "size"} style={{ readout: true }} />
    </CRC.ManipulationFrame>;
  }
  mount = CRC.crc(canvas, <CRC.FocusManagement><Scene /></CRC.FocusManagement>, { pixelRatio: 1 });
  await settle();
  const draw = vi.spyOn(canvas.getContext("2d")!, "fillText");
  await commands.manipulationPointer([{ type: "move", x: 200, y: 150 }, { type: "down" }, { type: "move", x: 220, y: 170 }]);
  await settle();
  expect(draw.mock.calls.filter(([text]) => text === "size")).toHaveLength(1);
  await commands.manipulationPointer([{ type: "up" }]);
});
