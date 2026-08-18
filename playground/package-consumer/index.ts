import type {
  CRCController,
  CRCMouseEvent,
  CRCRef,
  ClipStyle,
  GStyle,
  HorizontalLineStyle,
  ImgStyle,
  LayerStyle,
  LineStyle,
  PathStyle,
  RectProps,
  RectStyle,
  RenderingContext2D,
  StateUpdater,
  SvgPathStyle,
  SystemStyle,
  TextStyle,
  VerticalLineStyle,
} from '@crc/core';
import type * as CoreTypes from '@crc/core/types';
import {
  crc,
  crcCursor,
  crcEvent,
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
} from '@crc/core';

const rectangleStyle = {
  x: 10,
  y: 10,
  width: 40,
  height: 20,
  fill: '#2563eb',
} satisfies RectStyle;
const props = {} satisfies RectProps;

export type PublicCoreTypes = typeof CoreTypes;
export const scene = rect({ ...props, style: rectangleStyle });
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
  left: 4,
  right: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies HorizontalLineStyle;
horizontalLine({ style: horizontalLineStyle });

const verticalLineStyle = {
  x: 12,
  top: 4,
  bottom: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies VerticalLineStyle;
verticalLine({ style: verticalLineStyle });

const textStyle = {
  text: 'Hello Canvas',
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
text({ style: textStyle, onClick: () => undefined });

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

const subpathGroupStyle: CoreTypes.GStyle = groupStyle;
const subpathClipStyle: CoreTypes.ClipStyle = clipStyle;
const subpathLayerStyle: CoreTypes.LayerStyle = layerStyle;
void subpathGroupStyle;
void subpathClipStyle;
void subpathLayerStyle;

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
// @ts-expect-error vertical-line geometry is style-only
verticalLine({ x: 12 });
// @ts-expect-error vertical line requires style.x
verticalLine({ style: { stroke: 'black' } });
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
const runtimeController: CRCController = crc(canvas, runtimeElement, {
  signal: new AbortController().signal,
});
runtimeController.dispose();

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

crcEvent('click', (event: CRCMouseEvent) => {
  const x: number = event.x;
  const original: MouseEvent = event.originalEvent;
  void x;
  void original;
}, rectanglePath, true, 8);
crcEvent('mousemove', undefined);
// @ts-expect-error event names are limited to the public CRC event registry
crcEvent('pointerdown', () => undefined);
// @ts-expect-error CRC handlers receive CRCMouseEvent rather than PointerEvent
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
