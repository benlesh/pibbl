import { afterEach, describe, expect, it, vi } from "vitest";
import { defineRenderLayer } from "../../index.js";
import { crc } from "../crc.js";
import { clearSharedState, getCRCInstance } from "../global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("defineRenderLayer", () => {
  it("keeps definitions inert and owns the initial lifecycle", () => {
    const calls: string[] = [];
    const TestLayer = defineRenderLayer<
      { color: string },
      { ctx: OffscreenCanvasRenderingContext2D }
    >({
      create(context, props) {
        calls.push(`create:${props.color}`);
        const ctx = context.canvas.getContext("2d");
        if (!ctx) throw new Error("missing test context");
        return { ctx };
      },
      update(_resources, props) {
        calls.push(`update:${props.color}`);
      },
      resize(_resources, size) {
        calls.push(
          `resize:${size.width}x${size.height}@${size.backingWidth}x${size.backingHeight}`,
        );
      },
      render(resources, frame) {
        calls.push(`render:${frame.frameId}:${frame.delta}`);
        resources.ctx.fillRect(0, 0, 8, 8);
      },
      dispose() {
        calls.push("dispose");
      },
    });

    expect(calls).toEqual([]);
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const canvas = createCanvas();
    const controller = crc(
      canvas,
      <TestLayer color="red" style={{ width: 20, height: 10 }} />,
      {
        pixelRatio: 2,
      },
    );

    try {
      driver.flush(100);
      expect(calls).toEqual(["create:red", "resize:20x10@40x20", "render:1:0"]);

      crc(canvas, <TestLayer color="blue" style={{ width: 20, height: 10 }} />);
      driver.flush(120);
      expect(calls.slice(-2)).toEqual(["update:blue", "render:2:20"]);

      crc(canvas, <TestLayer color="blue" style={{ width: 30, height: 10 }} />);
      driver.flush(140);
      expect(calls.slice(-2)).toEqual(["resize:30x10@60x20", "render:3:20"]);
    } finally {
      controller.dispose();
      restore();
    }

    expect(calls.filter((call) => call === "dispose")).toHaveLength(1);
  });

  it("resizes when backing density changes without a logical size change", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const priorRatio = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    const sizes: string[] = [];
    const Layer = defineRenderLayer<{}, {}>({
      create(context) { context.canvas.getContext('2d'); return {}; },
      resize(_resources, size) { sizes.push(`${size.width}x${size.height}@${size.backingWidth}x${size.backingHeight}`); },
      render() {},
    });
    const controller = crc(createCanvas(), <Layer style={{ width: 20, height: 10 }} />, { pixelRatio: 'device' });
    try {
      driver.flush(10);
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
      window.dispatchEvent(new Event('resize'));
      driver.flush(20);
      expect(sizes).toEqual(['20x10@20x10', '20x10@40x20']);
    } finally {
      controller.dispose();
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: priorRatio });
      restore();
    }
  });

  it("coalesces retained invalidation and ignores it after disposal", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    let invalidate: (() => void) | undefined;
    let renders = 0;
    const Layer = defineRenderLayer<{}, {}>({
      create(context) { context.canvas.getContext('2d'); invalidate = context.invalidate; return {}; },
      render() { renders++; },
    });
    const controller = crc(createCanvas(), <Layer style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      invalidate!();
      invalidate!();
      expect(driver.pendingHostFrames).toBe(1);
      driver.flush(20);
      expect(renders).toBe(2);
    } finally {
      controller.dispose();
      restore();
    }
    invalidate!();
    expect(driver.pendingHostFrames).toBe(0);
  });

  it("lets frame invalidation continuously schedule renders", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const frames: number[] = [];
    const Layer = defineRenderLayer<{}, {}>({
      create(context) { context.canvas.getContext('2d'); return {}; },
      render(_resources, frame) {
        frames.push(frame.frameId);
        if (frames.length < 3) frame.invalidate();
      },
    });
    const controller = crc(createCanvas(), <Layer style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      driver.flush(20);
      driver.flush(30);
      expect(frames).toHaveLength(3);
      expect(frames[1]).toBe(frames[0] + 1);
      expect(frames[2]).toBe(frames[1] + 1);
      expect(driver.pendingHostFrames).toBe(0);
    } finally {
      controller.dispose();
      restore();
    }
  });

  it("reuses the committed bitmap for an unrelated root traversal", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const transfer = vi.spyOn(OffscreenCanvas.prototype, "transferToImageBitmap");
    const Layer = defineRenderLayer<{}, {}>({
      create(context) { context.canvas.getContext('2d'); return {}; },
      render() {},
    });
    const canvas = createCanvas();
    const controller = crc(canvas, <Layer style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      expect(transfer).toHaveBeenCalledTimes(1);
      crc(canvas, <Layer style={{ width: 20, height: 10 }} />);
      driver.flush(20);
      expect(transfer).toHaveBeenCalledTimes(1);
    } finally {
      controller.dispose();
      restore();
    }
  });

  it("keeps valid on-prefixed custom props in update snapshots", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const updates: number[] = [];
    const Layer = defineRenderLayer<{ once: number }, {}>({
      create(context) { context.canvas.getContext('2d'); return {}; },
      update(_resources, props) { updates.push(props.once); },
      render() {},
    });
    const canvas = createCanvas();
    const controller = crc(canvas, <Layer once={1} style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      crc(canvas, <Layer once={2} style={{ width: 20, height: 10 }} />);
      driver.flush(20);
      expect(updates).toEqual([2]);
    } finally {
      controller.dispose();
      restore();
    }
  });

  it("snapshots lifecycle callbacks at definition time", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const original = vi.fn();
    const replacement = vi.fn();
    const definition = {
      create(context: any) { context.canvas.getContext('2d'); return {}; },
      render: original,
    };
    const Layer = defineRenderLayer(definition);
    definition.render = replacement;
    const controller = crc(createCanvas(), <Layer style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      expect(original).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
    } finally {
      controller.dispose();
      restore();
    }
  });

  it.each(["create", "update", "resize", "render"] as const)(
    "rejects thenables returned by %s",
    (callback) => {
      const driver = new ManualSchedulerDriver();
      const restore = installSchedulerDriverForTest(driver);
      const thenable = { then() {} };
      const definition = {
        create: (context: any) => {
          context.canvas.getContext('2d');
          return callback === "create" ? thenable : {};
        },
        update: () => callback === "update" ? thenable : undefined,
        resize: () => callback === "resize" ? thenable : undefined,
        render: () => callback === "render" ? thenable : undefined,
      } as any;
      const Layer = defineRenderLayer<{ value: number }, {}>(definition);
      const canvas = createCanvas();
      const controller = crc(canvas, <Layer value={0} style={{ width: 20, height: 10 }} />);
      try {
        if (callback === 'update') {
          driver.flush(5);
          crc(canvas, <Layer value={1} style={{ width: 20, height: 10 }} />);
        }
        expect(() => driver.flush(10)).toThrowError(
          `defineRenderLayer ${callback}() must be synchronous.`,
        );
      } finally {
        controller.dispose();
        restore();
      }
    },
  );

  it("rejects a thenable returned by dispose", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const Layer = defineRenderLayer<{}, {}>({
      create(context) { context.canvas.getContext('2d'); return {}; },
      render() {},
      dispose() { return { then() {} } as never; },
    });
    const canvas = createCanvas();
    const controller = crc(canvas, <Layer style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      const refs = Array.from(getCRCInstance(canvas).refs.values())[0]!;
      expect(() => (refs.refs[0] as { dispose(): void }).dispose()).toThrowError(
        'defineRenderLayer dispose() must be synchronous.',
      );
    } finally {
      controller.dispose();
      restore();
    }
  });

  it("does not dispose resources after create fails", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const dispose = vi.fn();
    const Layer = defineRenderLayer<{}, {}>({
      create() { throw new Error("create failed"); },
      render() {},
      dispose,
    });
    const controller = crc(createCanvas(), <Layer style={{ width: 20, height: 10 }} />);
    try {
      expect(() => driver.flush(10)).toThrow("create failed");
      expect(dispose).not.toHaveBeenCalled();
    } finally {
      controller.dispose();
      restore();
    }
  });

  it("retains the committed bitmap and reports a failed render through the scheduler", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const transfer = vi.spyOn(OffscreenCanvas.prototype, "transferToImageBitmap");
    const close = vi.spyOn(ImageBitmap.prototype, 'close');
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    let invalidate: (() => void) | undefined;
    let fail = false;
    const Layer = defineRenderLayer<{}, {}>({
      create(context) { context.canvas.getContext('2d'); invalidate = context.invalidate; return {}; },
      render() { if (fail) throw new Error("render failed"); },
    });
    const controller = crc(createCanvas(), <Layer style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      const committed = transfer.mock.results[0]!.value as ImageBitmap;
      drawImage.mockClear();
      fail = true;
      invalidate!();
      expect(() => driver.flush(20)).not.toThrow();
      expect(transfer).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalledWith();
      expect(close.mock.instances).not.toContain(committed);
      expect(drawImage).toHaveBeenCalledWith(
        committed,
        0,
        0,
        20,
        10,
        0,
        0,
        20,
        10,
      );
      expect(() => driver.flush(30)).toThrow('render failed');
    } finally {
      controller.dispose();
      restore();
    }
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = 10;
  document.body.appendChild(canvas);
  return canvas;
}
