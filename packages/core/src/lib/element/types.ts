declare const crcElementTypeBrand: unique symbol;

export type CRCKey = string | number;
export type CRCEmptyNode = false | true | null | undefined | '' | 0;
export type CRCContainerChild = CRCNode;
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

export type CRCRenderResult = CRCNode | void;
export type CRCComponent<P = Record<string, never>> = (
  props: P,
) => CRCRenderResult;
export type CRCElementType<P = any> = CRCComponent<P>;
