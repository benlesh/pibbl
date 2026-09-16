import { crc, type CRCNode } from '@crc/core';
import {
  defineBackendPrimitive,
  executeBackendCRC,
  mountBackendCRC,
} from '@crc/core/internal';
import { describe, expect, it, vi } from 'vitest';
import { Mesh, createWebGLGeometry } from '../../index.js';
import { WEBGL_BACKEND_TOKEN, createWebGLBackend } from '../backend.js';
import { resolveCamera } from '../math/camera.js';
import type { CRCWebGLGeometryPickRecord } from '../pick-ledger.js';
import { Group3D } from './group-3d.js';

describe('Group3D', () => {
  it('snapshots nested T * Rz * Ry * Rx * S models and restores sibling scope', () => {
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const root = [
      <Group3D key="outer" style={{ translateX: 5 }}>
        <Group3D style={{
          translateX: 1,
          translateY: 2,
          translateZ: 3,
          rotationXDegrees: 90,
          rotationYDegrees: 90,
          rotationZDegrees: 90,
          scaleX: 2,
          scaleY: 3,
          scaleZ: 4,
        }}>
          <Mesh
            geometry={geometry}
            style={{ lit: false }}
            onClick={() => undefined}
          />
        </Group3D>
      </Group3D>,
      <Mesh
        key="sibling"
        geometry={geometry}
        style={{ lit: false }}
        onClick={() => undefined}
      />,
    ];
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 1);

    const entries = mounted.driver.takeCompletedFrame()
      .pickEntries as readonly CRCWebGLGeometryPickRecord[];
    expect(entries).toHaveLength(2);
    expectMatrix(entries[0]!.model, [
      0, 0, -2, 0,
      0, 3, 0, 0,
      4, 0, 0, 0,
      6, 2, 3, 1,
    ]);
    expectMatrix(entries[1]!.model, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    mounted.dispose();
  });

  it.each([
    [{ translateX: Number.NaN }, /translateX.*finite/i],
    [{ rotationYDegrees: Number.POSITIVE_INFINITY }, /rotationYDegrees.*finite/i],
    [{ scaleZ: 0 }, /scaleZ.*nonzero/i],
  ] as const)('rejects an invalid transform before rendering children %#', (style, message) => {
    const child = vi.fn();
    const Probe = defineBackendPrimitive<{}, {}, {}, {}, unknown>(
      WEBGL_BACKEND_TOKEN,
      function renderInvalidChild() {
        child();
      },
    );
    const root = <Group3D style={style}><Probe /></Group3D>;
    const mounted = mountScene(root);

    expect(() => executeBackendCRC(mounted.mount, root, 1)).toThrowError(message);
    expect(child).not.toHaveBeenCalled();
    mounted.dispose();
  });

  it('restores its model scope before a failed frame finishes', () => {
    const parentCanvas = document.createElement('canvas');
    const parent = crc(parentCanvas, undefined);
    const gl = createNoopGL();
    const camera = resolveCamera(undefined, 20, 10);
    const baseDriver = createWebGLBackend({
      gl,
      getCamera: () => camera,
      getContextGeneration: () => 1,
    });
    const finished: { readonly success: boolean; readonly modelDepth: number }[] = [];
    const driver = {
      ...baseDriver,
      finishFrame(frame: Parameters<typeof baseDriver.finishFrame>[0], success: boolean) {
        finished.push({ success, modelDepth: frame.environment.modelStack.length });
        baseDriver.finishFrame(frame, success);
      },
    };
    const failure = new Error('descendant failed');
    const Throwing = defineBackendPrimitive<{}, {}, {}, {}, unknown>(
      WEBGL_BACKEND_TOKEN,
      function renderThrowingDescendant() {
        throw failure;
      },
    );
    const root = (
      <Group3D style={{ translateX: 5 }}>
        <Throwing />
      </Group3D>
    );
    const mount = mountBackendCRC(new OffscreenCanvas(40, 20), root, {
      parent: parentCanvas,
      logicalWidth: 20,
      logicalHeight: 10,
      driver,
    });

    expect(() => executeBackendCRC(mount, root, 2)).toThrow(failure);
    expect(finished).toEqual([{ success: false, modelDepth: 1 }]);

    mount.dispose();
    parent.dispose();
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
    driver,
    dispose() {
      mount.dispose();
      parent.dispose();
    },
  };
}

function expectMatrix(actual: ArrayLike<number>, expected: readonly number[]) {
  expect(Array.from(actual)).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 6);
  });
}

function createNoopGL(): WebGL2RenderingContext {
  let constant = 1;
  let handle = 0;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 :
            property === 'getShaderParameter' ||
            property === 'getProgramParameter' ? () => true :
              property === 'getShaderInfoLog' ||
              property === 'getProgramInfoLog' ? () => '' :
                property === 'getUniformLocation' ?
                  (_program: object, name: string) => ({ name }) :
                  property === 'createShader' ||
                  property === 'createProgram' ||
                  property === 'createVertexArray' ||
                  property === 'createBuffer' ?
                    () => ({ kind: property, id: ++handle }) :
                    property === 'isContextLost' ? () => false :
                      () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}
