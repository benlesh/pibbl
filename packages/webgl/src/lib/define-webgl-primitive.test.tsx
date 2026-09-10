import {
  Rectangle,
  createElement,
  crc,
  type CRCNode,
  type PrimitiveInputOf,
  type SystemStyle,
} from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWebGLGeometry,
  defineWebGLPrimitive,
  type CRCWebGLHitCapability,
  type CRCWebGLTransformStyle,
} from '../index.js';
import { createWebGLBackend } from './backend.js';
import { resolveCamera } from './math/camera.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('defineWebGLPrimitive', () => {
  it('uses core elements for geometry, custom-hit, and decorative definitions', () => {
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const Geometry = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderGeometry() {},
      { hit: { kind: 'geometry', geometry: () => geometry } },
    );
    const Custom = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderCustom() {},
      { hit: { kind: 'custom', resolve: () => 1 } },
    );
    const Decorative = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderDecorative() {},
      { hit: { kind: 'none' } },
    );
    type ExactNone = { readonly kind: 'none' };
    const ExplicitDecorative = defineWebGLPrimitive<
      {},
      CRCWebGLTransformStyle,
      CRCWebGLTransformStyle,
      CRCWebGLTransformStyle,
      ExactNone
    >(
      function renderExplicitDecorative() {},
      { hit: { kind: 'none' } },
    );

    const elements = [
      createElement(Geometry, null),
      createElement(Custom, null),
      createElement(Decorative, { pointerEvents: 'none' }),
    ];

    expect(elements.map(element => element.type)).toEqual([
      Geometry,
      Custom,
      Decorative,
    ]);
    expect(elements.every(element =>
      (element as unknown as { $$typeof: symbol }).$$typeof ===
        Symbol.for('@crc/core.element')
    )).toBe(true);
    expect(Object.getOwnPropertySymbols(Geometry)).toEqual([]);
    expect(Object.getOwnPropertySymbols(Custom)).toEqual([]);
    expect(Object.getOwnPropertySymbols(Decorative)).toEqual([]);

    type DecorativeInput = PrimitiveInputOf<typeof Decorative>;
    type ExplicitDecorativeInput = PrimitiveInputOf<typeof ExplicitDecorative>;
    type GeometryInput = PrimitiveInputOf<typeof Geometry>;
    const widenedHit = { kind: 'none' } as CRCWebGLHitCapability<
      {},
      CRCWebGLTransformStyle
    >;
    const typeContract = () => {
      const allowed: DecorativeInput = { pointerEvents: 'none' };
      const explicitAllowed: ExplicitDecorativeInput = { pointerEvents: 'none' };
      // @ts-expect-error Decorative WebGL primitives cannot participate in hits.
      const automatic: DecorativeInput = { pointerEvents: 'auto' };
      // @ts-expect-error Decorative WebGL primitives cannot expose handlers.
      const interactive: DecorativeInput = { onClick() {} };
      const filtered: GeometryInput = {
        // @ts-expect-error Core Canvas filters belong on WebGLLayer, not children.
        style: { filter: { type: 'blur', radius: 1 } },
      };
      const Widened = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
        function renderWidened() {},
        // @ts-expect-error A widened hit union must be narrowed before definition.
        { hit: widenedHit },
      );
      // @ts-expect-error Explicit exact-none H remains decorative.
      const explicitAutomatic: ExplicitDecorativeInput = { pointerEvents: 'auto' };
      return {
        allowed,
        explicitAllowed,
        automatic,
        interactive,
        filtered,
        Widened,
        explicitAutomatic,
      };
    };
    void typeContract;
  });

  it('closes filters for custom specified styles without collapsing normalize/resolve types', () => {
    interface CustomSpecifiedStyle extends SystemStyle {
      readonly tone?: string;
    }
    interface CustomNormalizedStyle extends SystemStyle {
      readonly normalizedTone: string;
    }
    interface CustomResolvedStyle extends SystemStyle {
      readonly resolvedTone: string;
    }
    const Styled = defineWebGLPrimitive<
      { readonly label: string },
      CustomSpecifiedStyle,
      CustomNormalizedStyle,
      CustomResolvedStyle
    >(
      function renderStyled(props, style) {
        const label: string = props.label;
        const resolvedTone: string = style.resolvedTone;
        void label;
        void resolvedTone;
      },
      {
        normalizeStyle(style) {
          const tone: string | undefined = style.tone;
          return { normalizedTone: tone ?? 'default' };
        },
        resolveStyle(style) {
          const normalizedTone: string = style.normalizedTone;
          return { resolvedTone: normalizedTone };
        },
        hit: {
          kind: 'custom',
          resolve(input) {
            const resolvedTone: string = input.style.resolvedTone;
            return resolvedTone.length > 0 ? 1 : null;
          },
        },
      },
    );

    type StyledInput = PrimitiveInputOf<typeof Styled>;
    const typeContract = () => {
      const valid: StyledInput = { label: 'valid', style: { tone: 'warm' } };
      const filtered: StyledInput = {
        label: 'filtered',
        style: {
          tone: 'warm',
          // @ts-expect-error Every custom WebGL specified style closes core filters.
          filter: { type: 'blur', radius: 1 },
        },
      };
      return { valid, filtered };
    };
    void typeContract;
  });

  it('preserves every branch of a union specified style while closing filters', () => {
    type UnionStyle =
      | (SystemStyle & { readonly kind: 'a'; readonly amount: number })
      | (SystemStyle & { readonly kind: 'b'; readonly label: string });
    const UnionStyled = defineWebGLPrimitive<{}, UnionStyle, UnionStyle, UnionStyle>(
      function renderUnionStyled(_props, style) {
        if (style.kind === 'a') {
          const amount: number = style.amount;
          void amount;
        } else {
          const label: string = style.label;
          void label;
        }
      },
      {
        normalizeStyle(style) {
          return style.kind === 'a' ?
            { ...style, amount: style.amount } :
            { ...style, label: style.label };
        },
        resolveStyle(style) {
          return style.kind === 'a' ?
            { ...style, amount: style.amount } :
            { ...style, label: style.label };
        },
        hit: { kind: 'none' },
      },
    );

    type UnionInput = PrimitiveInputOf<typeof UnionStyled>;
    const typeContract = () => {
      const branchA: UnionInput = {
        pointerEvents: 'none',
        style: { kind: 'a', amount: 1 },
      };
      const branchB: UnionInput = {
        pointerEvents: 'none',
        style: { kind: 'b', label: 'two' },
      };
      const filteredA: UnionInput = {
        pointerEvents: 'none',
        style: {
          kind: 'a',
          amount: 1,
          // @ts-expect-error Every union branch closes core filters.
          filter: { type: 'blur', radius: 1 },
        },
      };
      const filteredB: UnionInput = {
        pointerEvents: 'none',
        style: {
          kind: 'b',
          label: 'two',
          // @ts-expect-error Every union branch closes core filters.
          filter: { type: 'blur', radius: 1 },
        },
      };
      return { branchA, branchB, filteredA, filteredB };
    };
    void typeContract;
  });

  it('rejects absent and malformed hit capabilities before registration', () => {
    const unsafeDefine = defineWebGLPrimitive as unknown as (
      render: () => void,
      capabilities?: unknown,
    ) => unknown;

    expect(() => unsafeDefine(function renderMissingHit() {})).toThrowError(
      /renderMissingHit.*hit capability.*geometry.*custom.*none/i,
    );
    expect(() => unsafeDefine(function renderBadGeometry() {}, {
      hit: { kind: 'geometry' },
    })).toThrowError(/renderBadGeometry.*geometry.*function/i);
    expect(() => unsafeDefine(function renderBadCustom() {}, {
      hit: { kind: 'custom', resolve: 1 },
    })).toThrowError(/renderBadCustom.*custom.*resolve.*function/i);
    expect(() => unsafeDefine(function renderBadKind() {}, {
      hit: { kind: 'painted' },
    })).toThrowError(/renderBadKind.*geometry.*custom.*none/i);
  });

  it('names WebGLLayer when a WebGL primitive is rendered in Canvas 2D', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const Probe = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderWebGLProbe() {},
      { hit: { kind: 'none' } },
    );
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100px;height:50px';
    document.body.appendChild(canvas);
    const controller = crc(canvas, <Probe pointerEvents="none" />);

    expect(() => callbacks[0]!(1)).toThrowError(
      'WebGLProbe requires the webgl2 backend and cannot render in the ' +
      'canvas2d root. Place it under <WebGLLayer>.',
    );
    controller.dispose();
  });

  it('names the unsupported boundary for Canvas primitives in a WebGL child', () => {
    const mounted = mountWebGL(<Rectangle style={{
      width: 4,
      height: 4,
    }} />);

    expect(() => executeBackendCRC(mounted.mount, mounted.root, 2)).toThrowError(
      /Rectangle requires the canvas2d backend and cannot render in the webgl2 root.*Canvas 2D children inside a WebGL island are unsupported/i,
    );
    mounted.dispose();
  });

  it('rejects a smuggled core filter with an actionable WebGLLayer diagnostic', () => {
    const Probe = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderFilteredChild() {},
      { hit: { kind: 'none' } },
    );
    const root = createElement(Probe as any, {
      pointerEvents: 'none',
      style: { filter: { type: 'blur', radius: 2 } },
    });
    const mounted = mountWebGL(root);

    expect(() => executeBackendCRC(mounted.mount, root, 3)).toThrowError(
      /FilteredChild style\.filter is not supported inside <WebGLLayer>.*apply the filter to <WebGLLayer>/i,
    );
    mounted.dispose();
  });

  it.each([
    ['automatic pointer events', { pointerEvents: 'auto' }],
    ['an event handler', { pointerEvents: 'none', onClick() {} }],
    ['focus participation', { pointerEvents: 'none', keyboardFocusable: true }],
    [
      'focus navigation bounds',
      {
        pointerEvents: 'none',
        keyboardNavigationBounds: { x: 0, y: 0, width: 1, height: 1 },
      },
    ],
    ['a cursor', { pointerEvents: 'none', cursor: 'pointer' }],
  ] as const)('rejects untyped decorative input with %s', (_label, props) => {
    const render = vi.fn();
    const Decorative = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderDecorativeParticipation() {
        render();
      },
      { hit: { kind: 'none' } },
    );
    const root = createElement(Decorative as any, props as any);
    const mounted = mountWebGL(root);

    expect(() => executeBackendCRC(mounted.mount, root, 4)).toThrowError(
      /DecorativeParticipation.*decorative.*event.*focus.*cursor.*unsupported/i,
    );
    expect(render).not.toHaveBeenCalled();
    mounted.dispose();
  });
});

function mountWebGL(root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const gl = createNoopGL();
  const camera = resolveCamera(undefined, 20, 10);
  const driver = createWebGLBackend({
    gl,
    getCamera: () => camera,
    getContextGeneration: () => 1,
  });
  const mount = mountBackendCRC(new OffscreenCanvas(40, 20), root, {
    parent: parentCanvas,
    logicalWidth: 20,
    logicalHeight: 10,
    driver,
  });
  return {
    mount,
    root,
    dispose() {
      mount.dispose();
      parent.dispose();
    },
  };
}

function createNoopGL(): WebGL2RenderingContext {
  let constant = 1;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 : () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}
