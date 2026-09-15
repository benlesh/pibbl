import {
  Cube,
  Group3D,
  Mesh,
  createWebGLGeometry,
} from '../index.js';
import { crc, createElement, type CRCNode } from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCEventTargetRegistration,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebGLBackend } from './backend.js';
import { resolveCamera } from './math/camera.js';
import {
  commitWebGLPickLedger,
  createWebGLPickLedger,
  recordGeometryWebGLPick,
  releaseWebGLPickParticipation,
  type CRCWebGLPickRecord,
} from './pick-ledger.js';

const disposals: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('WebGL pick ledger', () => {
  it('commits stable geometry identity with a copied model and LEQUAL source order', () => {
    const ledger = createWebGLPickLedger(80, 40);
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const target = fakeTarget();
    const model = new Float32Array([
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, -3, 0,
      4, 5, 6, 1,
    ]);

    recordGeometryWebGLPick(ledger, {
      componentName: 'Triangle',
      depthMode: 'less-equal',
      geometry,
      model,
      sourceOrder: 7,
      target,
    });
    model[12] = 99;
    const committed = commitWebGLPickLedger(ledger);

    expect(committed.logicalViewport).toEqual({ width: 80, height: 40 });
    expect(committed.entries).toHaveLength(1);
    expect(committed.entries[0]).toMatchObject({
      componentName: 'Triangle',
      depthMode: 'less-equal',
      geometry,
      kind: 'geometry',
      sourceOrder: 7,
      target,
    });
    expect(Array.from(committed.entries[0]!.model)).toEqual([
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, -3, 0,
      4, 5, 6, 1,
    ]);
    expect(Object.isFrozen(committed)).toBe(true);
    expect(Object.isFrozen(committed.entries)).toBe(true);
  });

  it.each([
    ['behind the eye', 1, 2],
    ['before the near plane', -0.5, -0.2],
    ['beyond the far plane', -12, -11],
  ])('omits automatic directional geometry wholly %s', (
    _label,
    minimumZ,
    maximumZ,
  ) => {
    const entry = projectedGeometryEntry(
      geometryBox(-0.5, -0.5, minimumZ, 0.5, 0.5, maximumZ),
    );

    expect(layerFocusBounds(entry)).toBeUndefined();
  });

  it.each([
    ['near plane', -2, -0.5, { x: 25, y: 25, width: 50, height: 50 }],
    ['eye w=0', -2, 0, { x: 25, y: 25, width: 50, height: 50 }],
    [
      'far plane',
      -12,
      -9,
      {
        x: 47.2222222222,
        y: 47.2222222222,
        width: 5.5555555556,
        height: 5.5555555556,
      },
    ],
  ])('clips automatic directional geometry crossing the %s', (
    _label,
    minimumZ,
    maximumZ,
    expected,
  ) => {
    const entry = projectedGeometryEntry(
      geometryBox(-0.5, -0.5, minimumZ, 0.5, 0.5, maximumZ),
    );

    expect(layerFocusBounds(entry)).toEqual({
      x: expect.closeTo(expected.x, 5),
      y: expect.closeTo(expected.y, 5),
      width: expect.closeTo(expected.width, 5),
      height: expect.closeTo(expected.height, 5),
    });
  });

  it('clips giant finite geometry deterministically to the logical viewport', () => {
    const entry = projectedGeometryEntry(geometryBox(
      -3e38,
      -3e38,
      -2,
      3e38,
      3e38,
      -1,
    ));

    expect(layerFocusBounds(entry)).toEqual({
      x: expect.closeTo(0, 6),
      y: expect.closeTo(0, 6),
      width: expect.closeTo(100, 6),
      height: expect.closeTo(100, 6),
    });
  });

  it('keeps an explicit local-layer rectangle when geometry is fully clipped', () => {
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(ledger, {
      camera: clippingCamera(),
      componentName: 'ExplicitClippedBox',
      depthMode: 'less-equal',
      geometry: geometryBox(-1, -1, 1, 1, 1, 2),
      keyboardNavigationBounds: { x: 7, y: 8, width: 9, height: 10 },
      model: identityMatrix(),
      sourceOrder: 0,
      target: fakeTarget(),
    });

    expect(layerFocusBounds(commitWebGLPickLedger(ledger).entries[0]!))
      .toEqual({ x: 7, y: 8, width: 9, height: 10 });
  });

  it('records only built-in geometry participation after one component traversal', () => {
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const executions: string[] = [];
    function CountedMesh(props: Readonly<{
      label: string;
      pointerEvents?: 'auto' | 'none';
      opacity?: number;
    }>): CRCNode {
      executions.push(props.label);
      return createElement(Mesh, {
        geometry,
        onClick: () => undefined,
        pointerEvents: props.pointerEvents,
        style: { opacity: props.opacity, lit: false },
      });
    }
    function CountedCube(_props: {}): CRCNode {
      executions.push('cube');
      return createElement(Cube, {
        pointerEvents: 'none',
        style: { lit: false },
      });
    }
    const root = createElement(Group3D, {
      style: { translateX: 2, scaleX: -2, scaleY: 3 },
      children: [
        createElement(CountedMesh, { key: 'visible', label: 'visible' }),
        createElement(CountedMesh, {
          key: 'opted-out',
          label: 'opted-out',
          pointerEvents: 'none',
        }),
        createElement(CountedMesh, {
          key: 'zero-opacity',
          label: 'zero-opacity',
          opacity: 0,
        }),
        createElement(CountedCube, { key: 'cube' }),
      ],
    });
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 10);
    const completed = mounted.driver.takeCompletedFrame();

    expect(executions).toEqual([
      'visible',
      'opted-out',
      'zero-opacity',
      'cube',
    ]);
    const entries = completed.pickEntries as readonly CRCWebGLPickRecord[];
    expect(entries.map(entry => ({
      kind: entry.kind,
      sourceOrder: entry.sourceOrder,
    }))).toEqual([
      { kind: 'geometry', sourceOrder: 0 },
      { kind: 'geometry', sourceOrder: 2 },
    ]);
    expect(Array.from(entries[0]!.model)).toEqual([
      -2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 1, 0,
      2, 0, 0, 1,
    ]);
    expect(entries.every(
      entry => entry.target.paintEntry === undefined,
    )).toBe(true);
    releaseWebGLPickParticipation([...entries, entries[0]!]);
    releaseWebGLPickParticipation(entries);
    expect(entries.every(entry => entry.target.live === false)).toBe(true);
  });
});

function mountScene(root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const camera = resolveCamera(undefined, 100, 100);
  const driver = createWebGLBackend({
    gl: createNoopGL(),
    getCamera: () => camera,
    getContextGeneration: () => 1,
  });
  const mount = mountBackendCRC(new OffscreenCanvas(100, 100), root, {
    parent: parentCanvas,
    logicalWidth: 100,
    logicalHeight: 100,
    driver,
  });
  disposals.push(() => {
    mount.dispose();
    parent.dispose();
  });
  return { driver, mount };
}

function fakeTarget(): CRCEventTargetRegistration {
  return { kind: 'target', live: true } as CRCEventTargetRegistration;
}

function projectedGeometryEntry(
  geometry: ReturnType<typeof createWebGLGeometry>,
): CRCWebGLPickRecord {
  const ledger = createWebGLPickLedger(100, 100);
  recordGeometryWebGLPick(ledger, {
    camera: clippingCamera(),
    componentName: 'ClippedBox',
    depthMode: 'less-equal',
    geometry,
    model: identityMatrix(),
    sourceOrder: 0,
    target: fakeTarget(),
  });
  return commitWebGLPickLedger(ledger).entries[0]!;
}

function clippingCamera() {
  return resolveCamera({
    type: 'perspective',
    position: [0, 0, 0],
    lookAt: [0, 0, -1],
    up: [0, 1, 0],
    fieldOfViewDegrees: 90,
    near: 1,
    far: 10,
  }, 100, 100);
}

function geometryBox(
  minimumX: number,
  minimumY: number,
  minimumZ: number,
  maximumX: number,
  maximumY: number,
  maximumZ: number,
) {
  return createWebGLGeometry({
    positions: [
      minimumX, minimumY, minimumZ,
      maximumX, minimumY, maximumZ,
      minimumX, maximumY, maximumZ,
    ],
  });
}

function identityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function layerFocusBounds(
  entry: CRCWebGLPickRecord,
): Readonly<{ x: number; y: number; width: number; height: number }> | undefined {
  const points = entry.keyboardNavigationPoints;
  if (!points?.length) return entry.keyboardNavigationBounds;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
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
