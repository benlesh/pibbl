import {
  createWebGLGeometry,
  type CRCWebGLPerspectiveCamera,
} from '../index.js';
import type {
  CRCEventTargetRegistration,
  CRCHitTestOutput,
} from '@crc/core/internal';
import { describe, expect, it } from 'vitest';
import { resolveCamera } from './math/camera.js';
import { composeModelMatrix4 } from './math/matrix4.js';
import {
  commitWebGLPickLedger,
  createWebGLPickLedger,
  recordGeometryWebGLPick,
} from './pick-ledger.js';
import { pickScene } from './scene-picker.js';

describe('CPU WebGL scene picker', () => {
  it('picks finite geometry with the accepted largest far plane', () => {
    const camera = resolveCamera(largeFarCamera(), 100, 100);
    const target = fakeTarget('large-far-geometry');
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(target, triangle(), identity(), 0),
    );
    const output = staleOutput();

    pickScene(commitWebGLPickLedger(ledger), camera, 50, 50, output);

    expect(output).toEqual({ disposition: 2, target });
  });

  it('rejects a non-finite or zero camera ray before geometry traversal', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const invalidCamera = {
      ...camera,
      inverseProjectionViewMatrix: new Float32Array(16),
    };
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(fakeTarget('invalid-ray'), triangle(), identity(), 0),
    );
    const output = staleOutput();

    pickScene(
      commitWebGLPickLedger(ledger),
      invalidCamera,
      50,
      50,
      output,
    );

    expect(output).toEqual({ disposition: 0, target: null });
  });

  it('maps center and corner points to one camera ray and returns miss for transparent background', () => {
    const target = fakeTarget('center');
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(target, triangle(), identity(), 0),
    );
    const committed = commitWebGLPickLedger(ledger);
    const camera = resolveCamera(undefined, 100, 100);

    const output = staleOutput();
    expect(pickScene(committed, camera, 50, 50, output)).toBe(output);
    expect(output).toEqual({ disposition: 2, target });

    expect(pickScene(committed, camera, 0, 0, output)).toBe(output);
    expect(output).toEqual({ disposition: 0, target: null });
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

  it('skips dead geometry records', () => {
    const target = fakeTarget('dead-geometry');
    releaseFakeTarget(target);
    const ledger = createWebGLPickLedger(100, 100);
    recordGeometryWebGLPick(
      ledger,
      geometryRecord(target, triangle(), identity(), 0),
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
