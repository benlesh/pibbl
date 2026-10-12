import { afterEach, expect, it, vi } from "vitest";
import {
  pibbl,
  defineTexture,
  useTexture,
  Rectangle,
  Text,
  Layer,
  signal,
} from "@pibbl/core";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";
import { clearSharedState } from "../src/lib/global-state.js";
import { getSignalNode } from "../src/lib/signals/graph.js";
import { borrowTextureRaster } from "@pibbl/core/internal";

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
  let resource: any;
  function Scene() {
    texture = useTexture(solid({}), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => { resource = raster.resource; });
    return (
      <>
        <Layer style={{ width: 64, height: 64 }}>
          <Rectangle style={{ width: 32, height: 32, fill: texture }} />
        </Layer>
        <Text style={{ left: 35, top: 40, font: "20px Arial", fill: texture }}>
          Ink
        </Text>
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
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
  expect(resource.publicationSnapshot()).toMatchObject({ hasOwner: false });
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
      <Rectangle style={{ left: 0, top: 0, width: 20, height: 20, fill: texture }} />
      <Rectangle style={{ left: 24, top: 0, width: 20, height: 20, fill: texture }} />
    </>;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 24;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
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
  const controller = pibbl(canvas, <Broken />);
  try {
    expect(() => driver.flush(0)).toThrow("texture mount failed");
    expect(source!.width).toBe(0);
    expect(source!.height).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
});

it("cleans a failed initial texture publication without masking its error", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const dispose = vi.fn(() => { throw new Error("recipe cleanup failed"); });
  let source: OffscreenCanvas | undefined;
  const recipe = defineTexture<{}, {}>({
    create(context) {
      source = context.canvas;
      context.requestFrame();
      return {};
    },
    rasterize() { throw new Error("initial publication failed"); },
    dispose,
  });
  function Broken() {
    useTexture(recipe({}), { resolution: { width: 8, height: 8 } });
    return <Rectangle style={{ width: 8, height: 8, fill: "red" }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Broken />);
  try {
    expect(() => driver.flush(0)).toThrow("initial publication failed");
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(source).toMatchObject({ width: 0, height: 0 });
    expect(driver.pendingHostFrames).toBe(0);
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
  const controller = pibbl(canvas, <Scene />);
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

it("retries one failed publication copy without replacing committed pixels", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const recipe = defineTexture<{}, { color: string }, string>({
    create: () => ({ color: "#ff0000" }),
    rasterize(state, { canvas }) { const ctx = canvas.getContext("2d")!; ctx.fillStyle = state.color; ctx.fillRect(0, 0, 8, 8); },
    receive(state, color, context) { state.color = color; context.invalidate(); },
  });
  let texture!: ReturnType<typeof useTexture<string>>;
  const nativeDrawImage = OffscreenCanvasRenderingContext2D.prototype.drawImage;
  function Scene() { texture = useTexture(recipe({}), { resolution: { width: 8, height: 8 } }); return <Rectangle style={{ width: 8, height: 8, fill: texture }} />; }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    texture.send("#00ff00");
    let fail = true;
    const failFirstPublicationCopy = function (
      this: OffscreenCanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      if (fail) { fail = false; throw new Error("publication copy failed"); }
      return (nativeDrawImage as (...parameters: unknown[]) => void).apply(this, args);
    };
    OffscreenCanvasRenderingContext2D.prototype.drawImage = failFirstPublicationCopy as typeof nativeDrawImage;
    expect(() => driver.flush(16)).toThrow("publication copy failed");
    expect(canvas.getContext("2d")!.getImageData(1, 1, 1, 1).data[0]).toBe(255);
    expect(driver.pendingHostFrames).toBe(1);
    OffscreenCanvasRenderingContext2D.prototype.drawImage = nativeDrawImage;
    driver.flush(32);
    expect(canvas.getContext("2d")!.getImageData(1, 1, 1, 1).data[1]).toBe(255);
  } finally { OffscreenCanvasRenderingContext2D.prototype.drawImage = nativeDrawImage; controller.dispose(); restore(); }
});

it("cleans the incompatible spare before replacement allocation fails", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const size = signal(8); let first: OffscreenCanvas | undefined;
  const recipe = defineTexture<{}, {}, string>({
    create: () => ({}), rasterize(_state, { canvas }) { canvas.getContext("2d")!.fillRect(0, 0, 1, 1); },
    receive(_state, _message, context) { context.invalidate(); },
  });
  let texture!: ReturnType<typeof useTexture<string>>;
  const NativeCanvas = OffscreenCanvas;
  function Scene() { texture = useTexture(recipe({}), { resolution: { width: size.get(), height: size.get() } }); borrowTextureRaster(texture, raster => { first ??= raster.source; }); return <Rectangle style={{ width: 8, height: 8, fill: texture }} />; }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0); texture.send("update"); driver.flush(16);
    let allocations = 0;
    globalThis.OffscreenCanvas = class extends NativeCanvas { constructor(width: number, height: number) { if (++allocations === 1) throw new Error("publication allocation failed"); super(width, height); } };
    size.set(16); driver.flush(32);
    expect(() => driver.flush(48)).toThrow("publication allocation failed");
    expect(first).toMatchObject({ width: 0, height: 0 });
  } finally { globalThis.OffscreenCanvas = NativeCanvas; controller.dispose(); restore(); }
});

it("stops after one automatic retry for a persistent publication copy failure", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const recipe = defineTexture<{}, {}, string>({ create: () => ({}), rasterize(_s, { canvas }) { canvas.getContext("2d")!.fillRect(0, 0, 1, 1); }, receive(_s, _m, context) { context.invalidate(); } });
  let texture!: ReturnType<typeof useTexture<string>>;
  function Scene() { texture = useTexture(recipe({}), { resolution: { width: 8, height: 8 } }); return <Rectangle style={{ width: 8, height: 8, fill: texture }} />; }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); const nativeDrawImage = OffscreenCanvasRenderingContext2D.prototype.drawImage;
  try {
    driver.flush(0); texture.send("retry");
    OffscreenCanvasRenderingContext2D.prototype.drawImage = () => { throw new Error("persistent copy failure"); };
    expect(() => driver.flush(16)).toThrow("persistent copy failure"); expect(driver.pendingHostFrames).toBe(1);
    expect(() => driver.flush(32)).toThrow("persistent copy failure"); expect(driver.pendingHostFrames).toBe(0);
  } finally { OffscreenCanvasRenderingContext2D.prototype.drawImage = nativeDrawImage; controller.dispose(); restore(); }
});

it("does not dispose an already released state again when recreation fails", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const size = signal(8), dispose = vi.fn(); let creations = 0;
  const recipe = defineTexture<{}, {}>({
    create() { if (++creations === 2) throw new Error("recreation failed"); return {}; },
    rasterize(_state, { canvas }) { canvas.getContext("2d")!.fillRect(0, 0, 1, 1); }, dispose,
  });
  function Scene() { const texture = useTexture(recipe({}), { resolution: { width: size.get(), height: size.get() } }); return <Rectangle style={{ width: 8, height: 8, fill: texture }} />; }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0); size.set(16);
    expect(() => driver.flush(16)).toThrow("recreation failed");
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(driver.pendingHostFrames).toBe(0);
  } finally { controller.dispose(); restore(); }
});

it("cleans a texture when its resized state disposer throws", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const size = signal(8), dispose = vi.fn(() => { throw new Error("resize disposal failed"); });
  const recipe = defineTexture<{}, {}>({
    create(context) { context.requestFrame(); return {}; },
    rasterize(_state, { canvas }) { canvas.getContext("2d")!.fillRect(0, 0, 1, 1); }, dispose,
  });
  function Scene() { const texture = useTexture(recipe({}), { resolution: { width: size.get(), height: size.get() } }); return <Rectangle style={{ width: 8, height: 8, fill: texture }} />; }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0); size.set(16);
    expect(() => driver.flush(16)).toThrow("resize disposal failed");
    expect(dispose).toHaveBeenCalledTimes(1); expect(driver.pendingHostFrames).toBe(0);
  } finally { controller.dispose(); restore(); }
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
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    for (let value = 1; value <= 100; value++) {
      texture!.send({ value });
      driver.flush(value * 16);
    }
    expect(resource.publicationSnapshot()).toEqual({ publicationCanvasesCreated: 2, hasOwner: true });
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
  const controller = pibbl(canvas, <Scene />);
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

it("resets texture state on resolution changes while preserving the producer canvas and exact teardown", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const resolution = signal(8), displayWidth = signal(16);
  const canvases: OffscreenCanvas[] = [];
  let firstPublication: OffscreenCanvas | undefined;
  const dispose = vi.fn();
  const receive = vi.fn((state: { color: string }, color: string, context: any) => { state.color = color; context.invalidate(); });
  const recipe = defineTexture<{}, { color: string }, string>({
    create(context) { canvases.push(context.canvas); return { color: 'red' }; },
    receive,
    rasterize(state, { canvas }) { const context = canvas.getContext('2d')!; context.fillStyle = state.color; context.fillRect(0, 0, canvas.width, canvas.height); },
    dispose,
  });
  let texture!: ReturnType<typeof useTexture<string>>;
  function Scene() {
    texture = useTexture(recipe({}), { resolution: { width: resolution.get(), height: resolution.get() } });
    borrowTextureRaster(texture, raster => { firstPublication ??= raster.source; });
    return <Rectangle style={{ width: displayWidth, height: 16, fill: texture }} />;
  }
  const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 20; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    texture.send('blue'); driver.flush(16);
    expect(canvas.getContext('2d')!.getImageData(2, 2, 1, 1).data[2]).toBe(255);
    displayWidth.set(24); driver.flush(32);
    expect(canvases).toHaveLength(1); expect(dispose).not.toHaveBeenCalled();
    resolution.set(16); driver.flush(48); driver.flush(64);
    expect(canvases).toHaveLength(2); expect(canvases[1]).toBe(canvases[0]);
    expect(canvases[0].width).toBe(16); expect(dispose).toHaveBeenCalledTimes(1);
    expect(firstPublication).toMatchObject({ width: 0, height: 0 });
    expect(canvas.getContext('2d')!.getImageData(2, 2, 1, 1).data[0]).toBe(255);
    controller.dispose();
    expect(dispose).toHaveBeenCalledTimes(2); expect(canvases[0].width).toBe(0);
    texture.send('blue');
    expect(receive).toHaveBeenCalledTimes(1); expect(driver.pendingHostFrames).toBe(0);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
