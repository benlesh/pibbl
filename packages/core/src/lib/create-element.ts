import { CompEl, CompFn } from './types';

/**
 * Creates a simple structure representing a component to be rendered.
 * DOES NOT RENDER.
 * @param comp The render function for a component
 * @param props The props to pass to that render function on render
 * @returns A structure that represents a component to be mounted or updated during render
 */

export function createElement<P>(comp: CompFn<P>, props: P): CompEl<P> {
  return { type: comp, props };
}
