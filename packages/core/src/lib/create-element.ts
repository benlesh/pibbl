import {
  CompEl,
  CompFn,
  SystemStyle,
} from './types.js';
import { createCRCElement } from './element/create-element.js';
import { setLegacyProgramProps } from './element/metadata.js';

export const EMPTY_STYLE: Readonly<SystemStyle> = Object.freeze({});

/**
 * Creates a simple structure representing a component to be rendered.
 * DOES NOT RENDER.
 * @param comp The render function for a component
 * @param props The props to pass to that render function on render
 * @returns A structure that represents a component to be mounted or updated during render
 */

export function createElement<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(
  comp: CompFn<P, S, N, R>,
  props: CompEl<P, S, N, R>['props'],
  style: CompEl<P, S, N, R>['style'] = EMPTY_STYLE as CompEl<P, S, N, R>['style'],
  key?: string,
): CompEl<P, S, N, R> {
  const element = createCRCElement(
    comp as any,
    { ...props, style },
    key,
    undefined,
  );
  setLegacyProgramProps(element, props);
  return element as unknown as CompEl<P, S, N, R>;
}
