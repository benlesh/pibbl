import type {
  CRCController,
  CRCMouseEvent,
  CRCRef,
  RectProps,
  RenderingContext2D,
  StateUpdater,
  SystemStyle,
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
  defineComp,
  rect,
} from '@crc/core';

const props = {
  x: 10,
  y: 10,
  width: 40,
  height: 20,
  fillStyle: '#2563eb',
} satisfies RectProps;

export type PublicCoreTypes = typeof CoreTypes;
export const scene = rect(props);
export const mount = crc;

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
      rect({ x: count, y: 0, width: 1, height: 1 }),
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
