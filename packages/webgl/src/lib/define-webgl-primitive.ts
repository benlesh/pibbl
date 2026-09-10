import { defineBackendPrimitive } from '@crc/core/internal';
import type {
  CRCNode,
  CRCPrimitiveComponent,
  SystemStyle,
} from '@crc/core';
import { WEBGL_BACKEND_TOKEN } from './backend.js';
import { crcWebGLContext } from './hooks/crc-webgl-context.js';
import type {
  CRCWebGLHitCapability,
  CRCWebGLPrimitiveCapabilities,
  CRCWebGLPrimitiveInput,
  CRCWebGLPrimitiveRender,
  CRCWebGLProgramProps,
} from './types.js';

/** Defines one primitive that can render only inside a WebGLLayer backend. */
export function defineWebGLPrimitive<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
>(
  render: CRCWebGLPrimitiveRender<P, R>,
  capabilities: CRCWebGLPrimitiveCapabilities<P, S, N, R> & {
    hit: { readonly kind: 'none' };
  },
): CRCPrimitiveComponent<
  CRCWebGLProgramProps<P, { readonly kind: 'none' }>,
  CRCWebGLPrimitiveInput<P, S, { readonly kind: 'none' }>
>;
export function defineWebGLPrimitive<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  const H extends CRCWebGLHitCapability<P, R> = CRCWebGLHitCapability<P, R>,
>(
  render: CRCWebGLPrimitiveRender<P, R>,
  capabilities: CRCWebGLPrimitiveCapabilities<P, S, N, R> & { hit: H },
): CRCPrimitiveComponent<
  CRCWebGLProgramProps<P, H>,
  CRCWebGLPrimitiveInput<P, S, H>
>;
export function defineWebGLPrimitive<
  P,
  S extends SystemStyle,
  N extends SystemStyle,
  R extends SystemStyle,
  H extends CRCWebGLHitCapability<P, R>,
>(
  render: CRCWebGLPrimitiveRender<P, R>,
  capabilities: CRCWebGLPrimitiveCapabilities<P, S, N, R> & { hit: H },
): CRCPrimitiveComponent<
  CRCWebGLProgramProps<P, H>,
  CRCWebGLPrimitiveInput<P, S, H>
> {
  assertHitCapability(render.name || 'Anonymous', capabilities?.hit);
  const program = (
    props: Readonly<CRCWebGLProgramProps<P, H>>,
    style: Readonly<R>,
  ) => render(props as Readonly<P>, style, crcWebGLContext());
  Object.defineProperty(program, 'name', {
    configurable: true,
    value: render.name,
  });
  type RegisteredProgram = (
    props: Readonly<CRCWebGLProgramProps<P, H>>,
    style: Readonly<R>,
  ) => CRCNode | void;
  const define = defineBackendPrimitive as unknown as (
    backend: typeof WEBGL_BACKEND_TOKEN,
    program: RegisteredProgram,
    capabilities: {
      readonly normalizeStyle?: CRCWebGLPrimitiveCapabilities<
        P,
        S,
        N,
        R
      >['normalizeStyle'];
      readonly resolveStyle?: CRCWebGLPrimitiveCapabilities<
        P,
        S,
        N,
        R
      >['resolveStyle'];
    },
  ) => CRCPrimitiveComponent<
    CRCWebGLProgramProps<P, H>,
    CRCWebGLPrimitiveInput<P, S, H>
  >;
  return define(WEBGL_BACKEND_TOKEN, program, {
    normalizeStyle: capabilities.normalizeStyle,
    resolveStyle: capabilities.resolveStyle,
  });
}

function assertHitCapability(
  component: string,
  hit: unknown,
): asserts hit is CRCWebGLHitCapability<unknown, SystemStyle> {
  const prefix = `${component} must declare a WebGL hit capability`;
  if (!hit || typeof hit !== 'object' || !('kind' in hit)) {
    throw new TypeError(`${prefix}: geometry, custom, or none.`);
  }
  const candidate = hit as {
    readonly kind?: unknown;
    readonly geometry?: unknown;
    readonly resolve?: unknown;
  };
  if (candidate.kind === 'geometry') {
    if (typeof candidate.geometry !== 'function') {
      throw new TypeError(
        `${component} geometry hit capability requires a geometry function.`,
      );
    }
    return;
  }
  if (candidate.kind === 'custom') {
    if (typeof candidate.resolve !== 'function') {
      throw new TypeError(
        `${component} custom hit capability requires a resolve function.`,
      );
    }
    return;
  }
  if (candidate.kind === 'none') return;
  throw new TypeError(`${prefix}: geometry, custom, or none.`);
}
