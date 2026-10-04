import { afterEach, expect, it } from "vitest";
import { crc, Group, Text } from "@crc/core";
import {
  ReactionDiffusion,
  ProceduralTexture,
  type TextureRenderer,
} from "@crc/core/textures";

const disposals: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  document.body.innerHTML = "";
});
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
it("composes and recolors textures through the public package entry in source and built modes", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 120;
  document.body.append(canvas);
  let paints = 0;
  const render: TextureRenderer = (ctx, t) => {
    paints++;
    ctx.fillStyle = ctx.createPattern(t.source, "repeat")!;
    ctx.fillRect(0, 0, t.width, t.height);
  };
  const scene = (palette: readonly string[]) => (
    <Group>
      <ReactionDiffusion
        paused
        seed={42}
        palette={palette}
        resolution={{ width: 64, height: 40 }}
        style={{ width: 120, height: 120 }}
      />
      <Group style={{ translateX: 120 }}>
        <ProceduralTexture
          kind="marble"
          render={render}
          palette={palette}
          resolution={{ width: 64, height: 40 }}
          style={{ width: 120, height: 120 }}
        />
      </Group>
      <Text pointerEvents="none" style={{ x: 8, y: 8, fill: "#ffffff" }}>
        Backgrounds
      </Text>
    </Group>
  );
  const controller = crc(canvas, scene(["#000000", "#ffffff"]));
  disposals.push(() => controller.dispose());
  await frame();
  const ctx = canvas.getContext("2d")!,
    before = Array.from(ctx.getImageData(0, 40, 240, 80).data);
  expect(paints).toBe(1);
  expect(new Set(before).size).toBeGreaterThan(10);
  crc(canvas, scene(["#331122", "#ffffaa"]));
  await frame();
  expect(Array.from(ctx.getImageData(0, 40, 240, 80).data)).not.toEqual(before);
  expect(paints).toBe(2);
  controller.dispose();
  await frame();
  expect(paints).toBe(2);
});
