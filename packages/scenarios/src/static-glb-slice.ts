import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  crc,
  createElement,
  signal,
  useWhenChanged,
  type CRCController,
  type Signal,
} from "@crc/core";
import {
  DirectionalLight,
  Mesh,
  Model,
  WebGLLayer,
  createWebGLGeometry,
  useOrbitCamera,
  type CRCWebGLVector3,
} from "@crc/webgl";
import {
  useGLTF,
  type CRCGLTFSource,
  type CRCWebGLAssetLoadResult,
} from "@crc/webgl/gltf";
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from "./types";

export const STATIC_GLB_SLICE_ACTION_IDS = [
  "show-primary",
  "show-replacement",
  "show-malformed",
  "remove-model",
  "remount-model",
  "reset",
] as const;

export type StaticGLBSliceAction = (typeof STATIC_GLB_SLICE_ACTION_IDS)[number];
export type StaticGLBSliceSource = "primary" | "replacement" | "malformed";
export type StaticGLBSliceStatus = "loading" | "ready" | "error" | "removed";

export interface StaticGLBSliceState {
  readonly source: StaticGLBSliceSource;
  readonly status: StaticGLBSliceStatus;
  readonly revision: number;
  readonly modelSelections: number;
  readonly lastTarget: "model" | null;
  readonly focusTarget: "model" | "none";
  readonly orbitPosition: CRCWebGLVector3;
  readonly assetBounds: Readonly<{
    readonly min: CRCWebGLVector3;
    readonly max: CRCWebGLVector3;
  }> | null;
  readonly errorMessage: string | null;
}

interface StaticGLBSliceConfiguration {
  readonly source: StaticGLBSliceSource;
  readonly visible: boolean;
}

export const STATIC_GLB_SLICE_PROBES = {
  tallPrimitive: { x: 335, y: 205 },
  compactPrimitive: { x: 410, y: 210 },
  orbitStart: { x: 668, y: 66 },
  orbitEnd: { x: 590, y: 118 },
} as const;

const SOURCE_BY_MODE: Readonly<Record<StaticGLBSliceSource, CRCGLTFSource>> = {
  primary: "/models/crc-static-glb-slice.glb",
  replacement: "/models/crc-static-glb-slice.glb?replacement=1",
  malformed: "/models/crc-static-glb-malformed.glb",
};

const groundGeometry = createWebGLGeometry({
  positions: [-4, 0, -3, 4, 0, -3, 4, 0, 3, -4, 0, 3],
  normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  indices: [0, 2, 1, 0, 3, 2],
});

function Loader({
  source,
  onLoadResult,
  onModelClick,
  onModelFocus,
  onModelBlur,
  onOrbitPosition,
}: {
  readonly source: CRCGLTFSource;
  readonly onLoadResult: (result: CRCWebGLAssetLoadResult) => void;
  readonly onModelClick: () => void;
  readonly onModelFocus: () => void;
  readonly onModelBlur: () => void;
  readonly onOrbitPosition: (position: CRCWebGLVector3) => void;
}) {
  const loaded = useGLTF(source);
  const orbit = useOrbitCamera({
    orbitPoint: [0, 0.5, 0],
    initialPosition: [4, 3, 6],
    minDistance: 3,
    maxDistance: 14,
  });
  useWhenChanged(() => onLoadResult(loaded), [loaded]);
  useWhenChanged(
    () => onOrbitPosition(orbit.position),
    [orbit.position[0], orbit.position[1], orbit.position[2]],
  );
  const model =
    loaded.status === "ready"
      ? createElement(Model, {
          asset: loaded.asset,
          keyboardFocusable: true,
          style: { color: "#ffffff", cursor: "pointer" },
          onClick: onModelClick,
          onFocus: onModelFocus,
          onBlur: onModelBlur,
        })
      : null;
  const webgl = createElement(WebGLLayer, {
    camera: {
      type: "perspective",
      position: orbit.position,
      lookAt: orbit.lookAt,
      up: [0, 1, 0],
      fieldOfViewDegrees: 48,
      near: 0.1,
      far: 100,
    },
    style: { width: 720, height: 420, shadows: "medium" },
    children: [
      createElement(DirectionalLight, {
        style: {
          color: "#fff1d6",
          intensity: 2.1,
          rotationXDegrees: -42,
          rotationYDegrees: 35,
        },
      }),
      model,
      createElement(Mesh, {
        geometry: groundGeometry,
        pointerEvents: "none",
        style: {
          color: "#64748b",
          lit: true,
          material: { type: "lambert" },
          receiveShadow: true,
        },
      }),
    ],
  });
  const status =
    loaded.status === "ready"
      ? []
      : [
          createElement(Rectangle, {
            key: "status-background",
            pointerEvents: "none",
            style: {
              x: 176,
              y: 174,
              width: 368,
              height: 72,
              fill:
                loaded.status === "error"
                  ? "rgb(127 29 29 / 92%)"
                  : "rgb(15 23 42 / 88%)",
              stroke: loaded.status === "error" ? "#fca5a5" : "#7dd3fc",
              strokeWidth: 2,
              cornerRadius: 12,
            },
          }),
          createElement(Text, {
            key: "status-message",
            pointerEvents: "none",
            style: {
              x: 360,
              y: 216,
              fill: "#f8fafc",
              font: "700 16px sans-serif",
              textAlign: "center",
            },
            children:
              loaded.status === "error"
                ? "THE GLB COULD NOT BE LOADED"
                : "LOADING STATIC GLB…",
          }),
        ];
  const group = createElement(Group, {
    ...orbit.handlers,
    children: [
      createElement(Rectangle, {
        key: "background",
        pointerEvents: "none",
        style: { width: 720, height: 420, fill: "#0f2133" },
      }),
      createElement(Rectangle, {
        key: "orbit-target",
        style: { width: 720, height: 420, fill: "transparent" },
      }),
      webgl,
      ...status,
    ],
  });
  return createElement(FocusManagement, { children: group });
}

function StaticGLBSliceHarness({
  configuration,
  onLoadResult,
  onModelClick,
  onModelFocus,
  onModelBlur,
  onOrbitPosition,
}: {
  readonly configuration: Signal<StaticGLBSliceConfiguration>;
  readonly onLoadResult: (result: CRCWebGLAssetLoadResult) => void;
  readonly onModelClick: () => void;
  readonly onModelFocus: () => void;
  readonly onModelBlur: () => void;
  readonly onOrbitPosition: (position: CRCWebGLVector3) => void;
}) {
  const current = configuration.get();
  if (!current.visible) return null;
  return createElement(Loader, {
    source: SOURCE_BY_MODE[current.source],
    onLoadResult,
    onModelClick,
    onModelFocus,
    onModelBlur,
    onOrbitPosition,
  });
}

function initialState(): StaticGLBSliceState {
  return {
    source: "primary",
    status: "loading",
    revision: 0,
    modelSelections: 0,
    lastTarget: null,
    focusTarget: "none",
    orbitPosition: [4, 3, 6],
    assetBounds: null,
    errorMessage: null,
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForSettled(read: () => StaticGLBSliceState): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await nextFrame();
    if (read().status !== "loading") {
      await nextFrame();
      return;
    }
  }
  throw new Error(
    "Static GLB feedback slice did not settle within 120 frames.",
  );
}

async function mountStaticGLBSlice(
  context: ScenarioMountContext<StaticGLBSliceState>,
): Promise<ScenarioController<StaticGLBSliceState>> {
  let disposed = false;
  let state = initialState();
  let currentConfiguration: StaticGLBSliceConfiguration = {
    source: "primary",
    visible: true,
  };
  const configuration = signal(currentConfiguration, {
    debugName: "static GLB feedback controls",
  });
  const publish = () => context.onStateChange?.({ ...state });
  const updateState = (update: Partial<StaticGLBSliceState>) => {
    state = { ...state, ...update };
    publish();
  };
  const runtime: CRCController = crc(
    context.canvas,
    createElement(StaticGLBSliceHarness, {
      configuration,
      onLoadResult: (loaded) => {
        if (loaded.status === "loading") {
          updateState({
            status: "loading",
            assetBounds: null,
            errorMessage: null,
          });
        } else if (loaded.status === "ready") {
          updateState({
            status: "ready",
            assetBounds: {
              min: [...loaded.asset.bounds.min] as CRCWebGLVector3,
              max: [...loaded.asset.bounds.max] as CRCWebGLVector3,
            },
            errorMessage: null,
          });
        } else {
          updateState({
            status: "error",
            assetBounds: null,
            errorMessage: loaded.error.message,
          });
        }
      },
      onModelClick: () =>
        updateState({
          lastTarget: "model",
          modelSelections: state.modelSelections + 1,
        }),
      onModelFocus: () => updateState({ focusTarget: "model" }),
      onModelBlur: () => updateState({ focusTarget: "none" }),
      onOrbitPosition: (position) =>
        updateState({
          orbitPosition: [...position] as CRCWebGLVector3,
        }),
    }),
    { pixelRatio: 1 },
  );
  publish();
  await waitForSettled(() => state);

  const assertActive = () => {
    if (disposed) {
      throw new Error(
        "Cannot operate on a disposed static GLB feedback slice.",
      );
    }
  };
  const showSource = async (source: StaticGLBSliceSource) => {
    assertActive();
    currentConfiguration = {
      source,
      visible: true,
    };
    updateState({
      source,
      status: "loading",
      revision: state.revision + 1,
      lastTarget: null,
      focusTarget: "none",
      assetBounds: null,
      errorMessage: null,
    });
    configuration.set(currentConfiguration);
    await waitForSettled(() => state);
  };
  const reset = async () => {
    if (
      currentConfiguration.visible &&
      currentConfiguration.source === "primary"
    ) {
      currentConfiguration = { ...currentConfiguration, visible: false };
      configuration.set(currentConfiguration);
      await nextFrame();
      await nextFrame();
    }
    await showSource("primary");
  };

  return {
    getState: () => ({ ...state }),
    perform: async (actionId) => {
      assertActive();
      if (
        !(STATIC_GLB_SLICE_ACTION_IDS as readonly string[]).includes(actionId)
      ) {
        throw new Error(
          `Static GLB feedback slice does not support action "${actionId}".`,
        );
      }
      const action = actionId as StaticGLBSliceAction;
      if (action === "show-primary" || action === "reset") {
        await reset();
        return;
      }
      if (action === "show-replacement") {
        await showSource("replacement");
        return;
      }
      if (action === "show-malformed") {
        await showSource("malformed");
        return;
      }
      if (action === "remove-model") {
        currentConfiguration = {
          ...currentConfiguration,
          visible: false,
        };
        updateState({
          status: "removed",
          revision: state.revision + 1,
          lastTarget: null,
          focusTarget: "none",
          assetBounds: null,
          errorMessage: null,
        });
        configuration.set(currentConfiguration);
        await nextFrame();
        await nextFrame();
        return;
      }
      await showSource(currentConfiguration.source);
    },
    reset,
    settled: () => waitForSettled(() => state),
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
    },
  };
}

export const staticGLBSliceScenario: ScenarioDefinition<StaticGLBSliceState> = {
  id: "static-glb",
  sourceId: "static-glb-feedback-example",
  actionIds: STATIC_GLB_SLICE_ACTION_IDS,
  mount: mountStaticGLBSlice,
  formatState: (state) => [
    { label: "Source", value: state.source },
    { label: "Status", value: state.status },
    { label: "Revision", value: String(state.revision) },
    { label: "Selections", value: String(state.modelSelections) },
    { label: "Focus", value: state.focusTarget },
    {
      label: "Orbit",
      value: state.orbitPosition.map((value) => value.toFixed(2)).join(", "),
    },
    { label: "Error", value: state.errorMessage ?? "none" },
  ],
};
