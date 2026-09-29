// components
export { Arc, type ArcProps, type ArcStyle } from './lib/components/arc.js';
export {
  Circle,
  type CircleProps,
  type CircleStyle,
} from './lib/components/circle.js';
export { Clip, type ClipProps, type ClipStyle } from './lib/components/clip.js';
export {
  Ellipse,
  type EllipseProps,
  type EllipseStyle,
} from './lib/components/ellipse.js';
export {
  Group,
  type GroupProps,
  type GStyle,
} from './lib/components/g.js';
export {
  HorizontalLine,
  type HorizontalLineProps,
  type HorizontalLineStyle,
} from './lib/components/horizontal-line.js';

export {
  Image,
  type ImageProps,
} from './lib/components/img.js';
export {
  Layer,
  type LayerProps,
  type LayerStyle,
} from './lib/components/layer.js';
export {
  Line,
  type LineProps,
  type LineStyle,
} from './lib/components/line.js';
export { Path, type PathProps } from './lib/components/path.js';
export {
  Polygon,
  type PolygonProps,
  type PolygonStyle,
} from './lib/components/polygon.js';
export {
  RegularPolygon,
  type RegularPolygonProps,
  type RegularPolygonStyle,
} from './lib/components/regular-polygon.js';
export {
  Rectangle,
  type RectangleProps,
} from './lib/components/rect.js';
export {
  Star,
  type StarProps,
  type StarStyle,
} from './lib/components/star.js';
export {
  SvgPath,
  type SvgPathProps,
} from './lib/components/svg-path.js';
export { Text, type TextProps } from './lib/components/text.js';
export {
  VerticalLine,
  type VerticalLineProps,
  type VerticalLineStyle,
} from './lib/components/vertical-line.js';
export {
  Wedge,
  type WedgeProps,
  type WedgeStyle,
} from './lib/components/wedge.js';
export {
  createArcPath,
  createWedgePath,
  type ArcPathOptions,
  type WedgePathOptions,
} from './lib/geometry/circular-sweep.js';
export {
  createCirclePath,
  type CirclePathOptions,
} from './lib/geometry/circle.js';
export {
  createEllipsePath,
  type EllipsePathOptions,
} from './lib/geometry/ellipse.js';
export {
  createLinePath,
  type LinePathOptions,
} from './lib/geometry/line.js';
export {
  createPolygonPath,
  type PolygonPathOptions,
} from './lib/geometry/polygon.js';
export {
  createRectanglePath,
  type RectanglePathOptions,
} from './lib/geometry/rectangle.js';
export {
  createRegularPolygonPath,
  type RegularPolygonNumericSize,
  type RegularPolygonPathOptions,
  type RegularPolygonPathPosition,
} from './lib/geometry/regular-polygon.js';
export {
  createStarPath,
  type StarPathOptions,
} from './lib/geometry/star.js';
export {
  createSvgPath,
  type SvgPathOptions,
} from './lib/geometry/svg-path.js';
export type { RoundedCornerPathOptions } from './lib/geometry/rounded-corners.js';
export { crc } from './lib/crc.js';
export {
  batch,
  computed,
  isSignal,
  signal,
  untracked,
} from './lib/signals/graph.js';
export { resolveSignalValue } from './lib/signals/resolve-signal-value.js';
export type {
  Signal,
  SignalEquals,
  SignalOptions,
  SignalValue,
  WritableSignal,
} from './lib/signals/types.js';
export { easing } from './lib/animation/easing.js';
export {
  defineAnimation,
  keyframes,
  spring,
  stepper,
  tween,
} from './lib/animation/definition.js';
export {
  marker,
  parallel,
  repeat,
  sequence,
  track,
  wait,
} from './lib/animation/program.js';
export type {
  CRCAnimationDefinition,
  CRCAnimationOptions,
  CRCAnimationProgram,
  CRCAnimationRepeatDirection,
  CRCAnimationRepeatOptions,
  CRCAnimationSampleInput,
  CRCSpringTransitionOptions,
  CRCPlayback,
  CRCPlaybackEvent,
  CRCPlaybackOptions,
  CRCPlaybackStatus,
  CRCEasing,
  CRCInterpolator,
  CRCKeyframesOptions,
  CRCSpringOptions,
  CRCStepperOptions,
  CRCTweenOptions,
  CRCTweenTransitionOptions,
} from './lib/animation/types.js';
export type {
  CRCConfig,
  CRCFit,
  CRCFixedViewportConfig,
  CRCPixelRatio,
  CRCResponsiveViewportConfig,
} from './lib/surface/types.js';
export {
  Absolute,
  type AbsoluteProps,
  type AbsoluteStyle,
} from './lib/layout/absolute.js';
export {
  Overlay,
  type OverlayProps,
  type OverlayStyle,
} from './lib/layout/overlay.js';
export {
  Flow,
  type FlowProps,
  type FlowStyle,
} from './lib/layout/flow.js';
export {
  Flex,
  type FlexProps,
  type FlexStyle,
} from './lib/layout/flex.js';
export {
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

export { definePrimitive } from './lib/define-primitive.js';
export { defineRenderLayer } from './lib/render-layer/define-render-layer.js';
export type {
  CRCRenderLayerComponentProps,
  CRCRenderLayerDefinition,
  CRCRenderLayerFrame,
  CRCRenderLayerContext,
  CRCRenderLayerHit,
  CRCRenderLayerInput,
  CRCRenderLayerInteraction,
  CRCRenderLayerInteractionSnapshot,
  CRCRenderLayerProps,
  CRCRenderLayerSize,
  CRCRenderLayerStyle,
  CRCRenderLayerTarget,
} from './lib/render-layer/types.js';
export { createElement } from './lib/element/create-element.js';
export { Fragment } from './lib/element/fragment.js';
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
  RoundedCornerStyle,
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
  CRCBlurFilter,
  CRCBrightnessFilter,
  CRCContrastFilter,
  CRCDropShadowFilter,
  CRCFilter,
  CRCGrayscaleFilter,
  CRCHueRotateFilter,
  CRCInvertFilter,
  CRCOpacityFilter,
  CRCSaturateFilter,
  CRCSepiaFilter,
} from './lib/style/filter-types.js';
export type {
  Constraints,
  Edges,
  LayoutBox,
  Size,
} from './lib/layout/types.js';
// hooks
export { useCursor } from './lib/hooks/use-cursor.js';
export { useCanvasContext } from './lib/hooks/use-canvas-context.js';
export { useComputed } from './lib/hooks/use-computed.js';
export { useConst } from './lib/hooks/use-const.js';
export { useEvent } from './lib/hooks/use-event.js';
export { useEventListener } from './lib/hooks/use-event-listener.js';
export { useEventTarget } from './lib/hooks/use-event-target.js';
export { useLinePath } from './lib/hooks/use-line-path.js';
export { useLayoutBox } from './lib/hooks/use-layout-box.js';
export { useRectPath } from './lib/hooks/use-rect-path.js';
export { useRef, type CRCRef } from './lib/hooks/use-ref.js';
export { usePlayback } from './lib/hooks/use-playback.js';
export {
  useReaction,
  type CRCReactionOptions,
} from './lib/hooks/use-reaction.js';
export { useTransition } from './lib/hooks/use-transition.js';
export { useSignal } from './lib/hooks/use-signal.js';
export { useSvgPath } from './lib/hooks/use-svg-path.js';
export type {
  Canvas,
  CanvasMeasurementService,
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
  CRCNodeInput,
  CRCPhysics2DPropExtension,
  CRCPrimitiveComponent,
  CRCTextChild,
  CRCTextInput,
  CRCRenderResult,
  CRCSizeQuery,
  CRCStyleRule,
  CRCResponsiveStyle,
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
  CRCEventParticipationOptions,
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
  CRCPointerEvents,
  CRCTouchEvent,
  CRCWheelEvent,
} from './lib/events/types.js';

export { useManipulation } from './lib/manipulation/controller.js';
export { ManipulationFrame } from './lib/manipulation/frame.js';
export { DragHandle, ResizeHandle, ResizeHandles } from './lib/manipulation/handles.js';
export type { CRCManipulationController, CRCManipulationOptions, CRCManipulationSnapshot, CRCManipulationEvent, CRCManipulationCommitEvent, CRCManipulationCancelEvent, CRCManipulationCancelReason, CRCManipulationGeometry, CRCManipulationOperation, CRCManipulationActive, CRCManipulationFrameProps, CRCManipulationMoveInput, CRCManipulationResizeInput } from './lib/manipulation/controller-types.js';
export type { CRCManipulationBox, CRCManipulationPoint, CRCManipulationWhen, CRCResizePosition } from './lib/manipulation/types.js';
export type { CRCDragHandleProps, CRCDragHandleStyle } from './lib/manipulation/handles.js';

export type { CRCResizeHandleProps, CRCResizeHandlesProps } from './lib/manipulation/handles.js';
