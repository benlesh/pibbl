import type { CRCNodeInput } from "./element/types.js";
import type { CRCTransitionBinding } from "./transitions/binding.js";
import type { crc } from './crc.js';
import type { measureElement } from './layout/measure.js';
import type { ArcProps } from './components/arc.js';
import type { CircleProps } from './components/circle.js';
import type { EllipseProps } from './components/ellipse.js';
import type { definePrimitive } from './define-primitive.js';
import type { TexturePaint } from './textures/texture-protocol.js';
import type { ImgStyle, PaintStyle, RectStyle } from './style/types.js';
import type { HorizontalLineStyle } from './components/horizontal-line.js';
import type { VerticalLineStyle } from './components/vertical-line.js';
import type { useCanvasContext } from './hooks/use-canvas-context.js';
import type { HtmlBridge } from './html/types.js';
import type { HtmlFocusRegion } from './focus/html-focus-region.js';
import type { Teardowns } from "./teardowns.js";
import type { CRCSurfaceState } from "./surface/types.js";
import type { Constraints, LayoutBox, Size } from "./layout/types.js";
import type { NativeListenerHub } from "./events/native-listener-hub.js";
import type { CRCEventType as DOMCRCEventType } from "./events/types.js";
import type { CRCEventTargetSnapshot } from "./events/types.js";
import type { CRCEvent } from "./events/types.js";
import type {
  CRCEventNode,
  CRCEventListenerRegistration,
  CRCEventTargetRegistration,
} from "./events/registrations.js";
import type {
  CRCHitTestInput,
  CRCHitTestOutput,
  CRCPaintEntry,
  CRCNestedPaintEntry,
} from "./events/paint-entry.js";
import type { CRCElement, CRCElementType, CRCNode } from "./element/types.js";
import type { PendingRoot } from "./global-state.js";
import type { CRCFilter } from "./style/filter-types.js";
import type { CRCBackendDriver } from "./backend/types.js";
import type { OptionalService } from "./optional-services.js";
import type { SignalRenderConsumer } from "./signals/render-consumer.js";
import type { Signal, SignalValue } from "./signals/types.js";
export type {
  CRCComponent,
  CRCContainerChild,
  CRCElement,
  CRCElementType,
  CRCEmptyNode,
  CRCKey,
  CRCNode,
  CRCNodeInput,
  CRCPrimitiveComponent,
  CRCTextChild,
  CRCTextInput,
  CRCRenderResult,
  PrimitiveInputOf,
} from "./element/types.js";

/**
 * Transition bindings, pixel filters, and application-defined style extensions understood by the
 * runtime.
 *
 * @see {@link CRCFilter}
 * @see {@link CRCStyleRule}
 * @see {@link CRCResponsiveStyle}
 * @see {@link PrimitiveCapabilities}
 * @see {@link CRCTransitionBinding}
 */
export interface SystemStyle {
  /** Visibility-transition binding applied to this primitive and its captured descendants. See {@link SystemStyle}. */
  transition?: import("./transitions/binding.js").CRCTransitionBinding;
  /** Application-defined style payload passed through the runtime. See {@link SystemStyle}. */
  custom?: unknown;
  /**
   * Ordered pixel-only filters applied to the receiving primitive and its descendants. See
   * {@link CRCFilter}.
   */
  filter?: CRCFilter | readonly CRCFilter[];
}

type PrimitiveReservedKey = "key" | "style";

/**
 * Empty declaration-merging base for the optional official 2D physics package.
 *
 * @see {@link PrimitiveInput}
 * @see {@link ArcProps}
 * @see {@link CircleProps}
 * @see {@link EllipseProps}
 */
export interface CRCPhysics2DPropExtension {}

type UnionKeys<T> = T extends unknown ? keyof T : never;

/**
 * Resolved props passed into a primitive's rendering program.
 *
 * @see {@link PrimitiveCapabilities}
 * @see {@link PrimitiveRender}
 * @see {@link definePrimitive}
 */
export type PrimitiveProgramProps<P> = 0 extends 1 & P
  ? P
  : Extract<UnionKeys<P>, PrimitiveReservedKey> extends never
    ? P
    : never;

type RequiredKeys<T> = T extends unknown
  ? {
      [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? K : never;
    }[keyof T]
  : never;

/**
 * Makes the style prop required when its style type contains required fields.
 *
 * @see {@link PrimitiveInput}
 */
type StyleField<S> = [RequiredKeys<S>] extends [never]
  ? {
      /** Declared presentation and layout properties. See {@link SignalValue}. */
      style?: SignalValue<S | undefined>;
    }
  : {
      /** Declared presentation and layout properties. See {@link SignalValue}. */
      style: SignalValue<S>;
    };

type IsExactSignalValue<T> = [NonNullable<T>] extends [never] ?
  false :
  [NonNullable<T>] extends [Signal<any>] ? true : false;

type SignalProgramValue<T> = IsExactSignalValue<T> extends true ?
  T :
  SignalValue<T>;

/**
 * Adds receiver-owned signal inputs to ordinary props while preserving explicitly declared signal
 * props.
 *
 * @see {@link PrimitiveProgramProps}
 */
export type SignalProgramProps<P> = [PrimitiveProgramProps<P>] extends [never]
  ? never
  : Readonly<{
      [K in keyof PrimitiveProgramProps<P>]: K extends "children"
        ? PrimitiveProgramProps<P>[K]
        : SignalProgramValue<PrimitiveProgramProps<P>[K]>;
    }>;

/**
 * Makes declared style properties accept either literals or signals.
 *
 * @see {@link SignalValue}
 */
export type SignalStyle<S> = Readonly<{
  [K in keyof S]: K extends "custom" ? S[K] : SignalValue<S[K]>;
}>;

/**
 * Conditions on the available containing size, in logical units. All bounds are inclusive.
 *
 * @see {@link CRCStyleRule}
 */
export type CRCSizeQuery = Readonly<
  {
    /** Minimum permitted width. See {@link CRCSizeQuery}. */
    minWidth?: number;
    /** Maximum permitted width. See {@link CRCSizeQuery}. */
    maxWidth?: number;
    /** Minimum permitted height. See {@link CRCSizeQuery}. */
    minHeight?: number;
    /** Maximum permitted height. See {@link CRCSizeQuery}. */
    maxHeight?: number;
  } & (
    | {
        /** Minimum permitted width. See {@link CRCSizeQuery}. */
        minWidth: number;
      }
    | {
        /** Maximum permitted width. See {@link CRCSizeQuery}. */
        maxWidth: number;
      }
    | {
        /** Minimum permitted height. See {@link CRCSizeQuery}. */
        minHeight: number;
      }
    | {
        /** Maximum permitted height. See {@link CRCSizeQuery}. */
        maxHeight: number;
      }
  )
>;

/**
 * A conditional style contribution selected by a responsive size query.
 *
 * @see {@link SystemStyle}
 * @see {@link CRCSizeQuery}
 * @see {@link SignalStyle}
 * @see {@link CRCResponsiveStyle}
 */
export type CRCStyleRule<S extends SystemStyle> = Readonly<{
  /** Query that selects a style rule or resolves a hover result. See {@link CRCSizeQuery}. */
  query: CRCSizeQuery;
  /** Declared presentation and layout properties. See {@link SignalStyle}. */
  style: Partial<SignalStyle<S>> & {
    /** Not accepted in this variant; use the alternative fields instead. See {@link CRCStyleRule}. */
    readonly when?: never;
  };
}>;

/**
 * Local ordered patches. Layout-item rules query the parent; internal rules query the assigned box.
 *
 * @see {@link SystemStyle}
 * @see {@link SignalStyle}
 * @see {@link CRCStyleRule}
 * @see {@link PrimitiveInput}
 */
export type CRCResponsiveStyle<S extends SystemStyle> = SignalStyle<S> & Readonly<{
  /**
   * Ordered local patches against the available containing size, not this
   * receiver's final size. All matches merge in order; later fields win.
   * Hoist stable lists for Layer cache reuse. Intrinsic responsive measurement
   * is unsupported: use a definite allocation and adapt its inner content.
   */
  when?: readonly CRCStyleRule<S>[];
}>;

export type PreservedSignalPropKey<P> = {
  [K in keyof PrimitiveProgramProps<P>]-?: [PrimitiveProgramProps<P>[K]] extends [never]
    ? never
    : [NonNullable<PrimitiveProgramProps<P>[K]>] extends [never]
      ? never
      : [NonNullable<PrimitiveProgramProps<P>[K]>] extends [Signal<any>]
      ? K
      : never;
}[keyof PrimitiveProgramProps<P>];

/**
 * The authored props and signal-capable inputs accepted by a primitive.
 *
 * @see {@link SystemStyle}
 * @see {@link SignalProgramProps}
 * @see {@link CRCResponsiveStyle}
 * @see {@link SpecifiedStyle}
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link definePrimitive}
 */
export type PrimitiveInput<
  P,
  S extends SystemStyle = SystemStyle,
> = SignalProgramProps<P> & StyleField<CRCResponsiveStyle<SpecifiedStyle<S>>>;

/**
 * A supported HTML or offscreen Canvas drawing surface.
 *
 * @see {@link crc}
 * @see {@link RenderingContext2D}
 */
export type Canvas = HTMLCanvasElement | OffscreenCanvas;
/**
 * A supported HTML or offscreen Canvas 2D rendering context.
 *
 * @see {@link Canvas}
 * @see {@link PrimitiveRender}
 * @see {@link useCanvasContext}
 */
export type RenderingContext2D =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * The caller-specified style before normalization and layout resolution.
 *
 * @see {@link SystemStyle}
 * @see {@link PrimitiveCapabilities}
 * @see {@link PrimitiveInput}
 */
export type SpecifiedStyle<S extends SystemStyle> = Readonly<S>;
/**
 * Style after default values and shorthand normalization have been applied.
 *
 * @see {@link SystemStyle}
 * @see {@link PrimitiveCapabilities}
 * @see {@link MeasureInput}
 */
export type NormalizedStyle<N extends SystemStyle> = Readonly<N>;
/**
 * Style after input resolution, normalization, and layout resolution.
 *
 * @see {@link SystemStyle}
 * @see {@link PrimitiveCapabilities}
 * @see {@link PrimitiveRender}
 */
export type ResolvedStyle<R extends SystemStyle> = Readonly<R>;

/**
 * Parent and measurement context available during primitive style resolution.
 *
 * @see {@link LayoutBox}
 * @see {@link Constraints}
 * @see {@link PrimitiveCapabilities}
 */
export interface StyleResolutionContext {
  /** The layout rectangle assigned by the parent. See {@link LayoutBox}. */
  allocation: Readonly<LayoutBox>;
  /** The containing rectangle against which percentages resolve. See {@link LayoutBox}. */
  percentageBasis: Readonly<LayoutBox>;
  /** Sizing limits and available dimensions for this operation. See {@link Constraints}. */
  constraints: Readonly<Constraints>;
  /**
   * Component identity or diagnostic name associated with this value. See
   * {@link StyleResolutionContext}.
   */
  component: string;
  /**
   * Name of the layout algorithm producing this diagnostic or resolution. See
   * {@link StyleResolutionContext}.
   */
  algorithm: "render-dispatch";
}

/**
 * Canvas text measurement services supplied to pure layout measurement.
 *
 * @see {@link MeasureInput}
 * @see {@link measureElement}
 */
export interface CanvasMeasurementService {
  /**
   * Measures text using the requested Canvas font configuration. See
   * {@link CanvasMeasurementService}.
   * @param text - Text to measure.
   * @param font - Canvas font string used for measurement.
   * @returns Canvas text metrics for the supplied text and font.
   */
  measureText(text: string, font: string): TextMetrics;
}

/**
 * Measured dimensions, or an explicit unsupported result with a diagnostic reason.
 *
 * @see {@link Size}
 * @see {@link PrimitiveCapabilities}
 * @see {@link MeasureInput}
 * @see {@link measureElement}
 */
export type MeasureResult =
  | {
      /** The literal "measured" identifying this variant. See {@link MeasureResult}. */
      status: "measured";
      /** Measured logical width and height. See {@link Size}. */
      size: Readonly<Size>;
    }
  | {
      /** The literal "unsupported" identifying this variant. See {@link MeasureResult}. */
      status: "unsupported";
      /** Reason the operation could not produce its ordinary result. See {@link MeasureResult}. */
      reason: string;
    };

/**
 * Declared style, props, and constraints passed to a primitive's measurement callback.
 *
 * @see {@link SystemStyle}
 * @see {@link NormalizedStyle}
 * @see {@link Constraints}
 * @see {@link CanvasMeasurementService}
 * @see {@link CRCElement}
 * @see {@link MeasureResult}
 * @see {@link PrimitiveCapabilities}
 */
export interface MeasureInput<P, S extends SystemStyle = SystemStyle> {
  /** Component props supplied to evaluation or measurement. See {@link MeasureInput}. */
  props: Readonly<P>;
  /** Declared presentation and layout properties. See {@link NormalizedStyle}. */
  style: NormalizedStyle<S>;
  /** Sizing limits and available dimensions for this operation. See {@link Constraints}. */
  constraints: Readonly<Constraints>;
  /**
   * Measurement services available while evaluating this input. See
   * {@link CanvasMeasurementService}.
   */
  service: CanvasMeasurementService;
  /**
   * Measures a nested element using the current measurement context. See {@link MeasureResult}.
   * @param element - Child element to measure. See {@link CRCElement}.
   * @param constraints - Available dimensions in logical units. See {@link Constraints}.
   * @returns Measured dimensions or an unsupported measurement result. See {@link MeasureResult}.
   */
  measureElement(
    element: CRCElement<any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

/**
 * The synchronous drawing callback of a custom primitive.
 *
 * @param props - Component's resolved non-style inputs. See {@link PrimitiveProgramProps}.
 * @param style - Resolved primitive style. See {@link ResolvedStyle}.
 * @param context - Active Canvas 2D context. See {@link RenderingContext2D}.
 * @returns Child nodes to traverse after the primitive, or no children.
 *
 * @see {@link SystemStyle}
 * @see {@link PrimitiveProgramProps}
 * @see {@link ResolvedStyle}
 * @see {@link RenderingContext2D}
 * @see {@link definePrimitive}
 * @see {@link CRCNodeInput}
 */
export type PrimitiveRender<P, R extends SystemStyle = SystemStyle> = (
  props: Readonly<PrimitiveProgramProps<P>>,
  style: ResolvedStyle<R>,
  context: RenderingContext2D,
) => import('./element/types.js').CRCNodeInput | void;

/**
 * Declares the style and measurement features supported by a custom primitive.
 *
 * @see {@link SystemStyle}
 * @see {@link SpecifiedStyle}
 * @see {@link NormalizedStyle}
 * @see {@link StyleResolutionContext}
 * @see {@link ResolvedStyle}
 * @see {@link MeasureInput}
 * @see {@link PrimitiveProgramProps}
 * @see {@link MeasureResult}
 */
export interface PrimitiveCapabilities<
  P,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> {
  /**
   * Names props whose signal identity is preserved for the primitive program. See
   * {@link PreservedSignalPropKey}.
   */
  preserveSignalProps?: readonly PreservedSignalPropKey<P>[];
  /**
   * Declares how the primitive receives and resolves its children. See
   * {@link PrimitiveCapabilities}.
   */
  childInput?: "structural" | "text";
  /**
   * Applies primitive defaults and shorthand normalization before layout resolution. See
   * {@link SpecifiedStyle}, {@link NormalizedStyle}.
   * @param style - Specified style values before normalization. See {@link SpecifiedStyle}.
   * @returns Normalized style with the primitive's shorthand and defaults applied. See
   * {@link NormalizedStyle} .
   */
  normalizeStyle?: (style: SpecifiedStyle<S>) => NormalizedStyle<N>;
  /**
   * Resolves normalized style using the current layout context. See {@link NormalizedStyle},
   * {@link StyleResolutionContext}, {@link ResolvedStyle}.
   * @param style - Normalized style to resolve. See {@link NormalizedStyle}.
   * @param context - Layout and diagnostic context for resolution. See
   * {@link StyleResolutionContext} .
   * @returns Resolved style ready for rendering. See {@link ResolvedStyle}.
   */
  resolveStyle?: (
    style: NormalizedStyle<N>,
    context: Readonly<StyleResolutionContext>,
  ) => ResolvedStyle<R>;
  /**
   * Measures declared primitive inputs without painting or retaining draw commands. See
   * {@link MeasureInput}, {@link PrimitiveProgramProps}, {@link MeasureResult}.
   * @param input - Props, normalized style, constraints, and nested measurement services. See
   * {@link MeasureInput} , {@link PrimitiveProgramProps} .
   * @returns Measured dimensions or an unsupported measurement result. See {@link MeasureResult}.
   */
  measure?: (input: MeasureInput<PrimitiveProgramProps<P>, N>) => MeasureResult;
}

export interface InternalIdentityHint {
  type: CRCElementType<any>;
  key: string | undefined;
  occurrence: number;
}

export interface CRCComponentRefs<P> {
  /** Last traversal entry context, not proof that this evaluation painted successfully. */
  layoutEntry?: Readonly<{
    allocation: Readonly<LayoutBox>;
    percentageBasis: Readonly<LayoutBox>;
  }>;
  id: string;
  parent: CRCComponentRefs<any> | undefined;
  element: CRCElement<P>;
  renderGeneration: number;
  refs: any[];
  hooks: CRCHookSlot[];
  signalConsumer: SignalRenderConsumer | undefined;
  signalConsumerTeardownAttached: boolean;
  teardowns: Teardowns;
  onAfterRender: (() => void) | undefined;
}

export interface CRCHookSlot<T = any> {
  kind: string;
  value: T;
  teardowns: Teardowns;
}

export interface CRCClippingStackEntry {
  readonly svgPath?: string;
  path: Path2D;
  fillRule: CanvasFillRule;
  transform: DOMMatrix;
}

/** @internal Legacy mouse-hook name retained until Task 8 cleanup. */
export type CRCInteractionRegion = CRCEventTargetRegistration;

/** @internal Canvas Layer bridge retained as one nested paint entry. */
export type CRCInteractionLayer = CRCNestedPaintEntry;

export type CRCInteractionPaintEntry = CRCPaintEntry;

export interface CRCCursorDefault {
  style: string;
}

export interface CRCInteractionActivation {
  readonly button: number;
  readonly path: readonly CRCEventNode[];
}

export interface CRCInteractionState {
  hoveredRegion: CRCInteractionRegion | undefined;
  primaryDown: CRCInteractionActivation | undefined;
  primaryUp: CRCInteractionActivation | undefined;
  auxiliaryDown: Map<number, CRCInteractionActivation>;
  auxiliaryUp: Map<number, CRCInteractionActivation>;
  clickStreakTarget: CRCEventNode | undefined;
  clickStreak: number;
  cursorRegion: CRCInteractionRegion | undefined;
  cursorDefault: CRCCursorDefault | undefined;
  pointerCanvas: HTMLCanvasElement | undefined;
  cursorCanvas: HTMLCanvasElement | undefined;
  cursorStyle: string | undefined;
}

export type CRCNativeObserver = (event: Event) => void;

export interface CRCEventRoot {
  rootInstance: CRCInstance | undefined;
  readonly canvas: HTMLCanvasElement | undefined;
  readonly nativeListeners: NativeListenerHub | undefined;
  readonly targets: Set<CRCEventTargetRegistration>;
  /** @internal Borrowed only for one synchronous coordinate lookup. */
  coordinateHitInput?: CRCHitTestInput;
  /** @internal Borrowed only for one synchronous coordinate lookup. */
  coordinateHitOutput?: CRCHitTestOutput;
  readonly listenersByComponent: Map<string, Set<CRCEventListenerRegistration>>;
  readonly observers: Map<DOMCRCEventType, Set<CRCNativeObserver>>;
  readonly pointerCaptures: Map<number, CRCEventNode>;
  onNodeRelease: ((node: CRCEventNode) => void) | undefined;
  onTargetUpdate: ((target: CRCEventTargetRegistration) => void) | undefined;
  htmlOverlay?: HTMLElement;
  html?: HtmlBridge;
  focusPolicy?: CRCFocusPolicyBridge;
  /** @internal Shared by nested layer renders; consumers register only erased callbacks. */
  renderTransaction?: CRCRenderTransaction;
}

/** @internal Root-wide render completion seam for optional policies. */
export interface CRCRenderTransaction {
  onPublish?(callback: () => void): void;
  onFinish(callback: (success: boolean) => void): void;
}

export interface CRCFocusPolicyBridge {
  observeHtmlRegion?(region: HtmlFocusRegion): void;
  suspendHtmlRegions?(): void;
  removeHtmlFocusRegion?(region: HtmlFocusRegion): void;
  snapshot(target: CRCEventTargetRegistration): CRCEventTargetSnapshot;
  observeTarget(target: CRCEventTargetRegistration): void;
  /** @internal Records a target committed during the active render transaction. */
  observeTransactionalTarget?(target: CRCEventTargetRegistration): void;
  removeTarget(target: CRCEventTargetRegistration): void;
  beforeNativeDispatch?(
    type: DOMCRCEventType,
    event: Event,
  ): CRCFocusPolicyBridge | undefined;
  resolveKeyboardTarget(): CRCEventTargetRegistration | undefined;
  afterDispatch(event: CRCEvent): void;
  afterPressDispatch?(input: CRCFocusPressDefaultInput): void;
  afterTouchDispatch?(input: CRCFocusTouchDefaultInput): void;
  /** @internal Returns the last focus change affecting one cached layer subtree. */
  layerFocusRenderRevision?(instance: CRCInstance): number | undefined;
  /** @internal Replays cached layer metadata without executing its components. */
  replayRetainedSubtree(instance: CRCInstance): void;
}

export interface CRCFocusPressDefaultInput {
  readonly source: "mouse" | "pointer" | "touch";
  readonly target: CRCEventTargetRegistration | undefined;
  readonly event: CRCEvent | undefined;
  readonly originalEvent: MouseEvent | PointerEvent | TouchEvent;
  readonly x: number;
  readonly y: number;
  readonly pointerId?: number;
  readonly pointerType?: string;
  readonly touchIdentifier?: number;
}

export interface CRCFocusTouchDefaultContact {
  readonly identifier: number;
  readonly target: CRCEventTargetRegistration | undefined;
  readonly x: number;
  readonly y: number;
}

export interface CRCFocusTouchDefaultInput {
  readonly type: "touchcancel" | "touchend" | "touchmove" | "touchstart";
  readonly changedContacts: readonly CRCFocusTouchDefaultContact[];
  readonly activeIdentifiers: readonly number[];
  readonly originalEvent: TouchEvent;
}

/**
 * The stable controller of one canvas mount, including explicit idempotent disposal.
 *
 * @see {@link crc}
 */
export interface CRCController {
  /** Releases every resource owned by this CRC mount. Safe to call repeatedly. */
  dispose(): void;
}

/**
 * A Canvas fill or CRC texture paint accepted by drawing primitives.
 *
 * @see {@link TexturePaint}
 * @see {@link PaintStyle}
 */
export type FillStyle = CanvasRenderingContext2D["fillStyle"] | import('./textures/texture.js').TexturePaint;
/**
 * A Canvas stroke or CRC texture paint accepted by drawing primitives.
 *
 * @see {@link TexturePaint}
 * @see {@link PaintStyle}
 * @see {@link ImgStyle}
 */
export type StrokeStyle = CanvasRenderingContext2D["strokeStyle"] | import('./textures/texture.js').TexturePaint;

export interface CRCInstance {
  canvas: Canvas;
  controller: CRCController;
  root: CRCNode;
  pendingRoot: PendingRoot;
  pendingUpdateParents: boolean;
  refs: Map<string, CRCComponentRefs<any>>;
  renderGeneration: number;
  renderSeenIds: Set<string>;
  renderSeenKeys: Set<string>;
  requestedRenderRevision: number;
  completedRenderRevision: number;
  renderTimestamp: number;
  mainTeardowns: Teardowns;
  eventRoot: CRCEventRoot;
  regions: Set<CRCInteractionRegion>;
  paintEntries: Set<CRCInteractionPaintEntry>;
  cursorDefaults: Set<CRCCursorDefault>;
  interaction: CRCInteractionState;
  interactionRoot: CRCInstance | undefined;
  parent: Canvas | undefined;
  /** Parent layer component used only for temporary cross-instance event paths. */
  eventParent: CRCComponentRefs<any> | undefined;
  /** Current child-to-parent mapping for focus geometry outside hit order. */
  focusParentBridge: CRCNestedPaintEntry | undefined;
  rootLayoutBox: Readonly<LayoutBox>;
  surface: CRCSurfaceState;
  /** Feature-owned resources, installed only by imported optional entries. */
  optionalServices: Map<symbol, OptionalService>;
  backendDriver: CRCBackendDriver<unknown>;
}

/**
 * Policy for aligning drawing geometry to the pixel grid.
 *
 * @see {@link RectStyle}
 * @see {@link ImgStyle}
 * @see {@link HorizontalLineStyle}
 * @see {@link VerticalLineStyle}
 */
export type PixelGridAlignment = "none" | "round" | "ceil" | "floor";
