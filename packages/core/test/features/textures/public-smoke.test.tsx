import { afterEach, expect, it } from "vitest";
import { pibbl, Group, Text, Rectangle, useTexture } from "@pibbl/core";
import {
  stripes,
  checkers,
  woodGrain,
  ReactionDiffusion,
  ProceduralTexture,
  type TextureRenderer,
} from "@pibbl/core/textures";

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
      <Text pointerEvents="none" style={{ left: 8, top: 8, fill: "#ffffff" }}>
        Backgrounds
      </Text>
    </Group>
  );
  const controller = pibbl(canvas, scene(["#000000", "#ffffff"]));
  disposals.push(() => controller.dispose());
  await frame();
  const ctx = canvas.getContext("2d")!,
    before = Array.from(ctx.getImageData(0, 40, 240, 80).data);
  expect(paints).toBe(1);
  expect(new Set(before).size).toBeGreaterThan(10);
  pibbl(canvas, scene(["#331122", "#ffffaa"]));
  await frame();
  expect(Array.from(ctx.getImageData(0, 40, 240, 80).data)).not.toEqual(before);
  expect(paints).toBe(2);
  controller.dispose();
  await frame();
  expect(paints).toBe(2);
});

it("publishes new pattern fills and expanded Gray–Scott through source and built package entries", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 120;
  document.body.append(canvas);
  function Scene({ palette }: { palette: readonly string[] }) {
    const bands = useTexture(stripes({ bands: 4, wave: 0.05 }), {
      resolution: { width: 64, height: 64 },
      palette,
    });
    const checks = useTexture(checkers({ columns: 4, rows: 4 }), {
      resolution: { width: 64, height: 64 },
      palette,
    });
    const fibers = useTexture(woodGrain({ seed: 42, grain: 12, distortion: 0.5 }), {
      resolution: { width: 64, height: 64 },
      palette,
    });
    return (
      <Group>
        <Rectangle style={{ width: 60, height: 120, fill: bands }} />
        <Rectangle style={{ left: 60, width: 60, height: 120, fill: checks }} />
        <Rectangle
          style={{ left: 120, width: 60, height: 120, fill: fibers }}
        />
        <Group style={{ translateX: 180 }}>
          <ReactionDiffusion
            preset="mitosis"
            warmupSteps={1200}
            paused
            brush={false}
            palette={palette}
            resolution={{ width: 64, height: 64 }}
            style={{ width: 60, height: 120 }}
          />
        </Group>
      </Group>
    );
  }
  const controller = pibbl(canvas, <Scene palette={["#000000", "#ffffff"]} />);
  disposals.push(() => controller.dispose());
  await frame();
  const context = canvas.getContext("2d")!;
  const before = Array.from(context.getImageData(0, 0, 240, 120).data);
  for (const x of [0, 60, 120, 180]) {
    const values = context.getImageData(x, 0, 60, 120).data;
    expect(values.some((value, i) => i % 4 !== 3 && value > 0)).toBe(true);
    expect(values.every((value, i) => i % 4 !== 3 || value === 255)).toBe(true);
  }
  pibbl(canvas, <Scene palette={["#112233", "#eeccaa"]} />);
  await frame();
  expect(Array.from(context.getImageData(0, 0, 240, 120).data)).not.toEqual(
    before,
  );
});
