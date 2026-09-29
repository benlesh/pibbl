import { afterEach, expect, it } from "vitest";
import { commands } from "vitest/browser";
import * as CRC from "@crc/core";
import type {
  CRCController,
  CRCNode,
  CRCManipulationCommitEvent,
} from "@crc/core";

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

async function scene(snap = false) {
  const RotationHandle = Reflect.get(CRC, "RotationHandle");
  expect(RotationHandle).toBeTypeOf("function");
  const box = CRC.signal({ left: 100, top: 100, width: 120, height: 80 });
  const rotation = CRC.signal(0);
  const commits: CRCManipulationCommitEvent[] = [];
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.dataset.manipulationTest = "";
  canvas.style.touchAction = "none";
  document.body.append(canvas);
  function Scene(): CRCNode {
    const control = CRC.useManipulation({
      box,
      rotation,
      rotate: snap ? { snap: { step: CRC.degrees(15) } } : {},
      onCommit: (event) => commits.push(event),
    });
    return (
      <CRC.ManipulationFrame {...control.frameProps}>
        <CRC.Rectangle
          pointerEvents="none"
          style={{ width: 120, height: 80, fill: "blue" }}
        />
        {CRC.createElement(RotationHandle, { controller: control })}
      </CRC.ManipulationFrame>
    );
  }
  mount = CRC.crc(canvas, <Scene />, { pixelRatio: 1 });
  await settle();
  return { box, rotation, commits };
}

it("rotates from the visible external handle with radians and angular snapping", async () => {
  const { rotation, box, commits } = await scene(true);
  const angle = (22 * Math.PI) / 180;
  await commands.manipulationPointer([
    { type: "move", x: 160, y: 76 },
    { type: "down" },
    {
      type: "move",
      x: 160 + Math.sin(angle) * 64,
      y: 140 - Math.cos(angle) * 64,
    },
    { type: "up" },
  ]);
  await settle();
  expect(rotation.get()).toBeCloseTo(Math.PI / 12);
  expect(box.get()).toEqual({ left: 100, top: 100, width: 120, height: 80 });
  expect(commits).toHaveLength(1);
  expect(commits[0].operation).toBe("rotate");
  expect(commits[0].after.rotation).toBeCloseTo(Math.PI / 12);
});

it("keeps rotation continuous through a full turn and commits the terminal sample once", async () => {
  const { rotation, commits } = await scene();
  await commands.manipulationPointer([
    { type: "move", x: 160, y: 76 },
    { type: "down" },
    { type: "move", x: 224, y: 140 },
    { type: "move", x: 160, y: 204 },
    { type: "move", x: 96, y: 140 },
    { type: "move", x: 160, y: 76 },
    { type: "move", x: 224, y: 140 },
    { type: "up" },
  ]);
  await settle();
  expect(rotation.get()).toBeCloseTo(Math.PI * 2.5);
  expect(commits).toHaveLength(1);
});
