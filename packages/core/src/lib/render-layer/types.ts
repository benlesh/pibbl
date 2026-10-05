import type { defineRenderLayer } from './define-render-layer.js';
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

/**
 * Logical surface size, backing-store dimensions, and effective pixel ratios of an external render
 * layer.
 *
 * @see {@link CRCRenderLayerDefinition}
 * @see {@link CRCRenderLayerContext}
 * @see {@link CRCRenderLayerInteraction}
 */
export interface CRCRenderLayerSize {
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link CRCRenderLayerSize}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link CRCRenderLayerSize}.
   */
  readonly height: number;
  /** Width of the backing raster in physical pixels. See {@link CRCRenderLayerSize}. */
  readonly backingWidth: number;
  /** Height of the backing raster in physical pixels. See {@link CRCRenderLayerSize}. */
  readonly backingHeight: number;
  /**
   * Effective ratio of backing pixels to logical units on the x axis. See
   * {@link CRCRenderLayerSize}.
   */
  readonly pixelRatioX: number;
  /**
   * Effective ratio of backing pixels to logical units on the y axis. See
   * {@link CRCRenderLayerSize}.
   */
  readonly pixelRatioY: number;
}

/**
 * Shared scheduler timing and invalidation supplied to an external renderer for one frame.
 *
 * @see {@link CRCRenderLayerDefinition}
 */
export interface CRCRenderLayerFrame {
  /** Identifier of the shared scheduler frame. See {@link CRCRenderLayerFrame}. */
  readonly frameId: number;
  /** Current shared logical time in milliseconds. See {@link CRCRenderLayerFrame}. */
  readonly time: number;
  /** Elapsed frame time in milliseconds. See {@link CRCRenderLayerFrame}. */
  readonly delta: number;
  /** Elapsed frame time in seconds. See {@link CRCRenderLayerFrame}. */
  readonly deltaSeconds: number;
  /** Requests another CRC render through the shared scheduler. See {@link CRCRenderLayerFrame}. */
  invalidate(): void;
}

/**
 * The CRC-owned offscreen canvas, current size, and frame-invalidation capability.
 *
 * @see {@link CRCRenderLayerSize}
 * @see {@link CRCRenderLayerDefinition}
 */
export interface CRCRenderLayerContext {
  /** Canvas surface associated with this resource or mount. See {@link CRCRenderLayerContext}. */
  readonly canvas: OffscreenCanvas;
  /** Current logical dimensions, backing-store dimensions, and effective pixel ratios. See {@link CRCRenderLayerSize}. */
  readonly size: CRCRenderLayerSize;
  /**
   * Requests another CRC render through the shared scheduler. See {@link CRCRenderLayerContext}.
   */
  invalidate(): void;
}

/**
 * Layout and outer Canvas composition style for an external render layer.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link CRCRenderLayerComponentProps}
 */
export interface CRCRenderLayerStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle {}

/**
 * A hit-test decision: pass through, block lower paint, or select one logical target.
 *
 * @see {@link CRCRenderLayerInput}
 * @see {@link CRCRenderLayerInteractionSnapshot}
 */
export type CRCRenderLayerHit<Target extends object> =
  | {
      /** Selects the kind of geometry, material, or result. See {@link CRCRenderLayerHit}. */
      readonly kind: "miss";
    }
  | {
      /** Selects the kind of geometry, material, or result. See {@link CRCRenderLayerHit}. */
      readonly kind: "block";
    }
  | {
      /** Selects the kind of geometry, material, or result. See {@link CRCRenderLayerHit}. */
      readonly kind: "target";
      /** The selected logical target or target configuration. See {@link CRCRenderLayerHit}. */
      readonly target: Target;
    };

/**
 * Stable target identity with event, cursor, and keyboard-focus metadata.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCPointerEvents}
 * @see {@link LayoutBox}
 * @see {@link CRCRenderLayerInteractionSnapshot}
 */
export interface CRCRenderLayerTarget<Target extends object> {
  /** The selected logical target or target configuration. See {@link CRCRenderLayerTarget}. */
  readonly target: Target;
  /** Event handlers dispatched for this logical target. See {@link CRCEventHandlers}. */
  readonly handlers?: CRCEventHandlers;
  /** Whether this content participates in pointer targeting. See {@link CRCPointerEvents}. */
  readonly pointerEvents?: CRCPointerEvents;
  /** Cursor shown while this target owns pointer presentation. See {@link CRCRenderLayerTarget}. */
  readonly cursor?: string;
  /** Whether the target may receive keyboard focus. See {@link CRCRenderLayerTarget}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

/**
 * CRC-routed pointer input in layer-local coordinates with pointer-capture operations.
 *
 * @see {@link CRCRenderLayerHit}
 * @see {@link CRCRenderLayerInteractionSnapshot}
 */
export interface CRCRenderLayerInput<Target extends object> {
  /**
   * Selects `"pointerdown"` , `"pointermove"` , `"pointerup"` , `"pointercancel"` , `"wheel"` ,
   * `"contextmenu"` , `"click"` for type. See {@link CRCRenderLayerInput}.
   */
  readonly type:
    | "pointerdown"
    | "pointermove"
    | "pointerup"
    | "pointercancel"
    | "wheel"
    | "contextmenu"
    | "click";
  /**
   * Pointer position in the external layer's logical local coordinates. See
   * {@link CRCRenderLayerInput}.
   */
  readonly point: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link CRCRenderLayerInput}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link CRCRenderLayerInput}.
     */
    y: number;
  }>;
  /** Target, block, or miss decision associated with the input. See {@link CRCRenderLayerHit}. */
  readonly hit: CRCRenderLayerHit<Target>;
  /** The originating browser event. See {@link CRCRenderLayerInput}. */
  readonly originalEvent: PointerEvent | WheelEvent | MouseEvent;
  /**
   * Captures the pointer for this logical target until release or cancellation. See
   * {@link CRCRenderLayerInput}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  setPointerCapture(pointerId: number): void;
  /**
   * Releases this target's capture of the identified pointer. See {@link CRCRenderLayerInput}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  releasePointerCapture(pointerId: number): void;
}

/**
 * Targets and hit testing committed atomically with one rendered bitmap generation.
 *
 * @see {@link CRCRenderLayerTarget}
 * @see {@link CRCRenderLayerHit}
 * @see {@link CRCRenderLayerInput}
 * @see {@link CRCRenderLayerInteraction}
 */
export interface CRCRenderLayerInteractionSnapshot<Target extends object> {
  /** Logical targets exposed by this committed generation. See {@link CRCRenderLayerTarget}. */
  readonly targets: Iterable<CRCRenderLayerTarget<Target>>;
  /**
   * Resolves a layer-local point to a target, block, or miss decision. See
   * {@link CRCRenderLayerHit}.
   * @param point - Pointer position in layer-local logical coordinates.
   * @returns A target hit, a blocking hit, or a miss for this interaction generation. See
   * {@link CRCRenderLayerHit} .
   */
  hitTest(
    point: Readonly<{
      /**
       * Horizontal coordinate or displacement in the containing coordinate system. See
       * {@link CRCRenderLayerInteractionSnapshot}.
       */
      x: number;
      /**
       * Vertical coordinate or displacement in the containing coordinate system. See
       * {@link CRCRenderLayerInteractionSnapshot}.
       */
      y: number;
    }>,
  ): CRCRenderLayerHit<Target>;
  /**
   * Receives CRC-routed input for this committed interaction generation. See
   * {@link CRCRenderLayerInteractionSnapshot}.
   * @param input - CRC-routed input for the committed interaction generation. See
   * {@link CRCRenderLayerInput} .
   */
  onInput?(input: Readonly<CRCRenderLayerInput<Target>>): void;
}

/**
 * Settles renderer resources into the interaction snapshot for a committed generation.
 *
 * @see {@link CRCRenderLayerSize}
 * @see {@link CRCRenderLayerInteractionSnapshot}
 * @see {@link CRCRenderLayerDefinition}
 */
export interface CRCRenderLayerInteraction<Props, Resources, Target extends object> {
  /**
   * Captures interaction state corresponding to the generation being committed. See
   * {@link CRCRenderLayerInteractionSnapshot}.
   * @param resources - Resources representing the rendered scene.
   * @param props - Props used for the committed render.
   * @param size - Logical and backing dimensions for this generation. See
   * {@link CRCRenderLayerSize} .
   * @returns The interaction snapshot to commit together with the rendered bitmap. See
   * {@link CRCRenderLayerInteractionSnapshot} .
   */
  settle(
    resources: Resources,
    props: Readonly<Props>,
    size: Readonly<CRCRenderLayerSize>,
  ): CRCRenderLayerInteractionSnapshot<Target>;
}

/**
 * CRC-owned style, event, focus, and miss-handling props shared by external layers.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCRenderLayerStyle}
 * @see {@link CRCRenderLayerProps}
 */
export interface CRCRenderLayerComponentProps
  extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions {
  /** Declared presentation and layout properties. See {@link CRCRenderLayerStyle}. */
  readonly style?: CRCRenderLayerStyle;
  /**
   * How a layer miss participates in arbitration with lower painted content. See
   * {@link CRCRenderLayerComponentProps}.
   */
  readonly missBehavior?: "pass-through" | "block" | "target-layer";
}

/**
 * Resource creation, update, resizing, rendering, disposal, and interaction lifecycle of an
 * external layer.
 *
 * @see {@link CRCRenderLayerContext}
 * @see {@link CRCRenderLayerSize}
 * @see {@link CRCRenderLayerFrame}
 * @see {@link CRCRenderLayerInteraction}
 * @see {@link defineRenderLayer}
 */
export interface CRCRenderLayerDefinition<
  Props,
  Resources,
  Target extends object = object,
> {
  /**
   * Allocates application resources once for this mounted layer identity. See
   * {@link CRCRenderLayerDefinition}.
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link CRCRenderLayerContext} .
   * @param initialProps - Props supplied for the first mounted render.
   * @returns Persistent application resources retained until dispose.
   */
  create(
    context: Readonly<CRCRenderLayerContext>,
    initialProps: Readonly<Props>,
  ): Resources;
  /**
   * Applies the latest props to existing resources before rendering. See
   * {@link CRCRenderLayerDefinition}.
   * @param resources - Resources previously returned by create.
   * @param props - Latest component props.
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link CRCRenderLayerContext} .
   */
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  /**
   * Adjusts resources to the newly resolved logical and backing-store dimensions. See
   * {@link CRCRenderLayerDefinition}.
   * @param resources - Resources previously returned by create.
   * @param size - New logical and backing dimensions. See {@link CRCRenderLayerSize}.
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link CRCRenderLayerContext} .
   */
  resize?(
    resources: Resources,
    size: Readonly<CRCRenderLayerSize>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  /**
   * Draws this generation using CRC's frame; invalidate only when another frame is needed. See
   * {@link CRCRenderLayerDefinition}.
   * @param resources - Resources previously returned by create.
   * @param frame - Shared CRC frame timing and invalidation service. See
   * {@link CRCRenderLayerFrame} .
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link CRCRenderLayerContext} .
   */
  render(
    resources: Resources,
    frame: Readonly<CRCRenderLayerFrame>,
    context: Readonly<CRCRenderLayerContext>,
  ): void;
  /**
   * Releases application resources when the mounted layer is torn down. See
   * {@link CRCRenderLayerDefinition}.
   * @param resources - Resources previously returned by create, whose application-owned resources
   * must be released.
   * @param context - Mount-owned context for this resource lifetime. See
   * {@link CRCRenderLayerContext} .
   */
  dispose?(resources: Resources, context: Readonly<CRCRenderLayerContext>): void;
  /**
   * Builds the interaction snapshot committed with the rendered bitmap. See
   * {@link CRCRenderLayerInteraction}.
   */
  interaction?: CRCRenderLayerInteraction<Props, Resources, Target>;
}

type CRCRenderLayerReservedProp =
  | "key"
  | "style"
  | "missBehavior"
  | keyof CRCEventHandlers
  | keyof CRCEventFocusOptions
  | keyof CRCEventParticipationOptions;

/**
 * Application props combined with layer props; reserved CRC prop collisions are rejected.
 *
 * @see {@link CRCRenderLayerComponentProps}
 * @see {@link defineRenderLayer}
 */
export type CRCRenderLayerProps<Props> =
  Extract<keyof Props, CRCRenderLayerReservedProp> extends never
    ? Props & CRCRenderLayerComponentProps
    : never;

export type CRCRenderLayerComponent<Props> = CRCComponent<
  CRCRenderLayerProps<Props>
>;
