import {
  createElement,
  crc,
  defineTexture,
  Rectangle,
  useTexture,
} from "@crc/core";
import { displacement } from "@crc/core/filters";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCRCInstance } from "../src/lib/global-state";
import { peekDisplacementGpu } from "../src/filters/render-displacement-boundary";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing";

const neutral = defineTexture({
  create: () => undefined,
  rasterize(_state: undefined, { canvas }: { canvas: OffscreenCanvas }) {
    const context = canvas.getContext("2d")!;
    context.fillStyle = "rgb(128 128 128)";
    context.fillRect(0, 0, canvas.width, canvas.height);
  },
});

afterEach(() => vi.restoreAllMocks());

type Restore = () => void;

function mountFaultedScene(inject: () => Restore, expected: RegExp): void {
  const driver = new ManualSchedulerDriver();
  const restoreDriver = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 40;
  document.body.append(canvas);
  const additions = vi.spyOn(OffscreenCanvas.prototype, "addEventListener");
  const removals = vi.spyOn(OffscreenCanvas.prototype, "removeEventListener");
  function Scene() {
    const map = useTexture(neutral({}), {
      resolution: { width: 8, height: 8 },
    });
    return createElement(Rectangle, {
      style: {
        width: 10,
        height: 10,
        fill: "red",
        filter: displacement({
          map,
          strength: 2,
          region: { x: 0, y: 0, width: 40, height: 40 },
        }),
      },
    });
  }
  const controller = crc(canvas, createElement(Scene, {}));
  const restoreFault = inject();
  try {
    expect(() => driver.flush(0)).toThrow(expected);
    expect(peekDisplacementGpu(getCRCInstance(canvas))).toBeUndefined();
    expect(
      additions.mock.calls.filter(
        ([type]) =>
          type === "webglcontextlost" || type === "webglcontextrestored",
      ),
    ).toHaveLength(2);
    expect(
      removals.mock.calls.filter(
        ([type]) =>
          type === "webglcontextlost" || type === "webglcontextrestored",
      ),
    ).toHaveLength(2);
    restoreFault();
    crc(canvas, createElement(Scene, {}));
    driver.flush(16);
    expect(peekDisplacementGpu(getCRCInstance(canvas))).toBeDefined();
  } finally {
    restoreFault();
    controller.dispose();
    restoreDriver();
    canvas.remove();
  }
  expect(
    removals.mock.calls.filter(
      ([type]) =>
        type === "webglcontextlost" || type === "webglcontextrestored",
    ),
  ).toHaveLength(4);
}

describe("displacement GPU first-generation faults", () => {
  it("releases listeners and retries when WebGL2 is unavailable", () => {
    mountFaultedScene(() => {
      const original = OffscreenCanvas.prototype.getContext;
      const spy = vi
        .spyOn(OffscreenCanvas.prototype, "getContext")
        .mockImplementation(function (
          this: OffscreenCanvas,
          kind: string,
          ...args: any[]
        ) {
          return kind === "webgl2"
            ? null
            : (original as any).call(this, kind, ...args);
        });
      return () => spy.mockRestore();
    }, /OffscreenCanvas WebGL2 support/);
  });

  it.each([
    [
      "shader allocation",
      () =>
        vi
          .spyOn(WebGL2RenderingContext.prototype, "createShader")
          .mockReturnValueOnce(null as unknown as WebGLVertexArrayObject),
    ],
    [
      "shader compile",
      () =>
        vi
          .spyOn(WebGL2RenderingContext.prototype, "getShaderParameter")
          .mockImplementationOnce(() => false),
    ],
    [
      "program link",
      () =>
        vi
          .spyOn(WebGL2RenderingContext.prototype, "getProgramParameter")
          .mockImplementationOnce(() => false),
    ],
    [
      "geometry allocation",
      () =>
        vi
          .spyOn(WebGL2RenderingContext.prototype, "createVertexArray")
          .mockReturnValueOnce(null as unknown as WebGLVertexArrayObject),
    ],
    [
      "source texture allocation",
      () =>
        vi
          .spyOn(WebGL2RenderingContext.prototype, "createTexture")
          .mockReturnValueOnce(null as unknown as WebGLTexture),
    ],
  ] as const)(
    "releases listeners and retries after %s failure",
    (_name, inject) => {
      mountFaultedScene(() => {
        const spy = inject();
        return () => spy.mockRestore();
      }, /displacement (shader|program|geometry|textures)/i);
    },
  );

  it("releases listeners and retries after a SecurityError texture upload", () => {
    mountFaultedScene(() => {
      const spy = vi
        .spyOn(WebGL2RenderingContext.prototype, "texImage2D")
        .mockImplementationOnce(() => {
          throw new DOMException(
            "Cross-origin texture source.",
            "SecurityError",
          );
        });
      return () => spy.mockRestore();
    }, /Cross-origin texture source/);
  });
});
