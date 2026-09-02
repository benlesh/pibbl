import type {
  CRCElement,
  CRCNode,
  CRCTextChild,
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
