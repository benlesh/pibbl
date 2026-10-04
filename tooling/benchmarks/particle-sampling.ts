import { compileParticleEffect2D } from "../../packages/core/src/features/particles/lib/compiler.js";
import { defineParticleEffect2D } from "../../packages/core/src/features/particles/lib/definition.js";
import { particle } from "../../packages/core/src/features/particles/lib/particle.js";
import {
  Particle2DRegister as R,
  sampleParticle2D,
} from "../../packages/core/src/features/particles/lib/sample.js";

const stride = R.AtlasFrame + 1;
const stats = (values: number[]) => {
  values.sort((a, b) => a - b);
  return {
    median: values[Math.floor(values.length / 2)],
    p95: values[Math.floor(values.length * 0.95)],
  };
};

export async function benchmark(count: number) {
  const start = performance.now();
  const plan = compileParticleEffect2D(
    defineParticleEffect2D({
      emitters: [
        {
          name: "smoke",
          capacity: count,
          emission: [{ type: "manual", count: 1 }],
          shape: {
            type: "rectangle",
            width: 660,
            height: 420,
            sample: "interior",
          },
          initial: {
            lifetimeMilliseconds: 10000,
            velocity: [particle.between(-10, 10), particle.between(-20, -5)],
            rotationDegrees: particle.between(0, 360),
            size: particle.between(10, 20),
            color: "#b3c6d5",
          },
          motion: [
            {
              type: "sway",
              amplitude: 6,
              frequency: particle.between(0.2, 0.6),
            },
          ],
          appearance: {
            size: particle.curve([
              [0, 10],
              [0.3, 20],
              [1, 32],
            ]),
            opacity: particle.curve([
              [0, 0],
              [0.1, 0.25],
              [1, 0],
            ]),
          },
          renderer: { type: "circle" },
        },
      ],
    }),
  ).emitters[0]!;
  // Both modes receive identical packed inputs; neither allocates per particle.
  const seeds = new Uint32Array(count),
    ordinals = new Float64Array(count),
    times = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i] = 42;
    ordinals[i] = i;
    times[i] = i % 4000;
  }
  const birth = { seed: 0, ordinal: 0, birthTimeMilliseconds: 0 };
  const parameters = new Float64Array(0),
    registers = new Float64Array(stride);
  const packed = new Float64Array(count * stride);
  const chunk = new Float64Array(Math.min(count, 256) * stride);
  const sprite = new OffscreenCanvas(32, 32),
    spriteContext = sprite.getContext("2d")!;
  const gradient = spriteContext.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "#b3c6d5");
  gradient.addColorStop(1, "#b3c6d500");
  spriteContext.fillStyle = gradient;
  spriteContext.fillRect(0, 0, 32, 32);
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 480;
  document.body.replaceChildren(canvas);
  const context = canvas.getContext("2d")!;
  const sample = (i: number) => {
    birth.seed = seeds[i]!;
    birth.ordinal = ordinals[i]!;
    birth.birthTimeMilliseconds = times[i]!;
    sampleParticle2D(plan, birth, 5000, parameters, registers);
  };
  const pack = () => {
    for (let i = 0; i < count; i++) {
      sample(i);
      packed.set(registers, i * stride);
    }
  };
  const draw = (values: Float64Array, offset: number) => {
    const angle = (values[offset + R.Rotation]! * Math.PI) / 180;
    const cosine = Math.cos(angle),
      sine = Math.sin(angle);
    context.setTransform(
      cosine,
      sine,
      -sine,
      cosine,
      values[offset + R.X]! + 360,
      values[offset + R.Y]! + 240,
    );
    context.globalAlpha = values[offset + R.Alpha]!;
    const width = values[offset + R.SizeX]!,
      height = values[offset + R.SizeY]!;
    context.drawImage(sprite, -width / 2, -height / 2, width, height);
  };
  const clear = () => {
    context.resetTransform();
    context.clearRect(0, 0, 720, 480);
  };
  pack();
  for (let i = 0; i < count; i++) {
    sample(i);
    for (let j = 0; j < stride; j++)
      if (registers[j] !== packed[i * stride + j])
        throw new Error(`Sample mismatch ${i}:${j}`);
  }
  const startupMilliseconds = performance.now() - start;
  let checksum = 0;
  const scalarSampling = () => {
    for (let i = 0; i < count; i++) {
      sample(i);
      checksum += registers[R.X]!;
    }
  };
  const batchSampling = () => {
    pack();
    for (let i = 0; i < count; i++) checksum += packed[i * stride + R.X]!;
  };
  const scalarFrame = () => {
    clear();
    for (let i = 0; i < count; i++) {
      sample(i);
      draw(registers, 0);
    }
  };
  const batchFrame = () => {
    clear();
    pack();
    for (let i = 0; i < count; i++) draw(packed, i * stride);
  };
  const chunked = (render: boolean) => {
    if (render) clear();
    for (let start = 0; start < count; start += 256) {
      const length = Math.min(256, count - start);
      for (let i = 0; i < length; i++) {
        sample(start + i);
        chunk.set(registers, i * stride);
      }
      for (let i = 0; i < length; i++) {
        if (render) draw(chunk, i * stride);
        else checksum += chunk[i * stride + R.X]!;
      }
    }
  };
  const cachedDrawing = () => {
    clear();
    for (let i = 0; i < count; i++) draw(packed, i * stride);
  };
  const sampling = {
    scalar: [] as number[],
    batch: [] as number[],
    chunked: [] as number[],
  };
  // Alternate order to avoid consistently gifting one mode a warmer JIT.
  for (let pass = 0; pass < 70; pass++) {
    for (const name of pass % 2
      ? (["chunked", "batch", "scalar"] as const)
      : (["scalar", "batch", "chunked"] as const)) {
      const before = performance.now();
      for (let repeat = 0; repeat < 10; repeat++)
        (name === "scalar"
          ? scalarSampling
          : name === "batch"
            ? batchSampling
            : () => chunked(false))();
      if (pass >= 10) sampling[name].push((performance.now() - before) / 10);
    }
  }
  const cpu = {
    scalar: [] as number[],
    batch: [] as number[],
    chunked: [] as number[],
    cachedDrawing: [] as number[],
  };
  const intervals = {
    scalar: [] as number[],
    batch: [] as number[],
    chunked: [] as number[],
    cachedDrawing: [] as number[],
  };
  // Contiguous windows make each rAF interval attributable to its preceding mode.
  for (const mode of [
    "scalar",
    "batch",
    "chunked",
    "cachedDrawing",
    "chunked",
    "batch",
    "scalar",
  ] as const) {
    const work =
      mode === "scalar"
        ? scalarFrame
        : mode === "batch"
          ? batchFrame
          : mode === "chunked"
            ? () => chunked(true)
            : cachedDrawing;
    let previous = 0;
    for (let frame = 0; frame < 65; frame++) {
      const now = await new Promise<number>((resolve) =>
        requestAnimationFrame(resolve),
      );
      if (frame >= 5) intervals[mode].push(now - previous);
      previous = now;
      const before = performance.now();
      work();
      if (frame >= 5) cpu[mode].push(performance.now() - before);
    }
  }
  return {
    count,
    exactEquivalentSamples: count,
    stride,
    startupMilliseconds,
    sharedInputBytes: seeds.byteLength + ordinals.byteLength + times.byteLength,
    extraBatchBytes: packed.byteLength,
    extraChunkBytes: chunk.byteLength,
    checksum,
    samplingMilliseconds: {
      scalar: stats(sampling.scalar),
      batchIncludingPacking: stats(sampling.batch),
      chunkedIncludingPacking: stats(sampling.chunked),
    },
    canvasSubmissionMilliseconds: Object.fromEntries(
      Object.entries(cpu).map(([key, values]) => [key, stats(values)]),
    ),
    frameIntervalsMilliseconds: Object.fromEntries(
      Object.entries(intervals).map(([key, values]) => [
        key,
        {
          ...stats(values),
          over25ms: values.filter((value) => value > 25).length,
          frames: values.length,
        },
      ]),
    ),
  };
}
