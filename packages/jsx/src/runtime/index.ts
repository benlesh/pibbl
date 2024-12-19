import type { CompEl, CompFn } from '@crc/core';
import type { IntrinsicElement, IntrinsicElements } from './types';
import { g, layer, line, path, rect, text } from '@crc/core';

const intrinsicElements = {
  rect,
  text,
  g,
  path,
  line,
  layer,
} as const;

type ElementType<P> = keyof IntrinsicElements | CompFn<P>;

export function jsx<P>(
  type: ElementType<P>,
  props: P,
  _key?: string,
  _isStaticChildren?: boolean,
  _source?: { fileName: string; lineNumber: number; columnNumber: number },
  _self?: any,
): CompEl<P> {
  const elementFn = typeof type === 'string' ?
    intrinsicElements[type as keyof typeof intrinsicElements] as unknown as CompFn<P> :
    type;

  return {
    type: elementFn,
    props,
  };
}

export const Fragment = Symbol('Fragment');
