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
import type { FilterSurfacePool } from "./filter/filter-surface-pool.js";
import type { CRCBackendDriver } from "./backend/types.js";
import type { SignalRenderConsumer } from "./signals/render-consumer.js";
export type {
  CRCComponent,
  CRCContainerChild,
  CRCElement,
  CRCElementType,
  CRCEmptyNode,
  CRCKey,
  CRCNode,
  CRCPrimitiveComponent,
  CRCTextChild,
  CRCRenderResult,
  PrimitiveInputOf,
} from "./element/types.js";

export interface SystemStyle {
  custom?: unknown;
  filter?: CRCFilter | readonly CRCFilter[];
}

type PrimitiveReservedKey = "key" | "style";

type UnionKeys<T> = T extends unknown ? keyof T : never;

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

type StyleField<S> = [RequiredKeys<S>] extends [never]
  ? { style?: S }
  : { style: S };

export type PrimitiveInput<
  P,
  S extends SystemStyle = SystemStyle,
> = PrimitiveProgramProps<P> & StyleField<SpecifiedStyle<S>>;

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
export type RenderingContext2D =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type SpecifiedStyle<S extends SystemStyle> = Readonly<S>;
export type NormalizedStyle<N extends SystemStyle> = Readonly<N>;
export type ResolvedStyle<R extends SystemStyle> = Readonly<R>;

export interface StyleResolutionContext {
  allocation: Readonly<LayoutBox>;
  percentageBasis: Readonly<LayoutBox>;
  constraints: Readonly<Constraints>;
  component: string;
  algorithm: "render-dispatch";
}

export interface CanvasMeasurementService {
  measureText(text: string, font: string): TextMetrics;
}

export type MeasureResult =
  | { status: "measured"; size: Readonly<Size> }
  | { status: "unsupported"; reason: string };

export interface MeasureInput<P, S extends SystemStyle = SystemStyle> {
  props: Readonly<P>;
  style: NormalizedStyle<S>;
  constraints: Readonly<Constraints>;
  service: CanvasMeasurementService;
  measureElement(
    element: CRCElement<any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

export type PrimitiveRender<P, R extends SystemStyle = SystemStyle> = (
  props: Readonly<PrimitiveProgramProps<P>>,
  style: ResolvedStyle<R>,
  context: RenderingContext2D,
) => CRCNode[] | CRCNode | void;

export interface PrimitiveCapabilities<
  P,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> {
  normalizeStyle?: (style: SpecifiedStyle<S>) => NormalizedStyle<N>;
  resolveStyle?: (
    style: NormalizedStyle<N>,
    context: Readonly<StyleResolutionContext>,
  ) => ResolvedStyle<R>;
  measure?: (input: MeasureInput<PrimitiveProgramProps<P>, N>) => MeasureResult;
}

export interface InternalIdentityHint {
  type: CRCElementType<any>;
  key: string | undefined;
  occurrence: number;
}

export interface CRCComponentRefs<P> {
  id: string;
  parent: CRCComponentRefs<any> | undefined;
  element: CRCElement<P>;
  renderGeneration: number;
  refs: any[];
  hooks: CRCHookSlot[];
  signalConsumer: SignalRenderConsumer | undefined;
  teardowns: Teardowns;
  onAfterRender: (() => void) | undefined;
}

export interface CRCHookSlot<T = any> {
  kind: string;
  value: T;
  teardowns: Teardowns;
}

export type CRCMouseEventListener = (e: CRCMouseEvent) => void;

export interface CRCEventRegistry {
  click: Set<(e: MouseEvent) => void>;
  dblclick: Set<(e: MouseEvent) => void>;
  mousemove: Set<(e: MouseEvent) => void>;
  mouseover: Set<(e: MouseEvent) => void>;
  mouseout: Set<(e: MouseEvent) => void>;
  mousedown: Set<(e: MouseEvent) => void>;
  mouseup: Set<(e: MouseEvent) => void>;
  contextmenu: Set<(e: MouseEvent) => void>;
}

export type CRCEventType = keyof CRCEventRegistry;
export type CRCRegionHandlers = Partial<
  Record<CRCEventType, CRCMouseEventListener>
>;

export interface CRCClippingStackEntry {
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
  focusPolicy?: CRCFocusPolicyBridge;
  /** @internal Shared by nested layer renders; consumers register only erased callbacks. */
  renderTransaction?: CRCRenderTransaction;
}

/** @internal Root-wide render completion seam for optional policies. */
export interface CRCRenderTransaction {
  onFinish(callback: (success: boolean) => void): void;
}

export interface CRCFocusPolicyBridge {
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

export interface CRCController {
  /** Releases every resource owned by this CRC mount. Safe to call repeatedly. */
  dispose(): void;
}

export type FillStyle = CanvasRenderingContext2D["fillStyle"];
export type StrokeStyle = CanvasRenderingContext2D["strokeStyle"];

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
  filterSurfacePool: FilterSurfacePool;
  backendDriver: CRCBackendDriver<unknown>;
}

export type PixelGridAlignment = "none" | "round" | "ceil" | "floor";

/** Shipped payload for the singular `useEvent` Canvas observer hook. */
export interface CRCMouseEvent {
  x: number;
  y: number;
  originalEvent: MouseEvent;
}
