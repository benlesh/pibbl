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
function harness(recipe: TextureRecipe, palette?: readonly string[]) {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const uploads = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "putImageData",
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 129;
  document.body.append(canvas);
  function Scene({
    input = recipe,
    colors = palette,
  }: {
    input?: TextureRecipe;
    colors?: readonly string[];
  }) {
    const texture = useTexture(input, {
      resolution: { width: 129, height: 129 },
      palette: colors,
    });
    return <Rectangle style={{ width: 129, height: 129, fill: texture }} />;
  }
  const controller = pibbl(canvas, <Scene />);
  driver.flush(0);
  return {
    driver,
    pixels: () => uploads.mock.calls.at(-1)![0].data.slice(),
    update(input: TextureRecipe, colors = palette) {
      pibbl(canvas, <Scene input={input} colors={colors} />);
      if (driver.pendingHostFrames) driver.flush(16);
      if (driver.pendingHostFrames) driver.flush(17);
    },
    dispose() {
      controller.dispose();
      restore();
    },
  };
}
function seams(p: Uint8ClampedArray) {
  expect(p.slice(0, 129 * 4)).toEqual(p.slice(128 * 129 * 4));
  for (let y = 0; y < 129; y++)
    expect(p.slice(y * 129 * 4, y * 129 * 4 + 4)).toEqual(
      p.slice((y * 129 + 128) * 4, (y * 129 + 129) * 4),
    );
}
it("polka dots have controlled centers, seeded jitter, recoloring, and seamless motion", () => {
  const h = harness(textures.polkaDots({ columns: 4, rows: 4, radius: 0.3 }), [
    "#000000",
    "#ffffff",
  ]);
  try {
    const first = h.pixels();
    expect(first[(16 * 129 + 16) * 4]).toBe(255);
    expect(first[0]).toBe(0);
    seams(first);
    expect(h.driver.pendingHostFrames).toBe(0);
    h.update(
      textures.polkaDots({
        columns: 4,
        rows: 4,
        jitter: 0.3,
        seed: 91,
        speed: 0.2,
      }),
      ["#112233", "#ffddaa"],
    );
    const jitter = h.pixels();
    expect(jitter).not.toEqual(first);
    h.driver.flush(500);
    expect(h.pixels()).not.toEqual(jitter);
    seams(h.pixels());
    h.update(textures.polkaDots());
    expect(h.driver.pendingHostFrames).toBe(0);
  } finally {
    h.dispose();
  }
});
it("halftone varies dot radius across a periodic tonal field", () => {
  const h = harness(
    textures.halftone({
      columns: 8,
      rows: 8,
      minRadius: 0.03,
      maxRadius: 0.45,
      cyclesX: 1,
      cyclesY: 1,
    }),
    ["#000000", "#ffffff"],
  );
  try {
    const first = h.pixels();
    seams(first);
    const count = (x: number, y: number) => {
      let n = 0;
      for (let j = 0; j < 16; j++)
        for (let i = 0; i < 16; i++)
          if (first[((y + j) * 129 + x + i) * 4] > 128) n++;
      return n;
    };
    expect(count(16, 16)).toBeGreaterThan(count(80, 80));
    h.update(textures.halftone({ phase: 0.3, speed: 0.1 }));
    h.driver.flush(500);
    expect(h.pixels()).not.toEqual(first);
    seams(h.pixels());
  } finally {
    h.dispose();
  }
});
it("plaid resolves named colors and relative band widths, blends crossings, and recolors without numeric selectors", () => {
  const colors = { paper: "#ffffff", ink: "#000000", accent: "#ff0000" };
  const options = {
    colors,
    horizontal: [
      { width: 3, color: "paper" },
      { width: 1, color: "accent" },
    ],
    vertical: [
      { width: 1, color: "ink" },
      { width: 1, color: "paper" },
    ],
    crossing: 0.25,
  } as const;
  const h = harness(textures.plaid(options));
  try {
    const first = h.pixels();
    expect(
      Array.from(first.slice((16 * 129 + 16) * 4, (16 * 129 + 16) * 4 + 3)),
    ).toEqual([64, 64, 64]);
    seams(first);
    h.update(
      textures.plaid({ ...options, colors: { ...colors, ink: "#0000ff" } }),
    );
    expect(h.pixels()).not.toEqual(first);
    expect(h.driver.pendingHostFrames).toBe(0);
    h.update(textures.plaid({ ...options, speed: 0.2 }));
    const before = h.pixels();
    h.driver.flush(500);
    expect(h.pixels()).not.toEqual(before);
    seams(h.pixels());
  } finally {
    h.dispose();
  }
  expect(() =>
    textures.plaid({
      ...options,
      horizontal: [{ width: 1, color: "missing" }],
    } as never),
  ).toThrow(/color/i);
});
it("Truchet arcs connect at every shared edge, use a deterministic seed, and remain seamless while moving", () => {
  const h = harness(
    textures.truchet({ columns: 4, rows: 4, lineWidth: 0.12, seed: 42 }),
    ["#000000", "#ffffff"],
  );
  try {
    const first = h.pixels();
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        expect(first[((y * 32 + 16) * 129 + x * 32) * 4]).toBeGreaterThan(200);
        expect(first[(y * 32 * 129 + x * 32 + 16) * 4]).toBeGreaterThan(200);
      }
    seams(first);
    h.update(
      textures.truchet({ columns: 4, rows: 4, lineWidth: 0.12, seed: 42 }),
    );
    expect(h.pixels()).toEqual(first);
    h.update(
      textures.truchet({
        columns: 4,
        rows: 4,
        lineWidth: 0.12,
        seed: 91,
        speed: 0.1,
      }),
    );
    expect(h.pixels()).not.toEqual(first);
    h.driver.flush(500);
    seams(h.pixels());
  } finally {
    h.dispose();
  }
});
