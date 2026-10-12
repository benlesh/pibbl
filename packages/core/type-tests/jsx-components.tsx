import type {
  PibblKey,
  PibblNode,
  PibblPrimitiveComponent,
  PibblTextChild,
} from '@pibbl/core';
import {
  FocusManagement,
  KeyboardNavigation,
  Rectangle,
} from '@pibbl/core';

function Label(props: { value: string; children?: PibblTextChild }): PibblNode {
  void props;
  return undefined;
}

function NoReturn(_props: { enabled?: boolean }): void {}

async function AsyncScene(): Promise<PibblNode> {
  return undefined;
}

function ReservedKey(_props: { key?: PibblKey }): void {}

type PrimitiveInput = {
  value: string;
  style?: { x?: number };
};

declare const Primitive: PibblPrimitiveComponent<
  Record<string, never>,
  PrimitiveInput
>;

export const valid = (
  <>
    <Label key={1} value="ready">
      Pibbl
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
// @ts-expect-error Pibbl defines no lowercase intrinsic tags
export const intrinsic = <rect />;
// @ts-expect-error async components are not Pibbl element types
export const asyncValue = <AsyncScene />;
// @ts-expect-error Promise values are not Pibbl text children
export const promiseChild = <Label value="loading">{Promise.resolve('Pibbl')}</Label>;
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
// @ts-expect-error policy text must be wrapped in Text and is not a Pibbl node
export const invalidPolicyText = <FocusManagement>raw text</FocusManagement>;
