import { Raycaster, WebGLRenderer, type Object3D } from "three";
import {
  defineRenderLayer,
  type CRCRenderLayerContext,
  type CRCRenderLayerTarget,
} from "@crc/core";
import { createDefaultPicker } from "./default-picker.js";
import { projectObjectBounds } from "./project-bounds.js";
import {
  createThreeInputBridge,
  type ThreeInputBridgeController,
} from "./three-input-bridge.js";
import type {
  CRCThreeLayerContext,
  CRCThreeLayerDefinition,
  CRCThreeLayerResources,
  CRCThreeTarget,
} from "./types.js";

interface ThreeAdapterResources<
  Props,
  Resources extends CRCThreeLayerResources,
> {
  readonly renderer: WebGLRenderer;
  readonly input: ThreeInputBridgeController;
  readonly threeContext: CRCThreeLayerContext;
  readonly resources: Resources;
  readonly raycaster: Raycaster;
  props: Readonly<Props>;
}

export function defineThreeLayer<
  Props,
  Resources extends CRCThreeLayerResources,
>(definition: CRCThreeLayerDefinition<Props, Resources>) {
  const immutableDefinition = snapshotDefinition(definition);
  return defineRenderLayer<
    Props,
    ThreeAdapterResources<Props, Resources>,
    Object3D
  >({
    create(context, initialProps) {
      const renderer = new WebGLRenderer({
        ...immutableDefinition.renderer,
        canvas: context.canvas,
        alpha: true,
      });
      const input = createThreeInputBridge(context);
      const threeContext = createThreeContext(context, renderer, input);
      try {
        const resources = immutableDefinition.create(
          threeContext,
          initialProps,
        );
        assertThreeResources(resources);
        input.finishCreate();
        return {
          renderer,
          input,
          threeContext,
          resources,
          raycaster: new Raycaster(),
          props: initialProps,
        };
      } catch (error) {
        input.dispose();
        renderer.dispose();
        throw error;
      }
    },
    update(adapter, props) {
      immutableDefinition.update?.(
        adapter.resources,
        props,
        adapter.threeContext,
      );
      adapter.props = props;
    },
    resize(adapter, size) {
      adapter.renderer.setPixelRatio(1);
      adapter.renderer.setSize(size.backingWidth, size.backingHeight, false);
      immutableDefinition.resize?.(
        adapter.resources,
        size,
        adapter.threeContext,
      );
    },
    render(adapter, frame) {
      if (immutableDefinition.render) {
        immutableDefinition.render(
          adapter.resources,
          frame,
          adapter.threeContext,
        );
      } else {
        adapter.renderer.render(
          adapter.resources.scene,
          adapter.resources.camera,
        );
      }
    },
    dispose(adapter) {
      try {
        immutableDefinition.dispose?.(adapter.resources, adapter.threeContext);
      } finally {
        try {
          adapter.input.dispose();
        } finally {
          adapter.renderer.dispose();
        }
      }
    },
    interaction: {
      settle(adapter, props, size) {
        const declarations = Array.from(
          immutableDefinition.targets?.(adapter.resources, props) ?? [],
        );
        const targetMap = new Map<Object3D, CRCThreeTarget>();
        const disabledRoots = new Set<Object3D>();
        const targets: CRCRenderLayerTarget<Object3D>[] = [];
        for (const declaration of declarations) {
          targetMap.set(declaration.object, declaration);
          if (declaration.pointerEvents === "none") {
            disabledRoots.add(declaration.object);
          }
          const projectedBounds =
            declaration.keyboardFocusable &&
            !declaration.keyboardNavigationBounds
              ? projectObjectBounds(
                  declaration.object,
                  adapter.resources.camera,
                  size,
                )
              : declaration.keyboardNavigationBounds;
          targets.push({
            target: declaration.object,
            handlers: declaration.handlers,
            pointerEvents: declaration.pointerEvents,
            cursor: declaration.cursor,
            keyboardFocusable:
              declaration.keyboardFocusable && projectedBounds !== undefined,
            keyboardNavigationBounds: projectedBounds,
          });
        }
        const hitTest = immutableDefinition.pick
          ? immutableDefinition.pick(adapter.resources, adapter.threeContext)
          : createDefaultPicker(
              adapter.resources.scene,
              adapter.resources.camera,
              adapter.raycaster,
              size,
              targetMap,
              disabledRoots,
            );
        return {
          targets,
          hitTest,
          onInput: adapter.input.connected
            ? (input) => adapter.input.deliver(input)
            : undefined,
        };
      },
    },
  });
}

function createThreeContext(
  context: Readonly<CRCRenderLayerContext>,
  renderer: WebGLRenderer,
  input: ThreeInputBridgeController,
): CRCThreeLayerContext {
  return Object.freeze({
    canvas: context.canvas,
    get size() {
      return context.size;
    },
    invalidate: () => context.invalidate(),
    renderer,
    input,
  });
}

function assertThreeResources(
  resources: CRCThreeLayerResources,
): asserts resources is CRCThreeLayerResources {
  if (!resources?.scene?.isScene || !resources?.camera?.isCamera) {
    throw new TypeError(
      "defineThreeLayer create() must return Three scene and camera resources.",
    );
  }
}

function snapshotDefinition<Props, Resources extends CRCThreeLayerResources>(
  definition: CRCThreeLayerDefinition<Props, Resources>,
): CRCThreeLayerDefinition<Props, Resources> {
  return Object.freeze({
    renderer: definition.renderer
      ? Object.freeze({ ...definition.renderer })
      : undefined,
    create: definition.create,
    update: definition.update,
    resize: definition.resize,
    render: definition.render,
    targets: definition.targets,
    pick: definition.pick,
    dispose: definition.dispose,
  });
}
