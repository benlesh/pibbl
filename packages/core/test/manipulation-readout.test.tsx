import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import * as Pibbl from "@pibbl/core";
import type { PibblController, PibblNode } from "@pibbl/core";

let mount: PibblController | undefined;
const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
afterEach(async () => { mount?.dispose(); mount = undefined; await settle(); document.body.replaceChildren(); vi.restoreAllMocks(); });

it("paints an active rotation readout in the visible CSS canvas rectangle", async () => {
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 100 });
  const rotation = Pibbl.signal(0);
  const canvas = document.createElement("canvas");
  canvas.width = 240; canvas.height = 180; canvas.dataset.manipulationTest = ""; document.body.append(canvas);
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({ box, rotation, rotate: {} });
    return <Pibbl.ManipulationFrame {...control.frameProps}>
      <Pibbl.RotationHandle controller={control} formatReadout={() => "turn"} style={{ readout: true }} />
    </Pibbl.ManipulationFrame>;
  }
  mount = Pibbl.pibbl(canvas, <Pibbl.FocusManagement><Scene /></Pibbl.FocusManagement>, { pixelRatio: 1 });
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
  const box = Pibbl.signal({ left: 40, top: 50, width: 160, height: 100 });
  const canvas = document.createElement("canvas");
  canvas.width = 260; canvas.height = 190; canvas.dataset.manipulationTest = ""; document.body.append(canvas);
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({ box, resize: {} });
    return <Pibbl.ManipulationFrame {...control.frameProps}>
      <Pibbl.ResizeHandles controller={control} formatReadout={() => "size"} style={{ readout: true }} />
    </Pibbl.ManipulationFrame>;
  }
  mount = Pibbl.pibbl(canvas, <Pibbl.FocusManagement><Scene /></Pibbl.FocusManagement>, { pixelRatio: 1 });
  await settle();
  const draw = vi.spyOn(canvas.getContext("2d")!, "fillText");
  await commands.manipulationPointer([{ type: "move", x: 200, y: 150 }, { type: "down" }, { type: "move", x: 220, y: 170 }]);
  await settle();
  expect(draw.mock.calls.filter(([text]) => text === "size")).toHaveLength(1);
  await commands.manipulationPointer([{ type: "up" }]);
});

it("keeps wide strokes and italic glyph bounds inside the canvas inset", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 160; canvas.height = 100;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const painted: number[][] = [];
  const original = ctx.strokeText.bind(ctx);
  vi.spyOn(ctx, "strokeText").mockImplementation((text, x, y) => {
    const m = ctx.measureText(text);
    painted.push([x - m.actualBoundingBoxLeft - ctx.lineWidth / 2,
      y - m.actualBoundingBoxAscent - ctx.lineWidth / 2,
      x + m.actualBoundingBoxRight + ctx.lineWidth / 2,
      y + m.actualBoundingBoxDescent + ctx.lineWidth / 2]);
    original(text, x, y);
  });
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({ box: Pibbl.useSignal({left: 120, top: 0, width: 30, height: 30}), resize: {} });
    return <Pibbl.ManipulationFrame {...control.frameProps}><Pibbl.ResizeHandle controller={control} position="top-right" formatReadout={() => "ffff"} style={{readout:{visible:true,font:"italic 28px serif",stroke:"red",strokeWidth:20}}}/></Pibbl.ManipulationFrame>;
  }
  mount = Pibbl.pibbl(canvas, <Scene />, {pixelRatio:1});
  await settle();
  expect(painted.length).toBeGreaterThan(0);
  for (const [left, top, right, bottom] of painted) {
    expect(left).toBeGreaterThanOrEqual(4);
    expect(top).toBeGreaterThanOrEqual(4);
    expect(right).toBeLessThanOrEqual(156);
    expect(bottom).toBeLessThanOrEqual(96);
  }
});

it.each([[0, 5], [Math.PI / 4, 5], [Math.PI * 0.8, 5], [Math.PI / 4, 16]])("places resize labels outside the rotated corner (%s, gap %s)", async (rotation, gap) => {
  const canvas = document.createElement("canvas");
  canvas.width = 800; canvas.height = 600; document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const bounds: number[][] = [];
  const original = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((text, x, y) => {
    const m = ctx.measureText(text);
    bounds.push([x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent, x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent]);
    original(text, x, y);
  });
  function Scene(): PibblNode {
    const control = Pibbl.useManipulation({box: Pibbl.useSignal({left:300,top:240,width:160,height:100}), rotation:Pibbl.useSignal(rotation), resize:{}});
    return <Pibbl.ManipulationFrame {...control.frameProps}><Pibbl.ResizeHandle controller={control} position="bottom-right" formatReadout={() => "size"} style={{readout:{visible:true,gap}}}/></Pibbl.ManipulationFrame>;
  }
  mount = Pibbl.pibbl(canvas, <Scene />, {pixelRatio:1}); await settle();
  expect(bounds).toHaveLength(1);
  const [left,top,right,bottom] = bounds[0];
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const anchor = [380 + 80*c - 50*s, 290 + 80*s + 50*c];
  for (const [x,y] of [[left,top],[right,top],[right,bottom],[left,bottom]]) {
    expect((x-anchor[0])*c + (y-anchor[1])*s).toBeGreaterThanOrEqual(gap - 0.01);
    expect(-(x-anchor[0])*s + (y-anchor[1])*c).toBeGreaterThanOrEqual(gap - 0.01);
  }
});
