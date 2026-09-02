import type {
  CRCElement,
  CRCElementType,
  CRCKey,
  CRCPrimitiveComponent,
  PrimitiveInputOf,
} from './lib/element/types.js';

export { Fragment, jsx, jsxs } from './lib/element/jsx-runtime.js';

export namespace JSX {
  export type Element = CRCElement;
  export type ElementType = CRCElementType;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    key?: CRCKey;
  }
  export interface IntrinsicElements {}
  export type LibraryManagedAttributes<C, P> =
    C extends CRCPrimitiveComponent<any, any>
      ? PrimitiveInputOf<C>
      : 'key' extends keyof P
        ? never
        : P;
}
