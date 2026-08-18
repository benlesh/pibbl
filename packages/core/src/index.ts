// components
export { clip, type ClipProps, type ClipStyle } from './lib/components/clip.js';
export { g, type GProps, type GStyle } from './lib/components/g.js';
export {
  horizontalLine,
  type HorizontalLineProps,
  type HorizontalLineStyle,
} from './lib/components/horizontal-line.js';

export { img, type ImgProps } from './lib/components/img.js';
export {
  layer,
  type LayerProps,
  type LayerStyle,
} from './lib/components/layer.js';
export { line, type LineProps, type LineStyle } from './lib/components/line.js';
export { path, type PathProps } from './lib/components/path.js';
export { rect, type RectProps } from './lib/components/rect.js';
export { svgPath, type SvgPathProps } from './lib/components/svg-path.js';
export { text, type TextProps } from './lib/components/text.js';
export {
  verticalLine,
  type VerticalLineProps,
  type VerticalLineStyle,
} from './lib/components/vertical-line.js';
export { crc } from './lib/crc.js';

export { defineComp } from './lib/define-comp.js';
export type {
  CursorStyle,
  ImgStyle,
  PaintStyle,
  PathStyle,
  RectStyle,
  SvgPathStyle,
  TextFit,
  TextStyle,
} from './lib/style/types.js';
// hooks
export { crcCursor } from './lib/hooks/crc-cursor.js';
export { crcEvent } from './lib/hooks/crc-event.js';
export { crcLinePath } from './lib/hooks/crc-line-path.js';
export { crcMemo } from './lib/hooks/crc-memo.js';
export { crcRectPath } from './lib/hooks/crc-rect-path.js';
export { crcRef, type CRCRef } from './lib/hooks/crc-ref.js';
export { crcState, type StateUpdater } from './lib/hooks/crc-state.js';
export { crcSvgPath } from './lib/hooks/crc-svg-path.js';
export { crcWhenChanged } from './lib/hooks/crc-when-changed.js';
export type {
  Canvas,
  CompEl,
  CompFn,
  ComponentInput,
  CRCController,
  CRCMouseEvent,
  CRCMouseEventListener,
  CRCNode,
  FillStyle,
  PixelGridAlignment,
  RenderingContext2D,
  StrokeStyle,
  SystemStyle,
} from './lib/types.js';
