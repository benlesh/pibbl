import { crc, type CRCNode, type PrimitiveInputOf } from '@crc/core';
import { executeBackendCRC, mountBackendCRC } from '@crc/core/internal';
import { describe, expect, it, vi } from 'vitest';
import { Cube } from '../../index.js';
import { createWebGLBackend } from '../backend.js';
import { resolveCamera } from '../math/camera.js';

describe('Cube', () => {
  it.each([
    [0, /Cube.*size.*positive/i],
    [-1, /Cube.*size.*positive/i],
    [Number.NaN, /Cube.*size.*finite/i],
    [Number.POSITIVE_INFINITY, /Cube.*size.*finite/i],
  ])('rejects invalid size %s before drawing', (size, message) => {
    const draw = vi.fn();
    const gl = createNoopGL({ draw });
    const root = <Cube style={{ size }} />;
    const mounted = mountScene(gl, root);

    expect(() => executeBackendCRC(mounted.mount, root, 1))
      .toThrowError(message);
    expect(draw).not.toHaveBeenCalled();
    mounted.dispose();
  });

  it('exposes size only as a style field and keeps interaction props', () => {
    type CubeInput = PrimitiveInputOf<typeof Cube>;
    const typeContract = () => {
      const valid: CubeInput = {
        onPointerDown() {},
        keyboardFocusable: true,
        style: {
          size: 2,
          color: 'red',
          cursor: 'pointer',
          lit: false,
          material: { type: 'lambert', emissiveColor: '#ff0000' },
        },
      };
      const invalid: CubeInput = {
        // @ts-expect-error Cube size belongs to style.
        size: 2,
      };
      return { valid, invalid };
    };
    void typeContract;
  });
});

function mountScene(gl: WebGL2RenderingContext, root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const driver = createWebGLBackend({
    gl,
    getCamera: () => resolveCamera(undefined, 10, 10),
    getContextGeneration: () => 1,
  });
  const mount = mountBackendCRC(new OffscreenCanvas(10, 10), root, {
    parent: parentCanvas,
    logicalWidth: 10,
    logicalHeight: 10,
    driver,
  });
  return {
    mount,
    dispose() {
      mount.dispose();
      parent.dispose();
    },
  };
}

function createNoopGL(options: { readonly draw: () => void }) {
  let constant = 1;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 :
          property === 'drawElements' || property === 'drawArrays' ?
            options.draw : () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}
