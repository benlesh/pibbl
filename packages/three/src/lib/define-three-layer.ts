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
        assertSynchronous(resources, "create");
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
        try {
          input.dispose();
        } finally {
          renderer.dispose();
        }
        throw error;
      }
    },
    update(adapter, props) {
      assertSynchronous(
        immutableDefinition.update?.(
          adapter.resources,
          props,
          adapter.threeContext,
        ),
        "update",
      );
      adapter.props = props;
    },
    resize(adapter, size) {
      adapter.renderer.setPixelRatio(1);
      adapter.renderer.setSize(size.backingWidth, size.backingHeight, false);
      assertSynchronous(
        immutableDefinition.resize?.(
          adapter.resources,
          size,
          adapter.threeContext,
        ),
        "resize",
      );
    },
    render(adapter, frame) {
      if (immutableDefinition.render) {
        assertSynchronous(
          immutableDefinition.render(
            adapter.resources,
            frame,
            adapter.threeContext,
          ),
          "render",
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
        assertSynchronous(
          immutableDefinition.dispose?.(
            adapter.resources,
            adapter.threeContext,
          ),
          "dispose",
        );
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
        const declaredTargets =
          immutableDefinition.targets?.(adapter.resources, props) ?? [];
        assertSynchronous(declaredTargets, "targets");
        const declarations = Array.from(declaredTargets);
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
        let hitTest;
        if (immutableDefinition.pick) {
          const picker = immutableDefinition.pick(
            adapter.resources,
            adapter.threeContext,
          );
          assertSynchronous(picker, "pick");
          hitTest = (point: Readonly<{ x: number; y: number }>) => {
            const result = picker(point);
            assertSynchronous(result, "picker");
            return result;
          };
        } else {
          hitTest = createDefaultPicker(
            adapter.resources.scene,
            adapter.resources.camera,
            adapter.raycaster,
            size,
            targetMap,
            disabledRoots,
          );
        }
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

function assertSynchronous(value: unknown, callback: string): void {
  if (value && typeof (value as { then?: unknown }).then === "function") {
    throw new TypeError(`defineThreeLayer ${callback}() must be synchronous.`);
  }
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
