import type { Teardowns } from './teardowns';

export interface CompEl<P = any> {
  type: CompFn<P>;
  props: P;
}

export type FalsyNodes = undefined | false | null | '' | 0;

export type CRCNode = CompEl | void | FalsyNodes;

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
export type RenderingContext2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type CompFn<P> = (
  props: P,
  ctx: RenderingContext2D,
) => CRCNode[] | CRCNode | void;

export interface CompRefs<P> {
  id: string;
  parent: CompRefs<any> | undefined;
  element: CompEl<P>;
  refs: any[];
  teardowns: Teardowns;
  onAfterRender: (() => void) | undefined;
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

export interface IntrinsicProps {
  key?: string;
}

export interface AlphaProps {
  alpha?: number;
}

export interface StrokeStyleProps {
  strokeStyle?: StrokeStyle;
  lineWidth?: number;
}

export interface FillStyleProps {
  fillStyle?: FillStyle;
}

export interface CursorStyleProps {
  cursor?: string;
}

export interface PathProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  FillStyleProps,
  StrokeStyleProps,
  CursorStyleProps,
  AlphaProps {
  path: Path2D;
  lineInteractionWidth?: number;
}

export interface CRCInstance {
  root: CompEl<any>;
  refs: Map<string, CompRefs<any>>;
  animationFrameId: number;
  renderTimestamp: number;
  mainTeardowns: Teardowns;
  events: CRCEventRegistry;
  parent: Canvas | undefined;
}

export type PixelGridAlignment = 'none' | 'round' | 'ceil' | 'floor';

export interface CRCMouseEvent {
  x: number;
  y: number;
  originalEvent: MouseEvent;
}
