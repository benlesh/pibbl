import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import mountExample from "../../scenarios/src/learning/user-events/manipulation.example";
import type { CRCController } from "@crc/core";
let mounted: CRCController | undefined;
afterEach(() => {
  mounted?.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
it("runs the public card with nested Flex reflow and a geometry readout", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 560;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const labels: string[] = [];
  const draw = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push(text);
    if (maxWidth === undefined) draw(text, x, y);
    else draw(text, x, y, maxWidth);
  });
  mounted = mountExample(canvas);
  await settle();
  expect(labels).toContain("320 × 224 local units");
  await commands.manipulationPointer([
    { type: "move", x: 416, y: 344 },
    { type: "down" },
    { type: "move", x: 448, y: 368 },
    { type: "up" },
  ]);
  await settle();
  expect(labels).toContain("352 × 248 local units");
  expect(labels).toContain("left 96 · top 120 · width 352 · height 248");
  await commands.manipulationPointer([
    { type: "move", x: 272, y: 96 },
    { type: "down" },
    { type: "move", x: 420, y: 244 },
    { type: "up" },
  ]);
  await settle();
  expect(labels).toContain("rotation 90° · idle · completed changes 2");
  await commands.manipulationPointer([
    { type: "move", x: 650, y: 470 },
    { type: "down" },
    { type: "up" },
  ]);
  await settle();
  expect(labels.at(-1)).toBe("rotation 0° · idle · completed changes 0");
  await commands.manipulationPointer([
    { type: "move", x: 650, y: 430 },
    { type: "down" },
    { type: "up" },
  ]);
  await settle();
  expect(labels).toContain("Snap: always");
  await commands.manipulationPointer([
    { type: "move", x: 140, y: 140 },
    { type: "down" },
    { type: "move", x: 163, y: 149 },
    { type: "up" },
  ]);
  await settle();
  expect(labels).toContain("left 112 · top 128 · width 320 · height 224");
  await commands.manipulationPointer([
    { type: "move", x: 140, y: 140 },
    { type: "down" },
    { type: "move", x: 188, y: 172 },
    { type: "keyDown", key: "Escape" },
    { type: "keyUp", key: "Escape" },
    { type: "up" },
  ]);
  await settle();
  expect(labels.at(-2)).toBe("left 112 · top 128 · width 320 · height 224");
  expect(labels.at(-1)).toBe("rotation 0° · idle · completed changes 1");
});

it("shows temporary styled rotation and size labels during native manipulation", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 560;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const labels: Array<{ text: string; fill: unknown }> = [];
  const draw = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((text, x, y, maxWidth) => {
    labels.push({ text, fill: ctx.fillStyle });
    if (maxWidth === undefined) draw(text, x, y);
    else draw(text, x, y, maxWidth);
  });
  mounted = mountExample(canvas);
  await settle();
  expect(labels.some(({ text }) => text === "320 × 224 px")).toBe(false);
  labels.length = 0;
  await commands.manipulationPointer([
    { type: "move", x: 416, y: 344 },
    { type: "down" },
    { type: "move", x: 448, y: 368 },
  ]);
  await settle();
  expect(labels).toContainEqual({ text: "352 × 248 px", fill: "#1d4ed8" });
  labels.length = 0;
  await commands.manipulationPointer([{ type: "up" }]);
  await settle();
  expect(labels.some(({ text }) => text === "352 × 248 px")).toBe(false);
  labels.length = 0;
  await commands.manipulationPointer([
    { type: "move", x: 272, y: 96 },
    { type: "down" },
    { type: "move", x: 420, y: 244 },
  ]);
  await settle();
  expect(labels).toContainEqual({ text: "90°", fill: "#1d4ed8" });
  await commands.manipulationPointer([{ type: "up" }]);
});

it("moves only through the painted title bar and shows applied position", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 560;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  const labels: string[] = [];
  const ctx = canvas.getContext("2d")!;
  const draw = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, "fillText").mockImplementation((text, x, y) => {
    labels.push(text);
    draw(text, x, y);
  });
  mounted = mountExample(canvas);
  await settle();
  labels.length = 0;
  await commands.manipulationPointer([
    { type: "move", x: 180, y: 240 },
    { type: "down" },
    { type: "move", x: 200, y: 260 },
    { type: "up" },
  ]);
  await settle();
  expect(labels).not.toContain("left 116 · top 140 px");
  await commands.manipulationPointer([
    { type: "move", x: 140, y: 140 },
    { type: "down" },
    { type: "move", x: 160, y: 160 },
  ]);
  await settle();
  expect(labels).toContain("left 116 · top 140 px");
  await commands.manipulationPointer([{ type: "up" }]);
  await settle();
});
