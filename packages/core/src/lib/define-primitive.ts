import { setPrimitiveDefinition } from './element/metadata.js';
import {
  CANVAS_2D_BACKEND,
} from './backend/canvas-2d-backend.js';
import type {
  CRCBackendPrimitiveProgram,
  CRCBackendToken,
} from './backend/types.js';
import type {
  CRCPrimitiveComponent,
  PrimitiveCapabilities,
  PrimitiveInput,
  PrimitiveProgramProps,
  PrimitiveRender,
  RenderingContext2D,
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
    capabilities: Readonly<PrimitiveCapabilities<P, S, N, R>> & {
      resolveStyle: NonNullable<
        PrimitiveCapabilities<P, S, N, R>['resolveStyle']
      >;
    },
  ] : [capabilities?: Readonly<PrimitiveCapabilities<P, S, N, R>>];

/** Defines a platform component with private style and measurement behavior. */
export function definePrimitive<
  P = Record<string, never>,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(
  render: PrimitiveRender<P, R> & (
    PrimitiveInput<P, S> extends never ? never : unknown
  ),
  ...capabilityArguments: CapabilityArguments<P, S, N, R>
): CRCPrimitiveComponent<PrimitiveProgramProps<P>, PrimitiveInput<P, S>> {
  return defineBackendPrimitive<P, S, N, R, RenderingContext2D>(
    CANVAS_2D_BACKEND.token,
    render,
    ...capabilityArguments,
  );
}

/** Defines a primitive owned by one official CRC rendering backend. */
export function defineBackendPrimitive<
  P = Record<string, never>,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  E = unknown,
>(
  backend: CRCBackendToken,
  program: CRCBackendPrimitiveProgram<P, R, E> & (
    PrimitiveInput<P, S> extends never ? never : unknown
  ),
  ...capabilityArguments: CapabilityArguments<P, S, N, R>
): CRCPrimitiveComponent<PrimitiveProgramProps<P>, PrimitiveInput<P, S>> {
  const componentName = primitiveComponentName(program.name);
  const component = function CRCPrimitiveComponent(): never {
    throw new Error(
      `${componentName} is a CRC component and was invoked outside the CRC ` +
      'renderer.\n' +
      `Use <${componentName} ... /> in a CRC JSX file or ` +
      `createElement(${componentName}, props).`,
    );
  } as unknown as CRCPrimitiveComponent<
    PrimitiveProgramProps<P>,
    PrimitiveInput<P, S>
  >;
  Object.defineProperty(component, 'name', {
    configurable: true,
    value: componentName,
  });

  const capabilities = capabilityArguments[0] ?? {};
  setPrimitiveDefinition(component, {
    backend,
    program,
    render: program,
    normalizeStyle: capabilities.normalizeStyle,
    resolveStyle: capabilities.resolveStyle,
    measure: capabilities.measure,
  });
  return component;
}

function primitiveComponentName(renderName: string): string {
  if (/^render[A-Z]/.test(renderName)) return renderName.slice('render'.length);
  return renderName || 'Anonymous';
}
