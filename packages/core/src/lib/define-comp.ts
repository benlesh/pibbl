import { createElement, EMPTY_STYLE } from './create-element.js';
import {
  CompEl,
  CompFn,
  ComponentInput,
  SystemStyle,
} from './types.js';

/**
 * Used to convert a component render function to a function that will return a component element.
 * This is useful for now because setting up JSX is still annoying.
 * @param compFn A component to create a simplfied function for
 */

export function defineComp<
  P,
  S extends SystemStyle = SystemStyle,
>(
  compFn: CompFn<P, S> & (
    ComponentInput<P, S> extends never ? never : unknown
  ),
): (input: ComponentInput<P, S>) => CompEl<P, S> {
  return (input) => {
    const hasKey = Object.prototype.hasOwnProperty.call(input, 'key');
    const hasStyle = Object.prototype.hasOwnProperty.call(input, 'style');
    if (!hasKey && !hasStyle) {
      return createElement(
        compFn,
        input as CompEl<P, S>['props'],
        EMPTY_STYLE as CompEl<P, S>['style'],
      );
    }

    const { key, style, ...props } = input as ComponentInput<P, S> & {
      style?: CompEl<P, S>['style'];
    };
    return createElement(
      compFn,
      props as CompEl<P, S>['props'],
      style ?? (EMPTY_STYLE as CompEl<P, S>['style']),
      key,
    );
  };
}
