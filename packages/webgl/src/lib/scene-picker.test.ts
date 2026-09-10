import {
  createWebGLGeometry,
  type CRCWebGLPrimitiveHitInput,
} from '../index.js';
import {
  type CRCEventTargetRegistration,
  type CRCHitTestOutput,
} from '@crc/core/internal';
import { describe, expect, it, vi } from 'vitest';
import { resolveCamera } from './math/camera.js';
import { composeModelMatrix4 } from './math/matrix4.js';
import {
  commitWebGLPickLedger,
  createWebGLPickLedger,
  recordCustomWebGLPick,
  recordGeometryWebGLPick,
} from './pick-ledger.js';
import { pickScene } from './scene-picker.js';

describe('CPU WebGL scene picker', () => {
  it('maps center and corner points to one camera ray and returns miss for transparent background', () => {
    const target = fakeTarget('center');
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(ledger, geometryRecord(target, triangle(), identity(), 0));
    const committed = commitWebGLPickLedger(ledger);
    const camera = resolveCamera(undefined, 100, 100);

    const center = staleOutput();
    expect(pickScene(committed, camera, 50, 50, center)).toBe(center);
    expect(center).toEqual({ disposition: 2, target });

    const corner = staleOutput();
    pickScene(committed, camera, 0, 0, corner);
    expect(corner).toEqual({ disposition: 0, target: null });
  });

  it('intersects indexed geometry through negative nonuniform model scale', () => {
    const target = fakeTarget('transformed');
    const ledger = createWebGLPickLedger(100, 100);
    const geometry = createWebGLGeometry({
      positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0],
      indices: [0, 1, 2],
    });
    const model = new Float32Array(16);
    composeModelMatrix4(model, {
      scaleX: -2,
      scaleY: 0.5,
      scaleZ: 3,
      translateX: 0.25,
    });
    recordGeometryWebGLPick(ledger, geometryRecord(target, geometry, model, 0));
    const output = staleOutput();

    pickScene(
      commitWebGLPickLedger(ledger),
      resolveCamera(undefined, 100, 100),
      52,
      50,
      output,
    );

    expect(output).toEqual({ disposition: 2, target });
  });

  it('selects the nearest supported depth regardless of source order', () => {
    const nearer = fakeTarget('nearer');
    const farther = fakeTarget('farther-later');
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(nearer, triangle(), translatedZ(1), 0),
    );
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(farther, triangle(), translatedZ(0), 1),
    );
    const output = staleOutput();

    pickScene(
      commitWebGLPickLedger(ledger),
      resolveCamera(undefined, 100, 100),
      50,
      50,
      output,
    );

    expect(output).toEqual({ disposition: 2, target: nearer });
  });

  it('compares analytic and triangle hits in the same camera-depth space', () => {
    const analytic = fakeTarget('analytic-near');
    const triangleTarget = fakeTarget('triangle-later');
    const camera = resolveCamera(undefined, 100, 100);
    const ledger = createWebGLPickLedger(100, 100);
    recordCustomWebGLPick(ledger, {
      camera,
      componentName: 'AnalyticNear',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve: () => 1,
      sourceOrder: 0,
      style: {},
      target: analytic,
    });
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(triangleTarget, triangle(), translatedZ(1), 1),
    );
    const output = staleOutput();

    pickScene(commitWebGLPickLedger(ledger), camera, 50, 50, output);

    expect(output).toEqual({ disposition: 2, target: analytic });
  });

  it('lets the later source win an equal-depth LEQUAL tie', () => {
    const earlier = fakeTarget('earlier');
    const later = fakeTarget('later');
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(earlier, triangle(), identity(), 4),
    );
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(later, triangle(), identity(), 9),
    );
    const output = staleOutput();

    pickScene(
      commitWebGLPickLedger(ledger),
      resolveCamera(undefined, 100, 100),
      50,
      50,
      output,
    );

    expect(output).toEqual({ disposition: 2, target: later });
  });

  it('ignores clipped-depth and noninvertible geometry deterministically', () => {
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(fakeTarget('past-far'), triangle(), translatedZ(-2_000), 0),
    );
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(
        fakeTarget('singular'),
        triangle(),
        new Float32Array(16),
        1,
      ),
    );
    const output = staleOutput();

    pickScene(
      commitWebGLPickLedger(ledger),
      resolveCamera(undefined, 100, 100),
      50,
      50,
      output,
    );

    expect(output).toEqual({ disposition: 0, target: null });
  });

  it('passes committed custom snapshots and validates resolver distance', () => {
    const target = fakeTarget('custom');
    const camera = resolveCamera(undefined, 100, 50);
    const seen: CRCWebGLPrimitiveHitInput<
      { label: string },
      { amount: number }
    >[] = [];
    const resolve = vi.fn((input: CRCWebGLPrimitiveHitInput<
      { label: string },
      { amount: number }
    >) => {
      seen.push(input);
      return 2;
    });
    const ledger = createWebGLPickLedger(100, 50);
    recordCustomWebGLPick(ledger, {
      camera,
      componentName: 'AnalyticTarget',
      depthMode: 'less-equal',
      model: identity(),
      props: { label: 'committed' },
      resolve,
      sourceOrder: 0,
      style: { amount: 3 },
      target,
    });
    const output = staleOutput();

    pickScene(commitWebGLPickLedger(ledger), camera, 75, 10, output);

    expect(output).toEqual({ disposition: 2, target });
    expect(resolve).toHaveBeenCalledOnce();
    expect(seen[0]).toMatchObject({
      camera: { aspect: 2 },
      layerX: 75,
      layerY: 10,
      ndcX: 0.5,
      ndcY: 0.6,
      props: { label: 'committed' },
      style: { amount: 3 },
    });
    expect(Array.from(seen[0]!.modelMatrix)).toEqual(Array.from(identity()));
    expect(Object.isFrozen(seen[0])).toBe(true);
    expect(Object.isFrozen(seen[0]!.rayOrigin)).toBe(true);
    expect(Object.isFrozen(seen[0]!.rayDirection)).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid custom distance %s with component diagnostics',
    distance => {
      const camera = resolveCamera(undefined, 100, 100);
      const ledger = createWebGLPickLedger(100, 100);
      recordCustomWebGLPick(ledger, {
        camera,
        componentName: 'BadAnalyticTarget',
        depthMode: 'less-equal',
        model: identity(),
        props: {},
        resolve: () => distance,
        sourceOrder: 0,
        style: {},
        target: fakeTarget('bad'),
      });

      expect(() => pickScene(
        commitWebGLPickLedger(ledger),
        camera,
        50,
        50,
        staleOutput(),
      )).toThrowError(
        /BadAnalyticTarget custom hit resolver must return null or a finite nonnegative ray distance/i,
      );
    },
  );
});

function geometryRecord(
  target: CRCEventTargetRegistration,
  geometry: ReturnType<typeof createWebGLGeometry>,
  model: Float32Array,
  sourceOrder: number,
) {
  return {
    componentName: 'TestMesh',
    depthMode: 'less-equal' as const,
    geometry,
    model,
    sourceOrder,
    target,
  };
}

function triangle() {
  return createWebGLGeometry({
    positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
  });
}

function identity(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function translatedZ(z: number): Float32Array {
  const matrix = identity();
  matrix[14] = z;
  return matrix;
}

function staleOutput(): CRCHitTestOutput {
  return {
    disposition: 2,
    target: fakeTarget('stale'),
  };
}

function fakeTarget(label: string): CRCEventTargetRegistration {
  return {
    kind: 'target',
    live: true,
    publicTarget: { label },
  } as unknown as CRCEventTargetRegistration;
}
