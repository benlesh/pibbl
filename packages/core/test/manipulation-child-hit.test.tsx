import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as Pibbl from "@pibbl/core";
import type { PibblController, PibblNode } from "@pibbl/core";

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
});

it("starts only from a painted DragHandle child and respects its pointer cancellation", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 100 });
  const cancelled = Pibbl.signal(false);
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 200;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({ box, move: {} });
    return (
      <Pibbl.ManipulationFrame {...control.frameProps}>
        <Pibbl.DragHandle
          controller={control}
          style={{ width: 160, height: 100 }}
        >
          <Pibbl.Rectangle
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

it("shows a move readout only for the active child-defined grip", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 180, height: 100 });
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 220;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({ box, move: {} });
    return (
      <Pibbl.ManipulationFrame {...control.frameProps}>
        <Pibbl.DragHandle
          controller={control}
          formatReadout={() => "first"}
          style={{ readout: true }}
        >
          <Pibbl.Circle style={{ cx: 40, cy: 50, radius: 16, fill: "#2563eb" }} />
        </Pibbl.DragHandle>
        <Pibbl.DragHandle
          controller={control}
          formatReadout={() => "second"}
          style={{ readout: true }}
        >
          <Pibbl.Circle
            style={{ cx: 120, cy: 50, radius: 16, fill: "#16a34a" }}
          />
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
  const draw = vi.spyOn(canvas.getContext("2d")!, "fillText");
  await commands.manipulationPointer([
    { type: "move", x: 80, y: 100 },
    { type: "down" },
    { type: "move", x: 105, y: 120 },
  ]);
  await settle();
  const text = draw.mock.calls.map(([value]) => value);
  expect(text).toContain("first");
  expect(text).not.toContain("second");
  await commands.manipulationPointer([{ type: "up" }]);
});
