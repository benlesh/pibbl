import type {
  PibblElement,
  PibblElementType,
  PibblKey,
  PibblPrimitiveComponent,
  PrimitiveInputOf,
} from './lib/element/types.js';

export { Fragment, jsx, jsxs } from './lib/element/jsx-runtime.js';

/**
 * Compiler-facing Pibbl JSX types; authored elements use the branded Pibbl element protocol.
 *
 * @see {@link PibblElement}
 * @see {@link PibblElementType}
 * @see {@link PibblKey}
 * @see {@link PibblPrimitiveComponent}
 * @see {@link PrimitiveInputOf}
 */
export namespace JSX {
  /** The branded element value recognized as valid Pibbl JSX output. See {@link JSX}. */
  export type Element = PibblElement;
  /** The synchronous component types accepted in Pibbl JSX. See {@link JSX}. */
  export type ElementType = PibblElementType;
  /** Identifies children as the JSX child-content prop. See {@link JSX}. */
  export interface ElementChildrenAttribute {
    /** Descendant content or the callback that supplies it. See {@link JSX}. */
    children: unknown;
  }
  /** Compiler-owned JSX attributes, including stable element keys. See {@link JSX}. */
  export interface IntrinsicAttributes {
    /** Stable identity used by the containing protocol. See {@link PibblKey}. */
    key?: PibblKey;
  }
  /** Pibbl has no lowercase intrinsic JSX vocabulary. See {@link JSX}. */
  export interface IntrinsicElements {}
  /**
   * Maps branded primitive components to their authored inputs and rejects reserved key props. See
   * {@link JSX}.
   */
  export type LibraryManagedAttributes<C, P> =
    C extends PibblPrimitiveComponent<any, any>
      ? PrimitiveInputOf<C>
      : 'key' extends keyof P
        ? never
        : P;
}
