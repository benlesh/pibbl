import { createElement, EMPTY_STYLE } from './create-element.js';
import {
  CompEl,
  CompFn,
  ComponentCapabilities,
  ComponentInput,
  SystemStyle,
} from './types.js';

type AllocationValue = `${number}%` | 'auto';
type DeclaredStyleValue<S> = S extends unknown
  ? S[Exclude<keyof S, 'custom'>]
  : never;
type RequiresResolver<S> = [
  Extract<DeclaredStyleValue<S>, AllocationValue>,
] extends [never] ? false : true;
type CapabilityArguments<
  P,
  S extends SystemStyle,
  N extends SystemStyle,
  R extends SystemStyle,
> = RequiresResolver<R> extends true ? [capabilities: never] :
  RequiresResolver<S> extends true ? [
    capabilities: Readonly<ComponentCapabilities<S, N, R, P>> & {
      resolveStyle: NonNullable<ComponentCapabilities<S, N, R, P>['resolveStyle']>;
    },
  ] : [capabilities?: Readonly<ComponentCapabilities<S, N, R, P>>];

/**
 * Used to convert a component render function to a function that will return a component element.
 * This is useful for now because setting up JSX is still annoying.
 * @param compFn A component to create a simplfied function for
 */

export function defineComp<
  P,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(
  compFn: CompFn<P, S, N, R> & (
    ComponentInput<P, S> extends never ? never : unknown
  ),
  ...capabilityArguments: CapabilityArguments<P, S, N, R>
): (input: ComponentInput<P, S>) => CompEl<P, S, N, R> {
  const capabilities = capabilityArguments[0] ?? {};
  if (capabilities.normalizeStyle) {
    Object.defineProperty(compFn, 'normalizeStyle', {
      configurable: false,
      enumerable: false,
      value: capabilities.normalizeStyle,
      writable: false,
    });
  }
  if (capabilities.resolveStyle) {
    Object.defineProperty(compFn, 'resolveStyle', {
      configurable: false,
      enumerable: false,
      value: capabilities.resolveStyle,
      writable: false,
    });
  }
  if (capabilities.measure) {
    Object.defineProperty(compFn, 'measure', {
      configurable: false,
      enumerable: false,
      value: capabilities.measure,
      writable: false,
    });
  }

  return (input) => {
    const hasKey = Object.prototype.hasOwnProperty.call(input, 'key');
    const hasStyle = Object.prototype.hasOwnProperty.call(input, 'style');
    if (!hasKey && !hasStyle) {
      return createElement(
        compFn,
        input as CompEl<P, S, N, R>['props'],
        EMPTY_STYLE as CompEl<P, S, N, R>['style'],
      );
    }

    const { key, style, ...props } = input as ComponentInput<P, S> & {
      style?: CompEl<P, S, N, R>['style'];
    };
    return createElement(
      compFn,
      props as CompEl<P, S, N, R>['props'],
      style ?? (EMPTY_STYLE as CompEl<P, S, N, R>['style']),
      key,
    );
  };
}
