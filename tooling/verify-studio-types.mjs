import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { crcRuntimeSource } from './crc-runtime-source.ts';

const repositoryRoot = resolve(import.meta.dirname, '..');
const declarationBundle = await readFile(
  join(repositoryRoot, 'playground/src/crc-editor-types.txt'),
  'utf8',
);
const directory = await mkdtemp(join(tmpdir(), 'crc-studio-types-'));
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript')), 'tsc.js');

const modulePaths = new Map([
  ['@crc/core', 'node_modules/@crc/core/index.d.ts'],
  ['@crc/core/jsx-runtime', 'node_modules/@crc/core/jsx-runtime.d.ts'],
  ['@crc/core/jsx-dev-runtime', 'node_modules/@crc/core/jsx-dev-runtime.d.ts'],
]);

function readDeclarationModules(bundle) {
  const markers = [...bundle.matchAll(/^\/\* @crc-studio-module (.+) \*\/$/gmu)];
  const modules = markers.map((marker, index) => ({
    moduleName: marker[1],
    content: bundle.slice(
      marker.index + marker[0].length,
      markers[index + 1]?.index ?? bundle.length,
    ).trimStart(),
  }));
  if (
    modules.length !== modulePaths.size ||
    new Set(modules.map(({ moduleName }) => moduleName)).size !== modulePaths.size ||
    modules.some(({ moduleName }) => !modulePaths.has(moduleName))
  ) {
    throw new Error('CRC Studio declarations must define the three package entry points exactly once.');
  }
  return modules;
}

const declarationModules = readDeclarationModules(declarationBundle);

const removedTypeImports = [
  [['define', 'Comp'], 'RemovedDefinitionWrapper'],
  [['Comp', 'El'], 'RemovedElementType'],
  [['Comp', 'Fn'], 'RemovedRenderType'],
  [['Component', 'Input'], 'RemovedInputType'],
  [['Component', 'Capabilities'], 'RemovedCapabilityType'],
  [['Falsy', 'Nodes'], 'RemovedEmptyNodeType'],
].map(([parts, alias]) =>
  '// @ts-expect-error removed authoring type\n' +
  `import type { ${parts.join('')} as ${alias} } from '@crc/core';`,
).join('\n');

const consumer = `
${removedTypeImports}
import * as CRC_CORE_ROOT from '@crc/core';
import {
  Absolute,
  crc,
  crcCanvasContext,
  crcEvent,
  crcEventListener,
  crcEventTarget,
  createElement,
  definePrimitive,
  Flex,
  Flow,
  FocusManagement,
  Grid,
  KeyboardNavigation,
  Overlay,
  Rectangle,
  Text,
  type CRCConfig,
  type CRCController,
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
  type CRCNode,
  type CRCPixelRatio,
  type CRCPointerEvent,
  type CRCEventTargetSnapshot,
  type CRCTouchEvent,
  type CRCWheelEvent,
  type FocusManagementProps,
  type KeyboardNavigationProps,
  type OverlayStyle,
  type Percentage,
  type PrimitiveCapabilities,
  type PrimitiveInput,
  type PrimitiveProgramProps,
  type PrimitiveRender,
  type RenderingContext2D,
  type SystemStyle,
} from '@crc/core';
import { jsx, jsxs } from '@crc/core/jsx-runtime';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';

// @ts-expect-error compiler constructors stay off the root package
void CRC_CORE_ROOT.jsx;
void jsx(Rectangle, { style: { width: 1, height: 1 } });
void jsxs(Text, { children: ['CRC ', 1] });
void jsxDEV(Rectangle, { style: { width: 1, height: 1 } }, undefined, false, {
  fileName: 'studio.crc.tsx', lineNumber: 1, columnNumber: 1,
}, undefined);

interface StudioCardProps {
  label: string;
  active: boolean;
}

function StudioCard({ label, active }: StudioCardProps): CRCNode {
  return (
    <>
      <Rectangle
        style={{
          x: 16,
          y: active ? 16 : 48,
          width: 180,
          height: 28,
          fill: active ? '#1f4bd8' : '#74d3ae',
        }}
        onClick={() => console.log(label)}
      />
      <Text style={{ x: 24, y: active ? 22 : 54, fill: '#fff' }}>
        {label} — {active ? 'active' : 'waiting'}
      </Text>
    </>
  );
}

function StudioLesson(): CRCNode {
  const labels = ['one', 'two'];
  const showFooter = true;
  return (
    <>
      {labels.map((label, index) => (
        <StudioCard key={label} label={label} active={index === 0} />
      ))}
      {showFooter && <Text style={{ x: 16, y: 92 }}>Ready: {labels.length}</Text>}
    </>
  );
}

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

function EventProbe(): CRCNode {
  const snapshot: CRCEventTargetSnapshot = crcEventTarget(eventHandlers, {
    path: new Path2D(),
    fill: true,
  });
  crcEventListener({ onPointerDownCapture: eventHandlers.onPointerDown });
  void snapshot.isFocused;
  const context: RenderingContext2D = crcCanvasContext();
  void context;
  return <Rectangle
    {...eventHandlers}
    style={{ width: 20, height: 20, fill: 'black' }}
  />;
}
createElement(EventProbe, {});

const keyboardNavigationOptions = {
  mode: 'directional',
} satisfies CRCKeyboardNavigationOptions;
const policyTree = (
  <FocusManagement>
    <KeyboardNavigation {...keyboardNavigationOptions}>
      <EventProbe key="studio-focus-probe" />
    </KeyboardNavigation>
  </FocusManagement>
);
void policyTree;
// @ts-expect-error focus policies reject raw container text
const invalidFocusPolicy = { children: 'raw text' } satisfies FocusManagementProps;
void invalidFocusPolicy;

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
const UnionProbe = definePrimitive<{}, UnionStyle>(() => undefined);
createElement(UnionProbe, { style: { opacity: 0.5 } });
createElement(UnionProbe, { style: { width: 4 } });
// @ts-expect-error one union member makes style required
createElement(UnionProbe, {});

// @ts-expect-error key is reserved descriptor metadata
definePrimitive<{ key: string }, SystemStyle>(() => undefined);
// @ts-expect-error style is reserved descriptor metadata
definePrimitive<{ style: string }, SystemStyle>(() => undefined);

interface PercentageStyle extends SystemStyle { radius: Percentage }
interface ResolvedRadiusStyle extends SystemStyle { radius: number }
// @ts-expect-error allocation-dependent declared styles require a resolver
definePrimitive<{}, PercentageStyle>(() => undefined);
// @ts-expect-error resolved styles must be allocation-free
definePrimitive<{}, PercentageStyle, PercentageStyle, PercentageStyle>(() => undefined, { resolveStyle: (style: PercentageStyle) => style });
const RadiusProbe = definePrimitive<
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
type StudioPrimitiveTypes = [
  PrimitiveProgramProps<{ label: string }>,
  PrimitiveInput<{ label: string }, PercentageStyle>,
  PrimitiveRender<{ label: string }, ResolvedRadiusStyle>,
  PrimitiveCapabilities<{ label: string }, PercentageStyle>,
];
void (null as unknown as StudioPrimitiveTypes);

const overlayStyle = {
  width: 240,
  height: 120,
  alignItems: 'center',
  justifyItems: 'end',
} satisfies OverlayStyle;
createElement(Overlay, { style: overlayStyle, children: [] });

const layoutPolicies = (
  <>
    <Absolute
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Absolute>
    <Overlay
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Overlay>
    <Flow
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Flow>
    <Flex
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
      }}
    >{false}</Flex>
    <Grid
      style={{
        left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
        flexBasis: 24, flexGrow: 1, flexShrink: 0,
        gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
        gridTemplateColumns: [100], gridTemplateRows: [50],
      }}
    >{false}</Grid>
  </>
);
void layoutPolicies;

createElement(Absolute, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Overlay, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flow, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flex, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Grid, {
  style: {
    left: 4, top: '10%', alignSelf: 'center', justifySelf: 'end',
    flexBasis: 24, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 1,
    gridTemplateColumns: [100], gridTemplateRows: [50],
  },
  children: [],
});

declare const canvas: HTMLCanvasElement;
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }));
const fit: CRCFit = 'cover';
const pixelRatio: CRCPixelRatio = 2;
const fixedSurface: CRCConfig = {
  viewport: { width: 720, height: 420 },
  fit,
  pixelRatio,
};
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }), fixedSurface);
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }), {
  viewport: 'responsive',
  pixelRatio: 'device',
});
crc(canvas, createElement(RadiusProbe, { style: { radius: '50%' } }), {
  viewport: 'responsive',
  // @ts-expect-error responsive viewports do not accept fit
  fit: 'contain',
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <StudioLesson />);
}
`;

const foreignRuntimeDeclarations = `
declare const foreignElementBrand: unique symbol;
export interface ForeignElement { readonly [foreignElementBrand]: true }
export const Fragment: (props: { children?: unknown }) => ForeignElement;
export function jsx(type: unknown, props: unknown, key?: string | number): ForeignElement;
export const jsxs: typeof jsx;
export namespace JSX {
  export type Element = ForeignElement;
  export type ElementType = (props: any) => ForeignElement;
  export interface ElementChildrenAttribute { children: unknown }
  export interface IntrinsicAttributes { key?: string | number }
  export interface IntrinsicElements {}
}
`;

const foreignRuntimeConsumer = `
/** @jsxImportSource ./foreign-runtime */
import { crc } from '@crc/core';

function ForeignScene() {
  return <></>;
}

declare const canvas: HTMLCanvasElement;
crc(canvas, <ForeignScene />);
`;

async function studioRuntimeExports(mode) {
  const plugin = crcRuntimeSource(mode);
  const resolvedId = plugin.resolveId('virtual:crc-runtime-source');
  const loaded = await plugin.load(resolvedId);
  const serializedRuntime = /^export default ([\s\S]+);$/u.exec(loaded)?.[1];
  if (!serializedRuntime) {
    throw new Error(`CRC Studio ${mode} runtime did not expose an IIFE module.`);
  }
  const context = {};
  runInNewContext(JSON.parse(serializedRuntime), context);
  return Object.keys(context.CRC_CORE ?? {}).sort();
}

try {
  for (const { moduleName, content } of declarationModules) {
    const declarationPath = join(directory, modulePaths.get(moduleName));
    await mkdir(dirname(declarationPath), { recursive: true });
    await writeFile(declarationPath, content);
  }
  await writeFile(join(directory, 'consumer.tsx'), consumer);
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      jsx: 'react-jsx',
      jsxImportSource: '@crc/core',
      lib: ['ESNext', 'DOM'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: 'ESNext',
    },
    files: ['consumer.tsx'],
  }));
  const result = spawnSync(process.execPath, [tsc, '-p', directory], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error('CRC Studio declarations failed their strict consumer.');
  }
  const foreignRuntimeDirectory = join(directory, 'foreign-runtime');
  await mkdir(foreignRuntimeDirectory, { recursive: true });
  await writeFile(
    join(foreignRuntimeDirectory, 'jsx-runtime.d.ts'),
    foreignRuntimeDeclarations,
  );
  await writeFile(
    join(directory, 'foreign-runtime-consumer.tsx'),
    foreignRuntimeConsumer,
  );
  await writeFile(
    join(directory, 'tsconfig.foreign-runtime.json'),
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@crc/core',
        lib: ['ESNext', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: 'ESNext',
      },
      files: ['foreign-runtime-consumer.tsx'],
    }),
  );
  const foreignRuntimeResult = spawnSync(
    process.execPath,
    [tsc, '-p', join(directory, 'tsconfig.foreign-runtime.json')],
    { encoding: 'utf8' },
  );
  const foreignRuntimeOutput =
    foreignRuntimeResult.stdout + foreignRuntimeResult.stderr;
  if (
    foreignRuntimeResult.status === 0 ||
    !foreignRuntimeOutput.includes("not assignable to parameter of type 'CRCNode'")
  ) {
    process.stderr.write(foreignRuntimeOutput);
    throw new Error(
      'CRC Studio declarations did not diagnose a foreign JSX runtime at crc().',
    );
  }
  const sourceRuntimeExports = await studioRuntimeExports('source');
  const builtRuntimeExports = await studioRuntimeExports('built');
  const expectedStudioRuntimeExports = [
    'Absolute',
    'Clip',
    'Flex',
    'Flow',
    'FocusManagement',
    'Fragment',
    'Grid',
    'Group',
    'HorizontalLine',
    'Image',
    'KeyboardNavigation',
    'Layer',
    'LayoutDiagnostic',
    'Line',
    'Overlay',
    'Path',
    'Rectangle',
    'SvgPath',
    'Text',
    'VerticalLine',
    'crc',
    'crcCanvasContext',
    'crcCursor',
    'crcEvent',
    'crcEventListener',
    'crcEventTarget',
    'crcLayoutBox',
    'crcLinePath',
    'crcMemo',
    'crcRectPath',
    'crcRef',
    'crcState',
    'crcSvgPath',
    'crcWhenChanged',
    'createElement',
    'definePrimitive',
    'jsx',
    'jsxDEV',
    'jsxs',
    'layoutDiagnostic',
    'measureElement',
    'normalizeEdges',
    'resolveBox',
    'resolveLength',
  ].sort();
  if (sourceRuntimeExports.join('\n') !== expectedStudioRuntimeExports.join('\n')) {
    throw new Error(
      `CRC Studio source runtime has unexpected exports: ${sourceRuntimeExports.join(', ')}.`,
    );
  }
  if (sourceRuntimeExports.join('\n') !== builtRuntimeExports.join('\n')) {
    throw new Error('CRC Studio source and built runtime surfaces differ.');
  }
  process.stdout.write('CRC Studio declarations passed strict TSX, compiler-runtime, event-family, generic, layout, and surface checks.\n');
} finally {
  await rm(directory, { recursive: true, force: true });
}
