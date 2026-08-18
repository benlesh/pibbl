import type { Teardowns } from './teardowns.js';
import type { Constraints, LayoutBox, Size } from './layout/types.js';

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
  ProgramProps<P> & { key?: string } & StyleField<S>;

export interface CompEl<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> {
  type: CompFn<P, S, N, R>;
  props: ProgramProps<P>;
  style: SpecifiedStyle<S>;
  key?: string;
  /** @internal */
  identityHint?: InternalIdentityHint;
}

export type FalsyNodes = undefined | false | null | '' | 0;

export type CRCNode = CompEl<any, any> | void | FalsyNodes;

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

export interface CRCMouseEvent {
  x: number;
  y: number;
  originalEvent: MouseEvent;
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

export interface CRCInteractionRegion {
  kind: 'region';
  owner: CRCInstance;
  handlers: CRCRegionHandlers;
  path: Path2D | undefined;
  fill: boolean;
  lineInteractionWidth: number;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
  cursor: string | undefined;
}

export interface CRCInteractionLayer {
  kind: 'layer';
  instance: CRCInstance;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
  bounds: Path2D;
}

export type CRCInteractionPaintEntry =
  | CRCInteractionRegion
  | CRCInteractionLayer;

export interface CRCCursorDefault {
  style: string;
}

export interface CRCInteractionState {
  hoveredRegion: CRCInteractionRegion | undefined;
  primaryDownRegion: CRCInteractionRegion | undefined;
  primaryUpRegion: CRCInteractionRegion | undefined;
  clickStreakRegion: CRCInteractionRegion | undefined;
  clickStreak: number;
  cursorRegion: CRCInteractionRegion | undefined;
  cursorDefault: CRCCursorDefault | undefined;
  pointerCanvas: HTMLCanvasElement | undefined;
  cursorCanvas: HTMLCanvasElement | undefined;
  cursorStyle: string | undefined;
}

export interface CRCController {
  /** Releases every resource owned by this CRC mount. Safe to call repeatedly. */
  dispose(): void;
}

export interface CRCBasicMouseEvents {
  onClick?: (e: CRCMouseEvent) => void;
  onDblClick?: (e: CRCMouseEvent) => void;
  onMouseMove?: (e: CRCMouseEvent) => void;
  onMouseOver?: (e: CRCMouseEvent) => void;
  onMouseOut?: (e: CRCMouseEvent) => void;
  onContextMenu?: (e: CRCMouseEvent) => void;
  onMouseDown?: (e: CRCMouseEvent) => void;
  onMouseUp?: (e: CRCMouseEvent) => void;
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
  events: CRCEventRegistry;
  regions: Set<CRCInteractionRegion>;
  paintEntries: Set<CRCInteractionPaintEntry>;
  cursorDefaults: Set<CRCCursorDefault>;
  interaction: CRCInteractionState;
  interactionRoot: CRCInstance | undefined;
  parent: Canvas | undefined;
  rootLayoutBox: Readonly<LayoutBox>;
}

export type PixelGridAlignment = 'none' | 'round' | 'ceil' | 'floor';

export interface CRCMouseEvent {
  x: number;
  y: number;
  originalEvent: MouseEvent;
}
