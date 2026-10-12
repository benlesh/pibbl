import { afterEach, expect, it, vi } from "vitest";
import { pibbl, Rectangle } from "@pibbl/core";
import {
  ReactionDiffusion,
  ProceduralTexture,
  type TextureRenderer,
} from "@pibbl/core/textures";
import { InkSimulation } from "../../../src/features/textures/lib/simulation.js";
import { TextureRaster } from "../../../src/features/textures/lib/presentation.js";
import { clearSharedState } from "../../../src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";
import {
  pointerDownLogicalPoint,
  pointerUpLogicalPoint,
} from "../../support/user-input.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
function canvas() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 80;
  document.body.append(c);
  return c;
}
function bytes(c: HTMLCanvasElement) {
  return Array.from(c.getContext("2d")!.getImageData(0, 0, 128, 80).data);
}

it("advances fixed steps, caps a long gap, and resumes without charging paused time", () => {
  const d = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(d),
    c = canvas();
  const advance = vi.spyOn(InkSimulation.prototype, "advance");
  const scene = (paused = false) => (
    <ReactionDiffusion
      paused={paused}
      resolution={{ width: 64, height: 40 }}
      style={{ width: 128, height: 80 }}
    />
  );
  const controller = pibbl(c, scene());
  try {
    d.flush(0);
    expect(advance).not.toHaveBeenCalled();
    d.flush(1000 / 60);
    expect(advance).toHaveBeenLastCalledWith(8);
    d.flush(10000);
    expect(advance).toHaveBeenLastCalledWith(24);
    pibbl(c, scene(true));
    d.flush(10016);
    expect(d.pendingHostFrames).toBe(0);
    const count = advance.mock.calls.length;
    pibbl(c, scene(false));
    d.flush(60000);
    expect(advance).toHaveBeenCalledTimes(count);
    d.flush(60000 + 1000 / 60);
    expect(advance).toHaveBeenLastCalledWith(8);
  } finally {
    controller.dispose();
    clearSharedState();
    restore();
  }
});
it("recolors without stepping or replacing the source and keeps output independent of display density", () => {
  const d = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(d),
    c = canvas();
  const advance = vi.spyOn(InkSimulation.prototype, "advance");
  const sources: OffscreenCanvas[] = [];
  const render: TextureRenderer = (ctx, t) => {
    sources.push(t.source);
    ctx.drawImage(t.source, 0, 0, t.width, t.height);
  };
  const scene = (palette: readonly string[]) => (
    <ReactionDiffusion
      paused
      render={render}
      palette={palette}
      resolution={{ width: 64, height: 40 }}
      style={{ width: 128, height: 80 }}
    />
  );
  const previousRatio = window.devicePixelRatio;
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 1,
  });
  const controller = pibbl(c, scene(["#000000", "#ffffff"]), {
    pixelRatio: "device",
  });
  try {
    d.flush(0);
    const first = bytes(c);
    pibbl(c, scene(["#331122", "#ffffaa"]));
    d.flush(16);
    expect(bytes(c)).not.toEqual(first);
    expect(sources[1]).toBe(sources[0]);
    expect(advance).not.toHaveBeenCalled();
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
    window.dispatchEvent(new Event("resize"));
    d.flush(32);
    expect(sources.at(-1)).toBe(sources[0]);
    expect(sources[0].width).toBe(64);
    expect(c.width).toBe(256);
  } finally {
    controller.dispose();
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: previousRatio,
    });
    clearSharedState();
    restore();
  }
});
it("shares one host frame across instances and releases all owned surfaces exactly once", () => {
  const d = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(d);
  const simulationDispose = vi.spyOn(InkSimulation.prototype, "dispose"),
    rasterDispose = vi.spyOn(TextureRaster.prototype, "dispose");
  const sources: OffscreenCanvas[] = [];
  const render: TextureRenderer = (ctx, t) => {
    sources.push(t.source, t.mask);
    ctx.drawImage(t.source, 0, 0, t.width, t.height);
  };
  const a = pibbl(
    canvas(),
    <ReactionDiffusion render={render} style={{ width: 128, height: 80 }} />,
  );
  const b = pibbl(
    canvas(),
    <ProceduralTexture
      kind="marble"
      render={render}
      style={{ width: 128, height: 80 }}
    />,
  );
  try {
    expect(d.pendingHostFrames).toBe(1);
    d.flush(0);
    expect(d.pendingHostFrames).toBe(1);
    a.dispose();
    a.dispose();
    b.dispose();
    b.dispose();
    expect(simulationDispose).toHaveBeenCalledTimes(1);
    expect(rasterDispose).toHaveBeenCalledTimes(2);
    expect(sources.every((s) => s.width === 0 && s.height === 0)).toBe(true);
    expect(d.pendingHostFrames).toBe(0);
  } finally {
    a.dispose();
    b.dispose();
    restore();
  }
});
it("does not paint through a later Pibbl target", async () => {
  const d = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(d),
    c = canvas();
  let clicks = 0;
  const controller = pibbl(
    c,
    <>
      <ReactionDiffusion
        paused
        resolution={{ width: 64, height: 40 }}
        style={{ width: 128, height: 80 }}
      />
      <Rectangle
        onPointerDown={() => clicks++}
        style={{ left: 0, top: 0, width: 64, height: 80, fill: "#ff0000" }}
      />
    </>,
  );
  try {
    d.flush(0);
    const before = bytes(c);
    await pointerDownLogicalPoint(c, { x: 24, y: 24 });
    await pointerUpLogicalPoint(c, { x: 24, y: 24 });
    expect(clicks).toBe(1);
    expect(d.pendingHostFrames).toBe(0);
    expect(bytes(c)).toEqual(before);
  } finally {
    controller.dispose();
    clearSharedState();
    restore();
  }
});
it("cleans up a failing renderer", () => {
  const d = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(d),
    c = canvas();
  const dispose = vi.spyOn(TextureRaster.prototype, "dispose");
  let source: OffscreenCanvas | undefined;
  const controller = pibbl(
    c,
    <ReactionDiffusion
      render={(_ctx, t) => {
        source = t.source;
        throw new Error("bad artwork");
      }}
      style={{ width: 128, height: 80 }}
    />,
  );
  try {
    expect(() => d.flush(0)).not.toThrow();
    expect(() => d.flush(16)).toThrow("bad artwork");
    controller.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(source?.width).toBe(0);
    expect(d.pendingHostFrames).toBe(0);
  } finally {
    controller.dispose();
    clearSharedState();
    restore();
  }
});

it.each([
  { seed: -1 },
  { resolution: { width: 0, height: 40 } },
  { resolution: { width: 1024, height: 1024 } },
  { palette: ["#ffffff"] },
  { brush: { radius: Infinity, strength: 0.5 } },
  { brush: { radius: 3, strength: 2 } },
  { resetRevision: 1.5 },
])(
  "rejects invalid texture input without leaving scheduled work: %j",
  (props) => {
    const driver = new ManualSchedulerDriver(),
      restore = installSchedulerDriverForTest(driver);
    const controller = pibbl(
      canvas(),
      <ReactionDiffusion {...props} style={{ width: 128, height: 80 }} />,
    );
    try {
      expect(() => driver.flush(0)).toThrow();
      controller.dispose();
      expect(driver.pendingHostFrames).toBe(0);
    } finally {
      controller.dispose();
      restore();
    }
  },
);
