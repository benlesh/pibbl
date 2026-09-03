import type {
  CRCController,
  CRCElement,
  CRCNode,
  CRCTextChild,
} from '@crc/core';
import {
  Absolute,
  Flex,
  Flow,
  Grid,
  Overlay,
  Rectangle,
  Text,
  crc,
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
