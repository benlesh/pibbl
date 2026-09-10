import { crc, type CRCNode } from '@crc/core';
import { executeBackendCRC, mountBackendCRC } from '@crc/core/internal';
import { describe, expect, it, vi } from 'vitest';
import { createWebGLBackend } from '../backend.js';
import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import { resolveCamera } from '../math/camera.js';
import type { CRCWebGLTransformStyle } from '../types.js';
import { Group3D } from './group-3d.js';

describe('Group3D', () => {
  it('composes nested models in parent-local T * Rz * Ry * Rx * S order and restores siblings', () => {
    const matrices: number[][] = [];
    const Probe = defineWebGLPrimitive<{ label: string }, CRCWebGLTransformStyle>(
      function renderModelProbe(_props, _style, context) {
        matrices.push(Array.from(context.modelMatrix));
      },
      { hit: { kind: 'none' } },
    );
    const root = [
      <Group3D key="outer" style={{ translateX: 5 }}>
        <Group3D style={{ translateY: 3, scaleX: 2, scaleY: 2, scaleZ: 2 }}>
          <Probe label="nested" pointerEvents="none" />
        </Group3D>
      </Group3D>,
      <Probe key="sibling" label="sibling" pointerEvents="none" />,
    ];
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 1);

    expect(matrices).toEqual([
      [
        2, 0, 0, 0,
        0, 2, 0, 0,
        0, 0, 2, 0,
        5, 3, 0, 1,
      ],
      [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    ]);
    mounted.dispose();
  });

  it.each([
    [{ translateX: Number.NaN }, /translateX.*finite/i],
    [{ rotationYDegrees: Number.POSITIVE_INFINITY }, /rotationYDegrees.*finite/i],
    [{ scaleZ: 0 }, /scaleZ.*nonzero/i],
  ] as const)('rejects an invalid transform before rendering children %#', (style, message) => {
    const child = vi.fn();
    const Probe = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderInvalidChild() {
        child();
      },
      { hit: { kind: 'none' } },
    );
    const root = <Group3D style={style}><Probe pointerEvents="none" /></Group3D>;
    const mounted = mountScene(root);

    expect(() => executeBackendCRC(mounted.mount, root, 1)).toThrowError(message);
    expect(child).not.toHaveBeenCalled();
    mounted.dispose();
  });

  it('owns only a propagation listener and releases it when removed', () => {
    const parentCanvas = document.createElement('canvas');
    const add = vi.spyOn(parentCanvas, 'addEventListener');
    const remove = vi.spyOn(parentCanvas, 'removeEventListener');
    const parent = crc(parentCanvas, undefined);
    const gl = createNoopGL();
    const camera = resolveCamera(undefined, 10, 10);
    const driver = createWebGLBackend({
      gl,
      getCamera: () => camera,
      getContextGeneration: () => 1,
    });
    const root = <Group3D onClick={() => undefined}>{undefined}</Group3D>;
    const mount = mountBackendCRC(new OffscreenCanvas(10, 10), root, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver,
    });

    executeBackendCRC(mount, root, 1);
    expect(add.mock.calls.filter(([type]) => type === 'click')).toHaveLength(1);

    executeBackendCRC(mount, undefined, 2);
    expect(remove.mock.calls.filter(([type]) => type === 'click')).toHaveLength(1);

    mount.dispose();
    parent.dispose();
  });
});

function mountScene(root: CRCNode) {
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
