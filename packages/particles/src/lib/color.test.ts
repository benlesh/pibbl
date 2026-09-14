import { describe, expect, it } from "vitest";
import { parseParticleColor } from "./color.js";

describe("particle color normalization", () => {
  it("normalizes every accepted Project 1 color family into finite sRGB RGBA", () => {
    expect(parseParticleColor("#0f08")).toEqual([0, 1, 0, 8 / 15]);
    expect(parseParticleColor("#336699cc")).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(parseParticleColor("rgb(255, 128, 0)")).toEqual([
      1,
      128 / 255,
      0,
      1,
    ]);
    expect(parseParticleColor("rgb(100% 0% 50% / 25%)")).toEqual([
      1, 0, 0.5, 0.25,
    ]);
    expect(parseParticleColor("rgba(0, 128, 255, 0.5)")).toEqual([
      0,
      128 / 255,
      1,
      0.5,
    ]);
    expect(parseParticleColor("hsl(120deg 100% 25% / .25)")).toEqual([
      0, 0.5, 0, 0.25,
    ]);
    expect(parseParticleColor("hsla(240, 100%, 50%, 50%)")).toEqual([
      0, 0, 1, 0.5,
    ]);
    expect(parseParticleColor("transparent")).toEqual([0, 0, 0, 0]);
    expect(parseParticleColor("rebeccapurple")).toEqual([0.4, 0.2, 0.6, 1]);
  });

  it("caches the immutable normalization for identical canonical source strings", () => {
    const first = parseParticleColor("  REBECCAPURPLE ");
    const second = parseParticleColor("rebeccapurple");

    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it.each([
    "currentColor",
    "CanvasText",
    "color(display-p3 1 0 0)",
    "lab(50% 0 0)",
    "rgb(from red r g b)",
    "rgb(,0,0)",
    "rgb(0,,0)",
    "rgba(0,0,0,)",
    "rgb(0 0 0 /)",
    "hsl(, 100%, 50%)",
    "rgb(% 0 0)",
    "hsl(deg 100% 50%)",
    "rgb(0x10 0 0)",
    "not-a-color",
  ])("rejects contextual or out-of-grammar color %s", (color) => {
    expect(() => parseParticleColor(color)).toThrowError(
      /particle color.*unsupported/i,
    );
  });

  it.each([
    "rgb(0 0 / 0)",
    "rgb(0 0 0 0.5)",
    "hsl(0 0% / 0%)",
    "hsl(0 0% 0% 0.5)",
  ])(
    "rejects functional color with invalid separator structure %s",
    (color) => {
      expect(() => parseParticleColor(color)).toThrowError(
        /particle color.*unsupported/i,
      );
    },
  );
});
