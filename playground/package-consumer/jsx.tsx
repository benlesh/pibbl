import type {
  CRCBlurFilter,
  CRCBrightnessFilter,
  CRCContrastFilter,
  CRCController,
  CRCDropShadowFilter,
  CRCElement,
  CRCFilter,
  CRCGrayscaleFilter,
  CRCHueRotateFilter,
  CRCInvertFilter,
  CRCNode,
  CRCOpacityFilter,
  CRCSaturateFilter,
  CRCSepiaFilter,
  CRCTextChild,
  SystemStyle,
} from '@crc/core';
import {
  Absolute,
  Flex,
  Flow,
  Grid,
  Group,
  Overlay,
  Rectangle,
  Text,
  crc,
  definePrimitive,
} from '@crc/core';
import {
  Fragment as DevelopmentFragment,
  jsxDEV,
  type JSX as DevelopmentJSX,
} from '@crc/core/jsx-dev-runtime';

function Label(props: { value: string; children?: CRCTextChild }): CRCNode {
  void props;
  return undefined;
}

const jsxFilterTypes = [
  { type: 'blur', radius: 2 } satisfies CRCBlurFilter,
  { type: 'brightness', amount: 1.25 } satisfies CRCBrightnessFilter,
  { type: 'contrast', amount: 0.8 } satisfies CRCContrastFilter,
  {
    type: 'dropShadow',
    offsetX: 3,
    offsetY: 4,
    color: 'black',
  } satisfies CRCDropShadowFilter,
  { type: 'grayscale', amount: 0.5 } satisfies CRCGrayscaleFilter,
  { type: 'hueRotate', degrees: 45 } satisfies CRCHueRotateFilter,
  { type: 'invert', amount: 0.25 } satisfies CRCInvertFilter,
  { type: 'opacity', amount: 0.75 } satisfies CRCOpacityFilter,
  { type: 'saturate', amount: 1.5 } satisfies CRCSaturateFilter,
  { type: 'sepia', amount: 0.4 } satisfies CRCSepiaFilter,
] as const satisfies readonly CRCFilter[];

interface FilterPrimitiveStyle extends SystemStyle {
  width: number;
}

const FilterPrimitive = definePrimitive<{}, FilterPrimitiveStyle>(
  (_props, style, context) => {
    context.fillRect(0, 0, style.width, style.width);
  },
);

export const jsxFilterElements: readonly CRCElement[] = [
  <Rectangle
    style={{ width: 40, height: 20, filter: jsxFilterTypes[0] }}
  />,
  <Rectangle style={{ width: 40, height: 20, filter: jsxFilterTypes }} />,
  <Group style={{ filter: jsxFilterTypes[3] }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Group>,
  <Group style={{ filter: jsxFilterTypes }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Group>,
  <Absolute style={{ width: 100, height: 50, filter: jsxFilterTypes[7] }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Absolute>,
  <Absolute style={{ width: 100, height: 50, filter: jsxFilterTypes }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Absolute>,
  <FilterPrimitive style={{ width: 12, filter: jsxFilterTypes[9] }} />,
  <FilterPrimitive style={{ width: 12, filter: jsxFilterTypes }} />,
];

export const automaticElement: CRCElement = (
  <Label key="automatic" value="ready">
    CRC
  </Label>
);

export type DevelopmentElement = DevelopmentJSX.Element;

export const developmentElement = jsxDEV(
  Label,
  { value: 'ready' },
  'development',
  false,
  {
    fileName: 'jsx.tsx',
    lineNumber: 22,
    columnNumber: 65,
  },
  undefined,
);

export const developmentFragment: DevelopmentJSX.ElementType =
  DevelopmentFragment;

interface PosterProps {
  readonly labels: readonly string[];
  readonly showTitle: boolean;
}

function Poster({ labels, showTitle }: PosterProps): CRCNode {
  return (
    <Grid
      style={{
        width: 240,
        height: 120,
        gridTemplateColumns: [120, 120],
        gridTemplateRows: [60, 60],
      }}
    >
      {labels.map((label, index) => (
        <Rectangle
          key={label}
          style={{
            width: 120,
            height: 60,
            fill: index % 2 === 0 ? '#2563eb' : '#7c3aed',
            gridColumnStart: index + 1,
            gridRowStart: 1,
          }}
        />
      ))}
      {showTitle && (
        <Text
          style={{
            x: 12,
            y: 24,
            gridColumnStart: 1,
            gridColumnSpan: 2,
            gridRowStart: 2,
          }}
        >
          {labels.join(', ')}
        </Text>
      )}
    </Grid>
  );
}

export function mountAutomaticJSXConsumer(
  canvas: HTMLCanvasElement,
): CRCController {
  return crc(canvas, <Poster labels={['Bundler', 'NodeNext']} showTitle />);
}

function* layoutChildren(): Generator<CRCNode> {
  yield [[
    <Rectangle key="child" style={{ width: 10, height: 10 }} />,
  ], false];
}

export const layoutElements: readonly CRCElement[] = [
  <Absolute style={{ width: 100, height: 50 }}>{layoutChildren()}</Absolute>,
  <Overlay style={{ width: 100, height: 50 }}>{layoutChildren()}</Overlay>,
  <Flow style={{ width: 100, height: 50 }}>{layoutChildren()}</Flow>,
  <Flex style={{ width: 100, height: 50 }}>{layoutChildren()}</Flex>,
  <Grid
    style={{
      width: 100,
      height: 50,
      gridTemplateColumns: [100],
      gridTemplateRows: [50],
    }}
  >
    {layoutChildren()}
  </Grid>,
];
