import { describe, expect, it, vi } from "vitest";
import type { CRCInternalRenderOwner } from "@crc/core/internal";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import type { CRCParticleEmitter2D, CRCParticleRenderer2D } from "../types.js";
import { createCanvasParticleExecutor } from "./executor.js";

const owner = {} as CRCInternalRenderOwner;

function emitter(
  name: string,
  renderer: CRCParticleRenderer2D,
  options: Partial<CRCParticleEmitter2D> = {},
): CRCParticleEmitter2D {
  return {
    name,
    capacity: 8,
    emission: [{ type: "manual", count: 1 }],
    shape: { type: "point", position: [20, 20] },
    initial: {
      lifetimeMilliseconds: 1_000,
      size: 10,
      color: "#336699",
    },
    renderer,
    bounds: { min: [10, 10], max: [30, 30] },
    ...options,
  };
}

function setup(...emitters: CRCParticleEmitter2D[]) {
  const effect = defineParticleEffect2D({
    emitters: emitters as [CRCParticleEmitter2D, ...CRCParticleEmitter2D[]],
  });
  const compiled = compileParticleEffect2D(effect);
  const executor = createCanvasParticleExecutor({
    owner,
    compiled,
    parameters: compiled.parameterLayout.defaults,
    requestRender() {},
    spawnParameters: () => compiled.parameterLayout.defaults,
    retainSpawnEpoch() {},
    releaseSpawnEpoch() {},
  });
  for (
    let emitterIndex = 0;
    emitterIndex < emitters.length;
    emitterIndex += 1
  ) {
    executor.emitBurst({
      generation: 1,
      emitterIndex,
      count: 1,
      birthTimeMilliseconds: 0,
      seed: 7,
      seedSalt: 0,
      origin: [0, 0],
      spawnEpoch: 1,
    });
  }
  return { compiled, executor };
}

function context() {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  return canvas.getContext("2d")!;
}

describe("Canvas particle executor commands", () => {
  it("rejects sprite sources with nonfinite dimensions before executor acquisition", () => {
    const sprite = document.createElement("canvas");
    Object.defineProperty(sprite, "width", {
      configurable: true,
      value: Number.POSITIVE_INFINITY,
    });

    expect(() =>
      setup(emitter("sprite", { type: "sprite", source: sprite })),
    ).toThrowError(/decoded sprite source with finite dimensions/i);
  });

  it("draws circle, rectangle, immutable Path2D, and decoded sprite renderers in emitter order", () => {
    const path = new Path2D();
    path.rect(-0.5, -0.5, 1, 1);
    const sprite = new OffscreenCanvas(2, 2);
    const { compiled, executor } = setup(
      emitter("circle", { type: "circle" }),
      emitter("rectangle", { type: "rectangle", aspectRatio: 2 }),
      emitter("path", { type: "path", path }),
      emitter("sprite", { type: "sprite", source: sprite }),
    );
    const compiledPath = compiled.emitters[2]!.renderer;
    if (compiledPath.type !== "path") throw new Error("Expected path renderer");
    const ctx = context();
    const order: string[] = [];
    vi.spyOn(ctx, "arc").mockImplementation(() => order.push("circle"));
    vi.spyOn(ctx, "rect").mockImplementation(() => order.push("rectangle"));
    vi.spyOn(ctx, "fill").mockImplementation((drawn?: Path2D) => {
      if (drawn === compiledPath.path) order.push("path");
    });
    vi.spyOn(ctx, "drawImage").mockImplementation(() => order.push("sprite"));

    executor.draw(ctx, { x: 0, y: 0, width: 100, height: 100 }, 1, "visible");

    expect(order).toEqual(["circle", "rectangle", "path", "sprite"]);
  });

  it("maps additive to lighter while retaining source-over emitter order", () => {
    const { executor } = setup(
      emitter("rear", { type: "circle", blend: "source-over" }),
      emitter("glow", { type: "circle", blend: "additive" }),
      emitter("front", { type: "circle", blend: "source-over" }),
    );
    const ctx = context();
    const composites: string[] = [];
    vi.spyOn(ctx, "fill").mockImplementation(() => {
      composites.push(ctx.globalCompositeOperation);
    });

    executor.draw(ctx, { x: 0, y: 0, width: 100, height: 100 }, 1, "visible");

    expect(composites).toEqual(["source-over", "lighter", "source-over"]);
  });

  it("culls only an emitter whose finite conservative bounds miss the content box", () => {
    const { executor } = setup(
      emitter(
        "outside",
        { type: "circle" },
        {
          bounds: { min: [200, 200], max: [220, 220] },
        },
      ),
    );
    const ctx = context();
    const fill = vi.spyOn(ctx, "fill");

    executor.draw(ctx, { x: 0, y: 0, width: 100, height: 100 }, 1, "visible");

    expect(fill).not.toHaveBeenCalled();
  });

  it("restores Canvas state after successful drawing and after an injected draw failure", () => {
    const { executor } = setup(emitter("circle", { type: "circle" }));
    const ctx = context();
    const initial = new DOMMatrix().translate(4, 7).scale(2, 3);
    const install = () => {
      ctx.setTransform(initial);
      ctx.globalAlpha = 0.7;
      ctx.globalCompositeOperation = "copy";
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "orange";
      ctx.strokeStyle = "green";
      ctx.lineWidth = 9;
    };
    const snapshot = () => ({
      transform: [
        ctx.getTransform().a,
        ctx.getTransform().b,
        ctx.getTransform().c,
        ctx.getTransform().d,
        ctx.getTransform().e,
        ctx.getTransform().f,
      ],
      alpha: ctx.globalAlpha,
      composite: ctx.globalCompositeOperation,
      smoothing: ctx.imageSmoothingEnabled,
      fill: ctx.fillStyle,
      stroke: ctx.strokeStyle,
      lineWidth: ctx.lineWidth,
    });

    install();
    const expected = snapshot();
    executor.draw(ctx, { x: 0, y: 0, width: 100, height: 100 }, 0.5, "clip");
    expect(snapshot()).toEqual(expected);

    install();
    vi.spyOn(ctx, "fill").mockImplementationOnce(() => {
      throw new Error("injected particle draw failure");
    });
    expect(() =>
      executor.draw(ctx, { x: 0, y: 0, width: 100, height: 100 }, 0.5, "clip"),
    ).toThrow(/injected particle draw failure/);
    expect(snapshot()).toEqual(expected);
  });

  it("uses the bounded raster cache for repeated complex paths and sprites", () => {
    const path = new Path2D();
    path.rect(-0.5, -0.5, 1, 1);
    const sprite = new OffscreenCanvas(2, 2);
    const { executor } = setup(
      emitter(
        "path",
        { type: "path", path },
        {
          emission: [{ type: "manual", count: 3 }],
        },
      ),
      emitter(
        "sprite",
        { type: "sprite", source: sprite },
        {
          emission: [{ type: "manual", count: 3 }],
        },
      ),
    );
    executor.emitBurst({
      generation: 1,
      emitterIndex: 0,
      count: 2,
      birthTimeMilliseconds: 0,
      seed: 7,
      seedSalt: 0,
      origin: [0, 0],
      spawnEpoch: 1,
    });
    executor.emitBurst({
      generation: 1,
      emitterIndex: 1,
      count: 2,
      birthTimeMilliseconds: 0,
      seed: 7,
      seedSalt: 0,
      origin: [0, 0],
      spawnEpoch: 1,
    });
    const ctx = context();
    const drawImage = vi.spyOn(ctx, "drawImage");

    executor.draw(ctx, { x: 0, y: 0, width: 100, height: 100 }, 1, "visible");

    expect(drawImage).toHaveBeenCalledTimes(6);
    expect(executor.cacheEntries).toBe(2);
  });
});
