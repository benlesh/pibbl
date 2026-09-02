declare const reactElementBrand: unique symbol;

export interface ReactElement {
  readonly [reactElementBrand]: true;
}

type ReactElementType = (props: any) => ReactElement | null;

export function jsx(
  type: ReactElementType | string,
  props: unknown,
  key?: string,
): ReactElement;
export { jsx as jsxs };
export const Fragment: ReactElementType;

export namespace JSX {
  export type Element = ReactElement;
  export type ElementType = ReactElementType | keyof IntrinsicElements;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    key?: string;
  }
  export interface IntrinsicElements {
    canvas: { height?: number; width?: number };
    div: { children?: unknown };
  }
}
