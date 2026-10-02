import { afterEach, expect, it, vi } from "vitest";
import {
  crc,
  defineTexture,
  useTexture,
  Rectangle,
  Text,
  Layer,
  signal,
} from "@crc/core";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";
import { clearSharedState } from "../src/lib/global-state.js";
import { getSignalNode } from "../src/lib/signals/graph.js";
import { borrowTextureRaster } from "@crc/core/internal";

afterEach(() => {
  clearSharedState();
  document.body.innerHTML = "";
});
it("shares a mount-owned texture across shape and text, updates cached consumers through send, and releases it once", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const create = vi.fn(() => ({ color: "#ff0000" }));
  const dispose = vi.fn();
  const rasterize = vi.fn((state: { color: string }, context: any) => {
    const ctx = context.canvas.getContext("2d")!;
    ctx.fillStyle = state.color;
    ctx.fillRect(0, 0, context.canvas.width, context.canvas.height);
  });
  const solid = defineTexture<{}, { color: string }, { color: string }>({
    create,
    rasterize,
    dispose,
    receive(state, message, context) {
      state.color = message.color;
      context.invalidate();
    },
  });
  let texture: ReturnType<typeof useTexture<{ color: string }>>;
  function Scene() {
    texture = useTexture(solid({}), { resolution: { width: 8, height: 8 } });
    return (
      <>
        <Layer style={{ width: 64, height: 64 }}>
          <Rectangle style={{ width: 32, height: 32, fill: texture }} />
        </Layer>
        <Text style={{ x: 35, y: 40, font: "20px Arial", fill: texture }}>
          Ink
        </Text>
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect([
      ...canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data,
    ]).toEqual([255, 0, 0, 255]);
    texture!.send({ color: "#00ff00" });
    driver.flush(16);
    expect(rasterize).toHaveBeenCalledTimes(2);
    expect([
      ...canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data,
    ]).toEqual([0, 255, 0, 255]);
  } finally {
    controller.dispose();
    controller.dispose();
    restore();
  }
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(driver.pendingHostFrames).toBe(0);
});

it("publishes one committed raster revision to every paint consumer", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const rasterize = vi.fn((state: { color: string }, context: any) => {
    const ctx = context.canvas.getContext("2d")!;
    ctx.fillStyle = state.color;
    ctx.fillRect(0, 0, context.canvas.width, context.canvas.height);
  });
  const solid = defineTexture<{}, { color: string }, { color: string }>({
    create: () => ({ color: "#ff0000" }),
    rasterize,
    receive(state, message, context) {
      state.color = message.color;
      context.invalidate();
    },
  });
  const observed: Array<readonly [number, number]> = [];
  let texture: ReturnType<typeof useTexture<{ color: string }>>;
  function Scene() {
    texture = useTexture(solid({}), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => {
      observed.push([raster.revision, raster.source.getContext("2d")!.getImageData(0, 0, 1, 1).data[0]!]);
    });
    return <>
      <Rectangle style={{ x: 0, y: 0, width: 20, height: 20, fill: texture }} />
      <Rectangle style={{ x: 24, y: 0, width: 20, height: 20, fill: texture }} />
    </>;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 24;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(observed).toEqual([[0, 255]]);
    texture!.send({ color: "#00ff00" });
    driver.flush(16);
    expect(rasterize).toHaveBeenCalledTimes(2);
    expect(observed).toEqual([[0, 255], [1, 0]]);
    expect([...canvas.getContext("2d")!.getImageData(4, 4, 1, 1).data]).toEqual([0, 255, 0, 255]);
    expect([...canvas.getContext("2d")!.getImageData(28, 4, 1, 1).data]).toEqual([0, 255, 0, 255]);
  } finally {
    controller.dispose();
    restore();
  }
});

it("releases an initial provisional texture raster when its render transaction fails", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  let source: OffscreenCanvas | undefined;
  const solid = defineTexture<{}, {}>({
    create(context) {
      source = context.canvas;
      return {};
    },
    rasterize(_state, context) {
      context.canvas.getContext("2d")!.fillRect(0, 0, 8, 8);
    },
  });
  function Broken() {
    useTexture(solid({}), { resolution: { width: 8, height: 8 } });
    throw new Error("texture mount failed");
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  document.body.append(canvas);
  const controller = crc(canvas, <Broken />);
  try {
    expect(() => driver.flush(0)).toThrow("texture mount failed");
    expect(source!.width).toBe(0);
    expect(source!.height).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
});

it("keeps an Advance-committed texture raster when the later render fails", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const fail = signal(false);
  const solid = defineTexture<{}, { color: string }, { color: string }>({
    create: () => ({ color: "#ff0000" }),
    rasterize(state, context) {
      const ctx = context.canvas.getContext("2d")!;
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, 8, 8);
    },
    receive(state, message, context) {
      state.color = message.color;
      context.invalidate();
    },
  });
  const observed: number[] = [];
  let texture: ReturnType<typeof useTexture<{ color: string }>>;
  function Scene() {
    texture = useTexture(solid({}), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => observed.push(raster.source.getContext("2d")!.getImageData(0, 0, 1, 1).data[1]!));
    if (fail.get()) throw new Error("later texture render failed");
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    texture!.send({ color: "#00ff00" });
    fail.set(true);
    expect(() => driver.flush(16)).toThrow("later texture render failed");
    expect(observed).toEqual([0, 255]);
  } finally {
    controller.dispose();
    restore();
  }
});

it("reuses its bounded publication pair across 100 committed updates", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const textureRecipe = defineTexture<{}, { value: number }, { value: number }>({
    create: () => ({ value: 0 }),
    rasterize(state, context) {
      const image = context.canvas.getContext("2d")!.createImageData(1, 1);
      image.data[0] = state.value;
      image.data[3] = 255;
      context.canvas.getContext("2d")!.putImageData(image, 0, 0);
    },
    receive(state, message, context) {
      state.value = message.value;
      context.invalidate();
    },
  });
  let texture: ReturnType<typeof useTexture<{ value: number }>>;
  let resource: any;
  function Scene() {
    texture = useTexture(textureRecipe({}), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => { resource = raster.resource; });
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    for (let value = 1; value <= 100; value++) {
      texture!.send({ value });
      driver.flush(value * 16);
    }
    expect(resource.publicationSnapshot()).toEqual({ publicationCanvasesCreated: 2 });
  } finally {
    controller.dispose();
    restore();
  }
});

it("retains committed pixels when Commit rejects a texture revision and retries", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const recipe = defineTexture<{}, { color: string }, { color: string }>({
    create: () => ({ color: "#ff0000" }),
    rasterize(state, context) {
      const ctx = context.canvas.getContext("2d")!;
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, 8, 8);
    },
    receive(state, message, context) { state.color = message.color; context.invalidate(); },
  });
  const observed: number[] = [];
  let texture: ReturnType<typeof useTexture<{ color: string }>>;
  let resource: any;
  function Scene() {
    texture = useTexture(recipe({}), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => {
      resource = raster.resource;
      observed.push(raster.source.getContext("2d")!.getImageData(0, 0, 1, 1).data[1]!);
    });
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    const node = getSignalNode(resource.revision) as any;
    const equals = node.equals;
    node.equals = () => { throw new Error("texture Commit rejected"); };
    texture!.send({ color: "#00ff00" });
    expect(() => driver.flush(16)).toThrow("texture Commit rejected");
    expect(observed).toEqual([0]);
    node.equals = equals;
    driver.flush(32);
    expect(observed).toEqual([0, 255]);
  } finally {
    controller.dispose();
    restore();
  }
});
