import { afterEach, expect, it, vi } from "vitest";
import { crc, Rectangle, useTexture, type Texture } from "@crc/core";
import {
  marble,
  paper,
  cellular,
  reactionDiffusion,
  type InkMessage,
} from "@crc/core/textures";
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
function canvas() {
  const surface = document.createElement("canvas");
  surface.width = surface.height = 64;
  document.body.append(surface);
  return surface;
}
function memorySpy() {
  const NativeMemory = WebAssembly.Memory;
  return vi
    .spyOn(WebAssembly, "Memory")
    .mockImplementation(function (descriptor) {
      return new NativeMemory(descriptor);
    });
}
for (const [name, factory] of Object.entries({ marble, paper, cellular })) {
  it(`${name} reuses fixed memory for parameters and palette, replaces it on resize, and idles`, () => {
    const driver = new ManualSchedulerDriver(),
      restore = installSchedulerDriverForTest(driver);
    const grow = vi.spyOn(WebAssembly.Memory.prototype, "grow"),
      memory = memorySpy();
    const uploads = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      "putImageData",
    );
    const surface = canvas();
    function Scene({
      seed = 42,
      size = 32,
      palette = ["#000000", "#ffffff"],
    }: {
      seed?: number;
      size?: number;
      palette?: string[];
    }) {
      const texture = useTexture(factory({ seed }), {
        resolution: { width: size, height: size },
        palette,
      });
      return <Rectangle style={{ width: 64, height: 64, fill: texture }} />;
    }
    const controller = crc(surface, <Scene />);
    try {
      driver.flush(0);
      const first = uploads.mock.calls.at(-1)![0],
        pixels = first.data.slice();
      expect(first.data.buffer).toBe(memory.mock.results[0].value.buffer);
      crc(surface, <Scene seed={91} />);
      driver.flush(16);
      driver.flush(17);
      expect(uploads.mock.calls.at(-1)![0]).toBe(first);
      expect(first.data).not.toEqual(pixels);
      const changed = first.data.slice();
      crc(surface, <Scene seed={91} palette={["#ff0000", "#0000ff"]} />);
      driver.flush(32);
      driver.flush(33);
      expect(first.data).not.toEqual(changed);
      expect(memory).toHaveBeenCalledTimes(1);
      crc(surface, <Scene size={48} />);
      driver.flush(48);
      driver.flush(49);
      expect(memory).toHaveBeenCalledTimes(2);
      expect(uploads.mock.calls.at(-1)![0].data.buffer).toBe(
        memory.mock.results[1].value.buffer,
      );
      expect(grow).not.toHaveBeenCalled();
      expect(driver.pendingHostFrames).toBe(0);
    } finally {
      controller.dispose();
      restore();
    }
  });
}
it("ink orders pause, stir, paint, and reset without replacing live memory except on reset", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const grow = vi.spyOn(WebAssembly.Memory.prototype, "grow"),
    memory = memorySpy();
  const uploads = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "putImageData",
  );
  const surface = canvas();
  let ink!: Texture<InkMessage>;
  function Scene() {
    ink = useTexture(reactionDiffusion({ preset: "stripes" }), {
      resolution: { width: 64, height: 64 },
    });
    return <Rectangle style={{ width: 64, height: 64, fill: ink }} />;
  }
  const controller = crc(surface, <Scene />);
  const pixels = () => uploads.mock.calls.at(-1)![0].data.slice();
  try {
    driver.flush(0);
    const original = pixels();
    ink.send({ type: "pause", paused: true });
    driver.flush(16);
    expect(driver.pendingHostFrames).toBe(0);
    ink.send({ type: "paint", u: 0.5, v: 0.5, radius: 10, strength: 1 });
    ink.send({ type: "stir", u: 0.5, v: 0.5, du: 0.1, dv: 0.1, radius: 18 });
    driver.flush(32);
    expect(pixels()).not.toEqual(original);
    expect(memory).toHaveBeenCalledTimes(1);
    ink.send({ type: "reset" });
    driver.flush(48);
    expect(pixels()).toEqual(original);
    expect(memory).toHaveBeenCalledTimes(2);
    ink.send({ type: "pause", paused: false });
    driver.flush(64);
    driver.flush(80);
    expect(pixels()).toEqual(original);
    driver.flush(96);
    expect(pixels()).not.toEqual(original);
    expect(memory).toHaveBeenCalledTimes(2);
    expect(grow).not.toHaveBeenCalled();
  } finally {
    controller.dispose();
    restore();
  }
  ink.send({ type: "stir", u: 0.5, v: 0.5, du: 0.1, dv: 0 });
  expect(driver.pendingHostFrames).toBe(0);
});
for (const change of [
  { radius: 0 },
  { radius: 129 },
  { radius: NaN },
  { du: Infinity },
  { dv: 1.01 },
  { u: NaN },
]) {
  it(`rejects invalid stir ${JSON.stringify(change)} without publishing damaged pixels`, () => {
    const driver = new ManualSchedulerDriver(),
      restore = installSchedulerDriverForTest(driver),
      surface = canvas();
    let ink!: Texture<InkMessage>;
    function Scene() {
      ink = useTexture(reactionDiffusion(), {
        resolution: { width: 32, height: 32 },
      });
      return <Rectangle style={{ width: 64, height: 64, fill: ink }} />;
    }
    const controller = crc(surface, <Scene />);
    const pixels = () =>
      surface.getContext("2d")!.getImageData(0, 0, 64, 64).data;
    try {
      driver.flush(0);
      ink.send({ type: "pause", paused: true });
      driver.flush(16);
      const before = pixels();
      ink.send({ type: "stir", u: 0.5, v: 0.5, du: 0.1, dv: 0, ...change });
      expect(() => driver.flush(32)).toThrow("Invalid ink stir message");
      expect(pixels()).toEqual(before);
      ink.send({ type: "stir", u: -0.01, v: 0.5, du: 0.1, dv: 0 });
      driver.flush(48);
      expect(pixels()).toEqual(before);
      ink.send({ type: "paint", u: 0.5, v: 0.5 });
      driver.flush(64);
      expect(pixels()).not.toEqual(before);
    } finally {
      controller.dispose();
      if (driver.pendingHostFrames) driver.flush(80);
      restore();
    }
  });
}

it("fails explicitly when WASM allocation is unavailable and leaves no scheduled work after disposal", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver),
    surface = canvas();
  vi.spyOn(WebAssembly, "Memory").mockImplementation(function () {
    throw new Error("WASM allocation unavailable");
  });
  function Scene() {
    const texture = useTexture(marble());
    return <Rectangle style={{ width: 64, height: 64, fill: texture }} />;
  }
  const controller = crc(surface, <Scene />);
  try {
    expect(() => driver.flush(0)).toThrow("WASM allocation unavailable");
  } finally {
    controller.dispose();
    if (driver.pendingHostFrames) driver.flush(16);
    restore();
  }
  expect(driver.pendingHostFrames).toBe(0);
});
