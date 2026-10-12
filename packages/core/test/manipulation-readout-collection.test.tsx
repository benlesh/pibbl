import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as Pibbl from "@pibbl/core";
import type { PibblController, PibblNode } from "@pibbl/core";

let mount: PibblController | undefined;
const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
afterEach(async () => { mount?.dispose(); mount = undefined; await settle(); document.body.replaceChildren(); vi.restoreAllMocks(); });

it("accepts an empty resize collection without registering a label or handle", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 100 });
  const canvas = document.createElement("canvas");
  canvas.width = 260; canvas.height = 190; document.body.append(canvas);
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({ box, resize: {} });
    return <Pibbl.ManipulationFrame {...control.frameProps}>
      <Pibbl.ResizeHandles controller={control} positions={[]} style={{ readout: true }} />
    </Pibbl.ManipulationFrame>;
  }
  mount = Pibbl.pibbl(canvas, <Scene />, { pixelRatio: 1 });
  await settle();
  expect(canvas.getContext("2d")!.getImageData(200, 150, 1, 1).data).toHaveLength(4);
});

it("does not retain removed collection state for a later standalone handle", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 100 });
  const collection = Pibbl.signal(true);
  const canvas = document.createElement("canvas");
  canvas.width = 260; canvas.height = 190; canvas.dataset.manipulationTest = ""; document.body.append(canvas);
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({ box, resize: {} });
    return <Pibbl.ManipulationFrame {...control.frameProps}>
      {collection.get() && <Pibbl.ResizeHandles controller={control} style={{ readout: true }} formatReadout={() => "collection"} />}
      <Pibbl.ResizeHandle controller={control} position="bottom-right" style={{ readout: true }} formatReadout={() => "standalone"} />
    </Pibbl.ManipulationFrame>;
  }
  mount = Pibbl.pibbl(canvas, <Pibbl.FocusManagement><Scene /></Pibbl.FocusManagement>, { pixelRatio: 1 });
  await settle();
  collection.set(false);
  await settle();
  const draw = vi.spyOn(canvas.getContext("2d")!, "fillText");
  await commands.manipulationPointer([{ type: "move", x: 200, y: 150 }, { type: "down" }, { type: "move", x: 220, y: 170 }]);
  await settle();
  expect(draw.mock.calls.map(([text]) => text)).toContain("standalone");
  await commands.manipulationPointer([{ type: "up" }]);
});
