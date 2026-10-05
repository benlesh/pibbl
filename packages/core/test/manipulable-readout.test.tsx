import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as Pibbl from "@pibbl/core";
import type { PibblController } from "@pibbl/core";

let mount: PibblController | undefined;
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

it("forwards resize and rotation readout options through Manipulable", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 100 });
  const rotation = Pibbl.signal(0);
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 200;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  mount = Pibbl.pibbl(
    canvas,
    <Pibbl.FocusManagement>
      <Pibbl.Manipulable
        style={box}
        rotation={rotation}
        resizable
        rotatable
        resizeHandles={{
          formatReadout: () => "resized",
          style: { readout: true },
        }}
        rotationHandle={{
          formatReadout: () => "rotated",
          style: { readout: true },
        }}
      />
    </Pibbl.FocusManagement>,
    { pixelRatio: 1 },
  );
  await settle();
  const draw = vi.spyOn(canvas.getContext("2d")!, "fillText");
  await commands.manipulationPointer([
    { type: "move", x: 200, y: 150 },
    { type: "down" },
    { type: "move", x: 220, y: 170 },
  ]);
  await settle();
  expect(draw.mock.calls.map(([text]) => text)).toContain("resized");
  await commands.manipulationPointer([
    { type: "up" },
    { type: "move", x: 120, y: 26 },
    { type: "down" },
    { type: "move", x: 175, y: 70 },
  ]);
  await settle();
  expect(draw.mock.calls.map(([text]) => text)).toContain("rotated");
  await commands.manipulationPointer([{ type: "up" }]);
});
