import type {
  CRCConfig,
  CRCBlurFilter,
  CRCBrightnessFilter,
  CRCClipboardEvent,
  CRCCompositionEvent,
  CRCContrastFilter,
  CRCController,
  CRCElement,
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
  CRCFilter,
  CRCFit,
  CRCFixedViewportConfig,
  CRCFocusEvent,
  CRCGrayscaleFilter,
  CRCHueRotateFilter,
  CRCInputEvent,
  CRCInvertFilter,
  CRCKeyboardEvent,
  CRCKeyboardNavigationOptions,
  CRCLogicalMouseEvent,
  CRCMouseEvent,
  CRCNode,
  CRCOpacityFilter,
  CRCPixelRatio,
  CRCPointerEvent,
  CRCRef,
  CRCResponsiveViewportConfig,
  CRCSaturateFilter,
  CRCSepiaFilter,
  CRCTouchEvent,
  CRCWheelEvent,
  CRCDropShadowFilter,
  ArcProps,
  ArcStyle,
  ArcPathOptions,
  AbsoluteStyle,
  BoxStyle,
  CirclePathOptions,
  CircleProps,
  CircleStyle,
  ClipStyle,
  GStyle,
  GridItemStyle,
  GridStyle,
  HorizontalLineStyle,
  ImgStyle,
  EllipseProps,
  EllipseStyle,
  EllipsePathOptions,
  LayerStyle,
  LayoutBox,
  LayoutItemStyle,
  Length,
  LineStyle,
  LinePathOptions,
  PathStyle,
  PolygonProps,
  PolygonStyle,
  PolygonPathOptions,
  RectangleProps,
  RectanglePathOptions,
  RegularPolygonNumericSize,
  RegularPolygonPathOptions,
  RegularPolygonPathPosition,
  RegularPolygonProps,
  RegularPolygonStyle,
  RoundedCornerPathOptions,
  RoundedCornerStyle,
  RectStyle,
  RenderingContext2D,
  StateUpdater,
  SvgPathStyle,
  SvgPathOptions,
  StarPathOptions,
  StarProps,
  StarStyle,
  SystemStyle,
  Percentage,
  FlexItemStyle,
  FlexStyle,
  FlowStyle,
  OverlayStyle,
  TextStyle,
  VerticalLineStyle,
  WedgeProps,
  WedgeStyle,
  WedgePathOptions,
} from '@crc/core';
import type * as CoreTypes from '@crc/core/types';
import {
  crcInternalCreateSignalConsumer,
  crcInternalCurrentFrame,
  crcInternalCurrentRenderOwner,
  crcInternalQueueComplete,
  crcInternalRequestRendererWork,
  type CRCInternalFrame,
  type CRCInternalRendererWorkKind,
  type CRCInternalRenderOwner,
  type CRCInternalSignalConsumer,
} from '@crc/core/internal';
import {
  crc,
  crcCursor,
  crcEvent,
  crcEventListener,
  crcEventTarget,
  crcLayoutBox,
  crcLinePath,
  crcMemo,
  crcRectPath,
  crcRef,
  crcState,
  crcSvgPath,
  crcWhenChanged,
  createElement,
  definePrimitive,
  Absolute,
  Arc,
  Circle,
  Clip,
  Ellipse,
  Flex,
  Flow,
  Grid,
  Group,
  HorizontalLine,
  Image,
  Layer,
  Line,
  Overlay,
  Path,
  Polygon,
  RegularPolygon,
  Rectangle,
  Star,
  SvgPath,
  Text,
  VerticalLine,
  Wedge,
  createArcPath,
  createCirclePath,
  createEllipsePath,
  createLinePath,
  createPolygonPath,
  createRectanglePath,
  createRegularPolygonPath,
  createStarPath,
  createSvgPath,
  createWedgePath,
  measureElement,
  FocusManagement,
  KeyboardNavigation,
  crcCanvasContext,
} from '@crc/core';

// @ts-expect-error internal library modules are outside the public export map
import type { CRCEventRoot } from '@crc/core/lib/types';
// @ts-expect-error package source modules are outside the public export map
import type { CRCEventDefinition } from '@crc/core/src/lib/events/event-definitions';
void (undefined as unknown as CRCEventRoot);
void (undefined as unknown as CRCEventDefinition);

declare const internalOwner: CRCInternalRenderOwner;
declare const internalFrame: CRCInternalFrame;
declare const internalConsumer: CRCInternalSignalConsumer;
const internalWorkKind = 'draw' satisfies CRCInternalRendererWorkKind;
void internalOwner;
void internalFrame;
void internalConsumer;
void internalWorkKind;
void crcInternalCreateSignalConsumer;
void crcInternalCurrentFrame;
void crcInternalCurrentRenderOwner;
void crcInternalQueueComplete;
void crcInternalRequestRendererWork;

export type PublicEventTypes = {
  base: CRCEvent;
  clipboard: CRCClipboardEvent;
  composition: CRCCompositionEvent;
  drag: CRCDragEvent;
  focus: CRCFocusEvent;
  input: CRCInputEvent;
  keyboard: CRCKeyboardEvent;
  logicalMouse: CRCLogicalMouseEvent;
  canvasObserverMouse: CRCMouseEvent;
  pointer: CRCPointerEvent;
  touch: CRCTouchEvent;
  wheel: CRCWheelEvent;
  eventMap: CRCEventMap;
  eventType: CRCEventType;
  eventPhase: CRCEventPhase;
  eventProp: CRCEventPropName;
  eventCaptureProp: CRCEventCapturePropName;
  eventTarget: CRCEventTarget;
  eventTargetOptions: CRCEventTargetOptions;
  eventTargetSnapshot: CRCEventTargetSnapshot;
};

const pointerHandler: CRCEventHandler<'pointerdown'> = event => {
  const pressure: number = event.pressure;
  void pressure;
};
const eventHandlers = {
  onPointerDown: pointerHandler,
  onMouseDown: event => {
    const detail: number = event.detail;
    void detail;
  },
  onTouchStart: event => {
    const changedTouches: TouchList = event.changedTouches;
    void changedTouches;
  },
  onWheel: event => {
    const deltaMode: number = event.deltaMode;
    void deltaMode;
  },
  onKeyDownCapture: event => {
    const key: string = event.key;
    void key;
  },
  onFocus: event => {
    const original: FocusEvent = event.originalEvent;
    void original;
  },
  onBeforeInput: event => {
    const inputType: string = event.inputType;
    void inputType;
  },
  onChange: event => {
    const original: Event = event.originalEvent;
    void original;
  },
  onCompositionUpdate: event => {
    const data: string = event.data;
    void data;
  },
  onCopyCapture: event => {
    const clipboardData: DataTransfer | null = event.clipboardData;
    void clipboardData;
  },
  onDragStart: event => {
    const dataTransfer: DataTransfer | null = event.dataTransfer;
    void dataTransfer;
  },
} satisfies CRCEventHandlers;

function PublicEventProbe(): CRCNode {
  const options = {
    path: new Path2D(),
    fill: true,
    keyboardFocusable: true,
    keyboardNavigationBounds: { x: 0, y: 0, width: 20, height: 20 },
  } satisfies CRCEventTargetOptions;
  const snapshot: CRCEventTargetSnapshot = crcEventTarget(
    eventHandlers,
    options,
  );
  crcEventListener({ onPointerDownCapture: pointerHandler });
  const focused: boolean = snapshot.isFocused;
  void focused;
  return undefined;
}
createElement(PublicEventProbe, {});

const rectangleStyle = {
  x: 10,
  y: 10,
  width: 40,
  height: 20,
  fill: '#2563eb',
} satisfies RectStyle;
const rectangleProps = {} satisfies RectangleProps;

const blurFilter: CRCBlurFilter = { type: 'blur', radius: 2 };
const brightnessFilter: CRCBrightnessFilter = {
  type: 'brightness',
  amount: 1.25,
};
const contrastFilter: CRCContrastFilter = { type: 'contrast', amount: 0.8 };
const dropShadowFilter: CRCDropShadowFilter = {
  type: 'dropShadow',
  offsetX: 3,
  offsetY: 4,
  blurRadius: 2,
  color: 'rgb(0 0 0 / 40%)',
};
const grayscaleFilter: CRCGrayscaleFilter = {
  type: 'grayscale',
  amount: 0.5,
};
const hueRotateFilter: CRCHueRotateFilter = {
  type: 'hueRotate',
  degrees: 45,
};
const invertFilter: CRCInvertFilter = { type: 'invert', amount: 0.25 };
const opacityFilter: CRCOpacityFilter = { type: 'opacity', amount: 0.75 };
const saturateFilter: CRCSaturateFilter = { type: 'saturate', amount: 1.5 };
const sepiaFilter: CRCSepiaFilter = { type: 'sepia', amount: 0.4 };
const publicFilterList = [
  blurFilter,
  brightnessFilter,
  contrastFilter,
  dropShadowFilter,
  grayscaleFilter,
  hueRotateFilter,
  invertFilter,
  opacityFilter,
  saturateFilter,
  sepiaFilter,
] as const satisfies readonly CRCFilter[];

createElement(Rectangle, {
  style: { ...rectangleStyle, filter: blurFilter },
});
createElement(Rectangle, {
  style: { ...rectangleStyle, filter: publicFilterList },
});
createElement(Group, {
  style: { filter: dropShadowFilter },
  children: createElement(Rectangle, { style: rectangleStyle }),
});
createElement(Group, {
  style: { filter: publicFilterList },
  children: createElement(Rectangle, { style: rectangleStyle }),
});
createElement(Absolute, {
  style: { width: 100, height: 50, filter: opacityFilter },
  children: createElement(Rectangle, { style: rectangleStyle }),
});
createElement(Absolute, {
  style: { width: 100, height: 50, filter: publicFilterList },
  children: createElement(Rectangle, { style: rectangleStyle }),
});

// @ts-expect-error raw CSS strings are not CRC filters
const raw: SystemStyle = { filter: 'blur(4px)' };
// @ts-expect-error boxShadow is not a CRC system style property
const box: SystemStyle = { boxShadow: { offsetX: 1 } };
// @ts-expect-error url filters are excluded
const url: CRCFilter = { type: 'url', value: '#filter' };
void raw;
void box;
void url;

export type PublicCoreTypes = typeof CoreTypes;
export type PublicCoreEventTypes = [
  CoreTypes.CRCClipboardEvent,
  CoreTypes.CRCCompositionEvent,
  CoreTypes.CRCDragEvent,
  CoreTypes.CRCEvent,
  CoreTypes.CRCEventHandlers,
  CoreTypes.CRCEventTarget,
  CoreTypes.CRCEventTargetOptions,
  CoreTypes.CRCEventTargetSnapshot,
  CoreTypes.CRCFocusEvent,
  CoreTypes.CRCInputEvent,
  CoreTypes.CRCKeyboardEvent,
  CoreTypes.CRCLogicalMouseEvent,
  CoreTypes.CRCMouseEvent,
  CoreTypes.CRCPointerEvent,
  CoreTypes.CRCTouchEvent,
  CoreTypes.CRCWheelEvent,
];
const keyboardNavigationOptions = {
  mode: 'directional',
} satisfies CRCKeyboardNavigationOptions;
export const scene = createElement(FocusManagement, {
  children: createElement(KeyboardNavigation, {
    ...keyboardNavigationOptions,
    children: createElement(Rectangle, {
      ...rectangleProps,
      key: 'packed-focus-probe',
      style: rectangleStyle,
    }),
  }),
});
export const mount = crc;

const pathStyle = {
  d: new Path2D(),
  fill: '#2563eb',
  stroke: '#0f172a',
  strokeWidth: 2,
  opacity: 0.5,
  cursor: 'pointer',
  lineInteractionWidth: 8,
} satisfies PathStyle;
createElement(Path, { style: pathStyle, onClick: () => undefined });
createElement(Path, { style: pathStyle, ...eventHandlers });

const svgPathStyle = {
  d: 'M 0 0 L 10 10',
  stroke: '#0f172a',
} satisfies SvgPathStyle;
createElement(SvgPath, { style: svgPathStyle });

const lineStyle = {
  coords: [[0, 0], [20, 10]],
  stroke: '#2563eb',
  strokeWidth: 2,
  opacity: 0.5,
  lineInteractionWidth: 8,
  cursor: 'pointer',
} satisfies LineStyle;
createElement(Line, { style: lineStyle, onMouseMove: () => undefined });

const circleStyle = {
  cx: '25%',
  cy: 30,
  radius: '10%',
  fill: '#2563eb',
  cursor: 'pointer',
} satisfies CircleStyle;
const circleProps = { onClick: () => undefined } satisfies CircleProps;

const ellipseStyle = {
  cx: 80,
  cy: '40%',
  radiusX: '15%',
  radiusY: 12,
  rotation: Math.PI / 8,
  stroke: '#0f172a',
  strokeWidth: 2,
} satisfies EllipseStyle;
const ellipseProps = { onPointerDown: () => undefined } satisfies EllipseProps;

const arcStyle = {
  cx: 120,
  cy: 50,
  radius: 24,
  startAngle: 0,
  endAngle: Math.PI,
  counterclockwise: false,
  stroke: '#dc2626',
  lineInteractionWidth: 8,
} satisfies ArcStyle;
const arcProps = { onMouseMove: () => undefined } satisfies ArcProps;

const wedgeStyle = {
  cx: 170,
  cy: 50,
  radius: 28,
  startAngle: -Math.PI / 2,
  endAngle: Math.PI / 3,
  fill: '#f97316',
  stroke: '#9a3412',
} satisfies WedgeStyle;
const wedgeProps = { keyboardFocusable: true } satisfies WedgeProps;

const polygonStyle = {
  coords: [[210, 20], [250, 50], [225, 85]] as [number, number][],
  fill: '#16a34a',
  stroke: '#14532d',
} satisfies PolygonStyle;
const polygonProps = { onClick: () => undefined } satisfies PolygonProps;

const regularPolygonStyle = {
  sides: 6,
  circumradius: 24,
  cornerRadius: 2,
  fill: '#0ea5e9',
} satisfies RegularPolygonStyle;
const regularPolygonProps = { onClick: () => undefined } satisfies RegularPolygonProps;
const starStyle = {
  points: 5,
  outerRadius: 24,
  innerRadius: 10,
  cornerRadii: [2, 0],
  fill: '#f59e0b',
} satisfies StarStyle;
const starProps = { onClick: () => undefined } satisfies StarProps;

const roundedCornerStyle = { cornerRadius: 2 } satisfies RoundedCornerStyle;
const roundedCornerPathOptions = { cornerRadii: [2, null] } satisfies RoundedCornerPathOptions;
const rectanglePathOptions = { width: 20, height: 10, cornerRadius: 2 } satisfies RectanglePathOptions;
const circlePathOptions = { radius: 10 } satisfies CirclePathOptions;
const ellipsePathOptions = { radiusX: 10, radiusY: 5 } satisfies EllipsePathOptions;
const arcPathOptions = { radius: 10, startAngle: 0, endAngle: Math.PI } satisfies ArcPathOptions;
const wedgePathOptions = { radius: 10, startAngle: 0, endAngle: Math.PI } satisfies WedgePathOptions;
const linePathOptions = { coords: [[0, 0], [10, 10]] } satisfies LinePathOptions;
const polygonPathOptions = { coords: [[0, 0], [10, 0], [5, 10]] } satisfies PolygonPathOptions;
const regularPolygonPathPosition = { sides: 6, cx: 10, cy: 10 } satisfies RegularPolygonPathPosition;
const regularPolygonNumericSize = { inradius: 10 } satisfies RegularPolygonNumericSize;
const regularPolygonPathOptions = {
  ...regularPolygonPathPosition,
  ...regularPolygonNumericSize,
} satisfies RegularPolygonPathOptions;
const starPathOptions = { points: 5, outerRadius: 10, innerRadius: 4 } satisfies StarPathOptions;
const svgPathOptions = { d: 'M 0 0 L 10 10' } satisfies SvgPathOptions;
const pathCreators = [
  createArcPath,
  createCirclePath,
  createEllipsePath,
  createLinePath,
  createPolygonPath,
  createRectanglePath,
  createRegularPolygonPath,
  createStarPath,
  createSvgPath,
  createWedgePath,
] as const;
void roundedCornerStyle;
void roundedCornerPathOptions;
void rectanglePathOptions;
void circlePathOptions;
void ellipsePathOptions;
void arcPathOptions;
void wedgePathOptions;
void linePathOptions;
void polygonPathOptions;
void regularPolygonPathPosition;
void regularPolygonNumericSize;
void regularPolygonPathOptions;
void starPathOptions;
void svgPathOptions;
void pathCreators;

export const standardShapeScene = createElement(Group, {
  children: [
    createElement(Circle, { ...circleProps, style: circleStyle }),
    createElement(Ellipse, { ...ellipseProps, style: ellipseStyle }),
    createElement(Arc, { ...arcProps, style: arcStyle }),
    createElement(Wedge, { ...wedgeProps, style: wedgeStyle }),
    createElement(Polygon, { ...polygonProps, style: polygonStyle }),
    createElement(RegularPolygon, {
      ...regularPolygonProps,
      style: regularPolygonStyle,
    }),
    createElement(Star, { ...starProps, style: starStyle }),
  ],
});

const horizontalLineStyle = {
  y: 12,
  x1: 4,
  x2: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies HorizontalLineStyle;
createElement(HorizontalLine, { style: horizontalLineStyle });

const verticalLineStyle = {
  x: 12,
  y1: 4,
  y2: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies VerticalLineStyle;
createElement(VerticalLine, { style: verticalLineStyle });

const textStyle = {
  x: 20,
  y: 24,
  width: 180,
  height: 60,
  lineHeight: 18,
  wrap: true,
  fit: 'ellipsis',
  font: '16px sans-serif',
  textAlign: 'left',
  textBaseline: 'top',
  fill: '#111827',
  opacity: 0.8,
  cursor: 'pointer',
} satisfies TextStyle;
createElement(Text, {
  style: textStyle,
  onClick: () => undefined,
}, 'Hello Canvas');

const imageStyle = {
  src: 'image.png',
  width: 80,
  height: 60,
  stroke: '#0f172a',
  strokeWidth: 1,
  opacity: 0.8,
  alignToPixelGrid: 'round',
  cursor: 'pointer',
} satisfies ImgStyle;
createElement(Image, { style: imageStyle, onClick: () => undefined });

const groupStyle = {
  scaleX: 1.5,
  rotationDegrees: 15,
  rotationOrigin: [10, 10],
  translateX: 20,
  translateY: 30,
  skewX: 5,
  skewY: 3,
} satisfies GStyle;
createElement(Group, {
  style: groupStyle,
  children: createElement(Rectangle, { style: rectangleStyle }),
});

const clipStyle = {
  d: new Path2D(),
  fillRule: 'evenodd',
} satisfies ClipStyle;
createElement(Clip, {
  style: clipStyle,
  children: createElement(Rectangle, { style: rectangleStyle }),
});

const layerStyle = { width: 320, height: 180 } satisfies LayerStyle;
createElement(Layer, {
  style: layerStyle,
  children: createElement(Rectangle, { style: rectangleStyle }),
});

const percentage = '50%' satisfies Percentage;
const length: Length = percentage;
const boxStyle = { width: length, height: 120, overflow: 'clip' } satisfies BoxStyle;
const absoluteStyle = { width: '100%', height: '100%' } satisfies AbsoluteStyle;
const overlayStyle = {
  width: 240,
  height: 120,
  alignItems: 'center',
  justifyItems: 'end',
} satisfies OverlayStyle;
const flowStyle = { width: 300, height: 120, gap: 8, wrap: true } satisfies FlowStyle;
const flexStyle = { width: 300, height: 120, gap: 8, alignItems: 'center' } satisfies FlexStyle;
const gridStyle = {
  width: 300,
  height: 120,
  gridTemplateColumns: [100, '1fr'],
  gridTemplateRows: [120],
} satisfies GridStyle;
const flexItem = { flexBasis: '50%', flexGrow: 1 } satisfies FlexItemStyle;
const gridItem = { gridColumnStart: 1, gridRowStart: 1 } satisfies GridItemStyle;
const layoutItem = { left: '25%', top: 10 } satisfies LayoutItemStyle;
void boxStyle;
void flexItem;
void gridItem;
void layoutItem;

const layoutChild = createElement(Rectangle, {
  style: { ...rectangleStyle, width: '50%' },
});
createElement(Absolute, { style: absoluteStyle, children: layoutChild });
createElement(Overlay, { style: overlayStyle, children: layoutChild });
createElement(Flow, { style: flowStyle, children: layoutChild });
createElement(Flex, {
  style: flexStyle,
  children: createElement(Rectangle, { style: {
    ...rectangleStyle, minWidth: 0, flexBasis: 40,
  } }),
});
createElement(Grid, {
  style: gridStyle,
  children: createElement(Rectangle, { style: {
    ...rectangleStyle, gridColumnStart: 1, gridRowStart: 1,
  } }),
});

createElement(Absolute, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Overlay, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flow, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flex, {
  style: {
    width: 100, height: 50, minWidth: 0, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Grid, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
    gridTemplateColumns: [100],
    gridTemplateRows: [50],
  },
  children: [],
});

const observedBox: Readonly<LayoutBox> = crcLayoutBox();
void observedBox;
measureElement(createElement(Text, null, 'measure me'), {
  minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 100,
}, { measureText: () => ({ width: 80 }) as TextMetrics });

// @ts-expect-error reverse Flex directions are outside the supported subset
createElement(Flex, { style: { ...flexStyle, flexDirection: 'row-reverse' } }, []);
// @ts-expect-error Grid track grammar excludes intrinsic auto tracks
createElement(Grid, { style: { ...gridStyle, gridTemplateColumns: ['auto'] } }, []);
// @ts-expect-error lengths use finite numbers, decimal percentages, or auto
const invalidLength: Length = 'wide';
// @ts-expect-error crcLayoutBox accepts no arguments
crcLayoutBox('parent');

const subpathGroupStyle: CoreTypes.GStyle = groupStyle;
const subpathCircleStyle: CoreTypes.CircleStyle = circleStyle;
const subpathEllipseStyle: CoreTypes.EllipseStyle = ellipseStyle;
const subpathArcStyle: CoreTypes.ArcStyle = arcStyle;
const subpathWedgeStyle: CoreTypes.WedgeStyle = wedgeStyle;
const subpathPolygonStyle: CoreTypes.PolygonStyle = polygonStyle;
const subpathClipStyle: CoreTypes.ClipStyle = clipStyle;
const subpathLayerStyle: CoreTypes.LayerStyle = layerStyle;
const subpathGridStyle: CoreTypes.GridStyle = gridStyle;
const subpathPercentage: CoreTypes.Percentage = percentage;
const subpathKeyboardNavigationOptions: CoreTypes.CRCKeyboardNavigationOptions =
  keyboardNavigationOptions;
void subpathGroupStyle;
void subpathCircleStyle;
void subpathEllipseStyle;
void subpathArcStyle;
void subpathWedgeStyle;
void subpathPolygonStyle;
void subpathClipStyle;
void subpathLayerStyle;
void subpathGridStyle;
void subpathPercentage;
void subpathKeyboardNavigationOptions;

// @ts-expect-error rectangle geometry is style-only
createElement(Rectangle, { x: 10, y: 10, width: 40, height: 20 });
// @ts-expect-error rectangle style requires width and height
createElement(Rectangle, { style: { fill: 'red' } });
// @ts-expect-error Path2D data is style-only
createElement(Path, { d: new Path2D() });
// @ts-expect-error SVG path data is style-only
createElement(SvgPath, { d: 'M 0 0 L 10 10' });
// @ts-expect-error line coordinates are style-only
createElement(Line, { coords: [[0, 0], [20, 10]] });
// @ts-expect-error line style is required because coordinates are required
createElement(Line, {});
// @ts-expect-error legacy line paint names are not style properties
createElement(Line, { style: { coords: [[0, 0], [20, 10]], strokeStyle: 'black', lineWidth: 1 } });
// @ts-expect-error line is stroke-only and does not accept fill paint
createElement(Line, { style: { coords: [[0, 0], [20, 10]], fill: 'red' } });
// @ts-expect-error horizontal-line geometry is style-only
createElement(HorizontalLine, { y: 12 });
// @ts-expect-error horizontal line requires style.y
createElement(HorizontalLine, { style: { stroke: 'black' } });
// @ts-expect-error legacy horizontal endpoint names are not supported
createElement(HorizontalLine, { style: { y: 12, right: 40 } });
// @ts-expect-error vertical-line geometry is style-only
createElement(VerticalLine, { x: 12 });
// @ts-expect-error vertical line requires style.x
createElement(VerticalLine, { style: { stroke: 'black' } });
// @ts-expect-error legacy vertical endpoint names are not supported
createElement(VerticalLine, { style: { x: 12, bottom: 40 } });
// @ts-expect-error text content is supplied through children, not a program prop
createElement(Text, { text: 'legacy' });
// @ts-expect-error text is not a style property
createElement(Text, { style: { text: 'legacy' } });
// @ts-expect-error legacy text sizing names are not supported
createElement(Text, { style: { overflow: 'ellipsis' } }, 'legacy');
// @ts-expect-error text does not accept visual values as program props
createElement(Text, { fillStyle: 'red' }, 'styled');
// @ts-expect-error image source is style-only
createElement(Image, { src: 'legacy.png' });
// @ts-expect-error image style is required because source is required
createElement(Image, {});
// @ts-expect-error legacy image paint names are not style properties
createElement(Image, { style: { src: 'legacy.png', strokeStyle: 'red', lineWidth: 1 } });
// @ts-expect-error image does not accept visual values as program props
createElement(Image, { style: { src: 'styled.png' }, alpha: 0.5 });
// @ts-expect-error group translation is style-only
createElement(Group, { x: 10 }, []);
// @ts-expect-error CRC-native transform names replace the legacy aliases
createElement(Group, { style: { rotate: 45, rotateOrigin: [0, 0] } }, []);
// @ts-expect-error clipping geometry is style-only
createElement(Clip, { path: new Path2D() }, []);
// @ts-expect-error clip style requires path data
createElement(Clip, { style: {} }, []);
// @ts-expect-error layer dimensions are style-only
createElement(Layer, { width: 100, height: 100 },
  createElement(Rectangle, { style: rectangleStyle }));

export function disposeMount(controller: ReturnType<typeof crc>): void {
  const publicController: CRCController = controller;
  publicController.dispose();
}

declare const canvas: HTMLCanvasElement;

function RuntimeProbe({ count }: { count: number; label?: string }): CRCNode {
  const publicContext: RenderingContext2D = crcCanvasContext();
  publicContext.fillRect(0, 0, count, count);
  return [
    createElement(Rectangle, { style: { x: count, y: 0, width: 1, height: 1 } }),
    false,
    null,
    undefined,
    '',
    0,
  ];
}

const runtimeElement = createElement(RuntimeProbe, { count: 1, label: 'typed' });
type PublicElementHasEnhancers = 'enhancers' extends keyof CRCElement ? true : false;
const publicElementHasEnhancers: PublicElementHasEnhancers = false;
const unsupportedEnhancerElement: CRCElement = {
  ...runtimeElement,
  // @ts-expect-error arbitrary enhancer metadata is not part of public CRC elements
  enhancers: [],
};
void publicElementHasEnhancers;
void unsupportedEnhancerElement;
const runtimeController: CRCController = crc(canvas, runtimeElement, {
  signal: new AbortController().signal,
});
runtimeController.dispose();

const surfaceFit: CRCFit = 'scale-down';
const surfacePixelRatio: CRCPixelRatio = 2;
const fixedSurfaceConfig: CRCFixedViewportConfig = {
  viewport: { width: 720, height: 420 },
  fit: surfaceFit,
  pixelRatio: surfacePixelRatio,
};
const responsiveSurfaceConfig: CRCResponsiveViewportConfig = {
  viewport: 'responsive',
  pixelRatio: 'device',
};
const publicSurfaceConfig: CRCConfig = fixedSurfaceConfig;
crc(canvas, runtimeElement, publicSurfaceConfig);
crc(canvas, runtimeElement, responsiveSurfaceConfig);

interface RuntimeProbeStyle extends SystemStyle {
  width: number;
  opacity?: number;
}

const StyledRuntimeProbe = definePrimitive<
  { count: number },
  RuntimeProbeStyle
>((props, style, context) => {
  context.fillRect(0, 0, props.count * style.width, style.opacity ?? 1);
});

createElement(StyledRuntimeProbe, { count: 2, style: { width: 3 } });
createElement(StyledRuntimeProbe, {
  count: 2,
  style: { custom: { source: 'consumer' }, width: 3 },
});
createElement(StyledRuntimeProbe, {
  count: 2,
  style: { width: 3, filter: sepiaFilter },
});
createElement(StyledRuntimeProbe, {
  count: 2,
  style: { width: 3, filter: publicFilterList },
});
// @ts-expect-error declared styles remain closed to excess properties
createElement(StyledRuntimeProbe, { count: 2, style: { unknown: true, width: 3 } });
// @ts-expect-error required style members make the style field required
createElement(StyledRuntimeProbe, { count: 2 });
// @ts-expect-error key is reserved descriptor metadata, not a program prop
definePrimitive<{ key: string }, SystemStyle>(() => undefined);
// @ts-expect-error style is reserved descriptor metadata, not a program prop
definePrimitive<{ style: string }, SystemStyle>(() => undefined);

type PartiallyReservedKeyProps =
  | { kind: 'value'; value: number }
  | { key: string; kind: 'reserved' };
type PartiallyReservedStyleProps =
  | { kind: 'value'; value: number }
  | { kind: 'reserved'; style: string };

// @ts-expect-error key is forbidden in every member of a program-props union
definePrimitive<PartiallyReservedKeyProps, SystemStyle>(() => undefined);
// @ts-expect-error style is forbidden in every member of a program-props union
definePrimitive<PartiallyReservedStyleProps, SystemStyle>(() => undefined);

type DisjointUnionStyle =
  | (SystemStyle & { opacity?: number })
  | (SystemStyle & { width: number });
const DisjointUnionStyleProbe = definePrimitive<{}, DisjointUnionStyle>(
  () => undefined,
);
createElement(DisjointUnionStyleProbe, { style: { opacity: 0.5 } });
createElement(DisjointUnionStyleProbe, { style: { width: 4 } });
// @ts-expect-error one union style member has a required field
createElement(DisjointUnionStyleProbe, {});

// @ts-expect-error arrays are not plain style schemas
definePrimitive<{}, string[]>(() => undefined);
// @ts-expect-error functions are not plain style schemas
definePrimitive<{}, () => void>(() => undefined);
// @ts-expect-error dates are not plain style schemas
definePrimitive<{}, Date>(() => undefined);
// @ts-expect-error URL instances are resources, not declared style schemas
definePrimitive<{}, URL>(() => undefined);
// @ts-expect-error Error instances are resources, not declared style schemas
definePrimitive<{}, Error>(() => undefined);
// @ts-expect-error Blob instances are resources, not declared style schemas
definePrimitive<{}, Blob>(() => undefined);

createElement((_props: object) => false, {});
createElement((_props: object) => null, {});
createElement((_props: object) => undefined, {});
createElement((_props: object) => '', {});
createElement((_props: object) => 0, {});

// @ts-expect-error required component props stay required
createElement(RuntimeProbe, {});
// @ts-expect-error excess component props are rejected
createElement(RuntimeProbe, { count: 1, unknown: true });
// @ts-expect-error crc requires an HTML Canvas
crc(document.createElement('div'), runtimeElement);
// @ts-expect-error crc requires a component element, not a component factory
crc(canvas, RuntimeProbe);
// @ts-expect-error crc signal must be an AbortSignal
crc(canvas, runtimeElement, { signal: 'abort' });
// @ts-expect-error responsive viewports do not accept a fit
crc(canvas, runtimeElement, { viewport: 'responsive', fit: 'contain' });
// @ts-expect-error fixed viewport dimensions must be numeric
crc(canvas, runtimeElement, { viewport: { width: '720', height: 420 } });
// @ts-expect-error pixelRatio accepts only device or a number
crc(canvas, runtimeElement, { pixelRatio: 'retina' });

const [state, setState] = crcState({ count: 0 });
const stateCount: number = state.count;
const typedSetter: StateUpdater<{ count: number }> = setState;
typedSetter({ count: stateCount + 1 });
typedSetter(previous => ({ count: previous.count + 1 }));
// @ts-expect-error state setters preserve the initialized value type
typedSetter({ count: 'one' });

const memoValue: Readonly<{ value: number }> = crcMemo(
  () => ({ value: 1 }),
  [stateCount],
);
memoValue.value;
// @ts-expect-error memo dependencies are required by the public contract
crcMemo(() => 1);

const initializedRef: CRCRef<number> = crcRef(1);
const emptyRef: CRCRef<string> = crcRef<string>();
initializedRef.current = 2;
emptyRef.current = 'ready';
// @ts-expect-error refs preserve their generic current-value type
initializedRef.current = 'two';

crcWhenChanged(() => {
  return () => undefined;
}, [stateCount]);
crcWhenChanged(() => undefined);
// @ts-expect-error change callbacks are synchronous and cannot return a Promise
crcWhenChanged(async () => undefined, []);

const rectanglePath: Path2D = crcRectPath(0, 0, 10, 20, {
  alignToPixelGrid: 'round',
  lineWidth: 1,
});
const linePath: Path2D = crcLinePath([[0, 0], [10, 10]], {
  closePath: true,
});
const parsedPath: Path2D = crcSvgPath('M 0 0 L 10 10');
rectanglePath.addPath(linePath);
parsedPath.addPath(rectanglePath);
// @ts-expect-error rectangle path geometry is numeric
crcRectPath('0', 0, 10, 20);
// @ts-expect-error line coordinates are numeric tuples
crcLinePath([['0', 0]]);
// @ts-expect-error SVG path input is a string
crcSvgPath(123);

crcEvent('click', (event: CRCLogicalMouseEvent) => {
  const x: number = event.x;
  const original: MouseEvent = event.originalEvent;
  void x;
  void original;
}, rectanglePath, true, 8);
const observer = (event: CRCMouseEvent) => {
  const x: number = event.x;
  const original: MouseEvent = event.originalEvent;
  void x;
  void original;
};
crcEvent('mousemove', observer);
crcEvent('mousemove', undefined);
crcEvent('mousemove', event => {
  const x: number = event.x;
  void x;
  // @ts-expect-error pathless crcEvent observers retain the legacy payload
  event.preventDefault();
});
// @ts-expect-error event names are limited to the public CRC event registry
crcEvent('pointerdown', () => undefined);
// @ts-expect-error CRC handlers receive a logical mouse facade, not PointerEvent
crcEvent('click', (_event: PointerEvent) => undefined);

crcCursor({ style: 'crosshair' });
crcCursor({
  path: linePath,
  style: 'pointer',
  fill: false,
  lineInteractionWidth: 8,
});
// @ts-expect-error cursor path must be a Path2D
crcCursor({ path: 'line', style: 'pointer' });
// @ts-expect-error cursor configuration has no unrelated fields
crcCursor({ style: 'pointer', capture: true });
