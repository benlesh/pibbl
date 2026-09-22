import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Group as ThreeGroup,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderer,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FocusManagement, Rectangle, crc } from "@crc/core";
import {
  clearSharedState,
  getCRCInstance,
} from "../../../core/src/lib/global-state.js";
import { resolveTargetRootBounds } from "../../../core/src/lib/focus/geometry.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../../../core/src/lib/scheduler/testing.js";
import {
  defineThreeLayer,
  type CRCThreeInputBridge,
  type CRCThreeLayerResources,
  type CRCThreeRendererOptions,
} from "../index.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("defineThreeLayer lifecycle", () => {
  it("is inert until mount and owns one transparent renderer per mounted identity", () => {
    const trace: string[] = [];
    const renderers: WebGLRenderer[] = [];
    let animationLoopCalls = 0;
    const frameRequest = vi.spyOn(window, "requestAnimationFrame");
    const Layer = defineThreeLayer<{ value: number }, CRCThreeLayerResources>({
      renderer: {
        alpha: false,
        antialias: true,
      } as unknown as CRCThreeRendererOptions,
      create(context, props) {
        trace.push(`create:${props.value}`);
        renderers.push(context.renderer);
        const setAnimationLoop = context.renderer.setAnimationLoop.bind(
          context.renderer,
        );
        context.renderer.setAnimationLoop = (callback) => {
          animationLoopCalls++;
          setAnimationLoop(callback);
        };
        expect(context.renderer.domElement).toBe(context.canvas);
        expect(
          context.renderer.getContext().getContextAttributes()?.alpha,
        ).toBe(true);
        return createResources();
      },
      update(_resources, props) {
        trace.push(`update:${props.value}`);
      },
      resize(_resources, size, context) {
        const drawingBuffer = context.renderer.getDrawingBufferSize(
          new Vector2(),
        );
        trace.push(
          `resize:${size.width}x${size.height}@${drawingBuffer.x}x${drawingBuffer.y}:${context.renderer.getPixelRatio()}`,
        );
      },
      render(_resources, frame) {
        trace.push(`render:${frame.frameId}`);
      },
      dispose(_resources, context) {
        trace.push("application-dispose");
        vi.spyOn(context.renderer, "dispose").mockImplementation(() => {
          trace.push("renderer-dispose");
        });
      },
    });

    expect(trace).toEqual([]);
    expect(renderers).toEqual([]);

    const mounted = mount(
      <Layer value={1} style={{ width: 40, height: 20 }} />,
      2,
    );
    try {
      expect(trace).toEqual(["create:1", "resize:40x20@80x40:1", "render:1"]);
      crc(
        mounted.canvas,
        <Layer value={2} style={{ width: 40, height: 20 }} />,
      );
      mounted.driver.flush(20);
      expect(renderers).toHaveLength(1);
      expect(trace.slice(-2)).toEqual(["update:2", "render:2"]);
      expect(animationLoopCalls).toBe(0);
      expect(frameRequest).not.toHaveBeenCalled();
    } finally {
      mounted.dispose();
    }
    expect(trace.slice(-2)).toEqual([
      "application-dispose",
      "renderer-dispose",
    ]);
  });

  it("uses default rendering unless the application supplies a custom pass", () => {
    let defaultRenderCalls = 0;
    const DefaultLayer = defineThreeLayer<{}, CRCThreeLayerResources>({
      create(context) {
        const render = context.renderer.render.bind(context.renderer);
        context.renderer.render = ((...args) => {
          defaultRenderCalls++;
          return render(...args);
        }) as WebGLRenderer["render"];
        return createResources();
      },
    });
    const defaultMounted = mount(
      <DefaultLayer style={{ width: 40, height: 20 }} />,
    );
    try {
      expect(defaultRenderCalls).toBe(1);
    } finally {
      defaultMounted.dispose();
    }

    defaultRenderCalls = 0;
    const customRender = vi.fn();
    const CustomLayer = defineThreeLayer<{}, CRCThreeLayerResources>({
      create(context) {
        const render = context.renderer.render.bind(context.renderer);
        context.renderer.render = ((...args) => {
          defaultRenderCalls++;
          return render(...args);
        }) as WebGLRenderer["render"];
        return createResources();
      },
      render: customRender,
    });
    const customMounted = mount(
      <CustomLayer style={{ width: 40, height: 20 }} />,
    );
    try {
      expect(customRender).toHaveBeenCalledOnce();
      expect(defaultRenderCalls).toBe(0);
    } finally {
      customMounted.dispose();
    }
  });
});

describe("defineThreeLayer picking", () => {
  it("passes a transparent gap through to lower CRC paint", () => {
    const trace: string[] = [];
    const Layer = defineThreeLayer<{}, CRCThreeLayerResources>({
      create: () => createResources(),
    });
    const mounted = mount(
      <>
        <Rectangle
          style={{ width: 100, height: 100, fill: "#2563eb" }}
          onClick={() => trace.push("lower")}
        />
        <Layer style={{ width: 100, height: 100 }} />
      </>,
    );
    try {
      click(mounted.canvas, 5, 5);
      expect(trace).toEqual(["lower"]);
    } finally {
      mounted.dispose();
    }
  });

  it("blocks lower CRC paint at the nearest unregistered geometry", () => {
    const trace: string[] = [];
    const Layer = defineThreeLayer<{}, CRCThreeLayerResources & { mesh: Mesh }>(
      {
        create() {
          const resources = createResourcesWithBox();
          return resources;
        },
      },
    );
    const mounted = mount(
      <>
        <Rectangle
          style={{ width: 100, height: 100, fill: "#2563eb" }}
          onClick={() => trace.push("lower")}
        />
        <Layer style={{ width: 100, height: 100 }} />
      </>,
    );
    try {
      click(mounted.canvas, 50, 50);
      expect(trace).toEqual([]);
    } finally {
      mounted.dispose();
    }
  });

  it.each(["object", "ancestor"] as const)(
    "targets the nearest registered %s",
    (registration) => {
      const trace: string[] = [];
      const Layer = defineThreeLayer<
        {},
        CRCThreeLayerResources & {
          mesh: Mesh;
          registration: Object3D;
        }
      >({
        create() {
          const { scene, camera, mesh } = createResourcesWithBox();
          if (registration === "object") {
            return { scene, camera, mesh, registration: mesh };
          }
          const parent = new ThreeGroup();
          scene.remove(mesh);
          parent.add(mesh);
          scene.add(parent);
          return { scene, camera, mesh, registration: parent };
        },
        targets(resources) {
          return [
            {
              object: resources.registration,
              handlers: { onClick: () => trace.push(registration) },
            },
          ];
        },
      });
      const mounted = mount(<Layer style={{ width: 100, height: 100 }} />);
      try {
        click(mounted.canvas, 50, 50);
        expect(trace).toEqual([registration]);
      } finally {
        mounted.dispose();
      }
    },
  );

  it("skips a pointer-events-none object and its subtree", () => {
    const trace: string[] = [];
    const Layer = defineThreeLayer<
      {},
      CRCThreeLayerResources & {
        disabled: ThreeGroup;
        behind: Mesh;
      }
    >({
      create() {
        const { scene, camera } = createResources();
        const disabled = new ThreeGroup();
        const front = createBox();
        front.position.z = 1;
        disabled.add(front);
        const behind = createBox();
        scene.add(disabled, behind);
        return { scene, camera, disabled, behind };
      },
      targets(resources) {
        return [
          { object: resources.disabled, pointerEvents: "none" },
          {
            object: resources.behind,
            handlers: { onClick: () => trace.push("behind") },
          },
        ];
      },
    });
    const mounted = mount(<Layer style={{ width: 100, height: 100 }} />);
    try {
      click(mounted.canvas, 50, 50);
      expect(trace).toEqual(["behind"]);
    } finally {
      mounted.dispose();
    }
  });

  it("lets a custom picker replace only hit selection", () => {
    const trace: string[] = [];
    const picked = new ThreeGroup();
    const pick = vi.fn(() => () => ({
      kind: "target" as const,
      target: picked,
    }));
    const render = vi.fn();
    const Layer = defineThreeLayer<
      { revision: number },
      CRCThreeLayerResources
    >({
      create: () => createResources(),
      update(_resources, props) {
        trace.push(`update:${props.revision}`);
      },
      render,
      targets() {
        return [
          {
            object: picked,
            handlers: { onClick: () => trace.push("picked") },
          },
        ];
      },
      pick,
    });
    const mounted = mount(
      <Layer revision={1} style={{ width: 100, height: 100 }} />,
    );
    try {
      click(mounted.canvas, 5, 5);
      expect(trace).toEqual(["picked"]);
      expect(render).toHaveBeenCalledOnce();
      expect(pick).toHaveBeenCalledOnce();

      crc(
        mounted.canvas,
        <Layer revision={2} style={{ width: 100, height: 100 }} />,
      );
      mounted.driver.flush(20);
      expect(trace.slice(-1)).toEqual(["update:2"]);
      expect(render).toHaveBeenCalledTimes(2);
      expect(pick).toHaveBeenCalledTimes(2);
    } finally {
      mounted.dispose();
    }
  });

  it("projects committed world bounds for an implicitly bounded focus target", () => {
    const mesh = createBox();
    const Layer = defineThreeLayer<{}, CRCThreeLayerResources>({
      create() {
        const { scene, camera } = createResources();
        scene.add(mesh);
        return { scene, camera };
      },
      targets() {
        return [{ object: mesh, keyboardFocusable: true }];
      },
    });
    const mounted = mount(
      <FocusManagement>
        <Layer style={{ width: 100, height: 100 }} />
      </FocusManagement>,
    );
    try {
      const target = Array.from(
        getCRCInstance(mounted.canvas).eventRoot.targets,
      ).find((candidate) => candidate.keyboardFocusable);
      const bounds = target && resolveTargetRootBounds(target);
      expect(bounds?.x).toBeCloseTo(37.5, 5);
      expect(bounds?.y).toBeCloseTo(37.5, 5);
      expect(bounds?.width).toBeCloseTo(25, 5);
      expect(bounds?.height).toBeCloseTo(25, 5);
    } finally {
      mounted.dispose();
    }
  });
});

describe("defineThreeLayer OrbitControls input", () => {
  it("connects only during create, routes winner input, invalidates, and cleans up", () => {
    let bridge: CRCThreeInputBridge | undefined;
    let controls: OrbitControls | undefined;
    let compatibilityElement: HTMLElement | undefined;
    const leakedClick = vi.fn();
    const trace: string[] = [];
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    const Layer = defineThreeLayer<
      {},
      CRCThreeLayerResources & { controls: OrbitControls }
    >({
      create(context) {
        bridge = context.input;
        const scene = new Scene();
        controls = context.input.connect((element) => {
          compatibilityElement = element;
          element.addEventListener("click", leakedClick);
          return new OrbitControls(camera, element);
        });
        return { scene, camera, controls };
      },
      render(resources, _frame, context) {
        trace.push("render");
        context.renderer.render(resources.scene, resources.camera);
      },
      dispose(resources) {
        trace.push("application-dispose");
        resources.controls.dispose();
      },
    });
    const mounted = mount(
      <Layer missBehavior="target-layer" style={{ width: 100, height: 100 }} />,
    );
    const initialPosition = camera.position.clone();
    try {
      expect(() => bridge!.connect(() => ({ invalid: true }))).toThrowError(
        "CRC Three input controls may only connect during create().",
      );

      pointer(mounted.canvas, "pointerdown", 50, 50);
      pointer(mounted.canvas, "pointermove", 70, 50);
      pointer(mounted.canvas, "pointerup", 70, 50);
      expect(camera.position.equals(initialPosition)).toBe(false);

      const distanceAfterDrag = camera.position.distanceTo(controls!.target);
      wheel(mounted.canvas, 50, 50, 120);
      expect(camera.position.distanceTo(controls!.target)).not.toBeCloseTo(
        distanceAfterDrag,
        8,
      );
      expect(mounted.driver.pendingHostFrames).toBe(1);
      mounted.driver.flush(20);
      expect(trace.filter((entry) => entry === "render")).toHaveLength(2);
    } finally {
      mounted.dispose();
    }

    expect(trace).toContain("application-dispose");
    leakedClick.mockClear();
    compatibilityElement!.dispatchEvent(new MouseEvent("click"));
    expect(leakedClick).not.toHaveBeenCalled();
    const disposedPosition = camera.position.clone();
    compatibilityElement!.ownerDocument.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 41,
        pointerType: "mouse",
        clientX: 90,
        clientY: 50,
      }),
    );
    expect(camera.position.equals(disposedPosition)).toBe(true);
  });
});

function createResources(): CRCThreeLayerResources {
  const scene = new Scene();
  const camera = new PerspectiveCamera(90, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  return { scene, camera };
}

function createResourcesWithBox(): CRCThreeLayerResources & { mesh: Mesh } {
  const { scene, camera } = createResources();
  const mesh = createBox();
  scene.add(mesh);
  return { scene, camera, mesh };
}

function createBox(): Mesh {
  return new Mesh(
    new BoxGeometry(2, 2, 2),
    new MeshBasicMaterial({ color: 0xffffff }),
  );
}

function mount(
  root: Parameters<typeof crc>[1],
  pixelRatio = 1,
): {
  readonly canvas: HTMLCanvasElement;
  readonly driver: ManualSchedulerDriver;
  dispose(): void;
} {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = createCanvas(100, 100);
  const controller = crc(canvas, root, { pixelRatio });
  driver.flush(10);
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
  const init = {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  };
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
      cancelable: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId: 41,
      pointerType: "mouse",
    }),
  );
}

function wheel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  deltaY: number,
): void {
  canvas.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaY,
    }),
  );
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  return canvas;
}
