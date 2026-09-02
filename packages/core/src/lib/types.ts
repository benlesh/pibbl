import type { Teardowns } from './teardowns.js';
import type { CRCSurfaceState } from './surface/types.js';
import type { Constraints, LayoutBox, Size } from './layout/types.js';
import type { NativeListenerHub } from './events/native-listener-hub.js';
import type { CRCEventType as DOMCRCEventType } from './events/types.js';
import type { CRCEventTargetSnapshot } from './events/types.js';
import type { CRCEvent } from './events/types.js';
import type {
  CRCEventNode,
  CRCEventListenerRegistration,
  CRCEventTargetRegistration,
} from './events/registrations.js';
import type { CRCElement, CRCKey, CRCNode } from './element/types.js';
export type {
  CRCComponent,
  CRCContainerChild,
  CRCElement,
  CRCElementType,
  CRCEmptyNode,
  CRCKey,
  CRCNode,
  CRCTextChild,
  CRCRenderResult,
} from './element/types.js';

export interface SystemStyle {
  custom?: unknown;
}

type ReservedElementKey = 'key' | 'style';

type UnionKeys<T> = T extends unknown ? keyof T : never;

type ProgramProps<P> = 0 extends (1 & P)
  ? P
  : Extract<UnionKeys<P>, ReservedElementKey> extends never
    ? P
    : never;

type RequiredKeys<T> = T extends unknown
  ? {
      [K in keyof T]-?:
        Pick<T, K> extends Required<Pick<T, K>> ? K : never
    }[keyof T]
  : never;

type StyleField<S> = [RequiredKeys<S>] extends [never]
  ? { style?: S }
  : { style: S };

export type ComponentInput<P, S extends SystemStyle = SystemStyle> =
  ProgramProps<P> & { key?: CRCKey } & StyleField<S>;

export type CompEl<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> = CRCElement<ProgramProps<P> & { style: SpecifiedStyle<S> }> & {
  readonly type: CompFn<P, S, N, R>;
  readonly props: Readonly<ProgramProps<P> & { style: SpecifiedStyle<S> }>;
  /** @deprecated Temporary compatibility alias; use element.props.style. */
  readonly style: SpecifiedStyle<S>;
  /** @internal */
  identityHint?: InternalIdentityHint;
};

export type FalsyNodes = import('./element/types.js').CRCEmptyNode;

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
export type RenderingContext2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type SpecifiedStyle<S extends SystemStyle> = Readonly<S>;
export type NormalizedStyle<N extends SystemStyle> = Readonly<N>;
export type ResolvedStyle<R extends SystemStyle> = Readonly<R>;

export interface StyleResolutionContext {
  allocation: Readonly<LayoutBox>;
  percentageBasis: Readonly<LayoutBox>;
  constraints: Readonly<Constraints>;
  component: string;
  algorithm: 'render-dispatch';
}

export interface CanvasMeasurementService {
  measureText(text: string, font: string): TextMetrics;
}

export type MeasureResult =
  | { status: 'measured'; size: Readonly<Size> }
  | { status: 'unsupported'; reason: string };

export interface MeasureInput<
  P,
  S extends SystemStyle = SystemStyle,
> {
  props: Readonly<P>;
  style: NormalizedStyle<S>;
  constraints: Readonly<Constraints>;
  service: CanvasMeasurementService;
  measureElement(
    element: CompEl<any, any>,
    constraints: Readonly<Constraints>,
  ): MeasureResult;
}

export interface ComponentCapabilities<
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  P = unknown,
> {
  normalizeStyle?: (style: SpecifiedStyle<S>) => NormalizedStyle<N>;
  resolveStyle?: (
    style: NormalizedStyle<N>,
    context: Readonly<StyleResolutionContext>,
  ) => ResolvedStyle<R>;
  measure?: (
    input: MeasureInput<ProgramProps<P>, N>,
  ) => MeasureResult;
}

export type CompFn<
  P,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> = ((
  props: ProgramProps<P>,
  style: ResolvedStyle<R>,
  ctx: RenderingContext2D,
) => CRCNode[] | CRCNode | void) & Readonly<ComponentCapabilities<S, N, R, P>>;

export interface InternalIdentityHint {
  type: CompFn<any, any, any, any>;
  key: string | undefined;
  occurrence: number;
}

export interface CompRefs<P> {
  id: string;
  parent: CompRefs<any> | undefined;
  element: CompEl<P, any>;
  refs: any[];
  hooks: CRCHookSlot[];
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
export type CRCRegionHandlers = Partial<Record<CRCEventType, CRCMouseEventListener>>;

export interface CRCClippingStackEntry {
  path: Path2D;
  fillRule: CanvasFillRule;
  transform: DOMMatrix;
}

/** @internal Legacy mouse-hook name retained until Task 8 cleanup. */
export type CRCInteractionRegion = CRCEventTargetRegistration;

export interface CRCInteractionLayer {
  kind: 'layer';
  instance: CRCInstance;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
  bounds: Path2D;
}

export type CRCInteractionPaintEntry = CRCEventTargetRegistration
  | CRCInteractionLayer;

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
  readonly listenersByComponent: Map<string, Set<CRCEventListenerRegistration>>;
  readonly observers: Map<DOMCRCEventType, Set<CRCNativeObserver>>;
  readonly pointerCaptures: Map<number, CRCEventNode>;
  onNodeRelease: ((node: CRCEventNode) => void) | undefined;
  onTargetUpdate:
    ((target: CRCEventTargetRegistration) => void) | undefined;
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
  readonly source: 'mouse' | 'pointer' | 'touch';
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
  readonly type: 'touchcancel' | 'touchend' | 'touchmove' | 'touchstart';
  readonly changedContacts: readonly CRCFocusTouchDefaultContact[];
  readonly activeIdentifiers: readonly number[];
  readonly originalEvent: TouchEvent;
}

export interface CRCController {
  /** Releases every resource owned by this CRC mount. Safe to call repeatedly. */
  dispose(): void;
}

export type FillStyle = CanvasRenderingContext2D['fillStyle'];
export type StrokeStyle = CanvasRenderingContext2D['strokeStyle'];

export interface CRCInstance {
  canvas: Canvas;
  controller: CRCController;
  root: CompEl<any, any>;
  pendingRoot: CompEl<any, any> | undefined;
  pendingUpdateParents: boolean;
  refs: Map<string, CompRefs<any>>;
  animationFrameId: number | undefined;
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
  eventParent: CompRefs<any> | undefined;
  rootLayoutBox: Readonly<LayoutBox>;
  surface: CRCSurfaceState;
}

export type PixelGridAlignment = 'none' | 'round' | 'ceil' | 'floor';

/** Shipped payload for the singular `crcEvent` Canvas observer hook. */
export interface CRCMouseEvent {
  x: number;
  y: number;
  originalEvent: MouseEvent;
}
