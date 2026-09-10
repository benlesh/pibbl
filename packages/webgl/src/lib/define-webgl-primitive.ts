import {
  defineBackendPrimitive,
  useBackendEventTarget,
} from '@crc/core/internal';
import type {
  CRCEventHandlers,
  CRCNode,
  CRCPrimitiveComponent,
  SystemStyle,
} from '@crc/core';
import { WEBGL_BACKEND_TOKEN } from './backend.js';
import { crcWebGLContext } from './hooks/crc-webgl-context.js';
import { registerWebGLPrimitiveHitMetadata } from './primitive-metadata.js';
import {
  beginWebGLPrimitivePick,
  finishWebGLPrimitivePick,
  recordWebGLPrimitivePick,
} from './render-environment.js';
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
  const H extends { readonly kind: 'none' } = { readonly kind: 'none' },
>(
  render: CRCWebGLPrimitiveRender<P, R>,
  capabilities: CRCWebGLPrimitiveCapabilities<P, S, N, R> & {
    hit: H;
  },
): CRCPrimitiveComponent<
  CRCWebGLProgramProps<P, H>,
  CRCWebGLPrimitiveInput<P, S, H>
>;
export function defineWebGLPrimitive<
  P,
  S extends SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
  const H extends Exclude<
    CRCWebGLHitCapability<P, R>,
    { readonly kind: 'none' }
  > = Exclude<
    CRCWebGLHitCapability<P, R>,
    { readonly kind: 'none' }
  >,
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
  const hit = snapshotHitCapability(capabilities.hit);
  const componentName = primitiveComponentName(render.name);
  const program = (
    props: Readonly<CRCWebGLProgramProps<P, H>>,
    style: Readonly<R>,
  ) => {
    const propsRecord = props as Readonly<Record<PropertyKey, unknown>>;
    const styleRecord = style as Readonly<Record<PropertyKey, unknown>>;
    const target = hit.kind === 'none' ? undefined : useBackendEventTarget(
      propsRecord as CRCEventHandlers,
      {
        cursor: resolveCursor(propsRecord, styleRecord),
        keyboardFocusable: propsRecord.keyboardFocusable as
          boolean | undefined,
        keyboardNavigationBounds: propsRecord.keyboardNavigationBounds as
          NonNullable<Parameters<typeof useBackendEventTarget>[1]>[
            'keyboardNavigationBounds'
          ],
      },
      propsRecord.pointerEvents === 'none' ? 'none' : 'auto',
    );
    const context = crcWebGLContext();
    if (hit.kind === 'none') {
      return render(props as Readonly<P>, style, context);
    }
    beginWebGLPrimitivePick(context);
    try {
      const result = render(props as Readonly<P>, style, context);
      if (target) {
        recordWebGLPrimitivePick(context, {
          componentName,
          target,
          hit: hit as Exclude<
            CRCWebGLHitCapability<
              unknown,
              Readonly<Record<PropertyKey, unknown>>
            >,
            { readonly kind: 'none' }
          >,
          props: propsRecord,
          style: styleRecord,
        });
      }
      return result;
    } finally {
      finishWebGLPrimitivePick(context);
    }
  };
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
  const component = define(WEBGL_BACKEND_TOKEN, program, {
    normalizeStyle: capabilities.normalizeStyle,
    resolveStyle: capabilities.resolveStyle,
  });
  registerWebGLPrimitiveHitMetadata(program, hit);
  return component;
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

function snapshotHitCapability<P, S, H extends CRCWebGLHitCapability<P, S>>(
  hit: H,
): H {
  switch (hit.kind) {
    case 'geometry':
      return Object.freeze({
        kind: 'geometry',
        geometry: hit.geometry,
      }) as H;
    case 'custom':
      return Object.freeze({
        kind: 'custom',
        resolve: hit.resolve,
      }) as H;
    case 'none':
      return Object.freeze({ kind: 'none' }) as H;
  }
}

function primitiveComponentName(renderName: string): string {
  if (/^render[A-Z]/.test(renderName)) return renderName.slice('render'.length);
  return renderName || 'Anonymous';
}

function resolveCursor(
  props: Readonly<Record<PropertyKey, unknown>>,
  style: Readonly<Record<PropertyKey, unknown>>,
): string | undefined {
  const cursor = style.cursor ?? props.cursor;
  return typeof cursor === 'string' ? cursor : undefined;
}
