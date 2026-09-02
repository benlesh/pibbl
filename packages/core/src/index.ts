// components
export {
  clip,
  Clip,
  type ClipProps,
  type ClipStyle,
} from './lib/components/clip.js';
export {
  g,
  Group,
  type GProps,
  type GroupProps,
  type GStyle,
} from './lib/components/g.js';
export {
  horizontalLine,
  HorizontalLine,
  type HorizontalLineProps,
  type HorizontalLineStyle,
} from './lib/components/horizontal-line.js';

export {
  img,
  Image,
  type ImageProps,
  type ImgProps,
} from './lib/components/img.js';
export {
  layer,
  Layer,
  type LayerProps,
  type LayerStyle,
} from './lib/components/layer.js';
export {
  line,
  Line,
  type LineProps,
  type LineStyle,
} from './lib/components/line.js';
export { path, Path, type PathProps } from './lib/components/path.js';
export {
  rect,
  Rectangle,
  type RectProps,
  type RectangleProps,
} from './lib/components/rect.js';
export {
  svgPath,
  SvgPath,
  type SvgPathProps,
} from './lib/components/svg-path.js';
export { text, Text, type TextProps } from './lib/components/text.js';
export {
  verticalLine,
  VerticalLine,
  type VerticalLineProps,
  type VerticalLineStyle,
} from './lib/components/vertical-line.js';
export { crc } from './lib/crc.js';
export type {
  CRCConfig,
  CRCFit,
  CRCFixedViewportConfig,
  CRCPixelRatio,
  CRCResponsiveViewportConfig,
} from './lib/surface/types.js';
export {
  absolute,
  Absolute,
  type AbsoluteProps,
  type AbsoluteStyle,
} from './lib/layout/absolute.js';
export {
  overlay,
  Overlay,
  type OverlayProps,
  type OverlayStyle,
} from './lib/layout/overlay.js';
export {
  flow,
  Flow,
  type FlowProps,
  type FlowStyle,
} from './lib/layout/flow.js';
export {
  flex,
  Flex,
  type FlexProps,
  type FlexStyle,
} from './lib/layout/flex.js';
export {
  grid,
  Grid,
  type GridProps,
  type GridStyle,
  type GridTrack,
} from './lib/layout/grid.js';
export { measureElement } from './lib/layout/measure.js';

export {
  FocusManagement,
  KeyboardNavigation,
  type FocusManagementProps,
  type KeyboardNavigationProps,
} from './lib/focus/policy-components.js';
export type { CRCKeyboardNavigationOptions } from './lib/focus/types.js';

export { defineComp } from './lib/define-comp.js';
export { definePrimitive } from './lib/define-primitive.js';
export { createElement } from './lib/element/create-element.js';
export { Fragment } from './lib/element/jsx-runtime.js';
export type {
  BoxStyle,
  CursorStyle,
  EdgeValues,
  FlexItemStyle,
  GridItemStyle,
  ImgStyle,
  LayoutItemStyle,
  Length,
  PaintStyle,
  PathStyle,
  RectStyle,
  ResolvedBoxStyle,
  SvgPathStyle,
  TextFit,
  TextStyle,
  Percentage,
} from './lib/style/types.js';
export {
  LayoutDiagnostic,
  layoutDiagnostic,
  type LayoutDiagnosticContext,
  type LayoutDiagnosticInput,
} from './lib/style/diagnostics.js';
export { normalizeEdges } from './lib/style/normalize.js';
export { resolveLength } from './lib/style/resolve-length.js';
export { resolveBox } from './lib/layout/box.js';
export type {
  Constraints,
  Edges,
  LayoutBox,
  Size,
} from './lib/layout/types.js';
// hooks
export { crcCursor } from './lib/hooks/crc-cursor.js';
export { crcCanvasContext } from './lib/hooks/crc-canvas-context.js';
export { crcEvent } from './lib/hooks/crc-event.js';
export { crcEventListener } from './lib/hooks/crc-event-listener.js';
export { crcEventTarget } from './lib/hooks/crc-event-target.js';
export { crcLinePath } from './lib/hooks/crc-line-path.js';
export { crcLayoutBox } from './lib/hooks/crc-layout-box.js';
export { crcMemo } from './lib/hooks/crc-memo.js';
export { crcRectPath } from './lib/hooks/crc-rect-path.js';
export { crcRef, type CRCRef } from './lib/hooks/crc-ref.js';
export { crcState, type StateUpdater } from './lib/hooks/crc-state.js';
export { crcSvgPath } from './lib/hooks/crc-svg-path.js';
export { crcWhenChanged } from './lib/hooks/crc-when-changed.js';
export type {
  Canvas,
  CanvasMeasurementService,
  CompEl,
  CompFn,
  ComponentCapabilities,
  ComponentInput,
  CRCController,
  CRCComponent,
  CRCContainerChild,
  CRCElement,
  CRCElementType,
  CRCEmptyNode,
  CRCKey,
  CRCMouseEvent,
  CRCMouseEventListener,
  CRCNode,
  CRCPrimitiveComponent,
  CRCTextChild,
  CRCRenderResult,
  PrimitiveInputOf,
  PrimitiveCapabilities,
  PrimitiveInput,
  PrimitiveProgramProps,
  PrimitiveRender,
  FillStyle,
  MeasureInput,
  MeasureResult,
  PixelGridAlignment,
  NormalizedStyle,
  RenderingContext2D,
  ResolvedStyle,
  SpecifiedStyle,
  StyleResolutionContext,
  StrokeStyle,
  SystemStyle,
} from './lib/types.js';
export type {
  CRCClipboardEvent,
  CRCCompositionEvent,
  CRCDragEvent,
  CRCEvent,
  CRCEventCapturePropName,
  CRCEventHandler,
  CRCEventHandlers,
  CRCEventMap,
  CRCEventPhase,
  CRCEventPropName,
  CRCEventTarget,
  CRCEventTargetOptions,
  CRCEventTargetSnapshot,
  CRCEventType,
  CRCFocusEvent,
  CRCInputEvent,
  CRCKeyboardEvent,
  CRCLogicalMouseEvent,
  CRCPointerEvent,
  CRCTouchEvent,
  CRCWheelEvent,
} from './lib/events/types.js';
