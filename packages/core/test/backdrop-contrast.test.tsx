import { expect, it, vi } from "vitest";
import { Group, Rectangle, Text, Clip, signal, pibbl } from "@pibbl/core";
import { backdropContrast, opacity } from "@pibbl/core/filters";
import { testRuntime } from "./features/viz/support/runtime.js";

import { getPibblInstance } from "../src/lib/global-state.js";
import { peekBackdropContrastService } from "../src/filters/render-backdrop-contrast-boundary.js";

function pixel(canvas: HTMLCanvasElement, x: number, y: number) {
  return [...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data];
}
it("selects black and white per backdrop pixel within one silhouette", () => {
  const runtime = testRuntime();
  try {
    const canvas = runtime.mount(
      <Group>
        <Rectangle style={{ width: 200, height: 80, fill: "white" }} />
        <Rectangle
          style={{ left: 100, width: 100, height: 80, fill: "black" }}
        />
        <Rectangle
          style={{
            left: 20,
            top: 20,
            width: 160,
            height: 40,
            fill: "red",
            filter: backdropContrast(),
          }}
        />
      </Group>,
    );
    runtime.flush();
    expect(pixel(canvas, 50, 40)).toEqual([0, 0, 0, 255]);
    expect(pixel(canvas, 150, 40)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 10, 40)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 190, 40)).toEqual([0, 0, 0, 255]);
  } finally {
    runtime.dispose();
  }
});
it("maps custom signal colors through transformed geometry and updates against a changing backdrop", () => {
  const runtime = testRuntime();
  const light = signal("#ffff00"),
    dark = signal("#000080"),
    background = signal("black");
  try {
    const canvas = runtime.mount(
      <Group>
        <Rectangle style={{ width: 300, height: 100, fill: background }} />
        <Group style={{ translateX: 50, scaleX: 2 }}>
          <Rectangle
            style={{
              left: 10,
              top: 20,
              width: 40,
              height: 40,
              fill: "red",
              filter: backdropContrast({ light, dark }),
            }}
          />
        </Group>
      </Group>,
    );
    runtime.flush();
    expect(pixel(canvas, 150, 40)).toEqual([255, 255, 0, 255]);
    background.set("white");
    runtime.flush();
    expect(pixel(canvas, 150, 40)).toEqual([0, 0, 128, 255]);
    dark.set("#800000");
    runtime.flush();
    expect(pixel(canvas, 150, 40)).toEqual([128, 0, 0, 255]);
  } finally {
    runtime.dispose();
  }
});
it("preserves source alpha and ordered filter composition", () => {
  const runtime = testRuntime();
  try {
    const canvas = runtime.mount(
      <Group>
        <Rectangle style={{ width: 200, height: 80, fill: "black" }} />
        <Rectangle
          style={{
            left: 20,
            top: 20,
            width: 160,
            height: 40,
            fill: "red",
            filter: [backdropContrast(), opacity({ amount: 0.5 })],
          }}
        />
      </Group>,
    );
    runtime.flush();
    const actual = pixel(canvas, 50, 40);
    expect(actual[0]).toBeGreaterThanOrEqual(126);
    expect(actual[0]).toBeLessThanOrEqual(129);
    expect(actual[0]).toBe(actual[1]);
    expect(actual[3]).toBe(255);
  } finally {
    runtime.dispose();
  }
});

it("uses linear luminance at the black/white contrast boundary and treats transparent backdrop as white", () => {
  const runtime = testRuntime();
  try {
    const canvas = runtime.mount(
      <Group>
        <Rectangle style={{ width: 100, height: 80, fill: "#757575" }} />
        <Rectangle
          style={{ left: 100, width: 100, height: 80, fill: "#767676" }}
        />
        <Rectangle
          style={{
            top: 20,
            width: 300,
            height: 40,
            fill: "red",
            filter: backdropContrast(),
          }}
        />
      </Group>,
    );
    runtime.flush();
    expect(pixel(canvas, 50, 40)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 150, 40)).toEqual([0, 0, 0, 255]);
    expect(pixel(canvas, 250, 40)).toEqual([0, 0, 0, 255]);
    expect(pixel(canvas, 250, 90)).toEqual([0, 0, 0, 0]);
  } finally {
    runtime.dispose();
  }
});

it("preserves text antialiasing and ancestor clipping without reading scene pixels back", () => {
  const runtime = testRuntime();
  const clip = new Path2D();
  clip.rect(0, 0, 75, 80);
  try {
    const canvas = runtime.mount(
      <Group>
        <Rectangle
          style={{ left: 100, width: 100, height: 80, fill: "black" }}
        />
        <Text
          style={{
            left: 5,
            top: 45,
            font: "32px sans-serif",
            fill: "red",
            filter: opacity({ amount: 1 }),
          }}
        >
          Mask
        </Text>
        <Clip style={{ left: 100, d: clip }}>
          <Text
            style={{
              left: 5,
              top: 45,
              font: "32px sans-serif",
              fill: "red",
              filter: backdropContrast(),
            }}
          >
            Mask
          </Text>
        </Clip>
      </Group>,
    );
    const read2d = vi
      .spyOn(CanvasRenderingContext2D.prototype, "getImageData")
      .mockImplementation(() => {
        throw new Error("scene readback");
      });
    const readOffscreen = vi
      .spyOn(OffscreenCanvasRenderingContext2D.prototype, "getImageData")
      .mockImplementation(() => {
        throw new Error("scene readback");
      });
    const readGl = vi.spyOn(WebGL2RenderingContext.prototype, "readPixels");
    runtime.flush();
    expect(read2d).not.toHaveBeenCalled();
    expect(readOffscreen).not.toHaveBeenCalled();
    expect(readGl).not.toHaveBeenCalled();
    read2d.mockRestore();
    readOffscreen.mockRestore();
    const ctx = canvas.getContext("2d")!;
    const original = ctx.getImageData(0, 0, 75, 80).data;
    const recolored = ctx.getImageData(100, 0, 75, 80).data;
    let opaque = 0,
      antialiased = 0;
    for (let i = 0; i < original.length; i += 4) {
      if (original[i + 3] === 255) opaque++;
      if (original[i + 3] > 0 && original[i + 3] < 255) antialiased++;
      expect(
        Math.abs(original[i + 3] - recolored[i]),
        JSON.stringify({
          x: (i / 4) % 75,
          y: Math.floor(i / 4 / 75),
          original: original[i + 3],
          recolored: recolored[i],
        }),
      ).toBeLessThanOrEqual(2);
    }
    expect(opaque).toBeGreaterThan(30);
    expect(antialiased).toBeGreaterThan(30);
    expect(pixel(canvas, 180, 35)).toEqual([0, 0, 0, 255]);
  } finally {
    runtime.dispose();
  }
});
it("reuses its owner and releases GPU resources when removed and disposed", () => {
  const runtime = testRuntime();
  const visible = signal(true),
    light = signal("white");
  function Scene() {
    return (
      <Rectangle
        style={{
          width: 100,
          height: 50,
          fill: "red",
          filter: visible.get() ? backdropContrast({ light }) : undefined,
        }}
      />
    );
  }
  let finalDispose: ReturnType<typeof vi.spyOn> | undefined;
  try {
    const canvas = runtime.mount(<Scene />);
    runtime.flush();
    const instance = getPibblInstance(canvas),
      first = peekBackdropContrastService(instance)!;
    expect(first).toBeDefined();
    const dispose = vi.spyOn(first.gpu, "dispose");
    light.set("yellow");
    runtime.flush();
    expect(peekBackdropContrastService(instance)).toBe(first);
    visible.set(false);
    runtime.flush();
    expect(peekBackdropContrastService(instance)).toBeUndefined();
    expect(dispose).toHaveBeenCalledTimes(1);
    visible.set(true);
    runtime.flush();
    const second = peekBackdropContrastService(instance)!;
    expect(second).not.toBe(first);
    finalDispose = vi.spyOn(second.gpu, "dispose");
  } finally {
    runtime.dispose();
  }
  expect(finalDispose).toHaveBeenCalledTimes(1);
});
it.each(["currentColor", "var(--foreground)", "not-a-color"])(
  "rejects unsupported or contextual colors before capture: %s",
  (dark) => {
    const runtime = testRuntime();
    try {
      const canvas = runtime.mount(
        <Rectangle
          style={{
            width: 80,
            height: 80,
            fill: "red",
            filter: backdropContrast({ dark }),
          }}
        />,
      );
      expect(() => runtime.flush()).toThrow(/filter.dark/);
      expect(
        peekBackdropContrastService(getPibblInstance(canvas)),
      ).toBeUndefined();
    } finally {
      runtime.dispose();
    }
  },
);

it("aligns the sampled backdrop under rotation at device pixel ratio two", () => {
  const runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = "width:100px;height:100px";
  document.body.append(canvas);
  const app = pibbl(
    canvas,
    <Group>
      <Rectangle style={{ width: 100, height: 100, fill: "white" }} />
      <Rectangle style={{ left: 50, width: 50, height: 100, fill: "black" }} />
      <Group style={{ left: 60, top: 20, rotationDegrees: 90 }}>
        <Rectangle
          style={{
            width: 40,
            height: 20,
            fill: "red",
            filter: backdropContrast(),
          }}
        />
      </Group>
    </Group>,
    { pixelRatio: 2 },
  );
  try {
    runtime.flush();
    expect(canvas.width).toBe(200);
    expect(pixel(canvas, 90, 80)).toEqual([0, 0, 0, 255]);
    expect(pixel(canvas, 110, 80)).toEqual([255, 255, 255, 255]);
  } finally {
    app.dispose();
    runtime.dispose();
  }
});
