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
it.each([false, true])(
  "shows applied position while moving, with wrapper=%s",
  async (wrapper) => {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 250;
    canvas.dataset.manipulationTest = "";
    document.body.append(canvas);
    const box = CRC.signal({ left: 40, top: 50, width: 160, height: 100 });
    const format = vi.fn(
      ({ left, top }: { left: number; top: number }) =>
        `${left / 10}, ${top / 10} mm`,
    );
    function Scene(): CRC.CRCNode {
      const control = CRC.useManipulation({ box, move: {} });
      return wrapper ? (
        <CRC.Manipulable
          style={box}
          draggable
          dragHandle={{
            formatReadout: format,
            style: { readout: { active: { fill: "#ff0000" } } },
          }}
        >
          <CRC.Rectangle style={{ width: 160, height: 100, fill: "white" }} />
        </CRC.Manipulable>
      ) : (
        <CRC.ManipulationFrame {...control.frameProps}>
          <CRC.DragHandle controller={control} style={{ readout: true }}>
            <CRC.Rectangle style={{ width: 160, height: 100, fill: "white" }} />
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
    expect(format).not.toHaveBeenCalled();
    const ctx = canvas.getContext("2d")!;
    const painted: { text: string; fill: unknown }[] = [];
    const original = ctx.fillText.bind(ctx);
    vi.spyOn(ctx, "fillText").mockImplementation((text, x, y) => {
      painted.push({ text, fill: ctx.fillStyle });
      original(text, x, y);
    });
    await commands.manipulationPointer([
      { type: "move", x: 80, y: 80 },
      { type: "down" },
      { type: "move", x: 110, y: 100 },
    ]);
    await settle();
    expect(box.get()).toMatchObject({ left: 70, top: 70 });
    expect(painted.map((v) => v.text)).toContain(
      wrapper ? "7, 7 mm" : "left 70 · top 70 px",
    );
    if (wrapper)
      expect(painted).toContainEqual({ text: "7, 7 mm", fill: "#ff0000" });
    painted.length = 0;
    await commands.manipulationPointer([{ type: "up" }]);
    await settle();
    expect(painted).toHaveLength(0);
  },
);

it.each([
  [0, undefined, 40],
  [Math.PI / 4, undefined, 40],
  [0, 12, 12],
])('places the drag readout outside the rotation control (angle %s, gap %s)', async (angle, gap, expectedGap) => {
  const canvas = document.createElement('canvas');
  canvas.width = 700;
  canvas.height = 500;
  document.body.append(canvas);
  const box = CRC.signal({ left: 220, top: 180, width: 160, height: 100 });
  const rotation = CRC.signal(angle);
  const ctx = canvas.getContext('2d')!;
  const corners: { x: number; y: number }[] = [];
  const original = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, 'fillText').mockImplementation((text, x, y) => {
    if (text === 'position') {
      const metrics = ctx.measureText(text);
      const left = x - metrics.actualBoundingBoxLeft;
      const right = x + metrics.actualBoundingBoxRight;
      const top = y - metrics.actualBoundingBoxAscent;
      const bottom = y + metrics.actualBoundingBoxDescent;
      corners.push({ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom });
    }
    original(text, x, y);
  });
  function Scene(): CRC.CRCNode {
    const control = CRC.useManipulation({ box, rotation, move: {}, rotate: {} });
    return <CRC.ManipulationFrame {...control.frameProps}>
      <CRC.DragHandle controller={control} formatReadout={() => 'position'} style={{ readout: { visible: true, gap } }}>
        <CRC.Rectangle style={{ width: 160, height: 100, fill: 'white' }} />
      </CRC.DragHandle>
      <CRC.RotationHandle controller={control} style={{ arc: true }} />
    </CRC.ManipulationFrame>;
  }
  mount = CRC.crc(canvas, <Scene />, { pixelRatio: 1 });
  await settle();
  expect(corners).toHaveLength(4);
  const normal = { x: Math.sin(angle), y: -Math.cos(angle) };
  const topCenter = { x: 300 + normal.x * 50, y: 230 + normal.y * 50 };
  const nearest = Math.min(...corners.map(point => (point.x - topCenter.x) * normal.x + (point.y - topCenter.y) * normal.y));
  expect(nearest).toBeGreaterThanOrEqual(expectedGap);
  expect(nearest).toBeLessThan(expectedGap + 8);
});
