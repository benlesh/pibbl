import { afterEach, expect, it } from "vitest";
import { crc, Rectangle, signal } from "@crc/core";
import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
  physicsObstacles2D,
  staticBody2D,
} from "@crc/physics/2d";
import {
  Particles2D,
  defineParticleEffect2D,
  useParticleSystem,
  useFlowField2D,
  useFlowSource2D,
  type CRCFlowField2D,
} from "@crc/particles";

let root: ReturnType<typeof crc> | undefined;
afterEach(() => {
  root?.dispose();
  root = undefined;
  document.body.replaceChildren();
});
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
it("composes smoke with optional committed physics obstacles through source and built package entries", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 120;
  document.body.appendChild(canvas);
  const left = signal(40);
  let field!: CRCFlowField2D;
  let obstacles!: ReturnType<typeof physicsObstacles2D>;
  const effect = defineParticleEffect2D({
    emitters: [
      {
        name: "smoke",
        capacity: 1,
        emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
        shape: { type: "point", position: [50, 85] },
        initial: { lifetimeMilliseconds: 10000, size: 6, color: "#ff0000" },
        renderer: { type: "circle" },
      },
    ],
  });
  function Scene() {
    obstacles = physicsObstacles2D(crcPhysicsWorld2D());
    field = useFlowField2D({
      bounds: { width: 120, height: 120 },
      resolution: [24, 24],
      obstacles,
    });
    useFlowSource2D(field, {
      position: [50, 95],
      radius: 25,
      acceleration: [0, -200],
      heat: 2,
    });
    const system = useParticleSystem(effect, { flow: field, autoplay: true });
    return (
      <>
        <Rectangle
          physics={staticBody2D()}
          style={{ left, top: 50, width: 20, height: 10, fill: "#0000ff" }}
        />
        <Particles2D
          system={system}
          pointerEvents="none"
          style={{ width: 120, height: 120 }}
        />
      </>
    );
  }
  root = crc(
    canvas,
    <PhysicsWorld2D gravity={[0, 0]}>
      <Scene />
    </PhysicsWorld2D>,
    { pixelRatio: 1 },
  );
  await expect.poll(() => field?.revision.get() ?? 0).toBeGreaterThan(5);
  await expect
    .poll(() => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, 120, 120).data;
      let sum = 0,
        count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i]! > 200 && pixels[i + 3]! > 100) {
          sum += Math.floor(i / 4 / 120);
          count++;
        }
      return count ? sum / count : Infinity;
    })
    .toBeLessThan(83);
  expect(obstacles.read().boxes[0]).toBe(50);
  left.set(70);
  await expect.poll(() => obstacles.read().boxes[0]).toBe(80);
  root.dispose();
  const revision = field.revision.get();
  await frame();
  expect(field.revision.get()).toBe(revision);
  expect(() =>
    field.sampleBatch(new Float32Array(2), new Float32Array(2), 1),
  ).toThrow(/disposed/);
  expect(() => obstacles.read()).toThrow(/live CRC physics/);
});
