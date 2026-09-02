import type {
  CRCKey,
  CRCNode,
  CRCPrimitiveComponent,
  CRCTextChild,
} from '@crc/core';
import {
  FocusManagement,
  KeyboardNavigation,
  Rectangle,
} from '@crc/core';

function Label(props: { value: string; children?: CRCTextChild }): CRCNode {
  void props;
  return undefined;
}

function NoReturn(_props: { enabled?: boolean }): void {}

async function AsyncScene(): Promise<CRCNode> {
  return undefined;
}

function ReservedKey(_props: { key?: CRCKey }): void {}

type PrimitiveInput = {
  value: string;
  style?: { x?: number };
};

declare const Primitive: CRCPrimitiveComponent<
  Record<string, never>,
  PrimitiveInput
>;

export const valid = (
  <>
    <Label key={1} value="ready">
      CRC
    </Label>
    <NoReturn enabled />
    <Primitive value="ready" style={{ x: 1 }} />
    <FocusManagement>
      <KeyboardNavigation mode="directional">
        <Rectangle style={{ width: 1, height: 1 }} />
      </KeyboardNavigation>
    </FocusManagement>
  </>
);

// @ts-expect-error required value is missing
export const missing = <Label />;
// @ts-expect-error CRC defines no lowercase intrinsic tags
export const intrinsic = <rect />;
// @ts-expect-error async components are not CRC element types
export const asyncValue = <AsyncScene />;
// @ts-expect-error Promise values are not CRC text children
export const promiseChild = <Label value="loading">{Promise.resolve('CRC')}</Label>;
// @ts-expect-error component props may not reserve the compiler-owned key field
export const reservedKey = <ReservedKey />;
// @ts-expect-error primitive managed input still requires value
export const missingPrimitiveValue = <Primitive />;
// @ts-expect-error focus policy requires a child
export const missingFocusChild = <FocusManagement />;
// @ts-expect-error keyboard policy requires directional mode
export const missingKeyboardMode = <KeyboardNavigation>
    <Rectangle style={{ width: 1, height: 1 }} />
</KeyboardNavigation>;
// @ts-expect-error keyboard policy accepts only directional mode
export const invalidKeyboardMode = <KeyboardNavigation mode="linear">
    <Rectangle style={{ width: 1, height: 1 }} />
</KeyboardNavigation>;
// @ts-expect-error policy text must be wrapped in Text and is not a CRC node
export const invalidPolicyText = <FocusManagement>raw text</FocusManagement>;
