import type { defineRenderLayer } from '../render-layer/define-render-layer.js';
import type { measureElement } from '../layout/measure.js';
import type { createElement } from './create-element.js';
import type { definePrimitive } from '../define-primitive.js';
import type { TextProps } from '../components/text.js';
import type { SignalValue } from '../signals/types.js';

declare const pibblElementTypeBrand: unique symbol;
declare const pibblPrimitiveComponentBrand: unique symbol;

/**
 * A stable sibling identity used when reconciling keyed elements.
 *
 * @see {@link createElement}
 * @see {@link PibblElement}
 */
export type PibblKey = string | number;
/**
 * A child value that intentionally contributes no rendered output.
 *
 * @see {@link PibblNode}
 */
export type PibblEmptyNode = false | true | null | undefined | '' | 0;
/**
 * A textual child accepted by the Text primitive.
 *
 * @see {@link PibblTextInput}
 */
export type PibblTextChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly PibblTextChild[]
  | Iterable<PibblTextChild>;

/**
 * A branded element descriptor containing component identity, props, and an optional reconciliation
 * key.
 *
 * @see {@link PibblElementType}
 * @see {@link PibblNode}
 * @see {@link measureElement}
 * @see {@link createElement}
 */
export interface PibblElement<P = unknown> {
  readonly [pibblElementTypeBrand]: true;
  /** Component identity evaluated when this element is rendered. See {@link PibblElementType}. */
  readonly type: PibblElementType<P>;
  /** Component props supplied to evaluation or measurement. See {@link PibblElement}. */
  readonly props: Readonly<P>;
  /** Stable identity used by the containing protocol. See {@link PibblElement}. */
  readonly key?: string;
}

/**
 * Recursive synchronous render output, including elements and empty child values.
 *
 * @see {@link PibblElement}
 * @see {@link PibblEmptyNode}
 * @see {@link PibblNodeInput}
 */
export type PibblNode =
  | PibblElement<any>
  | PibblEmptyNode
  | readonly PibblNode[]
  | Iterable<PibblNode>;

/**
 * An authored node input that may be supplied by a signal.
 *
 * @see {@link SignalValue}
 * @see {@link PibblNode}
 * @see {@link PibblContainerChild}
 * @see {@link PibblRenderResult}
 */
export type PibblNodeInput =
  | SignalValue<PibblNode>
  | readonly PibblNodeInput[]
  | Iterable<PibblNodeInput>;
/**
 * Literal or signal-supplied text content for the Text primitive.
 *
 * @see {@link SignalValue}
 * @see {@link PibblTextChild}
 * @see {@link TextProps}
 */
export type PibblTextInput =
  | SignalValue<PibblTextChild>
  | readonly PibblTextInput[]
  | Iterable<PibblTextInput>;
/**
 * A recursive child value accepted by a Pibbl container.
 *
 * @see {@link PibblNodeInput}
 */
export type PibblContainerChild = PibblNodeInput;
/**
 * The supported synchronous return value of a Pibbl component.
 *
 * @see {@link PibblNodeInput}
 * @see {@link PibblComponent}
 */
export type PibblRenderResult = PibblNodeInput | void;
/**
 * A synchronous function that receives props and returns Pibbl nodes.
 *
 * @param props - Authored component properties supplied by Pibbl.
 * @returns Synchronous Pibbl render output. See {@link PibblRenderResult}.
 *
 * @see {@link PibblRenderResult}
 * @see {@link PibblElementType}
 * @see {@link PibblPrimitiveComponent}
 * @see {@link defineRenderLayer}
 */
export type PibblComponent<P = Record<string, never>> = (
  props: P,
) => PibblRenderResult;
/**
 * A branded primitive component with separate authored-input and resolved-prop types.
 *
 * @see {@link PibblComponent}
 * @see {@link PrimitiveInputOf}
 * @see {@link definePrimitive}
 */
export type PibblPrimitiveComponent<
  P = Record<string, never>,
  I = P,
> = PibblComponent<I> & {
  readonly [pibblPrimitiveComponentBrand]: {
    readonly input: I;
    readonly programProps: P;
  };
};
/**
 * Extracts the authored-input type from a branded primitive component.
 *
 * @see {@link PibblPrimitiveComponent}
 */
export type PrimitiveInputOf<C> =
  C extends PibblPrimitiveComponent<any, infer I> ? I : never;
/**
 * A component or fragment identity that can be used to construct a Pibbl element.
 *
 * @see {@link PibblComponent}
 * @see {@link PibblElement}
 * @see {@link createElement}
 */
export type PibblElementType<P = any> = PibblComponent<P>;
