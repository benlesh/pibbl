import { afterEach, expect, it, vi } from "vitest";
import {
  Group,
  Rectangle,
  pibbl,
  defineTexture,
  signal,
  useTexture,
} from "@pibbl/core";
import { borrowTextureRaster } from "@pibbl/core/internal";
import { clearSharedState } from "../src/lib/global-state.js";
import {
  drawSimpleStretchedTexture,
  registerTexturePaint,
  type TexturePaint,
} from "../src/lib/textures/texture-protocol.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it("uses no CanvasPattern allocations for eligible stretched Rectangle texture fills", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const revision = signal(0);
  const recipe = defineTexture<{}, { color: string }>({
    create: () => ({ color: "#ff0000" }),
    rasterize(state, { canvas }) {
      const context = canvas.getContext("2d")!;
      context.fillStyle = state.color;
      context.fillRect(0, 0, 8, 8);
    },
  });
  function Scene() {
    revision.get();
    const texture = useTexture(recipe({}), {
      resolution: { width: 8, height: 8 },
    });
    return (
      <Rectangle
        style={{
          width: 8,
          height: 8,
          fill: texture.paint({ mode: "stretch" }),
        }}
      />
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  document.body.append(canvas);
  const createPattern = vi.spyOn(
    CanvasRenderingContext2D.prototype,
    "createPattern",
  );
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    revision.set(1);
    driver.flush(16);
    revision.set(2);
    driver.flush(32);
    expect(createPattern).not.toHaveBeenCalled();
    expect([...canvas.getContext("2d")!.getImageData(4, 4, 1, 1).data]).toEqual(
      [255, 0, 0, 255],
    );
  } finally {
    controller.dispose();
    restore();
  }
});

it("keeps CanvasPattern stretch semantics for transparent, fractional Rectangle bounds", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const recipe = defineTexture<{}, {}>({
    create: () => ({}),
    rasterize(_state, { canvas }) {
      const context = canvas.getContext("2d")!,
        image = context.createImageData(8, 8);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const index = (y * 8 + x) * 4;
          image.data[index] = x * 31;
          image.data[index + 1] = y * 31;
          image.data[index + 2] = 255 - x * 31;
          image.data[index + 3] = (x + y) % 3 === 0 ? 0 : 160;
        }
      context.putImageData(image, 0, 0);
    },
  });
  let source!: OffscreenCanvas;
  function Scene() {
    const texture = useTexture(recipe({}), {
      resolution: { width: 8, height: 8 },
    });
    borrowTextureRaster(texture, (raster) => {
      source = raster.source;
    });
    return (
      <Rectangle
        style={{
          left: 1.25,
          top: 2.5,
          width: 31.5,
          height: 19.25,
          opacity: 0.7,
          fill: texture.paint({ mode: "stretch" }),
        }}
      />
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 30;
  document.body.append(canvas);
  const createPattern = vi.spyOn(
    CanvasRenderingContext2D.prototype,
    "createPattern",
  );
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    const baseline = new OffscreenCanvas(40, 30),
      context = baseline.getContext("2d")!,
      pattern = context.createPattern(source, "repeat")!;
    pattern.setTransform(
      new DOMMatrix().translate(1.25, 2.5).scale(31.5 / 8, 19.25 / 8),
    );
    context.globalAlpha = 0.7;
    context.fillStyle = pattern;
    const path = new Path2D();
    path.rect(1.25, 2.5, 31.5, 19.25);
    context.fill(path);
    expect([
      ...canvas.getContext("2d")!.getImageData(0, 0, 40, 30).data,
    ]).toEqual([...context.getImageData(0, 0, 40, 30).data]);
    expect(createPattern).toHaveBeenCalled();
  } finally {
    controller.dispose();
    restore();
  }
});

it("matches CanvasPattern pixels at aligned bounds and falls back at DPR 2", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const recipe = defineTexture<{}, {}>({
    create: () => ({}),
    rasterize(_state, { canvas }) {
      const context = canvas.getContext("2d")!,
        image = context.createImageData(8, 8);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const index = (y * 8 + x) * 4;
          image.data[index] = x * 31;
          image.data[index + 1] = y * 31;
          image.data[index + 2] = 255 - x * 31;
          image.data[index + 3] = (x + y) % 3 ? 160 : 0;
        }
      context.putImageData(image, 0, 0);
    },
  });
  try {
    for (const pixelRatio of [1, 2]) {
      let source!: OffscreenCanvas;
      function Scene() {
        const texture = useTexture(recipe({}), {
          resolution: { width: 8, height: 8 },
        });
        borrowTextureRaster(texture, (raster) => {
          source = raster.source;
        });
        return (
          <Rectangle
            style={{
              left: 4,
              top: 2,
              width: 8,
              height: 8,
              opacity: 0.7,
              fill: texture.paint({ mode: "stretch" }),
            }}
          />
        );
      }
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 20;
      document.body.append(canvas);
      const createPattern = vi.spyOn(
        CanvasRenderingContext2D.prototype,
        "createPattern",
      );
      const controller = pibbl(canvas, <Scene />, { pixelRatio });
      try {
        driver.flush(pixelRatio * 32);
        const baseline = new OffscreenCanvas(canvas.width, canvas.height),
          context = baseline.getContext("2d")!;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        const pattern = context.createPattern(source, "repeat")!;
        pattern.setTransform(new DOMMatrix().translate(4, 2));
        context.globalAlpha = 0.7;
        context.fillStyle = pattern;
        const path = new Path2D();
        path.rect(4, 2, 8, 8);
        context.fill(path);
        expect([
          ...canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height).data,
        ]).toEqual([
          ...context.getImageData(0, 0, canvas.width, canvas.height).data,
        ]);
        expect(createPattern).toHaveBeenCalledTimes(pixelRatio === 1 ? 0 : 1);
      } finally {
        controller.dispose();
        createPattern.mockRestore();
      }
    }
  } finally {
    restore();
  }
});

it("falls back to CanvasPattern for transformed, rounded, stroked, and non-stretch fills", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const recipe = defineTexture<{}, {}>({
    create: () => ({}),
    rasterize: (_state, { canvas }) =>
      canvas.getContext("2d")!.fillRect(0, 0, 8, 8),
  });
  function Scene() {
    const texture = useTexture(recipe({}), {
      resolution: { width: 8, height: 8 },
    });
    return (
      <>
        <Group style={{ rotationDegrees: 15 }}>
          <Rectangle
            style={{
              width: 32,
              height: 16,
              fill: texture.paint({ mode: "stretch" }),
            }}
          />
        </Group>
        <Rectangle
          style={{
            top: 20,
            width: 32,
            height: 16,
            cornerRadius: 4,
            fill: texture.paint({ mode: "stretch" }),
          }}
        />
        <Rectangle
          style={{
            top: 40,
            width: 32,
            height: 16,
            stroke: "black",
            strokeWidth: 1,
            fill: texture.paint({ mode: "stretch" }),
          }}
        />
        <Rectangle
          style={{
            top: 60,
            width: 32,
            height: 16,
            fill: texture.paint({ mode: "repeat", offsetX: 1 }),
          }}
        />
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 80;
  document.body.append(canvas);
  const createPattern = vi.spyOn(
    CanvasRenderingContext2D.prototype,
    "createPattern",
  );
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(createPattern).toHaveBeenCalledTimes(4);
  } finally {
    controller.dispose();
    restore();
  }
});

it("does not bypass a nontransparent zero-offset Canvas shadow", () => {
  const source = new OffscreenCanvas(8, 8),
    paint = Object.freeze({}) as TexturePaint;
  registerTexturePaint(paint, {
    validate: () => undefined,
    resolvePaint: () => "black",
    borrow: (callback) =>
      callback({
        source,
        width: 8,
        height: 8,
        revision: 0,
        resource: {},
        placement: { mode: "stretch" },
      }),
  });
  const context = new OffscreenCanvas(8, 8).getContext("2d")!;
  context.shadowColor = "red";
  expect(
    drawSimpleStretchedTexture(paint, context, {
      x: 0,
      y: 0,
      width: 8,
      height: 8,
    }),
  ).toBe(false);
});
