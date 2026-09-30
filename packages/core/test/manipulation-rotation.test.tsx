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

it("resizes a quarter-turned frame while preserving the opposite painted corner", async () => {
  const box = CRC.signal({ left: 100, top: 100, width: 120, height: 80 });
  const rotation = CRC.signal(Math.PI / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  mount = CRC.crc(
    canvas,
    <CRC.Manipulable style={box} rotation={rotation} resizable>
      <CRC.Rectangle style={{ width: "100%", height: "100%", fill: "blue" }} />
    </CRC.Manipulable>,
    { pixelRatio: 1 },
  );
  await settle();
  await commands.manipulationPointer([
    { type: "move", x: 120, y: 200 },
    { type: "down" },
    { type: "move", x: 100, y: 240 },
    { type: "up" },
  ]);
  await settle();
  expect(box.get().width).toBeCloseTo(160);
  expect(box.get().height).toBeCloseTo(100);
  expect(box.get().left).toBeCloseTo(70);
  expect(box.get().top).toBeCloseTo(110);
  const corner = new DOMMatrix()
    .translate(
      box.get().left + box.get().width / 2,
      box.get().top + box.get().height / 2,
    )
    .rotate(90)
    .transformPoint(new DOMPoint(-box.get().width / 2, -box.get().height / 2));
  expect(corner.x).toBeCloseTo(200);
  expect(corner.y).toBeCloseTo(80);
});

it("converts native movement through a rotated and nonuniformly scaled Group", async () => {
  const box = CRC.signal({ left: 40, top: 50, width: 120, height: 80 });
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 400;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  mount = CRC.crc(
    canvas,
    <CRC.Group
      style={{
        translateX: 100,
        translateY: 40,
        rotationDegrees: 30,
        scaleX: 1.5,
        scaleY: 0.75,
      }}
    >
      <CRC.Manipulable style={box} draggable>
        <CRC.Rectangle
          style={{ width: "100%", height: "100%", fill: "blue" }}
        />
      </CRC.Manipulable>
    </CRC.Group>,
    { pixelRatio: 1 },
  );
  await settle();
  const mapping = new DOMMatrix()
    .scale(1.5, 0.75)
    .rotate(30)
    .translate(100, 40);
  const start = mapping.transformPoint(new DOMPoint(60, 70));
  const end = mapping.transformPoint(new DOMPoint(80, 100));
  await commands.manipulationPointer([
    { type: "move", x: start.x, y: start.y },
    { type: "down" },
    { type: "move", x: end.x, y: end.y },
    { type: "up" },
  ]);
  await settle();
  expect(box.get().left).toBeCloseTo(60, 0);
  expect(box.get().top).toBeCloseTo(80, 0);
});

it("converts every finite degree magnitude without intermediate overflow", () => {
  expect(CRC.degrees(180)).toBe(Math.PI);
  expect(CRC.degrees(-90)).toBe(-Math.PI / 2);
  expect(Number.isFinite(CRC.degrees(Number.MAX_VALUE))).toBe(true);
  expect(CRC.degrees(Number.MAX_VALUE)).toBeCloseTo(Number.MAX_VALUE / 180 * Math.PI, -290);
  expect(() => CRC.degrees(Infinity)).toThrow(/finite/);
  expect(() => CRC.degrees(NaN)).toThrow(/finite/);
});
