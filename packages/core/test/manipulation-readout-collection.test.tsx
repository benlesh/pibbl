import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
import type { CRCController, CRCNode } from "@crc/core";

let mount: CRCController | undefined;
const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
afterEach(async () => { mount?.dispose(); mount = undefined; await settle(); document.body.replaceChildren(); vi.restoreAllMocks(); });

it("accepts an empty resize collection without registering a label or handle", async () => {
  const box = CRC.signal({ left: 40, top: 50, width: 160, height: 100 });
  const canvas = document.createElement("canvas");
  canvas.width = 260; canvas.height = 190; document.body.append(canvas);
  function Scene(): CRCNode {
    const control = CRC.useManipulation({ box, resize: {} });
    return <CRC.ManipulationFrame {...control.frameProps}>
      <CRC.ResizeHandles controller={control} positions={[]} style={{ readout: true }} />
    </CRC.ManipulationFrame>;
  }
  mount = CRC.crc(canvas, <Scene />, { pixelRatio: 1 });
  await settle();
  expect(canvas.getContext("2d")!.getImageData(200, 150, 1, 1).data).toHaveLength(4);
});

it("does not retain removed collection state for a later standalone handle", async () => {
  const box = CRC.signal({ left: 40, top: 50, width: 160, height: 100 });
  const collection = CRC.signal(true);
  const canvas = document.createElement("canvas");
  canvas.width = 260; canvas.height = 190; canvas.dataset.manipulationTest = ""; document.body.append(canvas);
  function Scene(): CRCNode {
    const control = CRC.useManipulation({ box, resize: {} });
    return <CRC.ManipulationFrame {...control.frameProps}>
      {collection.get() && <CRC.ResizeHandles controller={control} style={{ readout: true }} formatReadout={() => "collection"} />}
      <CRC.ResizeHandle controller={control} position="bottom-right" style={{ readout: true }} formatReadout={() => "standalone"} />
    </CRC.ManipulationFrame>;
  }
  mount = CRC.crc(canvas, <CRC.FocusManagement><Scene /></CRC.FocusManagement>, { pixelRatio: 1 });
  await settle();
  collection.set(false);
  await settle();
  const draw = vi.spyOn(canvas.getContext("2d")!, "fillText");
  await commands.manipulationPointer([{ type: "move", x: 200, y: 150 }, { type: "down" }, { type: "move", x: 220, y: 170 }]);
  await settle();
  expect(draw.mock.calls.map(([text]) => text)).toContain("standalone");
  await commands.manipulationPointer([{ type: "up" }]);
});
