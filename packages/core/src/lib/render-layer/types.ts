import type { CRCComponent } from "../element/types.js";
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from "../events/types.js";
import type { BoxStyle, LayoutItemStyle } from "../style/types.js";
import type { SystemStyle } from "../types.js";

export interface CRCRenderLayerSize {
  readonly width: number;
  readonly height: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly pixelRatioX: number;
  readonly pixelRatioY: number;
}

export interface CRCRenderLayerFrame {
  readonly frameId: number;
  readonly time: number;
  readonly delta: number;
  readonly deltaSeconds: number;
  invalidate(): void;
}

export interface CRCRenderLayerContext {
  readonly canvas: OffscreenCanvas;
  readonly size: CRCRenderLayerSize;
  invalidate(): void;
}

export interface CRCRenderLayerStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle {}

export interface CRCRenderLayerComponentProps
  extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions {
  readonly style?: CRCRenderLayerStyle;
  readonly missBehavior?: "pass-through" | "block" | "target-layer";
}

export interface CRCRenderLayerDefinition<
  Props,
  Resources,
  Target extends object = object,
> {
  create(
    context: Readonly<CRCRenderLayerContext>,
    initialProps: Readonly<Props>,
  ): Resources;
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  resize?(
    resources: Resources,
    size: Readonly<CRCRenderLayerSize>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  render(
    resources: Resources,
    frame: Readonly<CRCRenderLayerFrame>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  dispose?(
    resources: Resources,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
}

type CRCRenderLayerReservedProp =
  | "key"
  | "style"
  | "missBehavior"
  | keyof CRCEventHandlers
  | keyof CRCEventFocusOptions
  | keyof CRCEventParticipationOptions;

export type CRCRenderLayerProps<Props> =
  Extract<keyof Props, CRCRenderLayerReservedProp> extends never
    ? Props & CRCRenderLayerComponentProps
    : never;

export type CRCRenderLayerComponent<Props> = CRCComponent<
  CRCRenderLayerProps<Props>
>;
