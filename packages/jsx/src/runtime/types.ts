import type {
  GProps,
  LayerProps,
  LineProps,
  PathProps,
  RectProps,
  RenderingContext2D,
  TextProps,
} from '@crc/core';
import { g, layer, line, path, rect, text } from '@crc/core';

export type IntrinsicElement = typeof rect | typeof text | typeof g | typeof path | typeof line | typeof layer;
export type IntrinsicElementProps = GProps | LayerProps | LineProps | PathProps | RectProps | TextProps;

export interface VirtualNode<P = any> {
  type: string | IntrinsicElement;
  props: P;
  children: VirtualNode[];
  effects?: (() => void)[];
  __source?: string;
  __debug?: boolean;
}

export interface RuntimeOptions {
  debug?: boolean;
  performance?: boolean;
  strict?: boolean;
}

export interface Hook {
  (type: IntrinsicElement, props: any): any;
}

// Type-safe intrinsic elements
export interface IntrinsicElements {
  rect: RectProps;
  text: TextProps;
  g: GProps;
  path: PathProps;
  line: LineProps;
  layer: LayerProps;
}

// Development utilities
export interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  childCount: number;
  depth: number;
}
