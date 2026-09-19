import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FocusManagement,
  Group,
  Rectangle,
  defineRenderLayer,
  type CRCRenderLayerHit,
  type CRCRenderLayerInteractionSnapshot,
  type CRCRenderLayerTarget,
} from "../../index.js";
import { crc } from "../crc.js";
import { clearSharedState, getCRCInstance } from "../global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../scheduler/testing.js";
import { resolveTargetRootBounds } from "../focus/geometry.js";

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
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });
    const sizes: string[] = [];
    const Layer = defineRenderLayer<{}, {}>({
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
      resize(_resources, size) {
        sizes.push(
          `${size.width}x${size.height}@${size.backingWidth}x${size.backingHeight}`,
        );
      },
      render() {},
    });
    const controller = crc(
      createCanvas(),
      <Layer style={{ width: 20, height: 10 }} />,
      { pixelRatio: "device" },
    );
    try {
      driver.flush(10);
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: 2,
      });
      window.dispatchEvent(new Event("resize"));
      driver.flush(20);
      expect(sizes).toEqual(["20x10@20x10", "20x10@40x20"]);
    } finally {
      controller.dispose();
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: priorRatio,
      });
      restore();
    }
  });

  it("coalesces retained invalidation and ignores it after disposal", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    let invalidate: (() => void) | undefined;
    let renders = 0;
    const Layer = defineRenderLayer<{}, {}>({
      create(context) {
        context.canvas.getContext("2d");
        invalidate = context.invalidate;
        return {};
      },
      render() {
        renders++;
      },
    });
    const controller = crc(
      createCanvas(),
      <Layer style={{ width: 20, height: 10 }} />,
    );
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
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
      render(_resources, frame) {
        frames.push(frame.frameId);
        if (frames.length < 3) frame.invalidate();
      },
    });
    const controller = crc(
      createCanvas(),
      <Layer style={{ width: 20, height: 10 }} />,
    );
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
    const transfer = vi.spyOn(
      OffscreenCanvas.prototype,
      "transferToImageBitmap",
    );
    const Layer = defineRenderLayer<{}, {}>({
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
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
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
      update(_resources, props) {
        updates.push(props.once);
      },
      render() {},
    });
    const canvas = createCanvas();
    const controller = crc(
      canvas,
      <Layer once={1} style={{ width: 20, height: 10 }} />,
    );
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
      create(context: any) {
        context.canvas.getContext("2d");
        return {};
      },
      render: original,
    };
    const Layer = defineRenderLayer(definition);
    definition.render = replacement;
    const controller = crc(
      createCanvas(),
      <Layer style={{ width: 20, height: 10 }} />,
    );
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
          context.canvas.getContext("2d");
          return callback === "create" ? thenable : {};
        },
        update: () => (callback === "update" ? thenable : undefined),
        resize: () => (callback === "resize" ? thenable : undefined),
        render: () => (callback === "render" ? thenable : undefined),
      } as any;
      const Layer = defineRenderLayer<{ value: number }, {}>(definition);
      const canvas = createCanvas();
      const controller = crc(
        canvas,
        <Layer value={0} style={{ width: 20, height: 10 }} />,
      );
      try {
        if (callback === "update") {
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
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
      render() {},
      dispose() {
        return { then() {} } as never;
      },
    });
    const canvas = createCanvas();
    const controller = crc(canvas, <Layer style={{ width: 20, height: 10 }} />);
    try {
      driver.flush(10);
      const refs = Array.from(getCRCInstance(canvas).refs.values())[0]!;
      expect(() =>
        (refs.refs[0] as { dispose(): void }).dispose(),
      ).toThrowError("defineRenderLayer dispose() must be synchronous.");
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
      create() {
        throw new Error("create failed");
      },
      render() {},
      dispose,
    });
    const controller = crc(
      createCanvas(),
      <Layer style={{ width: 20, height: 10 }} />,
    );
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
    const transfer = vi.spyOn(
      OffscreenCanvas.prototype,
      "transferToImageBitmap",
    );
    const close = vi.spyOn(ImageBitmap.prototype, "close");
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    let invalidate: (() => void) | undefined;
    let fail = false;
    const Layer = defineRenderLayer<{}, {}>({
      create(context) {
        context.canvas.getContext("2d");
        invalidate = context.invalidate;
        return {};
      },
      render() {
        if (fail) throw new Error("render failed");
      },
    });
    const controller = crc(
      createCanvas(),
      <Layer style={{ width: 20, height: 10 }} />,
    );
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
      expect(() => driver.flush(30)).toThrow("render failed");
    } finally {
      controller.dispose();
      restore();
    }
  });

  it("retains a bitmap for an application TypeError that resembles a synchronous violation", () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    let invalidate: (() => void) | undefined;
    let fail = false;
    const applicationError = new TypeError(
      "defineRenderLayer render() must be synchronous.",
    );
    const Layer = defineRenderLayer<{}, {}>({
      create(context) {
        context.canvas.getContext("2d");
        invalidate = context.invalidate;
        return {};
      },
      render() {
        if (fail) throw applicationError;
      },
    });
    const controller = crc(
      createCanvas(),
      <Layer style={{ width: 20, height: 10 }} />,
    );
    try {
      driver.flush(10);
      fail = true;
      invalidate!();
      expect(() => driver.flush(20)).not.toThrow();
      expect(() => driver.flush(30)).toThrow(applicationError);
    } finally {
      controller.dispose();
      restore();
    }
  });

  it.each([
    { missBehavior: undefined, expected: ["lower"] },
    { missBehavior: "block" as const, expected: [] },
    { missBehavior: "target-layer" as const, expected: ["layer"] },
  ])("arbitrates a miss with $missBehavior", ({ missBehavior, expected }) => {
    const trace: string[] = [];
    const Layer = interactionLayer({ kind: "miss" });
    const mounted = mountInteraction(
      <>
        <Rectangle
          style={{ width: 100, height: 60, fill: "#2563eb" }}
          onClick={() => trace.push("lower")}
        />
        <Layer
          missBehavior={missBehavior}
          style={{ width: 100, height: 60 }}
          onClick={() => trace.push("layer")}
        />
      </>,
    );
    try {
      click(mounted.canvas, 30, 20);
      expect(trace).toEqual(expected);
    } finally {
      mounted.dispose();
    }
  });

  it("delivers an unregistered block only to the winning layer input", () => {
    const trace: string[] = [];
    const Layer = interactionLayer(
      { kind: "block" },
      {
        onInput: (input) => trace.push(`input:${input.hit.kind}`),
      },
    );
    const mounted = mountInteraction(
      <>
        <Rectangle
          style={{ width: 100, height: 60, fill: "#2563eb" }}
          onClick={() => trace.push("lower")}
        />
        <Layer
          style={{ width: 100, height: 60 }}
          onClick={() => trace.push("layer")}
        />
      </>,
    );
    try {
      click(mounted.canvas, 30, 20);
      expect(trace).toEqual(["input:block"]);
    } finally {
      mounted.dispose();
    }
  });

  it("dispatches a registered target before its layer structural listener", () => {
    const trace: string[] = [];
    const applicationTarget = {};
    const Layer = interactionLayer(
      { kind: "target", target: applicationTarget },
      {
        targets: [
          {
            target: applicationTarget,
            handlers: { onClick: () => trace.push("target") },
          },
        ],
        onInput: (input) => trace.push(`input:${input.hit.kind}`),
      },
    );
    const mounted = mountInteraction(
      <Layer
        style={{ width: 100, height: 60 }}
        onClick={() => trace.push("layer")}
      />,
    );
    try {
      click(mounted.canvas, 30, 20);
      expect(trace).toEqual(["input:target", "target", "layer"]);
    } finally {
      mounted.dispose();
    }
  });

  it("does not deliver input when later CRC paint wins", () => {
    const trace: string[] = [];
    const Layer = interactionLayer(
      { kind: "block" },
      {
        onInput: () => trace.push("input"),
      },
    );
    const mounted = mountInteraction(
      <>
        <Layer style={{ width: 100, height: 60 }} />
        <Rectangle
          style={{ width: 100, height: 60, fill: "#f97316" }}
          onClick={() => trace.push("front")}
        />
      </>,
    );
    try {
      click(mounted.canvas, 30, 20);
      expect(trace).toEqual(["front"]);
    } finally {
      mounted.dispose();
    }
  });

  it("keeps pointer delivery with the winning layer until release", () => {
    const trace: string[] = [];
    const Layer = interactionLayer(
      { kind: "block" },
      {
        onInput: (input) => {
          trace.push(`input:${input.type}`);
          if (input.type === "pointerdown") {
            input.setPointerCapture(
              (input.originalEvent as PointerEvent).pointerId,
            );
          }
        },
      },
    );
    const mounted = mountInteraction(
      <>
        <Rectangle
          style={{ width: 100, height: 60, fill: "#2563eb" }}
          onPointerMove={() => trace.push("lower:pointermove")}
        />
        <Layer style={{ width: 40, height: 30 }} />
      </>,
    );
    try {
      pointer(mounted.canvas, "pointerdown", 20, 20);
      pointer(mounted.canvas, "pointermove", 80, 50);
      pointer(mounted.canvas, "pointerup", 80, 50);
      pointer(mounted.canvas, "pointermove", 80, 50);
      expect(trace).toEqual([
        "input:pointerdown",
        "input:pointermove",
        "input:pointerup",
        "lower:pointermove",
      ]);
    } finally {
      mounted.dispose();
    }
  });

  it("gates retained invalidation but leaves a frame-invalidated commit live", () => {
    const trace: string[] = [];
    const applicationTarget = {};
    let invalidate: (() => void) | undefined;
    let first = true;
    const Layer = defineRenderLayer<{}, {}, typeof applicationTarget>({
      create(context) {
        context.canvas.getContext("2d");
        invalidate = context.invalidate;
        return {};
      },
      render(_resources, frame) {
        if (first) {
          first = false;
          frame.invalidate();
        }
      },
      interaction: {
        settle() {
          return {
            targets: [
              {
                target: applicationTarget,
                handlers: { onClick: () => trace.push("target") },
              },
            ],
            hitTest: () => ({ kind: "target", target: applicationTarget }),
            onInput: (input) => trace.push(`input:${input.hit.kind}`),
          };
        },
      },
    });
    const mounted = mountInteraction(
      <Layer style={{ width: 100, height: 60 }} />,
    );
    try {
      click(mounted.canvas, 20, 20);
      expect(trace).toEqual(["input:target", "target"]);
      trace.length = 0;
      invalidate!();
      click(mounted.canvas, 20, 20);
      expect(trace).toEqual(["input:block"]);
    } finally {
      mounted.dispose();
    }
  });

  it("keeps candidate targets inert until a successful bitmap transaction", () => {
    const trace: string[] = [];
    const oldTarget = {};
    const newTarget = {};
    const Layer = defineRenderLayer<{ target: object }, {}, object>({
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
      render() {},
      interaction: {
        settle(_resources, props) {
          const label = props.target === oldTarget ? "old" : "new";
          return {
            targets: [
              {
                target: props.target,
                handlers: { onClick: () => trace.push(label) },
              },
            ],
            hitTest: () => ({ kind: "target", target: props.target }),
          };
        },
      },
    });
    const mounted = mountInteraction(
      <Layer target={oldTarget} style={{ width: 100, height: 60 }} />,
    );
    const oldRegistration = Array.from(
      getCRCInstance(mounted.canvas).eventRoot.targets,
    )[0];
    let observedDuringCandidate = false;
    function RejectAfterObserving() {
      const instance = getCRCInstance(mounted.canvas);
      observedDuringCandidate = instance.eventRoot.targets.has(
        oldRegistration!,
      );
      (
        instance.eventRoot.renderTransaction as unknown as {
          finish(success: boolean): void;
        }
      ).finish(false);
      return undefined;
    }
    try {
      crc(
        mounted.canvas,
        <>
          <Layer target={newTarget} style={{ width: 100, height: 60 }} />
          <RejectAfterObserving />
        </>,
      );
      mounted.driver.flush(20);
      expect(observedDuringCandidate).toBe(true);
      click(mounted.canvas, 20, 20);
      expect(trace).toEqual(["old"]);
    } finally {
      mounted.dispose();
    }
  });

  it("re-observes committed focus targets on a clean unrelated traversal", () => {
    const trace: string[] = [];
    const target = {};
    const Layer = interactionLayer(
      { kind: "target", target },
      {
        targets: [
          {
            target,
            keyboardFocusable: true,
            keyboardNavigationBounds: { x: 0, y: 0, width: 20, height: 10 },
            handlers: { onClick: () => trace.push("target") },
          },
        ],
      },
    );
    const scene = (color: string) => (
      <FocusManagement>
        <Group>
          <Layer style={{ width: 40, height: 30 }} />
          <Rectangle style={{ x: 60, width: 10, height: 10, fill: color }} />
        </Group>
      </FocusManagement>
    );
    const mounted = mountInteraction(scene("#111111"));
    try {
      click(mounted.canvas, 10, 5);
      trace.length = 0;
      crc(mounted.canvas, scene("#222222"));
      mounted.driver.flush(20);
      mounted.canvas.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
      expect(trace).toEqual(["target"]);
    } finally {
      mounted.dispose();
    }
  });

  it("honors layer pointer participation and transformed target-layer focus", () => {
    const trace: string[] = [];
    const Layer = interactionLayer({ kind: "miss" });
    const mounted = mountInteraction(
      <FocusManagement>
        <Group>
          <Rectangle
            style={{ width: 100, height: 60, fill: "#2563eb" }}
            onClick={() => trace.push("lower")}
          />
          <Group style={{ translateX: 25, translateY: 15 }}>
            <Layer
              missBehavior="target-layer"
              pointerEvents="none"
              keyboardFocusable
              keyboardNavigationBounds={{ x: 2, y: 3, width: 20, height: 10 }}
              style={{ width: 40, height: 30 }}
              onClick={() => trace.push("layer")}
            />
          </Group>
        </Group>
      </FocusManagement>,
    );
    try {
      click(mounted.canvas, 30, 20);
      expect(trace).toEqual(["lower"]);
      expect(
        Array.from(getCRCInstance(mounted.canvas).eventRoot.targets).some(
          (target) => target.keyboardFocusable,
        ),
      ).toBe(false);

      crc(
        mounted.canvas,
        <FocusManagement>
          <Group style={{ translateX: 25, translateY: 15 }}>
            <Layer
              missBehavior="target-layer"
              keyboardFocusable
              keyboardNavigationBounds={{ x: 2, y: 3, width: 20, height: 10 }}
              style={{ width: 40, height: 30 }}
              onClick={() => trace.push("layer")}
            />
          </Group>
        </FocusManagement>,
      );
      mounted.driver.flush(20);
      const focusTarget = Array.from(
        getCRCInstance(mounted.canvas).eventRoot.targets,
      ).find((target) => target.keyboardFocusable);
      expect(focusTarget && resolveTargetRootBounds(focusTarget)).toEqual({
        x: 27,
        y: 18,
        width: 20,
        height: 10,
      });
      click(mounted.canvas, 30, 20);
      trace.length = 0;
      mounted.canvas.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
      expect(trace).toEqual(["layer"]);
    } finally {
      mounted.dispose();
    }
  });

  it("updates target-layer policy transactionally without application rendering", () => {
    const trace: string[] = [];
    let renders = 0;
    const Layer = defineRenderLayer<{}, {}>({
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
      render() {
        renders++;
      },
    });
    const scene = (missBehavior: "pass-through" | "block" | "target-layer") => (
      <>
        <Rectangle
          style={{ width: 100, height: 60, fill: "#2563eb" }}
          onClick={() => trace.push("lower")}
        />
        <Layer
          missBehavior={missBehavior}
          style={{ width: 100, height: 60 }}
          onClick={() => trace.push("layer")}
        />
      </>
    );
    const mounted = mountInteraction(scene("pass-through"));
    try {
      click(mounted.canvas, 20, 20);
      expect(trace).toEqual(["lower"]);
      trace.length = 0;
      crc(mounted.canvas, scene("target-layer"));
      mounted.driver.flush(20);
      click(mounted.canvas, 20, 20);
      expect(trace).toEqual(["layer"]);
      expect(renders).toBe(1);
      trace.length = 0;
      crc(mounted.canvas, scene("block"));
      mounted.driver.flush(30);
      click(mounted.canvas, 20, 20);
      expect(trace).toEqual([]);
      expect(renders).toBe(1);
    } finally {
      mounted.dispose();
    }
  });

  it("releases resolver capture after a generation removes onInput", () => {
    const trace: string[] = [];
    const Layer = defineRenderLayer<{ listen: boolean }, {}>({
      create(context) {
        context.canvas.getContext("2d");
        return {};
      },
      render() {},
      interaction: {
        settle(_resources, props) {
          return {
            targets: [],
            hitTest: () => ({ kind: "block" }),
            onInput: props.listen
              ? (input) => {
                  trace.push(`input:${input.type}`);
                  if (input.type === "pointerdown") {
                    input.setPointerCapture(
                      (input.originalEvent as PointerEvent).pointerId,
                    );
                  }
                }
              : undefined,
          };
        },
      },
    });
    const scene = (listen: boolean) => (
      <>
        <Rectangle
          style={{ width: 100, height: 60, fill: "#2563eb" }}
          onPointerMove={() => trace.push("lower:pointermove")}
        />
        <Layer listen={listen} style={{ width: 40, height: 30 }} />
      </>
    );
    const mounted = mountInteraction(scene(true));
    try {
      pointer(mounted.canvas, "pointerdown", 20, 20);
      crc(mounted.canvas, scene(false));
      mounted.driver.flush(20);
      pointer(mounted.canvas, "pointerup", 80, 50);
      pointer(mounted.canvas, "pointermove", 80, 50);
      expect(trace).toEqual(["input:pointerdown", "lower:pointermove"]);
    } finally {
      mounted.dispose();
    }
  });

  it("excludes pointer-events-none declarations from the committed target map", () => {
    const trace: string[] = [];
    const applicationTarget = {};
    const Layer = interactionLayer(
      { kind: "target", target: applicationTarget },
      {
        targets: [
          {
            target: applicationTarget,
            pointerEvents: "none",
            handlers: { onClick: () => trace.push("target") },
          },
        ],
        onInput: (input) => trace.push(`input:${input.hit.kind}`),
      },
    );
    const mounted = mountInteraction(
      <Layer style={{ width: 100, height: 60 }} />,
    );
    try {
      click(mounted.canvas, 30, 20);
      expect(trace).toEqual(["input:block"]);
      expect(() => mounted.driver.flush(20)).toThrowError(
        "Render layer hitTest() returned a target absent from its committed snapshot.",
      );
    } finally {
      mounted.dispose();
    }
  });

  it("rejects duplicate application target identities during settlement", () => {
    const applicationTarget = {};
    const declaration = { target: applicationTarget };
    const Layer = interactionLayer(
      { kind: "miss" },
      {
        targets: [declaration, declaration],
      },
    );
    const mounted = mountInteraction(
      <Layer style={{ width: 100, height: 60 }} />,
      false,
    );
    try {
      expect(() => mounted.driver.flush(10)).not.toThrow();
      expect(() => mounted.driver.flush(20)).toThrowError(
        "Render layer interaction contains a duplicate target identity.",
      );
    } finally {
      mounted.dispose();
    }
  });

  it("transforms explicit focus bounds and activates the committed target", () => {
    const trace: string[] = [];
    const applicationTarget = {};
    const Layer = interactionLayer(
      { kind: "target", target: applicationTarget },
      {
        targets: [
          {
            target: applicationTarget,
            keyboardFocusable: true,
            keyboardNavigationBounds: { x: 0, y: 0, width: 20, height: 10 },
            handlers: { onClick: () => trace.push("target") },
          },
        ],
      },
    );
    const mounted = mountInteraction(
      <FocusManagement>
        <Group style={{ translateX: 25, translateY: 15 }}>
          <Layer style={{ width: 40, height: 30 }} />
        </Group>
      </FocusManagement>,
    );
    try {
      const target = Array.from(
        getCRCInstance(mounted.canvas).eventRoot.targets,
      ).find((candidate) => candidate.keyboardFocusable);
      expect(target && resolveTargetRootBounds(target)).toEqual({
        x: 25,
        y: 15,
        width: 20,
        height: 10,
      });
      click(mounted.canvas, 30, 20);
      trace.length = 0;
      mounted.canvas.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
      expect(trace).toEqual(["target"]);
    } finally {
      mounted.dispose();
    }
  });
});

function interactionLayer<Target extends object>(
  hit: CRCRenderLayerHit<Target>,
  options: {
    readonly targets?: readonly CRCRenderLayerTarget<Target>[];
    readonly onInput?: CRCRenderLayerInteractionSnapshot<Target>["onInput"];
  } = {},
) {
  return defineRenderLayer<{}, {}, Target>({
    create(context) {
      context.canvas.getContext("2d");
      return {};
    },
    render() {},
    interaction: {
      settle() {
        return {
          targets: options.targets ?? [],
          hitTest: () => hit,
          onInput: options.onInput,
        };
      },
    },
  });
}

function mountInteraction(
  root: Parameters<typeof crc>[1],
  flush = true,
): {
  readonly canvas: HTMLCanvasElement;
  readonly driver: ManualSchedulerDriver;
  dispose(): void;
} {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = createCanvas(100, 60);
  const controller = crc(canvas, root);
  if (flush) driver.flush(10);
  return {
    canvas,
    driver,
    dispose() {
      controller.dispose();
      restore();
    },
  };
}

function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const init = { bubbles: true, button: 0, clientX: x, clientY: y };
  canvas.dispatchEvent(new MouseEvent("mousedown", init));
  canvas.dispatchEvent(new MouseEvent("mouseup", init));
  canvas.dispatchEvent(new MouseEvent("click", init));
}

function pointer(
  canvas: HTMLCanvasElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
): void {
  canvas.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId: 41,
      pointerType: "mouse",
    }),
  );
}

function createCanvas(width = 20, height = 10): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  return canvas;
}
