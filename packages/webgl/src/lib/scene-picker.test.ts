import {
  createWebGLGeometry,
  type CRCWebGLPerspectiveCamera,
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
  it('picks finite geometry and custom rays with the accepted largest far plane', () => {
    const camera = resolveCamera(largeFarCamera(), 100, 100);
    const geometryTarget = fakeTarget('large-far-geometry');
    const geometryLedger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      geometryLedger,
      geometryRecord(geometryTarget, triangle(), identity(), 0),
    );
    const customTarget = fakeTarget('large-far-custom');
    const customLedger = createWebGLPickLedger(100, 100);
    const resolve = vi.fn((input: CRCWebGLPrimitiveHitInput<{}, {}>) => {
      expect([...input.rayOrigin, ...input.rayDirection]
        .every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...input.rayDirection)).toBeCloseTo(1, 12);
      return 4.9;
    });
    recordCustomWebGLPick(customLedger, {
      camera,
      componentName: 'LargeFarCustom',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve,
      sourceOrder: 0,
      style: {},
      target: customTarget,
    });

    const geometryOutput = staleOutput();
    pickScene(
      commitWebGLPickLedger(geometryLedger),
      camera,
      50,
      50,
      geometryOutput,
    );
    const customOutput = staleOutput();
    pickScene(
      commitWebGLPickLedger(customLedger),
      camera,
      50,
      50,
      customOutput,
    );

    expect(geometryOutput).toEqual({
      disposition: 2,
      target: geometryTarget,
    });
    expect(customOutput).toEqual({ disposition: 2, target: customTarget });
    expect(resolve).toHaveBeenCalledOnce();
  });

  it('rejects a non-finite or zero camera ray before custom hit code', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const invalidCamera = {
      ...camera,
      inverseProjectionViewMatrix: new Float32Array(16),
    };
    const resolve = vi.fn(() => 0);
    const ledger = createWebGLPickLedger(100, 100);
    recordCustomWebGLPick(ledger, {
      camera: invalidCamera,
      componentName: 'InvalidRayCustom',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve,
      sourceOrder: 0,
      style: {},
      target: fakeTarget('invalid-ray'),
    });
    const output = staleOutput();

    pickScene(
      commitWebGLPickLedger(ledger),
      invalidCamera,
      50,
      50,
      output,
    );

    expect(output).toEqual({ disposition: 0, target: null });
    expect(resolve).not.toHaveBeenCalled();
  });

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

  it.each([1e12, -1e12])(
    'keeps a planar hit invariant under extreme nonuniform scaleZ %s',
    scaleZ => {
      const target = fakeTarget(`scale-${scaleZ}`);
      const ledger = createWebGLPickLedger(100, 100);
      const model = new Float32Array(16);
      composeModelMatrix4(model, {
        scaleX: 2,
        scaleY: 0.5,
        scaleZ,
      });
      recordGeometryWebGLPick(
        ledger,
        geometryRecord(target, triangle(), model, 0),
      );
      const output = staleOutput();

      pickScene(
        commitWebGLPickLedger(ledger),
        resolveCamera(undefined, 100, 100),
        50,
        50,
        output,
      );

      expect(output).toEqual({ disposition: 2, target });
    },
  );

  it('picks tiny local geometry enlarged to the same visible world plane', () => {
    const target = fakeTarget('tiny-enlarged');
    const ledger = createWebGLPickLedger(100, 100);
    const geometry = createWebGLGeometry({
      positions: [-1e-12, -1e-12, 0, 1e-12, -1e-12, 0, 0, 1e-12, 0],
    });
    const model = new Float32Array(16);
    composeModelMatrix4(model, {
      scaleX: 1e12,
      scaleY: 1e12,
      scaleZ: 1e12,
    });
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(target, geometry, model, 0),
    );
    const output = staleOutput();

    pickScene(
      commitWebGLPickLedger(ledger),
      resolveCamera(undefined, 100, 100),
      50,
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
    const nonfinite = identity();
    nonfinite[0] = Number.POSITIVE_INFINITY;
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(fakeTarget('nonfinite'), triangle(), nonfinite, 2),
    );
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(
        fakeTarget('degenerate'),
        createWebGLGeometry({
          positions: [-1, 0, 0, 0, 0, 0, 1, 0, 0],
        }),
        identity(),
        3,
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

  it('skips dead geometry and custom records before user hit code', () => {
    const geometryTarget = fakeTarget('dead-geometry');
    const customTarget = fakeTarget('dead-custom');
    releaseFakeTarget(geometryTarget);
    releaseFakeTarget(customTarget);
    const resolve = vi.fn(() => 1);
    const camera = resolveCamera(undefined, 100, 100);
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(geometryTarget, triangle(), identity(), 0),
    );
    recordCustomWebGLPick(ledger, {
      camera,
      componentName: 'DeadCustom',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve,
      sourceOrder: 1,
      style: {},
      target: customTarget,
    });
    const output = staleOutput();

    pickScene(commitWebGLPickLedger(ledger), camera, 50, 50, output);

    expect(output).toEqual({ disposition: 0, target: null });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('revalidates an earlier winner after later custom lifecycle code', () => {
    const earlierTarget = fakeTarget('released-winner');
    const customTarget = fakeTarget('live-custom');
    const fallbackTarget = fakeTarget('live-fallback');
    const camera = resolveCamera(undefined, 100, 100);
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(earlierTarget, triangle(), identity(), 0),
    );
    recordCustomWebGLPick(ledger, {
      camera,
      componentName: 'LifecycleCustom',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve: () => {
        releaseFakeTarget(earlierTarget);
        return null;
      },
      sourceOrder: 1,
      style: {},
      target: customTarget,
    });
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(fallbackTarget, triangle(), translatedZ(0), 2),
    );
    const output = staleOutput();

    pickScene(commitWebGLPickLedger(ledger), camera, 50, 50, output);

    expect(output).toEqual({ disposition: 2, target: fallbackTarget });
  });

  it('recovers an earlier live fallback after a later winner is released', () => {
    const fallbackTarget = fakeTarget('earlier-live-fallback');
    const releasedWinner = fakeTarget('later-released-winner');
    const fartherCustom = fakeTarget('farther-custom');
    const camera = resolveCamera(undefined, 100, 100);
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(fallbackTarget, triangle(), translatedZ(-1), 0),
    );
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(releasedWinner, triangle(), identity(), 1),
    );
    recordCustomWebGLPick(ledger, {
      camera,
      componentName: 'ReleasingFartherCustom',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve: () => {
        releaseFakeTarget(releasedWinner);
        return 6.5;
      },
      sourceOrder: 2,
      style: {},
      target: fartherCustom,
    });
    const output = staleOutput();

    pickScene(commitWebGLPickLedger(ledger), camera, 50, 50, output);

    expect(output).toEqual({ disposition: 2, target: fallbackTarget });
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

  it('does not let custom resolver mutations alter later picks', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const observations: Array<readonly [number, number, number]> = [];
    const ledger = createWebGLPickLedger(100, 100);
    recordCustomWebGLPick(ledger, {
      camera,
      componentName: 'MutationShape',
      depthMode: 'less-equal',
      model: identity(),
      props: {
        nested: { distance: 1 },
        typed: new Float32Array([2]),
      },
      resolve: input => {
        const props = input.props as {
          nested: { distance: number };
          typed: Float32Array;
        };
        const style = input.style as { nested: { threshold: number } };
        observations.push([
          props.nested.distance,
          props.typed[0]!,
          style.nested.threshold,
        ]);
        try {
          props.nested.distance = 9;
        } catch {
          // A frozen committed plain-object snapshot rejects this mutation.
        }
        try {
          style.nested.threshold = 9;
        } catch {
          // Style uses the same frozen recursive snapshot boundary.
        }
        props.typed[0] = 9;
        return null;
      },
      sourceOrder: 0,
      style: { nested: { threshold: 3 } },
      target: fakeTarget('mutation'),
    });
    const committed = commitWebGLPickLedger(ledger);

    pickScene(committed, camera, 50, 50, staleOutput());
    pickScene(committed, camera, 50, 50, staleOutput());

    expect(observations).toEqual([[1, 2, 3], [1, 2, 3]]);
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

  it('restores an outer miss after a nested pick reuses its output', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const outerTarget = fakeTarget('outer');
    const outerLedger = createWebGLPickLedger(100, 100);
    const output = staleOutput();
    let nested = false;
    let committed: ReturnType<typeof commitWebGLPickLedger>;
    recordCustomWebGLPick(outerLedger, {
      camera,
      componentName: 'ReentrantOuter',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve: () => {
        if (nested) return 1;
        nested = true;
        pickScene(committed, camera, 50, 50, output);
        return null;
      },
      sourceOrder: 0,
      style: {},
      target: outerTarget,
    });
    committed = commitWebGLPickLedger(outerLedger);

    pickScene(
      committed,
      camera,
      50,
      50,
      output,
    );

    expect(output).toEqual({ disposition: 0, target: null });
  });

  it('isolates distinct outputs during a nested pick', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const target = fakeTarget('inner-distinct');
    const innerOutput = staleOutput();
    const outerLedger = createWebGLPickLedger(100, 100);
    let nested = false;
    let committed: ReturnType<typeof commitWebGLPickLedger>;
    recordCustomWebGLPick(outerLedger, {
      camera,
      componentName: 'DistinctOuter',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve: () => {
        if (nested) return 1;
        nested = true;
        pickScene(committed, camera, 50, 50, innerOutput);
        return null;
      },
      sourceOrder: 0,
      style: {},
      target,
    });
    committed = commitWebGLPickLedger(outerLedger);
    const outerOutput = staleOutput();

    pickScene(
      committed,
      camera,
      50,
      50,
      outerOutput,
    );

    expect(outerOutput).toEqual({ disposition: 0, target: null });
    expect(innerOutput).toEqual({ disposition: 2, target });
  });

  it('resets a reused output before propagating a custom resolver error', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const innerLedger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      innerLedger,
      geometryRecord(fakeTarget('inner-before-throw'), triangle(), identity(), 0),
    );
    const committedInner = commitWebGLPickLedger(innerLedger);
    const output = staleOutput();
    const error = new Error('custom failed');
    const outerLedger = createWebGLPickLedger(100, 100);
    recordCustomWebGLPick(outerLedger, {
      camera,
      componentName: 'ThrowingOuter',
      depthMode: 'less-equal',
      model: identity(),
      props: {},
      resolve: () => {
        pickScene(committedInner, camera, 50, 50, output);
        throw error;
      },
      sourceOrder: 0,
      style: {},
      target: fakeTarget('throwing-outer'),
    });

    expect(() => pickScene(
      commitWebGLPickLedger(outerLedger),
      camera,
      50,
      50,
      output,
    )).toThrow(error);
    expect(output).toEqual({ disposition: 0, target: null });
  });
});

function largeFarCamera(): CRCWebGLPerspectiveCamera {
  return {
    type: 'perspective',
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    up: [0, 1, 0],
    fieldOfViewDegrees: 50,
    near: 0.1,
    far: 3e38,
  };
}

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
  const eventRoot = {
    targets: new Set<CRCEventTargetRegistration>(),
  };
  const owner = {
    eventRoot,
    mainTeardowns: { closed: false },
  };
  const target = {
    kind: 'target',
    live: true,
    owner,
    publicTarget: { label },
  } as unknown as CRCEventTargetRegistration;
  eventRoot.targets.add(target);
  return target;
}

function releaseFakeTarget(target: CRCEventTargetRegistration): void {
  target.live = false;
  target.owner.eventRoot.targets.delete(target);
}
