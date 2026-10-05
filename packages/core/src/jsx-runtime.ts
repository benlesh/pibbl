import type {
  CRCElement,
  CRCElementType,
  CRCKey,
  CRCPrimitiveComponent,
  PrimitiveInputOf,
} from './lib/element/types.js';

export { Fragment, jsx, jsxs } from './lib/element/jsx-runtime.js';

/**
 * Compiler-facing CRC JSX types; authored elements use the branded CRC element protocol.
 *
 * @see {@link CRCElement}
 * @see {@link CRCElementType}
 * @see {@link CRCKey}
 * @see {@link CRCPrimitiveComponent}
 * @see {@link PrimitiveInputOf}
 */
export namespace JSX {
  /** The branded element value recognized as valid CRC JSX output. See {@link JSX}. */
  export type Element = CRCElement;
  /** The synchronous component types accepted in CRC JSX. See {@link JSX}. */
  export type ElementType = CRCElementType;
  /** Identifies children as the JSX child-content prop. See {@link JSX}. */
  export interface ElementChildrenAttribute {
    /** Descendant content or the callback that supplies it. See {@link JSX}. */
    children: unknown;
  }
  /** Compiler-owned JSX attributes, including stable element keys. See {@link JSX}. */
  export interface IntrinsicAttributes {
    /** Stable identity used by the containing protocol. See {@link CRCKey}. */
    key?: CRCKey;
  }
  /** CRC has no lowercase intrinsic JSX vocabulary. See {@link JSX}. */
  export interface IntrinsicElements {}
  /**
   * Maps branded primitive components to their authored inputs and rejects reserved key props. See
   * {@link JSX}.
   */
  export type LibraryManagedAttributes<C, P> =
    C extends CRCPrimitiveComponent<any, any>
      ? PrimitiveInputOf<C>
      : 'key' extends keyof P
        ? never
        : P;
}
