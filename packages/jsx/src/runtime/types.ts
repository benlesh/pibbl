import type {
  CompEl,
  GProps,
  LayerProps,
  LineProps,
  PathProps,
  RectProps,
  TextProps,
} from '@crc/core';
import { g, layer, line, path, rect, text } from '@crc/core';

// The actual component functions
export type IntrinsicElement = typeof rect | typeof text | typeof g | typeof path | typeof line | typeof layer;

// The props for each element type
export interface IntrinsicElements {
  rect: RectProps;
  text: TextProps;
  g: GProps;
  path: PathProps;
  line: LineProps;
  layer: LayerProps;
}

export interface RuntimeOptions {
  debug?: boolean;
  performance?: boolean;
  strict?: boolean;
}

declare global {
  namespace JSX {
    // CRC components operate via side effects
    type Element = void;
    interface ElementAttributesProperty {
      props: object;
    }
    interface ElementChildrenAttribute {
      children: object;
    }
    interface IntrinsicElements {
      rect: RectProps;
      text: TextProps;
      g: GProps;
      path: PathProps;
      line: LineProps;
      layer: LayerProps;
    }
  }
}
