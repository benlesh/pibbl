import type { defineRenderLayer } from './define-render-layer.js';
import type { PibblComponent } from "../element/types.js";
import type { LayoutBox } from "../layout/types.js";
import type {
  PibblEventFocusOptions,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  PibblPointerEvents,
} from "../events/types.js";
import type { BoxStyle, LayoutItemStyle } from "../style/types.js";
import type { SystemStyle } from "../types.js";

/**
 * Logical surface size, backing-store dimensions, and effective pixel ratios of an external render
 * layer.
 *
 * @see {@link PibblRenderLayerDefinition}
 * @see {@link PibblRenderLayerContext}
 * @see {@link PibblRenderLayerInteraction}
 */
export interface PibblRenderLayerSize {
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link PibblRenderLayerSize}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link PibblRenderLayerSize}.
   */
  readonly height: number;
  /** Width of the backing raster in physical pixels. See {@link PibblRenderLayerSize}. */
  readonly backingWidth: number;
  /** Height of the backing raster in physical pixels. See {@link PibblRenderLayerSize}. */
  readonly backingHeight: number;
  /**
   * Effective ratio of backing pixels to logical units on the x axis. See
   * {@link PibblRenderLayerSize}.
   */
  readonly pixelRatioX: number;
  /**
   * Effective ratio of backing pixels to logical units on the y axis. See
   * {@link PibblRenderLayerSize}.
   */
  readonly pixelRatioY: number;
}

/**
 * Shared scheduler timing and invalidation supplied to an external renderer for one frame.
 *
 * @see {@link PibblRenderLayerDefinition}
 */
export interface PibblRenderLayerFrame {
  /** Identifier of the shared scheduler frame. See {@link PibblRenderLayerFrame}. */
  readonly frameId: number;
  /** Current shared logical time in milliseconds. See {@link PibblRenderLayerFrame}. */
  readonly time: number;
  /** Elapsed frame time in milliseconds. See {@link PibblRenderLayerFrame}. */
  readonly delta: number;
  /** Elapsed frame time in seconds. See {@link PibblRenderLayerFrame}. */
  readonly deltaSeconds: number;
  /** Requests another Pibbl render through the shared scheduler. See {@link PibblRenderLayerFrame}. */
  invalidate(): void;
}

/**
 * The Pibbl-owned offscreen canvas, current size, and frame-invalidation capability.
 *
 * @see {@link PibblRenderLayerSize}
 * @see {@link PibblRenderLayerDefinition}
 */
export interface PibblRenderLayerContext {
  /** Canvas surface associated with this resource or mount. See {@link PibblRenderLayerContext}. */
  readonly canvas: OffscreenCanvas;
  /** Current logical dimensions, backing-store dimensions, and effective pixel ratios. See {@link PibblRenderLayerSize}. */
  readonly size: PibblRenderLayerSize;
  /**
   * Requests another Pibbl render through the shared scheduler. See {@link PibblRenderLayerContext}.
   */
  invalidate(): void;
}

/**
 * Layout and outer Canvas composition style for an external render layer.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PibblRenderLayerComponentProps}
 */
export interface PibblRenderLayerStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle {}

/**
 * A hit-test decision: pass through, block lower paint, or select one logical target.
 *
 * @see {@link PibblRenderLayerInput}
 * @see {@link PibblRenderLayerInteractionSnapshot}
 */
export type PibblRenderLayerHit<Target extends object> =
  | {
      /** Selects the kind of geometry, material, or result. See {@link PibblRenderLayerHit}. */
      readonly kind: "miss";
    }
  | {
      /** Selects the kind of geometry, material, or result. See {@link PibblRenderLayerHit}. */
      readonly kind: "block";
    }
  | {
      /** Selects the kind of geometry, material, or result. See {@link PibblRenderLayerHit}. */
      readonly kind: "target";
      /** The selected logical target or target configuration. See {@link PibblRenderLayerHit}. */
      readonly target: Target;
    };

/**
 * Stable target identity with event, cursor, and keyboard-focus metadata.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblPointerEvents}
 * @see {@link LayoutBox}
 * @see {@link PibblRenderLayerInteractionSnapshot}
 */
export interface PibblRenderLayerTarget<Target extends object> {
  /** The selected logical target or target configuration. See {@link PibblRenderLayerTarget}. */
  readonly target: Target;
  /** Event handlers dispatched for this logical target. See {@link PibblEventHandlers}. */
  readonly handlers?: PibblEventHandlers;
  /** Whether this content participates in pointer targeting. See {@link PibblPointerEvents}. */
  readonly pointerEvents?: PibblPointerEvents;
  /** Cursor shown while this target owns pointer presentation. See {@link PibblRenderLayerTarget}. */
  readonly cursor?: string;
  /** Whether the target may receive keyboard focus. See {@link PibblRenderLayerTarget}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
}

/**
 * Pibbl-routed pointer input in layer-local coordinates with pointer-capture operations.
 *
 * @see {@link PibblRenderLayerHit}
 * @see {@link PibblRenderLayerInteractionSnapshot}
 */
export interface PibblRenderLayerInput<Target extends object> {
  /**
   * Selects `"pointerdown"` , `"pointermove"` , `"pointerup"` , `"pointercancel"` , `"wheel"` ,
   * `"contextmenu"` , `"click"` for type. See {@link PibblRenderLayerInput}.
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
   * {@link PibblRenderLayerInput}.
   */
  readonly point: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link PibblRenderLayerInput}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link PibblRenderLayerInput}.
     */
    y: number;
  }>;
  /** Target, block, or miss decision associated with the input. See {@link PibblRenderLayerHit}. */
  readonly hit: PibblRenderLayerHit<Target>;
  /** The originating browser event. See {@link PibblRenderLayerInput}. */
  readonly originalEvent: PointerEvent | WheelEvent | MouseEvent;
  /**
   * Captures the pointer for this logical target until release or cancellation. See
   * {@link PibblRenderLayerInput}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  setPointerCapture(pointerId: number): void;
  /**
   * Releases this target's capture of the identified pointer. See {@link PibblRenderLayerInput}.
   * @param pointerId - Pointer identifier from the routed pointer event.
   */
  releasePointerCapture(pointerId: number): void;
}

/**
 * Targets and hit testing committed atomically with one rendered bitmap generation.
 *
 * @see {@link PibblRenderLayerTarget}
 * @see {@link PibblRenderLayerHit}
 * @see {@link PibblRenderLayerInput}
 * @see {@link PibblRenderLayerInteraction}
 */
export interface PibblRenderLayerInteractionSnapshot<Target extends object> {
  /** Logical targets exposed by this committed generation. See {@link PibblRenderLayerTarget}. */
  readonly targets: Iterable<PibblRenderLayerTarget<Target>>;
  /**
   * Resolves a layer-local point to a target, block, or miss decision. See
   * {@link PibblRenderLayerHit}.
   * @param point - Pointer position in layer-local logical coordinates.
   * @returns A target hit, a blocking hit, or a miss for this interaction generation. See
   * {@link PibblRenderLayerHit} .
   */
  hitTest(
    point: Readonly<{
      /**
       * Horizontal coordinate or displacement in the containing coordinate system. See
       * {@link PibblRenderLayerInteractionSnapshot}.
       */
      x: number;
      /**
       * Vertical coordinate or displacement in the containing coordinate system. See
       * {@link PibblRenderLayerInteractionSnapshot}.
       */
      y: number;
    }>,
  ): PibblRenderLayerHit<Target>;
  /**
   * Receives Pibbl-routed input for this committed interaction generation. See
   * {@link PibblRenderLayerInteractionSnapshot}.
   * @param input - Pibbl-routed input for the committed interaction generation. See
   * {@link PibblRenderLayerInput} .
   */
  onInput?(input: Readonly<PibblRenderLayerInput<Target>>): void;
}

/**
 * Settles renderer resources into the interaction snapshot for a committed generation.
 *
 * @see {@link PibblRenderLayerSize}
 * @see {@link PibblRenderLayerInteractionSnapshot}
 * @see {@link PibblRenderLayerDefinition}
 */
export interface PibblRenderLayerInteraction<Props, Resources, Target extends object> {
  /**
   * Captures interaction state corresponding to the generation being committed. See
   * {@link PibblRenderLayerInteractionSnapshot}.
   * @param resources - Resources representing the rendered scene.
   * @param props - Props used for the committed render.
   * @param size - Logical and backing dimensions for this generation. See
   * {@link PibblRenderLayerSize} .
   * @returns The interaction snapshot to commit together with the rendered bitmap. See
   * {@link PibblRenderLayerInteractionSnapshot} .
   */
  settle(
    resources: Resources,
    props: Readonly<Props>,
    size: Readonly<PibblRenderLayerSize>,
  ): PibblRenderLayerInteractionSnapshot<Target>;
}

/**
 * Pibbl-owned style, event, focus, and miss-handling props shared by external layers.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblRenderLayerStyle}
 * @see {@link PibblRenderLayerProps}
 */
export interface PibblRenderLayerComponentProps
  extends PibblEventHandlers, PibblEventFocusOptions, PibblEventParticipationOptions {
  /** Declared presentation and layout properties. See {@link PibblRenderLayerStyle}. */
  readonly style?: PibblRenderLayerStyle;
  /**
   * How a layer miss participates in arbitration with lower painted content. See
   * {@link PibblRenderLayerComponentProps}.
   */
  readonly missBehavior?: "pass-through" | "block" | "target-layer";
}

/**
 * Resource creation, update, resizing, rendering, disposal, and interaction lifecycle of an
 * external layer.
 *
 * @see {@link PibblRenderLayerContext}
 * @see {@link PibblRenderLayerSize}
 * @see {@link PibblRenderLayerFrame}
 * @see {@link PibblRenderLayerInteraction}
 * @see {@link defineRenderLayer}
 */
export interface PibblRenderLayerDefinition<
  Props,
  Resources,
  Target extends object = object,
> {
  /**
   * Allocates application resources once for this mounted layer identity. See
   * {@link PibblRenderLayerDefinition}.
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link PibblRenderLayerContext} .
   * @param initialProps - Props supplied for the first mounted render.
   * @returns Persistent application resources retained until dispose.
   */
  create(
    context: Readonly<PibblRenderLayerContext>,
    initialProps: Readonly<Props>,
  ): Resources;
  /**
   * Applies the latest props to existing resources before rendering. See
   * {@link PibblRenderLayerDefinition}.
   * @param resources - Resources previously returned by create.
   * @param props - Latest component props.
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link PibblRenderLayerContext} .
   */
  update?(
    resources: Resources,
    props: Readonly<Props>,
    context: Readonly<PibblRenderLayerContext>,
  ): void;
  /**
   * Adjusts resources to the newly resolved logical and backing-store dimensions. See
   * {@link PibblRenderLayerDefinition}.
   * @param resources - Resources previously returned by create.
   * @param size - New logical and backing dimensions. See {@link PibblRenderLayerSize}.
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link PibblRenderLayerContext} .
   */
  resize?(
    resources: Resources,
    size: Readonly<PibblRenderLayerSize>,
    context: Readonly<PibblRenderLayerContext>,
  ): void;
  /**
   * Draws this generation using Pibbl's frame; invalidate only when another frame is needed. See
   * {@link PibblRenderLayerDefinition}.
   * @param resources - Resources previously returned by create.
   * @param frame - Shared Pibbl frame timing and invalidation service. See
   * {@link PibblRenderLayerFrame} .
   * @param context - Mount-owned canvas, size, and invalidation services. See
   * {@link PibblRenderLayerContext} .
   */
  render(
    resources: Resources,
    frame: Readonly<PibblRenderLayerFrame>,
    context: Readonly<PibblRenderLayerContext>,
  ): void;
  /**
   * Releases application resources when the mounted layer is torn down. See
   * {@link PibblRenderLayerDefinition}.
   * @param resources - Resources previously returned by create, whose application-owned resources
   * must be released.
   * @param context - Mount-owned context for this resource lifetime. See
   * {@link PibblRenderLayerContext} .
   */
  dispose?(resources: Resources, context: Readonly<PibblRenderLayerContext>): void;
  /**
   * Builds the interaction snapshot committed with the rendered bitmap. See
   * {@link PibblRenderLayerInteraction}.
   */
  interaction?: PibblRenderLayerInteraction<Props, Resources, Target>;
}

type PibblRenderLayerReservedProp =
  | "key"
  | "style"
  | "missBehavior"
  | keyof PibblEventHandlers
  | keyof PibblEventFocusOptions
  | keyof PibblEventParticipationOptions;

/**
 * Application props combined with layer props; reserved Pibbl prop collisions are rejected.
 *
 * @see {@link PibblRenderLayerComponentProps}
 * @see {@link defineRenderLayer}
 */
export type PibblRenderLayerProps<Props> =
  Extract<keyof Props, PibblRenderLayerReservedProp> extends never
    ? Props & PibblRenderLayerComponentProps
    : never;

export type PibblRenderLayerComponent<Props> = PibblComponent<
  PibblRenderLayerProps<Props>
>;
