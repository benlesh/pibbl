import {
  derivePrimitiveMetadata,
  getPrimitiveDefinition,
  setPrimitiveDefinition,
} from './element/metadata.js';
import {
  CANVAS_2D_BACKEND,
} from './backend/canvas-2d-backend.js';
import type {
  PibblBackendPrimitiveProgram,
  PibblBackendToken,
} from './backend/types.js';
import type {
  PibblPrimitiveComponent,
  PreservedSignalPropKey,
  PrimitiveCapabilities,
  PrimitiveInput,
  PrimitiveProgramProps,
  PrimitiveRender,
  RenderingContext2D,
  SystemStyle,
} from './types.js';
import { GLOBAL_STATE } from './global-state.js';
import { withSignalWriteForbidden } from './signals/graph.js';

type DeclaresWhen<S> = S extends unknown ? 'when' extends keyof S ? true : false : never;
type PrimitiveStyleGuard<S, N, R> = true extends DeclaresWhen<S> | DeclaresWhen<N> | DeclaresWhen<R> ? {
  readonly 'Pibbl: style.when is framework-owned; remove when from the primitive style type': never;
} : unknown;

type AllocationValue = `${number}%` | 'auto';
type DeclaredStyleValue<S> = S extends unknown
  ? S[Exclude<keyof S, 'custom'>]
  : never;
type RequiresResolver<S> = [
  Extract<DeclaredStyleValue<S>, AllocationValue>,
] extends [never] ? false : true;
type PrimitiveCapabilitiesInput<
  P,
  S extends SystemStyle,
  N extends SystemStyle,
  R extends SystemStyle,
> = Readonly<PrimitiveCapabilities<P, S, N, R>> & PrimitiveStyleGuard<S, N, R> & (
  [PreservedSignalPropKey<P>] extends [never] ? object : {
    readonly preserveSignalProps: readonly [
      PreservedSignalPropKey<P>,
      ...PreservedSignalPropKey<P>[],
    ];
  }
);
type CapabilityArguments<
  P,
  S extends SystemStyle,
  N extends SystemStyle,
  R extends SystemStyle,
> = RequiresResolver<R> extends true ? [capabilities: never] :
  RequiresResolver<S> extends true ? [
    capabilities: PrimitiveCapabilitiesInput<P, S, N, R> & {
      resolveStyle: NonNullable<
        PrimitiveCapabilities<P, S, N, R>['resolveStyle']
      >;
    },
  ] : [PreservedSignalPropKey<P>] extends [never] ? [
    capabilities?: PrimitiveCapabilitiesInput<P, S, N, R>,
  ] : [capabilities: PrimitiveCapabilitiesInput<P, S, N, R>];

/**
 * Defines a platform component with private style and measurement behavior.
 *
 * @param render - Synchronous primitive renderer receiving props, resolved style, and Canvas
 * context. See {@link PrimitiveRender} , {@link PrimitiveStyleGuard} , {@link PrimitiveInput} .
 * @param capabilityArguments - Style normalization, resolution, and measurement capabilities
 * required by the primitive. See {@link CapabilityArguments} .
 * @returns A primitive component usable with JSX or createElement. See
 * {@link PibblPrimitiveComponent} , {@link PrimitiveProgramProps} , {@link PrimitiveInput} .
 *
 * @see {@link PrimitiveRender}
 * @see {@link PrimitiveInput}
 * @see {@link PibblPrimitiveComponent}
 * @see {@link PrimitiveProgramProps}
 * @see {@link SystemStyle}
 */
export function definePrimitive<
  P = Record<string, never>,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(
  render: PrimitiveRender<P, R> & PrimitiveStyleGuard<S, N, R> & (
    PrimitiveInput<P, S> extends never ? never : unknown
  ),
  ...capabilityArguments: CapabilityArguments<P, S, N, R>
): PibblPrimitiveComponent<PrimitiveProgramProps<P>, PrimitiveInput<P, S>> {
  return defineBackendPrimitive<P, S, N, R, RenderingContext2D>(
    CANVAS_2D_BACKEND.token,
    render,
    ...capabilityArguments,
  );
}

/**
 * Defines a primitive owned by one official Pibbl rendering backend.
 *
 * @param backend - Identity of the backend that can execute this primitive. See
 * {@link PibblBackendToken} .
 * @param program - Synchronous program using the active backend environment. See
 * {@link PibblBackendPrimitiveProgram} , {@link PrimitiveStyleGuard} , {@link PrimitiveInput} .
 * @param capabilityArguments - Style and measurement capabilities for the primitive. See
 * {@link CapabilityArguments} .
 * @returns A primitive component bound to the specified backend. See {@link PibblPrimitiveComponent}
 * , {@link PrimitiveProgramProps} , {@link PrimitiveInput} .
 *
 * @see {@link PibblBackendToken}
 * @see {@link PibblBackendPrimitiveProgram}
 * @see {@link PrimitiveInput}
 * @see {@link PibblPrimitiveComponent}
 * @see {@link PrimitiveProgramProps}
 * @see {@link SystemStyle}
 */
export function defineBackendPrimitive<
  P = Record<string, never>,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  E = unknown,
>(
  backend: PibblBackendToken,
  program: PibblBackendPrimitiveProgram<P, R, E> & PrimitiveStyleGuard<S, N, R> & (
    PrimitiveInput<P, S> extends never ? never : unknown
  ),
  ...capabilityArguments: CapabilityArguments<P, S, N, R>
): PibblPrimitiveComponent<PrimitiveProgramProps<P>, PrimitiveInput<P, S>> {
  const componentName = primitiveComponentName(program.name);
  const component = function PibblPrimitiveComponent(): never {
    throw new Error(
      `${componentName} is a Pibbl component and was invoked outside the Pibbl ` +
      'renderer.\n' +
      `Use <${componentName} ... /> in a Pibbl JSX file or ` +
      `createElement(${componentName}, props).`,
    );
  } as unknown as PibblPrimitiveComponent<
    PrimitiveProgramProps<P>,
    PrimitiveInput<P, S>
  >;
  Object.defineProperty(component, 'name', {
    configurable: true,
    value: componentName,
  });

  const capabilities = (capabilityArguments[0] ?? {}) as Readonly<
    PrimitiveCapabilities<P, S, N, R>
  >;
  setPrimitiveDefinition(component, {
    backend,
    program,
    preserveSignalProps: capabilities.preserveSignalProps,
    childInput: capabilities.childInput,
    normalizeStyle: capabilities.normalizeStyle,
    resolveStyle: capabilities.resolveStyle,
    measure: capabilities.measure,
  });
  return component;
}

/**
 * Derives a new official-package primitive identity with the source behavior.
 *
 * @param source - Primitive whose rendering and capabilities are reused.
 * @returns A derived primitive with its own component identity.
 *
 * @see {@link PibblPrimitiveComponent}
 */
export function derivePrimitive<T extends PibblPrimitiveComponent<any, any>>(
  source: T,
): T {
  if (!getPrimitiveDefinition(source)) {
    throw new TypeError('Can only derive a Pibbl primitive component.');
  }
  const componentName = source.name || 'Anonymous';
  const derived = function PibblPrimitiveComponent(): never {
    throw new Error(
      `${componentName} is a Pibbl component and was invoked outside the Pibbl ` +
      'renderer.\n' +
      `Use <${componentName} ... /> in a Pibbl JSX file or ` +
      `createElement(${componentName}, props).`,
    );
  } as unknown as T;
  Object.defineProperty(derived, 'name', {
    configurable: true,
    value: componentName,
  });
  derivePrimitiveMetadata(source, derived);
  return derived;
}

/**
 * Runs one official-package primitive resolver without render side-effect authority.
 *
 * @param callback - Synchronous resolver to evaluate with hooks and signal writes forbidden.
 * @returns The resolver's return value.
 *
 * @see {@link PrimitiveCapabilities}
 */
export function pibblInternalRunPurePrimitiveResolver<T>(callback: () => T): T {
  const previousComponentRefs = GLOBAL_STATE.componentRefs;
  const previousComponentHookIndex = GLOBAL_STATE.componentHookIndex;
  const previousComponentIsMounting = GLOBAL_STATE.componentIsMounting;
  GLOBAL_STATE.componentRefs = undefined;
  GLOBAL_STATE.componentHookIndex = 0;
  GLOBAL_STATE.componentIsMounting = false;
  try {
    return withSignalWriteForbidden('Pibbl pure primitive resolver', callback);
  } finally {
    GLOBAL_STATE.componentRefs = previousComponentRefs;
    GLOBAL_STATE.componentHookIndex = previousComponentHookIndex;
    GLOBAL_STATE.componentIsMounting = previousComponentIsMounting;
  }
}

function primitiveComponentName(renderName: string): string {
  if (/^render[A-Z]/.test(renderName)) return renderName.slice('render'.length);
  return renderName || 'Anonymous';
}
