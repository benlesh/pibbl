import type {
  CRCConfig,
  CRCClipboardEvent,
  CRCCompositionEvent,
  CRCController,
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
  CRCFit,
  CRCFixedViewportConfig,
  CRCFocusEvent,
  CRCInputEvent,
  CRCKeyboardEvent,
  CRCKeyboardNavigationOptions,
  CRCLogicalMouseEvent,
  CRCMouseEvent,
  CRCPixelRatio,
  CRCPointerEvent,
  CRCRef,
  CRCResponsiveViewportConfig,
  CRCTouchEvent,
  CRCWheelEvent,
  AbsoluteStyle,
  BoxStyle,
  CompEl,
  ClipStyle,
  GStyle,
  GridItemStyle,
  GridStyle,
  HorizontalLineStyle,
  ImgStyle,
  LayerStyle,
  LayoutBox,
  LayoutItemStyle,
  Length,
  LineStyle,
  PathStyle,
  RectProps,
  RectStyle,
  RenderingContext2D,
  StateUpdater,
  SvgPathStyle,
  SystemStyle,
  Percentage,
  FlexItemStyle,
  FlexStyle,
  FlowStyle,
  OverlayStyle,
  TextStyle,
  VerticalLineStyle,
} from '@crc/core';
import type * as CoreTypes from '@crc/core/types';
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
  clip,
  defineComp,
  g,
  horizontalLine,
  line,
  path,
  rect,
  svgPath,
  text,
  verticalLine,
  img,
  layer,
  absolute,
  overlay,
  flow,
  flex,
  grid,
  measureElement,
  withFocusManagement,
  withKeyboardNavigation,
} from '@crc/core';

// @ts-expect-error internal library modules are outside the public export map
import type { CRCEventRoot } from '@crc/core/lib/types';
// @ts-expect-error package source modules are outside the public export map
import type { CRCEventDefinition } from '@crc/core/src/lib/events/event-definitions';
void (undefined as unknown as CRCEventRoot);
void (undefined as unknown as CRCEventDefinition);

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

const PublicEventProbe = defineComp(() => {
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
});
PublicEventProbe({});

const rectangleStyle = {
  x: 10,
  y: 10,
  width: 40,
  height: 20,
  fill: '#2563eb',
} satisfies RectStyle;
const props = {} satisfies RectProps;

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
export const scene = withFocusManagement(
  withKeyboardNavigation(
    rect({ ...props, key: 'packed-focus-probe', style: rectangleStyle }),
    keyboardNavigationOptions,
  ),
);
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
path({ style: pathStyle, onClick: () => undefined });
path({ style: pathStyle, ...eventHandlers });

const svgPathStyle = {
  d: 'M 0 0 L 10 10',
  stroke: '#0f172a',
} satisfies SvgPathStyle;
svgPath({ style: svgPathStyle });

const lineStyle = {
  coords: [[0, 0], [20, 10]],
  stroke: '#2563eb',
  strokeWidth: 2,
  opacity: 0.5,
  lineInteractionWidth: 8,
  cursor: 'pointer',
} satisfies LineStyle;
line({ style: lineStyle, onMouseMove: () => undefined });

const horizontalLineStyle = {
  y: 12,
  x1: 4,
  x2: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies HorizontalLineStyle;
horizontalLine({ style: horizontalLineStyle });

const verticalLineStyle = {
  x: 12,
  y1: 4,
  y2: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies VerticalLineStyle;
verticalLine({ style: verticalLineStyle });

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
text({
  style: { ...textStyle, text: 'Hello Canvas' },
  onClick: () => undefined,
});

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
img({ style: imageStyle, onClick: () => undefined });

const groupStyle = {
  scaleX: 1.5,
  rotationDegrees: 15,
  rotationOrigin: [10, 10],
  translateX: 20,
  translateY: 30,
  skewX: 5,
  skewY: 3,
} satisfies GStyle;
g({ style: groupStyle, children: [rect({ style: rectangleStyle })] });

const clipStyle = {
  d: new Path2D(),
  fillRule: 'evenodd',
} satisfies ClipStyle;
clip({ style: clipStyle, children: [rect({ style: rectangleStyle })] });

const layerStyle = { width: 320, height: 180 } satisfies LayerStyle;
layer({ style: layerStyle, render: rect({ style: rectangleStyle }) });

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

const layoutChild = rect({ style: { ...rectangleStyle, width: '50%' } });
absolute({ style: absoluteStyle, children: [layoutChild] });
overlay({ style: overlayStyle, children: [layoutChild] });
flow({ style: flowStyle, children: [layoutChild] });
flex({ style: flexStyle, children: [rect({ style: {
  ...rectangleStyle, minWidth: 0, flexBasis: 40,
} })] });
grid({ style: gridStyle, children: [rect({ style: {
  ...rectangleStyle, gridColumnStart: 1, gridRowStart: 1,
} })] });

absolute({
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
overlay({
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
flow({
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
flex({
  style: {
    width: 100, height: 50, minWidth: 0, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
grid({
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
measureElement(text({ style: { text: 'measure me' } }), {
  minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 100,
}, { measureText: () => ({ width: 80 }) as TextMetrics });

// @ts-expect-error reverse Flex directions are outside the supported subset
flex({ style: { ...flexStyle, flexDirection: 'row-reverse' }, children: [] });
// @ts-expect-error Grid track grammar excludes intrinsic auto tracks
grid({ style: { ...gridStyle, gridTemplateColumns: ['auto'] }, children: [] });
// @ts-expect-error lengths use finite numbers, decimal percentages, or auto
const invalidLength: Length = 'wide';
// @ts-expect-error crcLayoutBox accepts no arguments
crcLayoutBox('parent');

const subpathGroupStyle: CoreTypes.GStyle = groupStyle;
const subpathClipStyle: CoreTypes.ClipStyle = clipStyle;
const subpathLayerStyle: CoreTypes.LayerStyle = layerStyle;
const subpathGridStyle: CoreTypes.GridStyle = gridStyle;
const subpathPercentage: CoreTypes.Percentage = percentage;
const subpathKeyboardNavigationOptions: CoreTypes.CRCKeyboardNavigationOptions =
  keyboardNavigationOptions;
void subpathGroupStyle;
void subpathClipStyle;
void subpathLayerStyle;
void subpathGridStyle;
void subpathPercentage;
void subpathKeyboardNavigationOptions;

// @ts-expect-error rectangle geometry is style-only
rect({ x: 10, y: 10, width: 40, height: 20 });
// @ts-expect-error rectangle style requires width and height
rect({ style: { fill: 'red' } });
// @ts-expect-error Path2D data is style-only
path({ d: new Path2D() });
// @ts-expect-error SVG path data is style-only
svgPath({ d: 'M 0 0 L 10 10' });
// @ts-expect-error line coordinates are style-only
line({ coords: [[0, 0], [20, 10]] });
// @ts-expect-error line style is required because coordinates are required
line({});
// @ts-expect-error legacy line paint names are not style properties
line({ style: { coords: [[0, 0], [20, 10]], strokeStyle: 'black', lineWidth: 1 } });
// @ts-expect-error line is stroke-only and does not accept fill paint
line({ style: { coords: [[0, 0], [20, 10]], fill: 'red' } });
// @ts-expect-error horizontal-line geometry is style-only
horizontalLine({ y: 12 });
// @ts-expect-error horizontal line requires style.y
horizontalLine({ style: { stroke: 'black' } });
// @ts-expect-error legacy horizontal endpoint names are not supported
horizontalLine({ style: { y: 12, right: 40 } });
// @ts-expect-error vertical-line geometry is style-only
verticalLine({ x: 12 });
// @ts-expect-error vertical line requires style.x
verticalLine({ style: { stroke: 'black' } });
// @ts-expect-error legacy vertical endpoint names are not supported
verticalLine({ style: { x: 12, bottom: 40 } });
// @ts-expect-error text content is style-only
text({ text: 'legacy' });
// @ts-expect-error text style is required because text content is required
text({});
// @ts-expect-error legacy text sizing and fit names are not supported
text({ style: { text: 'legacy', maxWidth: 40, overflow: 'ellipsis' } });
// @ts-expect-error text does not accept visual values as program props
text({ style: { text: 'styled' }, fillStyle: 'red' });
// @ts-expect-error image source is style-only
img({ src: 'legacy.png' });
// @ts-expect-error image style is required because source is required
img({});
// @ts-expect-error legacy image paint names are not style properties
img({ style: { src: 'legacy.png', strokeStyle: 'red', lineWidth: 1 } });
// @ts-expect-error image does not accept visual values as program props
img({ style: { src: 'styled.png' }, alpha: 0.5 });
// @ts-expect-error group translation is style-only
g({ x: 10, children: [] });
// @ts-expect-error CRC-native transform names replace the legacy aliases
g({ style: { rotate: 45, rotateOrigin: [0, 0] }, children: [] });
// @ts-expect-error clipping geometry is style-only
clip({ path: new Path2D(), children: [] });
// @ts-expect-error clip style requires path data
clip({ style: {}, children: [] });
// @ts-expect-error layer dimensions are style-only
layer({ width: 100, height: 100, render: rect({ style: rectangleStyle }) });

export function disposeMount(controller: ReturnType<typeof crc>): void {
  const publicController: CRCController = controller;
  publicController.dispose();
}

declare const canvas: HTMLCanvasElement;

const RuntimeProbe = defineComp<{ count: number; label?: string }>(
  ({ count }, _style, context) => {
    const publicContext: RenderingContext2D = context;
    publicContext.fillRect(0, 0, count, count);
    return [
      rect({ style: { x: count, y: 0, width: 1, height: 1 } }),
      false,
      null,
      undefined,
      '',
      0,
    ];
  },
);

const runtimeElement = RuntimeProbe({ count: 1, label: 'typed' });
type PublicCompElHasEnhancers = 'enhancers' extends keyof CompEl ? true : false;
const publicCompElHasEnhancers: PublicCompElHasEnhancers = false;
const unsupportedEnhancerElement: CompEl = {
  ...runtimeElement,
  // @ts-expect-error arbitrary enhancer metadata is not part of public CompEl
  enhancers: [],
};
void publicCompElHasEnhancers;
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

const StyledRuntimeProbe = defineComp<
  { count: number },
  RuntimeProbeStyle
>((props, style, context) => {
  context.fillRect(0, 0, props.count * style.width, style.opacity ?? 1);
});

StyledRuntimeProbe({ count: 2, style: { width: 3 } });
StyledRuntimeProbe({
  count: 2,
  style: { custom: { source: 'consumer' }, width: 3 },
});
// @ts-expect-error declared styles remain closed to excess properties
StyledRuntimeProbe({ count: 2, style: { unknown: true, width: 3 } });
// @ts-expect-error required style members make the style field required
StyledRuntimeProbe({ count: 2 });
// @ts-expect-error key is reserved descriptor metadata, not a program prop
defineComp<{ key: string }, SystemStyle>(() => undefined);
// @ts-expect-error style is reserved descriptor metadata, not a program prop
defineComp<{ style: string }, SystemStyle>(() => undefined);

type PartiallyReservedKeyProps =
  | { kind: 'value'; value: number }
  | { key: string; kind: 'reserved' };
type PartiallyReservedStyleProps =
  | { kind: 'value'; value: number }
  | { kind: 'reserved'; style: string };

// @ts-expect-error key is forbidden in every member of a program-props union
defineComp<PartiallyReservedKeyProps, SystemStyle>(() => undefined);
// @ts-expect-error style is forbidden in every member of a program-props union
defineComp<PartiallyReservedStyleProps, SystemStyle>(() => undefined);

type DisjointUnionStyle =
  | (SystemStyle & { opacity?: number })
  | (SystemStyle & { width: number });
const DisjointUnionStyleProbe = defineComp<{}, DisjointUnionStyle>(
  () => undefined,
);
DisjointUnionStyleProbe({ style: { opacity: 0.5 } });
DisjointUnionStyleProbe({ style: { width: 4 } });
// @ts-expect-error one union style member has a required field
DisjointUnionStyleProbe({});

// @ts-expect-error arrays are not plain style schemas
defineComp<{}, string[]>(() => undefined);
// @ts-expect-error functions are not plain style schemas
defineComp<{}, () => void>(() => undefined);
// @ts-expect-error dates are not plain style schemas
defineComp<{}, Date>(() => undefined);
// @ts-expect-error URL instances are resources, not declared style schemas
defineComp<{}, URL>(() => undefined);
// @ts-expect-error Error instances are resources, not declared style schemas
defineComp<{}, Error>(() => undefined);
// @ts-expect-error Blob instances are resources, not declared style schemas
defineComp<{}, Blob>(() => undefined);

defineComp(() => false)({});
defineComp(() => null)({});
defineComp(() => undefined)({});
defineComp(() => '')({});
defineComp(() => 0)({});

// @ts-expect-error required component props stay required
RuntimeProbe({});
// @ts-expect-error excess component props are rejected
RuntimeProbe({ count: 1, unknown: true });
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
