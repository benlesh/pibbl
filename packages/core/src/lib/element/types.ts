import type { defineRenderLayer } from '../render-layer/define-render-layer.js';
import type { measureElement } from '../layout/measure.js';
import type { createElement } from './create-element.js';
import type { definePrimitive } from '../define-primitive.js';
import type { TextProps } from '../components/text.js';
import type { SignalValue } from '../signals/types.js';

declare const crcElementTypeBrand: unique symbol;
declare const crcPrimitiveComponentBrand: unique symbol;

/**
 * A stable sibling identity used when reconciling keyed elements.
 *
 * @see {@link createElement}
 * @see {@link CRCElement}
 */
export type CRCKey = string | number;
/**
 * A child value that intentionally contributes no rendered output.
 *
 * @see {@link CRCNode}
 */
export type CRCEmptyNode = false | true | null | undefined | '' | 0;
/**
 * A textual child accepted by the Text primitive.
 *
 * @see {@link CRCTextInput}
 */
export type CRCTextChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly CRCTextChild[]
  | Iterable<CRCTextChild>;

/**
 * A branded element descriptor containing component identity, props, and an optional reconciliation
 * key.
 *
 * @see {@link CRCElementType}
 * @see {@link CRCNode}
 * @see {@link measureElement}
 * @see {@link createElement}
 */
export interface CRCElement<P = unknown> {
  readonly [crcElementTypeBrand]: true;
  /** Component identity evaluated when this element is rendered. See {@link CRCElementType}. */
  readonly type: CRCElementType<P>;
  /** Component props supplied to evaluation or measurement. See {@link CRCElement}. */
  readonly props: Readonly<P>;
  /** Stable identity used by the containing protocol. See {@link CRCElement}. */
  readonly key?: string;
}

/**
 * Recursive synchronous render output, including elements and empty child values.
 *
 * @see {@link CRCElement}
 * @see {@link CRCEmptyNode}
 * @see {@link CRCNodeInput}
 */
export type CRCNode =
  | CRCElement<any>
  | CRCEmptyNode
  | readonly CRCNode[]
  | Iterable<CRCNode>;

/**
 * An authored node input that may be supplied by a signal.
 *
 * @see {@link SignalValue}
 * @see {@link CRCNode}
 * @see {@link CRCContainerChild}
 * @see {@link CRCRenderResult}
 */
export type CRCNodeInput =
  | SignalValue<CRCNode>
  | readonly CRCNodeInput[]
  | Iterable<CRCNodeInput>;
/**
 * Literal or signal-supplied text content for the Text primitive.
 *
 * @see {@link SignalValue}
 * @see {@link CRCTextChild}
 * @see {@link TextProps}
 */
export type CRCTextInput =
  | SignalValue<CRCTextChild>
  | readonly CRCTextInput[]
  | Iterable<CRCTextInput>;
/**
 * A recursive child value accepted by a CRC container.
 *
 * @see {@link CRCNodeInput}
 */
export type CRCContainerChild = CRCNodeInput;
/**
 * The supported synchronous return value of a CRC component.
 *
 * @see {@link CRCNodeInput}
 * @see {@link CRCComponent}
 */
export type CRCRenderResult = CRCNodeInput | void;
/**
 * A synchronous function that receives props and returns CRC nodes.
 *
 * @param props - Authored component properties supplied by CRC.
 * @returns Synchronous CRC render output. See {@link CRCRenderResult}.
 *
 * @see {@link CRCRenderResult}
 * @see {@link CRCElementType}
 * @see {@link CRCPrimitiveComponent}
 * @see {@link defineRenderLayer}
 */
export type CRCComponent<P = Record<string, never>> = (
  props: P,
) => CRCRenderResult;
/**
 * A branded primitive component with separate authored-input and resolved-prop types.
 *
 * @see {@link CRCComponent}
 * @see {@link PrimitiveInputOf}
 * @see {@link definePrimitive}
 */
export type CRCPrimitiveComponent<
  P = Record<string, never>,
  I = P,
> = CRCComponent<I> & {
  readonly [crcPrimitiveComponentBrand]: {
    readonly input: I;
    readonly programProps: P;
  };
};
/**
 * Extracts the authored-input type from a branded primitive component.
 *
 * @see {@link CRCPrimitiveComponent}
 */
export type PrimitiveInputOf<C> =
  C extends CRCPrimitiveComponent<any, infer I> ? I : never;
/**
 * A component or fragment identity that can be used to construct a CRC element.
 *
 * @see {@link CRCComponent}
 * @see {@link CRCElement}
 * @see {@link createElement}
 */
export type CRCElementType<P = any> = CRCComponent<P>;
