import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  BatchedMesh,
  LOD,
  Bone,
  Skeleton,
  SkinnedMesh,
  InstancedMesh,
  Matrix4,
  Float32BufferAttribute,
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
  type CRCThreeLayerDefinition,
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

describe("defineThreeLayer synchronous application boundaries", () => {
  const thenable = Object.freeze({ then() {} });

  it("rejects a thenable returned by create and releases adapter resources", () => {
    let rendererDisposes = 0;
    const Layer = defineThreeLayer<{}, CRCThreeLayerResources>({
      create(context) {
        const dispose = context.renderer.dispose.bind(context.renderer);
        context.renderer.dispose = () => {
          rendererDisposes++;
          dispose();
        };
        return thenable as never;
      },
    });
    const pending = mountPending(<Layer style={{ width: 40, height: 20 }} />);
    try {
      expect(() => pending.driver.flush(10)).toThrowError(
        "defineThreeLayer create() must be synchronous.",
      );
      expect(rendererDisposes).toBe(1);
    } finally {
      pending.dispose();
    }
    expect(rendererDisposes).toBe(1);
  });

  it.each([
    ["update", "defineThreeLayer update() must be synchronous."],
    ["resize", "defineThreeLayer resize() must be synchronous."],
    ["render", "defineThreeLayer render() must be synchronous."],
    ["targets", "defineThreeLayer targets() must be synchronous."],
    ["pick", "defineThreeLayer pick() must be synchronous."],
  ] as const)(
    "rejects a thenable returned by %s() and releases adapter resources",
    (callback, expectedError) => {
      let rendererDisposes = 0;
      const definition: CRCThreeLayerDefinition<
        { revision: number },
        CRCThreeLayerResources
      > = {
        create(context) {
          const dispose = context.renderer.dispose.bind(context.renderer);
          context.renderer.dispose = () => {
            rendererDisposes++;
            dispose();
          };
          return createResources();
        },
      };
      const returnThenable = () => thenable as never;
      definition[callback] = returnThenable;
      const Layer = defineThreeLayer(definition);
      const pending = mountPending(
        <Layer revision={1} style={{ width: 40, height: 20 }} />,
      );
      try {
        if (callback === "update") {
          pending.driver.flush(10);
          crc(
            pending.canvas,
            <Layer revision={2} style={{ width: 40, height: 20 }} />,
          );
          expect(() => pending.driver.flush(20)).not.toThrow();
          expect(() => pending.driver.flush(30)).toThrowError(expectedError);
        } else {
          expect(() => pending.driver.flush(10)).not.toThrow();
          expect(() => pending.driver.flush(20)).toThrowError(expectedError);
        }
      } finally {
        pending.dispose();
      }
      expect(rendererDisposes).toBe(1);
    },
  );

  it("rejects a thenable returned by the candidate picker", () => {
    const Layer = defineThreeLayer<{}, CRCThreeLayerResources>({
      create: () => createResources(),
      pick() {
        return () => thenable as never;
      },
    });
    const mounted = mount(<Layer style={{ width: 40, height: 20 }} />);
    try {
      expect(() =>
        committedHitTest(mounted.canvas)({ x: 5, y: 5 }),
      ).toThrowError("defineThreeLayer picker() must be synchronous.");
    } finally {
      mounted.dispose();
    }
  });

  it("rejects a thenable returned by dispose and still releases the renderer", () => {
    let rendererDisposes = 0;
    const Layer = defineThreeLayer<{}, CRCThreeLayerResources>({
      create(context) {
        const dispose = context.renderer.dispose.bind(context.renderer);
        context.renderer.dispose = () => {
          rendererDisposes++;
          dispose();
        };
        return createResources();
      },
      dispose() {
        return thenable as never;
      },
    });
    const mounted = mount(<Layer style={{ width: 40, height: 20 }} />);
    try {
      expect(() =>
        renderLayerController(mounted.canvas).dispose(),
      ).toThrowError("defineThreeLayer dispose() must be synchronous.");
      expect(rendererDisposes).toBe(1);
    } finally {
      mounted.dispose();
    }
    expect(rendererDisposes).toBe(1);
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

  it("picks only objects rendered by the camera's active layers", () => {
    const trace: string[] = [];
    const Layer = defineThreeLayer<
      {},
      CRCThreeLayerResources & { visibleTarget: Mesh }
    >({
      create() {
        const { scene, camera } = createResources();
        camera.layers.set(1);

        const hiddenBlocker = createBox();
        hiddenBlocker.position.z = 1;

        const visibleTarget = createBox();
        visibleTarget.layers.set(1);
        scene.add(hiddenBlocker, visibleTarget);
        return { scene, camera, visibleTarget };
      },
      targets(resources) {
        return [
          {
            object: resources.visibleTarget,
            handlers: { onClick: () => trace.push("target") },
          },
        ];
      },
    });
    const mounted = mount(<Layer style={{ width: 100, height: 100 }} />);
    try {
      click(mounted.canvas, 50, 50);
      expect(trace).toEqual(["target"]);
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

  it("skips an invisible intersected material group on a multi-material mesh", () => {
    const trace: string[] = [];
    const Layer = defineThreeLayer<{}, CRCThreeLayerResources & { mesh: Mesh }>(
      {
        create() {
          const { scene, camera } = createResources();
          const materials = Array.from(
            { length: 6 },
            () => new MeshBasicMaterial({ color: 0xffffff }),
          );
          materials[4]!.visible = false;
          const mesh = new Mesh(new BoxGeometry(2, 2, 2), materials);
          scene.add(mesh);
          return { scene, camera, mesh };
        },
        targets(resources) {
          return [
            {
              object: resources.mesh,
              handlers: { onClick: () => trace.push("target") },
            },
          ];
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
      expect(trace).toEqual(["lower"]);
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

  it("does not focus an implicitly bounded target behind the camera", () => {
    const mesh = createBox();
    mesh.position.z = 10;
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
      const targets = Array.from(
        getCRCInstance(mounted.canvas).eventRoot.targets,
      );
      expect(targets.some((candidate) => candidate.keyboardFocusable)).toBe(
        false,
      );
    } finally {
      mounted.dispose();
    }
  });
});

describe("defineThreeLayer OrbitControls input", () => {
  it("preserves a registered CRC click after controls receive the winning press", () => {
    const crcTrace: string[] = [];
    const inputTrace: string[] = [];
    const Layer = defineThreeLayer<
      {},
      CRCThreeLayerResources & { controls: OrbitControls; mesh: Mesh }
    >({
      create(context) {
        const { scene, camera, mesh } = createResourcesWithBox();
        const controls = context.input.connect((element) => {
          element.addEventListener("pointerdown", () =>
            inputTrace.push("pointerdown"),
          );
          element.addEventListener("click", () => inputTrace.push("click"));
          return new OrbitControls(camera, element);
        });
        return { scene, camera, controls, mesh };
      },
      targets(resources) {
        return [
          {
            object: resources.mesh,
            handlers: { onClick: () => crcTrace.push("target") },
          },
        ];
      },
      dispose(resources) {
        resources.controls.dispose();
      },
    });
    const mounted = mount(<Layer style={{ width: 100, height: 100 }} />);
    try {
      pointerAndMouseClick(mounted.canvas, 50, 50);
      expect(inputTrace).toEqual(["pointerdown", "click"]);
      expect(crcTrace).toEqual(["target"]);
      expect(mounted.driver.pendingHostFrames).toBe(1);
    } finally {
      mounted.dispose();
    }
  });

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

// Picking must describe the committed bitmap, even when application resources mutate.
it.each(["visibility", "world-transform", "camera", "geometry", "failed-render"] as const)(
  "preserves committed picking across %s", (mutation) => {
  const trace: string[] = [];
  let resources!: ReturnType<typeof createResourcesWithBox>;
  let renders = 0;
  let failNext = false;
  let disposals = 0;
  let invalidate!: () => void;
  const Layer = defineThreeLayer<{}, ReturnType<typeof createResourcesWithBox>>({
    create(context) { invalidate = context.invalidate; resources = createResourcesWithBox(); return resources; },
    render(value, _frame, context) {
      renders++;
      if (failNext) { value.mesh.visible = false; throw new Error("REN-07 candidate failed"); }
      context.renderer.render(value.scene, value.camera);
    },
    targets(value) {
      return [{ object: value.mesh, handlers: { onClick: () => trace.push("three") } }];
    },
    dispose(value) {
      disposals++;
      value.mesh.geometry.dispose();
      (value.mesh.material as MeshBasicMaterial).dispose();
    },
  });
  const mounted = mount(<>
    <Rectangle style={{ width: 100, height: 100, fill: "#2563eb" }} onClick={() => trace.push("canvas")} />
    <Layer style={{ width: 100, height: 100 }} />
  </>);
  try {
    const context = mounted.canvas.getContext("2d")!;
    const before = Array.from(context.getImageData(50, 50, 1, 1).data);
    expect(before).toEqual([255, 255, 255, 255]);
    click(mounted.canvas, 50, 50);
    expect(trace).toEqual(["three"]);
    if (mutation === "visibility") resources.mesh.visible = false;
    if (mutation === "world-transform") {
      resources.mesh.position.x = 20;
      resources.mesh.updateMatrixWorld(true);
    }
    if (mutation === "camera") {
      resources.camera.position.x = 20;
      resources.camera.updateMatrixWorld(true);
    }
    if (mutation === "geometry") resources.mesh.geometry.translate(20, 0, 0);
    if (mutation === "failed-render") {
      failNext = true; invalidate();
      expect(() => mounted.driver.flush(20)).not.toThrow();
      expect(() => mounted.driver.flush(30)).toThrowError("REN-07 candidate failed");
    }
    // No successful replacement render: the visible white box is still committed.
    click(mounted.canvas, 50, 50);
    expect(renders).toBe(mutation === "failed-render" ? 2 : 1);
    expect(Array.from(context.getImageData(50, 50, 1, 1).data)).toEqual(before);
    if (mutation === "failed-render") {
      // Candidate failure gates input while retaining resources and the old bitmap.
      expect(disposals).toBe(0);
      expect(trace).toEqual(["three"]);
      failNext = false; resources.mesh.visible = true; invalidate();
      mounted.driver.flush(40);
      click(mounted.canvas, 50, 50);
      expect(renders).toBe(3);
      expect(trace).toEqual(["three", "three"]);
    } else {
      expect(disposals).toBe(0);
      // The displayed box remains the target until a replacement frame commits.
      expect(trace).toEqual(["three", "three"]);
      invalidate(); mounted.driver.flush(40);
      expect(renders).toBe(2);
      expect(Array.from(context.getImageData(50, 50, 1, 1).data)).toEqual([37, 99, 235, 255]);
      click(mounted.canvas, 50, 50);
      expect(trace).toEqual(["three", "three", "canvas"]);
    }
  } finally { mounted.dispose(); }
});

it.each(["scene", "camera", "mesh", "material"] as const)(
  "does not serialize %s application metadata while preparing picking", (owner) => {
    let serializations = 0;
    const metadata: Record<string, unknown> = {
      toJSON() { serializations++; throw new Error("application metadata must not be serialized"); },
    };
    metadata.self = metadata;
    let selected = 0;
    let resources!: ReturnType<typeof createResourcesWithBox>;
    const Layer = defineThreeLayer<{}, ReturnType<typeof createResourcesWithBox>>({
      create() {
        resources = createResourcesWithBox();
        const target = owner === "material" ? resources.mesh.material as MeshBasicMaterial : resources[owner];
        target.userData = metadata;
        if (owner === "mesh") resources.mesh.raycast = function (raycaster, intersections) {
          if (this.userData === metadata) Mesh.prototype.raycast.call(this, raycaster, intersections);
        };
        return resources;
      },
      targets(value) { return [{ object: value.mesh, handlers: { onClick: () => selected++ } }]; },
      dispose(value) { value.mesh.geometry.dispose(); (value.mesh.material as MeshBasicMaterial).dispose(); },
    });
    const mounted = mount(<Layer style={{ width: 100, height: 100 }} />);
    try {
      click(mounted.canvas, 50, 50);
      expect(selected).toBe(1);
      expect(serializations).toBe(0);
      const target = owner === "material" ? resources.mesh.material as MeshBasicMaterial : resources[owner];
      expect(target.userData).toBe(metadata);
      expect(metadata.self).toBe(metadata);
    } finally { mounted.dispose(); }
  },
);

it.each(["instance-matrix", "batch-matrix", "bone", "morph"] as const)(
  "keeps %s picking aligned with each committed frame", (mutation) => {
    const trace: string[] = [];
    let invalidate!: () => void;
    let resources!: CRCThreeLayerResources & { mesh: Mesh; bone?: Bone };
    const Layer = defineThreeLayer<{}, typeof resources>({
      create(context) {
        invalidate = context.invalidate;
        const base = createResources();
        const geometry = new BoxGeometry(2, 2, 2);
        const material = new MeshBasicMaterial({ color: 0xffffff });
        let mesh: Mesh;
        let bone: Bone | undefined;
        if (mutation === "instance-matrix") {
          mesh = new InstancedMesh(geometry, material, 1);
          (mesh as InstancedMesh).setMatrixAt(0, new Matrix4());
        } else if (mutation === "batch-matrix") {
          const batched = new BatchedMesh(1, 24, 36, material);
          const geometryId = batched.addGeometry(geometry);
          batched.addInstance(geometryId); geometry.dispose(); mesh = batched;
        } else if (mutation === "bone") {
          const count = geometry.attributes.position.count;
          geometry.setAttribute("skinIndex", new Float32BufferAttribute(new Float32Array(count * 4), 4));
          const weights = new Float32Array(count * 4);
          for (let index = 0; index < count; index++) weights[index * 4] = 1;
          geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
          const skinned = new SkinnedMesh(geometry, material);
          bone = new Bone(); skinned.add(bone); skinned.bind(new Skeleton([bone])); mesh = skinned;
        } else {
          const positions = geometry.attributes.position.array.slice();
          for (let index = 0; index < positions.length; index += 3) positions[index] += 20;
          geometry.morphAttributes.position = [new Float32BufferAttribute(positions, 3)];
          mesh = new Mesh(geometry, material);
        }
        base.scene.add(mesh); resources = { ...base, mesh, bone }; return resources;
      },
      targets(value) { return [{ object: value.mesh, handlers: { onClick: () => trace.push("three") } }]; },
      dispose(value) {
        if (value.mesh instanceof BatchedMesh) value.mesh.dispose(); else value.mesh.geometry.dispose();
        (value.mesh.material as MeshBasicMaterial).dispose();
        if (value.mesh instanceof SkinnedMesh) value.mesh.skeleton.dispose();
      },
    });
    const mounted = mount(<>
      <Rectangle style={{ width: 100, height: 100, fill: "#2563eb" }} onClick={() => trace.push("canvas")} />
      <Layer style={{ width: 100, height: 100 }} />
    </>);
    try {
      const pixel = () => Array.from(mounted.canvas.getContext("2d")!.getImageData(50, 50, 1, 1).data);
      expect(pixel()).toEqual([255, 255, 255, 255]);
      click(mounted.canvas, 50, 50);
      if (resources.mesh instanceof InstancedMesh) {
        resources.mesh.setMatrixAt(0, new Matrix4().makeTranslation(20, 0, 0));
        resources.mesh.instanceMatrix.needsUpdate = true;
        resources.mesh.computeBoundingSphere();
      } else if (resources.mesh instanceof BatchedMesh) {
        resources.mesh.setMatrixAt(0, new Matrix4().makeTranslation(20, 0, 0));
        resources.mesh.computeBoundingSphere();
      } else if (resources.bone) {
        resources.bone.position.x = 20; resources.mesh.updateMatrixWorld(true);
        (resources.mesh as SkinnedMesh).computeBoundingSphere();
      } else resources.mesh.morphTargetInfluences![0] = 1;
      click(mounted.canvas, 50, 50);
      expect(pixel()).toEqual([255, 255, 255, 255]);
      expect(trace).toEqual(["three", "three"]);
      invalidate(); mounted.driver.flush(40);
      expect(pixel()).toEqual([37, 99, 235, 255]);
      click(mounted.canvas, 50, 50);
      expect(trace).toEqual(["three", "three", "canvas"]);
    } finally { mounted.dispose(); }
  },
);

it("commits projected focus bounds with picking and preserves them across a failed candidate", () => {
  let resources!: ReturnType<typeof createResourcesWithBox>;
  let invalidate!: () => void;
  let failNext = false;
  let selected = 0;
  const Layer = defineThreeLayer<{}, typeof resources>({
    create(context) { invalidate = context.invalidate; resources = createResourcesWithBox(); return resources; },
    render(value, _frame, context) {
      if (failNext) throw new Error("focus candidate failed");
      context.renderer.render(value.scene, value.camera);
    },
    targets(value) { return [{ object: value.mesh, keyboardFocusable: true, handlers: { onClick: () => selected++ } }]; },
    dispose(value) { value.mesh.geometry.dispose(); (value.mesh.material as MeshBasicMaterial).dispose(); },
  });
  const mounted = mount(<>
    <Rectangle style={{ width: 100, height: 100, fill: "#2563eb" }} />
    <FocusManagement><Layer style={{ width: 100, height: 100 }} /></FocusManagement>
  </>);
  try {
    const registration = () => Array.from(getCRCInstance(mounted.canvas).eventRoot.targets).find(target => target.keyboardFocusable)!;
    const original = registration();
    const bounds = resolveTargetRootBounds(original)!;
    expect(bounds.x).toBeCloseTo(37.5, 8); expect(bounds.width).toBeCloseTo(25, 8);
    resources.mesh.position.x = 2; resources.mesh.updateMatrixWorld(true);
    expect(resolveTargetRootBounds(registration())).toEqual(bounds);
    click(mounted.canvas, 50, 50); expect(selected).toBe(1);
    failNext = true; invalidate(); mounted.driver.flush(20);
    expect(() => mounted.driver.flush(30)).toThrowError("focus candidate failed");
    expect(resolveTargetRootBounds(registration())).toEqual(bounds);
    click(mounted.canvas, 50, 50); expect(selected).toBe(1);
    failNext = false; invalidate(); mounted.driver.flush(40);
    expect(registration()).toBe(original);
    const updated = resolveTargetRootBounds(registration())!;
    // Camera at z=5, 90-degree FOV; translated box spans x=[1,3], z=[-1,1].
    expect(updated.x).toBeCloseTo(50 + 50 / 6, 8);
    expect(updated.x + updated.width).toBeCloseTo(50 + 150 / 4, 8);
    expect(updated.y).toBeCloseTo(37.5, 8); expect(updated.height).toBeCloseTo(25, 8);
    click(mounted.canvas, 50, 50); expect(selected).toBe(1);
    click(mounted.canvas, 75, 50); expect(selected).toBe(2);
    const context = mounted.canvas.getContext("2d")!;
    expect(Array.from(context.getImageData(50, 50, 1, 1).data)).toEqual([37, 99, 235, 255]);
    expect(Array.from(context.getImageData(75, 50, 1, 1).data)).toEqual([255, 255, 255, 255]);
  } finally { mounted.dispose(); }
});

it.each(["LOD", "BatchedMesh"] as const)("preserves registered leaf identity inside an ordinary Three %s", (parentKind) => {
  let selected = 0;
  let resources!: ReturnType<typeof createResourcesWithBox>;
  let invalidate!: () => void;
  const Layer = defineThreeLayer<{}, typeof resources>({
    create(context) {
      invalidate = context.invalidate; resources = createResourcesWithBox();
      if (parentKind === "LOD") {
        const lod = new LOD(); lod.addLevel(resources.mesh, 0); resources.scene.add(lod);
      } else {
        const batch = new BatchedMesh(1, 24, 36, resources.mesh.material as MeshBasicMaterial);
        batch.addInstance(batch.addGeometry(resources.mesh.geometry));
        batch.setMatrixAt(0, new Matrix4().makeTranslation(20, 0, 0));
        batch.add(resources.mesh); resources.scene.add(batch);
      }
      return resources;
    },
    targets(value) { return [{ object: value.mesh, handlers: { onClick: () => selected++ } }]; },
    dispose(value) {
      const parent = value.mesh.parent;
      if (parent instanceof BatchedMesh) parent.dispose();
      value.mesh.geometry.dispose(); (value.mesh.material as MeshBasicMaterial).dispose();
    },
  });
  const mounted = mount(<Layer style={{ width: 100, height: 100 }} />);
  try {
    click(mounted.canvas, 50, 50); expect(selected).toBe(1);
    resources.mesh.geometry.translate(20, 0, 0);
    click(mounted.canvas, 50, 50); expect(selected).toBe(2);
    invalidate(); mounted.driver.flush(40);
    click(mounted.canvas, 50, 50); expect(selected).toBe(2);
  } finally { mounted.dispose(); }
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
  const pending = mountPending(root, pixelRatio);
  try {
    pending.driver.flush(10);
  } catch (error) {
    pending.dispose();
    throw error;
  }
  return pending;
}

function mountPending(
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
  return {
    canvas,
    driver,
    dispose() {
      try {
        controller.dispose();
      } finally {
        restore();
      }
    },
  };
}

function committedHitTest(
  canvas: HTMLCanvasElement,
): (point: Readonly<{ x: number; y: number }>) => unknown {
  const controller = renderLayerController(canvas);
  if (!controller.committedInteraction) {
    throw new Error("missing committed Three interaction snapshot");
  }
  return controller.committedInteraction.hitTest;
}

function renderLayerController(canvas: HTMLCanvasElement): {
  readonly committedInteraction?: {
    hitTest(point: Readonly<{ x: number; y: number }>): unknown;
  };
  dispose(): void;
} {
  const refs = Array.from(getCRCInstance(canvas).refs.values())[0];
  return refs?.refs[0] as unknown as {
    readonly committedInteraction?: {
      hitTest(point: Readonly<{ x: number; y: number }>): unknown;
    };
    dispose(): void;
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

function pointerAndMouseClick(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): void {
  pointer(canvas, "pointerdown", x, y);
  const init = {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  };
  canvas.dispatchEvent(new MouseEvent("mousedown", init));
  pointer(canvas, "pointerup", x, y);
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
