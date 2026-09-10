import {
  Rectangle,
  createElement,
  crc,
  type CRCNode,
  type PrimitiveInputOf,
} from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWebGLGeometry,
  defineWebGLPrimitive,
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
    type GeometryInput = PrimitiveInputOf<typeof Geometry>;
    const typeContract = () => {
      const allowed: DecorativeInput = { pointerEvents: 'none' };
      // @ts-expect-error Decorative WebGL primitives cannot participate in hits.
      const automatic: DecorativeInput = { pointerEvents: 'auto' };
      // @ts-expect-error Decorative WebGL primitives cannot expose handlers.
      const interactive: DecorativeInput = { onClick() {} };
      const filtered: GeometryInput = {
        // @ts-expect-error Core Canvas filters belong on WebGLLayer, not children.
        style: { filter: { type: 'blur', radius: 1 } },
      };
      return { allowed, automatic, interactive, filtered };
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
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ : () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}
