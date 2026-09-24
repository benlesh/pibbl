import type { SignalValue } from '../signals/types.js';

declare const crcElementTypeBrand: unique symbol;
declare const crcPrimitiveComponentBrand: unique symbol;

export type CRCKey = string | number;
export type CRCEmptyNode = false | true | null | undefined | '' | 0;
export type CRCTextChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly CRCTextChild[]
  | Iterable<CRCTextChild>;

export interface CRCElement<P = unknown> {
  readonly [crcElementTypeBrand]: true;
  readonly type: CRCElementType<P>;
  readonly props: Readonly<P>;
  readonly key?: string;
}

export type CRCNode =
  | CRCElement<any>
  | CRCEmptyNode
  | readonly CRCNode[]
  | Iterable<CRCNode>;

export type CRCNodeInput =
  | SignalValue<CRCNode>
  | readonly CRCNodeInput[]
  | Iterable<CRCNodeInput>;
export type CRCTextInput =
  | SignalValue<CRCTextChild>
  | readonly CRCTextInput[]
  | Iterable<CRCTextInput>;
export type CRCContainerChild = CRCNodeInput;
export type CRCRenderResult = CRCNodeInput | void;
export type CRCComponent<P = Record<string, never>> = (
  props: P,
) => CRCRenderResult;
export type CRCPrimitiveComponent<
  P = Record<string, never>,
  I = P,
> = CRCComponent<I> & {
  readonly [crcPrimitiveComponentBrand]: {
    readonly input: I;
    readonly programProps: P;
  };
};
export type PrimitiveInputOf<C> =
  C extends CRCPrimitiveComponent<any, infer I> ? I : never;
export type CRCElementType<P = any> = CRCComponent<P>;
