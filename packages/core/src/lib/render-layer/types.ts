import type { CRCComponent } from "../element/types.js";
import type { LayoutBox } from "../layout/types.js";
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
  CRCPointerEvents,
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

export type CRCRenderLayerHit<Target extends object> =
  | { readonly kind: "miss" }
  | { readonly kind: "block" }
  | { readonly kind: "target"; readonly target: Target };

export interface CRCRenderLayerTarget<Target extends object> {
  readonly target: Target;
  readonly handlers?: CRCEventHandlers;
  readonly pointerEvents?: CRCPointerEvents;
  readonly cursor?: string;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

export interface CRCRenderLayerInput<Target extends object> {
  readonly type:
    | "pointerdown"
    | "pointermove"
    | "pointerup"
    | "pointercancel"
    | "wheel"
    | "contextmenu"
    | "click";
  readonly point: Readonly<{ x: number; y: number }>;
  readonly hit: CRCRenderLayerHit<Target>;
  readonly originalEvent: PointerEvent | WheelEvent | MouseEvent;
  setPointerCapture(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
}

export interface CRCRenderLayerInteractionSnapshot<Target extends object> {
  readonly targets: Iterable<CRCRenderLayerTarget<Target>>;
  hitTest(point: Readonly<{ x: number; y: number }>): CRCRenderLayerHit<Target>;
  onInput?(input: Readonly<CRCRenderLayerInput<Target>>): void;
}

export interface CRCRenderLayerInteraction<
  Props,
  Resources,
  Target extends object,
> {
  settle(
    resources: Resources,
    props: Readonly<Props>,
    size: Readonly<CRCRenderLayerSize>,
  ): CRCRenderLayerInteractionSnapshot<Target>;
}

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
  interaction?: CRCRenderLayerInteraction<Props, Resources, Target>;
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
