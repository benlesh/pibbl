import {
  CompEl,
  CompFn,
  SystemStyle,
} from './types.js';

export const EMPTY_STYLE: Readonly<SystemStyle> = Object.freeze({});

/**
 * Creates a simple structure representing a component to be rendered.
 * DOES NOT RENDER.
 * @param comp The render function for a component
 * @param props The props to pass to that render function on render
 * @returns A structure that represents a component to be mounted or updated during render
 */

export function createElement<P, S extends SystemStyle>(
  comp: CompFn<P, S>,
  props: CompEl<P, S>['props'],
  style: CompEl<P, S>['style'] = EMPTY_STYLE as CompEl<P, S>['style'],
  key?: string,
): CompEl<P, S> {
  return { type: comp, props, style, key };
}
