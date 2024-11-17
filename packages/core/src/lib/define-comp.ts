import { createElement } from './create-element';
import { CompFn } from './types';

/**
 * Used to convert a component render function to a function that will return a component element.
 * This is useful for now because setting up JSX is still annoying.
 * @param compFn A component to create a simplfied function for
 */

export function defineComp<P>(compFn: CompFn<P>) {
  return (props: P) => createElement(compFn, props);
}
