import type {
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
