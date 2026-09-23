import {
  crc,
  createElement,
  signal,
  type CRCController,
} from "@crc/core";
import type { CRCWebGLVector3 } from "@crc/webgl";
import {
  STATIC_GLB_SLICE_SOURCE_ID,
  StaticGLBSliceHarness,
  type StaticGLBSliceConfiguration,
  type StaticGLBSliceSource,
} from "./static-glb-slice.example";
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from "./types";

export type { StaticGLBSliceSource } from "./static-glb-slice.example";

export const STATIC_GLB_SLICE_ACTION_IDS = [
  "show-primary",
  "show-replacement",
  "show-malformed",
  "remove-model",
  "remount-model",
  "reset",
] as const;

export type StaticGLBSliceAction = (typeof STATIC_GLB_SLICE_ACTION_IDS)[number];
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

export const STATIC_GLB_SLICE_PROBES = {
  tallPrimitive: { x: 335, y: 205 },
  compactPrimitive: { x: 410, y: 210 },
  orbitStart: { x: 668, y: 66 },
  orbitEnd: { x: 590, y: 118 },
} as const;

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
  const remount = async () => {
    const source = currentConfiguration.source;
    currentConfiguration = { ...currentConfiguration, visible: false };
    configuration.set(currentConfiguration);
    await nextFrame();
    await nextFrame();
    await showSource(source);
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
      await remount();
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
  sourceId: STATIC_GLB_SLICE_SOURCE_ID,
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
