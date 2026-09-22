import type * as THREE from "three";
import type {
  CRCEventHandlers,
  CRCPointerEvents,
  CRCRenderLayerContext,
  CRCRenderLayerFrame,
  CRCRenderLayerHit,
  CRCRenderLayerSize,
  LayoutBox,
} from "@crc/core";

export interface CRCThreeLayerResources {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
}

export interface CRCThreeTarget {
  readonly object: THREE.Object3D;
  readonly handlers?: CRCEventHandlers;
  readonly pointerEvents?: CRCPointerEvents;
  readonly cursor?: string;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

export type CRCThreePickResult = CRCRenderLayerHit<THREE.Object3D>;

export type CRCThreeRendererOptions = Omit<
  THREE.WebGLRendererParameters,
  "canvas" | "alpha"
>;

export interface CRCThreeInputBridge {
  connect<Control>(create: (element: HTMLElement) => Control): Control;
}

export type CRCThreePicker = (
  point: Readonly<{ x: number; y: number }>,
) => CRCThreePickResult;

export interface CRCThreeLayerContext extends CRCRenderLayerContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly input: CRCThreeInputBridge;
}

export interface CRCThreeLayerDefinition<
  Props,
  Resources extends CRCThreeLayerResources,
> {
  readonly renderer?: CRCThreeRendererOptions;
  create(
    context: CRCThreeLayerContext,
    initialProps: Readonly<Props>,
  ): Resources;
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: CRCThreeLayerContext,
  ): void;
  resize?(
    resources: Resources,
    size: CRCRenderLayerSize,
    context: CRCThreeLayerContext,
  ): void;
  render?(
    resources: Resources,
    frame: CRCRenderLayerFrame,
    context: CRCThreeLayerContext,
  ): void;
  targets?(
    resources: Resources,
    props: Readonly<Props>,
  ): Iterable<CRCThreeTarget>;
  pick?(resources: Resources, context: CRCThreeLayerContext): CRCThreePicker;
  dispose?(resources: Resources, context: CRCThreeLayerContext): void;
}
