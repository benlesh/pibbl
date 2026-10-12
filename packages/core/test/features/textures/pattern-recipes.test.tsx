import { afterEach, expect, it, vi } from "vitest";
import { pibbl, Rectangle, useTexture, type TextureRecipe } from "@pibbl/core";
import * as textures from "@pibbl/core/textures";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";
import { clearSharedState } from "../../../src/lib/global-state.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function harness<Message>(recipe: TextureRecipe<Message>, resolution = 65) {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const uploads = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "putImageData",
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = resolution;
  document.body.append(canvas);
  function Scene({
    input = recipe,
    palette = ["#000000", "#ffffff"],
  }: {
    input?: TextureRecipe<Message>;
    palette?: string[];
  }) {
    const texture = useTexture(input, {
      resolution: { width: resolution, height: resolution },
      palette,
    });
    return <Rectangle style={{ width: 65, height: 65, fill: texture }} />;
  }
  const controller = pibbl(canvas, <Scene />);
  const pixels = () => uploads.mock.calls.at(-1)![0].data.slice();
  return {
    driver,
    pixels,
    update(input: TextureRecipe<Message>, palette?: string[]) {
      pibbl(canvas, <Scene input={input} palette={palette} />);
      driver.flush(16);
      driver.flush(17);
    },
    dispose() {
      controller.dispose();
      restore();
    },
  };
}

it("stripes expose a recolorable, resizable periodic fill and idle at zero speed", () => {
  expect(typeof textures.stripes).toBe("function");
  const h = harness(textures.stripes({ bands: 4, dutyCycle: 0.5 }));
  try {
    h.driver.flush(0);
    const first = h.pixels();
    expect(first[4 * 4]).toBe(255);
    expect(first[12 * 4]).toBe(0);
    for (let y = 0; y < 65; y++)
      expect(first.slice(y * 65 * 4, y * 65 * 4 + 4)).toEqual(
        first.slice((y * 65 + 64) * 4, (y * 65 + 65) * 4),
      );
    expect(h.driver.pendingHostFrames).toBe(0);
    h.update(textures.stripes({ bands: 8 }), ["#112233", "#ccddff"]);
    expect(h.pixels()).not.toEqual(first);
    expect(h.driver.pendingHostFrames).toBe(0);
  } finally {
    h.dispose();
  }
});

it("checkers alternate two palette endpoints with even rows and columns", () => {
  expect(typeof textures.checkers).toBe("function");
  const h = harness(textures.checkers({ columns: 4, rows: 4 }));
  try {
    h.driver.flush(0);
    const p = h.pixels(),
      at = (x: number, y: number) => p[(y * 65 + x) * 4];
    expect(at(8, 8)).toBe(0);
    expect(at(24, 8)).toBe(255);
    expect(at(24, 24)).toBe(0);
    expect(at(0, 8)).toBe(at(64, 8));
    expect(at(8, 0)).toBe(at(8, 64));
    expect(h.driver.pendingHostFrames).toBe(0);
  } finally {
    h.dispose();
  }
});

it("wood grain is seeded, periodic on both axes, and changes with distortion and motion", () => {
  expect(typeof textures.woodGrain).toBe("function");
  const h = harness(
    textures.woodGrain({ seed: 42, grain: 12, distortion: 0.6, speed: 0.5 }),
  );
  try {
    h.driver.flush(0);
    const first = h.pixels();
    expect(new Set(first).size).toBeGreaterThan(20);
    for (let y = 0; y < 65; y++)
      expect(first.slice(y * 65 * 4, y * 65 * 4 + 4)).toEqual(
        first.slice((y * 65 + 64) * 4, (y * 65 + 65) * 4),
      );
    expect(first.slice(0, 65 * 4)).toEqual(first.slice(64 * 65 * 4));
    h.driver.flush(16);
    h.driver.flush(500);
    expect(h.pixels()).not.toEqual(first);
    h.update(
      textures.woodGrain({ seed: 42, grain: 12, distortion: 0.6, speed: 0 }),
    );
    expect(h.driver.pendingHostFrames).toBe(0);
  } finally {
    h.dispose();
  }
});

it("expanded Gray–Scott presets produce distinct seeded fields through public fills", () => {
  expect(textures.grayScottPresets).toBeDefined();
  const outputs: Uint8ClampedArray[] = [];
  for (const preset of [
    "spots",
    "stripes",
    "coral",
    "worms",
    "labyrinths",
    "mitosis",
  ] as const) {
    const h = harness(
      textures.reactionDiffusion({ preset, warmupSteps: 1200 }),
    );
    try {
      h.driver.flush(0);
      outputs.push(h.pixels());
    } finally {
      h.dispose();
    }
  }
  for (let i = 0; i < outputs.length; i++) {
    expect(new Set(outputs[i]).size).toBeGreaterThan(10);
    for (let j = 0; j < i; j++) expect(outputs[i]).not.toEqual(outputs[j]);
  }
});

it("explicit Gray–Scott rates reproduce the curated chemistry with the same seed", () => {
  const preset = harness(
    textures.reactionDiffusion({ preset: "coral", warmupSteps: 1200 }),
  );
  let expected: Uint8ClampedArray;
  try {
    preset.driver.flush(0);
    expected = preset.pixels();
  } finally {
    preset.dispose();
  }
  const custom = harness(
    textures.reactionDiffusion({
      preset: "spots",
      ...textures.grayScottPresets.coral,
      warmupSteps: 1200,
    }),
  );
  try {
    custom.driver.flush(0);
    expect(custom.pixels()).toEqual(expected);
  } finally {
    custom.dispose();
  }
});

it("wood grain can add optional seeded knots without losing either repeat seam", () => {
  expect(typeof textures.woodGrain).toBe("function");
  const plain = harness(textures.woodGrain({ seed: 42, grain: 12, knots: 0 }));
  let original: Uint8ClampedArray;
  try {
    plain.driver.flush(0);
    original = plain.pixels();
  } finally {
    plain.dispose();
  }
  const knotted = harness(
    textures.woodGrain({ seed: 42, grain: 12, knots: 2, knotSize: 0.15 }),
  );
  try {
    knotted.driver.flush(0);
    const pixels = knotted.pixels();
    expect(pixels).not.toEqual(original);
    expect(pixels.slice(0, 65 * 4)).toEqual(pixels.slice(64 * 65 * 4));
    for (let y = 0; y < 65; y++)
      expect(pixels.slice(y * 65 * 4, y * 65 * 4 + 4)).toEqual(
        pixels.slice((y * 65 + 64) * 4, (y * 65 + 65) * 4),
      );
    expect(knotted.driver.pendingHostFrames).toBe(0);
    knotted.update(textures.woodGrain({ seed: 42, grain: 12, knots: 0 }));
    expect(knotted.pixels()).toEqual(original);
    knotted.update(textures.woodGrain({ seed: 91, grain: 12, knots: 0 }));
    expect(knotted.pixels()).not.toEqual(original);
  } finally {
    knotted.dispose();
  }
});

it("a wood knot pushes adjacent growth lines outward rather than pulling them inward", () => {
  // Seed 42 places its first knot at (0.160428, 0.980152). Observe the
  // dark growth line to its right, outside the core, across the wrapped seam.
  const ridge = (knots: number) => {
    const h = harness(
      textures.woodGrain({
        seed: 42,
        grain: 8,
        distortion: 0,
        roughness: 0,
        knots,
        knotSize: 0.12,
      }),
      257,
    );
    try {
      h.driver.flush(0);
      const pixels = h.pixels();
      let darkest = Infinity,
        position = 0;
      for (let x = 58; x <= 84; x++) {
        const value = pixels[(251 * 257 + x) * 4];
        if (value < darkest) {
          darkest = value;
          position = x / 256;
        }
      }
      return position;
    } finally {
      h.dispose();
    }
  };
  expect(ridge(1)).toBeGreaterThan(ridge(0) + 0.02);
});

it("fabric recipes expose distinct seamless seeded weaves with adjustable thread geometry", () => {
  const outputs: Uint8ClampedArray[] = [];
  for (const factory of [
    textures.plainWeave,
    textures.twill,
    textures.herringbone,
  ]) {
    expect(typeof factory).toBe("function");
    const h = harness(
      factory({ threads: 16, seed: 42, threadWidth: 0.7, fuzz: 0.4 }),
    );
    try {
      h.driver.flush(0);
      const pixels = h.pixels();
      outputs.push(pixels);
      expect(pixels.slice(0, 65 * 4)).toEqual(pixels.slice(64 * 65 * 4));
      for (let y = 0; y < 65; y++)
        expect(pixels.slice(y * 65 * 4, y * 65 * 4 + 4)).toEqual(
          pixels.slice((y * 65 + 64) * 4, (y * 65 + 65) * 4),
        );
      expect(h.driver.pendingHostFrames).toBe(0);
      h.update(
        factory({ threads: 16, seed: 42, threadWidth: 0.95, fuzz: 0.4 }),
      );
      expect(h.pixels()).not.toEqual(pixels);
      const wider = h.pixels();
      h.update(
        factory({ threads: 16, seed: 91, threadWidth: 0.95, fuzz: 0.4 }),
      );
      expect(h.pixels()).not.toEqual(wider);
    } finally {
      h.dispose();
    }
  }
  for (let i = 0; i < outputs.length; i++)
    for (let j = 0; j < i; j++) expect(outputs[i]).not.toEqual(outputs[j]);
});

it("fabric crossing centers match plain, 2/2 twill, and CottonWorks' broken herringbone drawdown", () => {
  // CottonWorks Weaving 101, pp. 22–23. One means warp on top.
  // Twill may be translated/reflected without changing its 2/2 structure.
  const examples = [
    {
      factory: textures.plainWeave,
      rows: ["10101010", "01010101", "10101010", "01010101"],
    },
    {
      factory: textures.twill,
      rows: ["11001100", "01100110", "00110011", "10011001"],
    },
    {
      factory: textures.herringbone,
      rows: ["00110011", "01101001", "11001100", "10010110"],
    },
  ];
  for (const { factory, rows } of examples) {
    const h = harness(factory({ threads: 8, relief: 0, fuzz: 0 }), 257);
    try {
      h.driver.flush(0);
      const pixels = h.pixels();
      const observed = rows.map((_, y) =>
        Array.from({ length: 8 }, (_, x) =>
          pixels[((y * 32 + 16) * 257 + x * 32 + 16) * 4] > 128 ? "1" : "0",
        ).join(""),
      );
      expect(observed).toEqual(rows);
    } finally {
      h.dispose();
    }
  }
});

it("fuzzy yarn has gradual edge coverage instead of an abrupt pixel step", () => {
  const h = harness(
    textures.plainWeave({ threads: 8, threadWidth: 0.8, fuzz: 0.8, relief: 0 }),
    257,
  );
  try {
    h.driver.flush(0);
    const pixels = h.pixels();
    const changes = Array.from({ length: 9 }, (_, x) =>
      Math.abs(pixels[(x + 1) * 4] - pixels[x * 4]),
    );
    expect(Math.max(...changes)).toBeLessThan(35);
    expect(pixels[8 * 4]).toBeGreaterThan(pixels[0]);
  } finally {
    h.dispose();
  }
});
