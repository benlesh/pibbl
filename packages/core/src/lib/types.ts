import type { Teardowns } from './teardowns.js';

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
> {
  type: CompFn<P, S>;
  props: ProgramProps<P>;
  style: Readonly<S>;
  key?: string;
}

export type FalsyNodes = undefined | false | null | '' | 0;

export type CRCNode = CompEl<any, any> | void | FalsyNodes;

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
export type RenderingContext2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type CompFn<P, S extends SystemStyle = SystemStyle> = (
  props: ProgramProps<P>,
  style: Readonly<S>,
  ctx: RenderingContext2D,
) => CRCNode[] | CRCNode | void;

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
}

export type PixelGridAlignment = 'none' | 'round' | 'ceil' | 'floor';

export interface CRCMouseEvent {
  x: number;
  y: number;
  originalEvent: MouseEvent;
}
