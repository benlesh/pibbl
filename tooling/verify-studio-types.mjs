import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '..');
const declarations = await readFile(
  join(repositoryRoot, 'playground/src/crc-editor-types.txt'),
  'utf8',
);
const directory = await mkdtemp(join(tmpdir(), 'crc-studio-types-'));
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript')), 'tsc.js');

const consumer = `
import {
  absolute,
  crc,
  crcEvent,
  crcEventListener,
  crcEventTarget,
  defineComp,
  flex,
  flow,
  grid,
  overlay,
  rect,
  withFocusManagement,
  withKeyboardNavigation,
  type CRCConfig,
  type CRCClipboardEvent,
  type CRCCompositionEvent,
  type CRCDragEvent,
  type CRCEvent,
  type CRCEventHandlers,
  type CRCFocusEvent,
  type CRCFit,
  type CRCInputEvent,
  type CRCKeyboardEvent,
  type CRCKeyboardNavigationOptions,
  type CRCLogicalMouseEvent,
  type CRCMouseEvent,
  type CRCPixelRatio,
  type CRCPointerEvent,
  type CRCEventTargetSnapshot,
  type CRCTouchEvent,
  type CRCWheelEvent,
  type OverlayStyle,
  type Percentage,
  type SystemStyle,
} from '@crc/core';

const eventHandlers = {
  onPointerDown: (event: CRCPointerEvent) => {
    const pressure: number = event.pressure;
    void pressure;
  },
  onMouseDown: (event: CRCLogicalMouseEvent) => void event.detail,
  onTouchStart: (event: CRCTouchEvent) => void event.changedTouches,
  onWheel: (event: CRCWheelEvent) => void event.deltaMode,
  onKeyDownCapture: (event: CRCKeyboardEvent) => void event.key,
  onFocus: (event: CRCFocusEvent) => void event.originalEvent,
  onBeforeInput: (event: CRCInputEvent) => void event.inputType,
  onChange: (event: CRCEvent) => void event.originalEvent,
  onCompositionUpdate: (event: CRCCompositionEvent) => void event.data,
  onCopyCapture: (event: CRCClipboardEvent) => void event.clipboardData,
  onDragStart: (event: CRCDragEvent) => void event.dataTransfer,
} satisfies CRCEventHandlers;

const EventProbe = defineComp(() => {
  const snapshot: CRCEventTargetSnapshot = crcEventTarget(eventHandlers, {
    path: new Path2D(),
    fill: true,
  });
  crcEventListener({ onPointerDownCapture: eventHandlers.onPointerDown });
  void snapshot.isFocused;
  return rect({
    ...eventHandlers,
    style: { width: 20, height: 20, fill: 'black' },
  });
});
EventProbe({});

const keyboardNavigationOptions = {
  mode: 'directional',
} satisfies CRCKeyboardNavigationOptions;
withFocusManagement(
  withKeyboardNavigation(
    EventProbe({ key: 'studio-focus-probe' }),
    keyboardNavigationOptions,
  ),
);

const logicalMouseHandler = (event: CRCLogicalMouseEvent) => {
  event.preventDefault();
};
crcEvent('click', logicalMouseHandler, new Path2D());
const canvasObserver = (event: CRCMouseEvent) => void event.x;
crcEvent('mousemove', canvasObserver);
crcEvent('mousemove', event => {
  // @ts-expect-error Canvas observers retain the shipped legacy payload
  event.preventDefault();
});

type UnionStyle =
  | (SystemStyle & { opacity?: number })
  | (SystemStyle & { width: number });
const UnionProbe = defineComp<{}, UnionStyle>(() => undefined);
UnionProbe({ style: { opacity: 0.5 } });
UnionProbe({ style: { width: 4 } });
// @ts-expect-error one union member makes style required
UnionProbe({});

// @ts-expect-error key is reserved descriptor metadata
defineComp<{ key: string }, SystemStyle>(() => undefined);
// @ts-expect-error style is reserved descriptor metadata
defineComp<{ style: string }, SystemStyle>(() => undefined);

interface PercentageStyle extends SystemStyle { radius: Percentage }
interface ResolvedRadiusStyle extends SystemStyle { radius: number }
// @ts-expect-error allocation-dependent declared styles require a resolver
defineComp<{}, PercentageStyle>(() => undefined);
// @ts-expect-error resolved styles must be allocation-free
defineComp<{}, PercentageStyle, PercentageStyle, PercentageStyle>(() => undefined, { resolveStyle: (style: PercentageStyle) => style });
const RadiusProbe = defineComp<
  {},
  PercentageStyle,
  PercentageStyle,
  ResolvedRadiusStyle
>(
  (_props, style) => {
    const radius: number = style.radius;
    void radius;
  },
  {
    resolveStyle: (style, context) => ({
      radius: context.allocation.width * Number.parseFloat(style.radius) / 100,
    }),
  },
);

const overlayStyle = {
  width: 240,
  height: 120,
  alignItems: 'center',
  justifyItems: 'end',
} satisfies OverlayStyle;
overlay({ style: overlayStyle, children: [] });

absolute({
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
overlay({
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
flow({
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
flex({
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
grid({
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
    gridTemplateColumns: [100], gridTemplateRows: [50],
  },
  children: [],
});

declare const canvas: HTMLCanvasElement;
crc(canvas, RadiusProbe({ style: { radius: '50%' } }));
const fit: CRCFit = 'cover';
const pixelRatio: CRCPixelRatio = 2;
const fixedSurface: CRCConfig = {
  viewport: { width: 720, height: 420 },
  fit,
  pixelRatio,
};
crc(canvas, RadiusProbe({ style: { radius: '50%' } }), fixedSurface);
crc(canvas, RadiusProbe({ style: { radius: '50%' } }), {
  viewport: 'responsive',
  pixelRatio: 'device',
});
crc(canvas, RadiusProbe({ style: { radius: '50%' } }), {
  viewport: 'responsive',
  // @ts-expect-error responsive viewports do not accept fit
  fit: 'contain',
});
`;

try {
  await writeFile(join(directory, 'index.d.ts'), declarations);
  await writeFile(join(directory, 'consumer.ts'), consumer);
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      lib: ['ESNext', 'DOM'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: 'ESNext',
    },
    files: ['index.d.ts', 'consumer.ts'],
  }));
  const result = spawnSync(process.execPath, [tsc, '-p', directory], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error('CRC Studio declarations failed their strict consumer.');
  }
  process.stdout.write('CRC Studio declarations passed strict event-family, generic, layout, and surface checks.\n');
} finally {
  await rm(directory, { recursive: true, force: true });
}
