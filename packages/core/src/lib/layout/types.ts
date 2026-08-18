export interface Size {
  width: number;
  height: number;
}

export interface Constraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export interface LayoutBox extends Size {
  x: number;
  y: number;
}

export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
