import {
  crc,
  createElement,
  type CRCNode,
  type PrimitiveInputOf,
} from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from '@crc/core/internal';
import { describe, expect, it } from 'vitest';
import {
  AmbientLight,
  DirectionalLight,
  Group3D,
  HemisphereLight,
  Mesh,
  PointLight,
  SpotLight,
  WebGLBackground,
  createWebGLGeometry,
} from '../../index.js';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { resolveCamera } from '../math/camera.js';
import {
  closeWebGLSceneComposer,
  createWebGLSceneComposer,
  discardWebGLSceneComposer,
} from '../scene/composer.js';
import { settleWebGLScene } from '../scene/settle.js';
import type { WebGLSceneComposer } from '../scene/types.js';

const geometry = createWebGLGeometry({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
});

describe('WebGL light declarations', () => {
  it('composes ordered target-free declarations without consuming mesh source indices', () => {
    const root = (
      <>
        <Mesh geometry={geometry} style={{ lit: false }} />
        <AmbientLight style={{ color: '#fff', intensity: 0.25 }} />
        <Group3D style={{ translateX: 3, rotationYDegrees: 90 }}>
          <PointLight style={{ range: 10 }} />
          <DirectionalLight />
        </Group3D>
        <WebGLBackground style={{ color: 'rgb(8 17 31 / 75%)' }} />
        <Mesh geometry={geometry} style={{ lit: false }} />
      </>
    );

    const scene = compose(root);

    expect(scene.meshes.map(mesh => mesh.sourceIndex)).toEqual([0, 1]);
    expect(scene.lights.map(light => light.kind)).toEqual([
      'ambient',
      'point',
      'directional',
    ]);
    expect(scene.lights.every(light => !('target' in light))).toBe(true);
    expect(scene.backgrounds).toHaveLength(1);
    expect('target' in scene.backgrounds[0]!).toBe(false);
  });

  it('supports createElement and owns composed model snapshots for transformable lights', () => {
    const pointStyle = { translateY: 4, range: 12 };
    const root = createElement(Group3D, {
      children: [
        createElement(HemisphereLight, {}),
        createElement(DirectionalLight, {}),
        createElement(PointLight, { style: pointStyle }),
        createElement(SpotLight, {}),
      ],
      style: { translateX: 3 },
    });

    const scene = compose(root);
    pointStyle.translateY = 99;

    expect(scene.lights.map(light => light.kind)).toEqual([
      'hemisphere',
      'directional',
      'point',
      'spot',
    ]);
    expect(Array.from(scene.lights[0]!.model!)).toEqual(translation(3, 0, 0));
    expect(Array.from(scene.lights[1]!.model!)).toEqual(translation(3, 0, 0));
    expect(Array.from(scene.lights[2]!.model!)).toEqual(translation(3, 4, 0));
    expect(Array.from(scene.lights[3]!.model!)).toEqual(translation(3, 0, 0));
  });

  it('resolves every light default and preserves zero intensity', () => {
    const scene = compose(
      <>
        <AmbientLight />
        <HemisphereLight />
        <DirectionalLight />
        <PointLight />
        <SpotLight style={{ intensity: 0 }} />
      </>,
    );

    expect(scene.lights).toMatchObject([
      { kind: 'ambient', color: [1, 1, 1, 1], intensity: 1 },
      {
        kind: 'hemisphere',
        skyColor: [1, 1, 1, 1],
        groundColor: [1, 1, 1, 1],
        intensity: 1,
      },
      { kind: 'directional', color: [1, 1, 1, 1], intensity: 1 },
      { kind: 'point', color: [1, 1, 1, 1], intensity: 1, range: undefined },
      {
        kind: 'spot',
        color: [1, 1, 1, 1],
        intensity: 0,
        range: undefined,
        innerConeAngleDegrees: 0,
        outerConeAngleDegrees: 45,
      },
    ]);
    expect(Array.from(scene.lights[1]!.model!)).toEqual(identity());
    expect(Array.from(scene.lights[2]!.model!)).toEqual(identity());
    expect(Array.from(scene.lights[4]!.model!)).toEqual(identity());
    expect(scene.lights.slice(2).map(light => light.castShadow)).toEqual([
      true,
      true,
      true,
    ]);
    expect(scene.lights.slice(2).every(light => light.identity !== undefined))
      .toBe(true);
    expect('castShadow' in scene.lights[0]!).toBe(false);
    expect('castShadow' in scene.lights[1]!).toBe(false);
  });

  it('keeps direct-light shadow identity stable while snapshotting participation', () => {
    let completed: ReturnType<typeof closeWebGLSceneComposer> | undefined;
    const root = <DirectionalLight style={{ castShadow: false }} />;
    const mounted = mountComposingScene(root, scene => {
      completed = scene;
    });
    executeBackendCRC(mounted.mount, root, 1);
    const first = completed!.lights[0]!;
    executeBackendCRC(mounted.mount, root, 2);
    const second = completed!.lights[0]!;

    expect(first.castShadow).toBe(false);
    expect(second.identity).toBe(first.identity);
    mounted.dispose();
  });

  it.each([
    [createElement(AmbientLight, { style: { intensity: Number.NaN } }), /AmbientLight.*intensity.*finite/i],
    [createElement(DirectionalLight, { style: { intensity: -1 } }), /DirectionalLight.*intensity.*nonnegative/i],
    [createElement(PointLight, { style: { range: Number.POSITIVE_INFINITY } }), /PointLight.*range.*finite/i],
    [createElement(PointLight, { style: { range: 0 } }), /PointLight.*range.*positive/i],
    [createElement(SpotLight, { style: { innerConeAngleDegrees: Number.NaN } }), /SpotLight.*innerConeAngleDegrees.*finite/i],
    [createElement(SpotLight, { style: { innerConeAngleDegrees: -1 } }), /SpotLight.*innerConeAngleDegrees.*between 0 and 90/i],
    [createElement(SpotLight, { style: { outerConeAngleDegrees: 91 } }), /SpotLight.*outerConeAngleDegrees.*between 0 and 90/i],
    [createElement(SpotLight, { style: { innerConeAngleDegrees: 50, outerConeAngleDegrees: 40 } }), /SpotLight.*innerConeAngleDegrees.*not exceed.*outerConeAngleDegrees/i],
    [createElement(AmbientLight, { style: { color: 'currentColor' } }), /AmbientLight.*color.*contextual/i],
    [createElement(HemisphereLight, { style: { skyColor: 'not-a-color' } }), /HemisphereLight.*skyColor.*concrete/i],
    [createElement(DirectionalLight, { style: { castShadow: 'yes' } } as never), /DirectionalLight.*castShadow.*boolean/i],
  ])('rejects invalid light input before submission %#', (root, message) => {
    expect(() => compose(root)).toThrowError(message);
  });

  it.each([
    ['PointLight', <PointLight style={{ range: Number.MIN_VALUE }} />],
    ['SpotLight', <SpotLight style={{ range: Number.MIN_VALUE }} />],
  ])('rejects a %s range that cannot remain positive through settlement',
    (_name, root) => {
      expect(() => settleComposition(root)).toThrowError(
        /style\.range.*finite.*positive.*Float32/i,
      );
    });

  it('rejects unknown own props and style fields from untyped callers', () => {
    expect(() => compose(createElement(
      AmbientLight,
      { onClick() {} } as never,
    ))).toThrow(/AmbientLight.*prop\.onClick.*not supported/i);
    expect(() => compose(createElement(
      PointLight,
      { style: { distance: 10 } } as never,
    ))).toThrow(/PointLight.*style\.distance.*not supported/i);
    expect(() => compose(createElement(
      AmbientLight,
      { style: { translateX: 1 } } as never,
    ))).toThrow(/AmbientLight.*style\.translateX.*not supported/i);
  });

  it('keeps declaration props and styles closed at compile time', () => {
    type AmbientInput = PrimitiveInputOf<typeof AmbientLight>;
    type HemisphereInput = PrimitiveInputOf<typeof HemisphereLight>;
    type PointInput = PrimitiveInputOf<typeof PointLight>;
    type BackgroundInput = PrimitiveInputOf<typeof WebGLBackground>;
    const typeContract = () => {
      const ambient: AmbientInput = { style: { intensity: 0 } };
      const hemisphere: HemisphereInput = { style: { translateX: 1 } };
      const point: PointInput = { style: { rotationYDegrees: 45 } };
      const background: BackgroundInput = { style: { color: '#000' } };
      const ambientChild: AmbientInput = {
        // @ts-expect-error Light declarations do not accept children.
        children: <Mesh geometry={geometry} />,
      };
      const ambientEvent: AmbientInput = {
        // @ts-expect-error Light declarations do not accept event handlers.
        onClick() {},
      };
      const pointFocus: PointInput = {
        // @ts-expect-error Light declarations do not accept focus props.
        keyboardFocusable: true,
      };
      const pointPointer: PointInput = {
        // @ts-expect-error Light declarations do not accept pointer participation.
        pointerEvents: 'none',
      };
      const pointCursor: PointInput = {
        style: {
          // @ts-expect-error Light declarations do not accept cursor styles.
          cursor: 'pointer',
        },
      };
      const pointFilter: PointInput = {
        style: {
          // @ts-expect-error Inner WebGL declarations do not accept Canvas filters.
          filter: { type: 'blur', radius: 1 },
        },
      };
      const ambientTransform: AmbientInput = {
        style: {
          // @ts-expect-error AmbientLight is transform-free.
          translateX: 1,
        },
      };
      return {
        ambient,
        hemisphere,
        point,
        background,
        ambientChild,
        ambientEvent,
        pointFocus,
        pointPointer,
        pointCursor,
        pointFilter,
        ambientTransform,
      };
    };
    void typeContract;
  });
});

function mountComposingScene(
  root: CRCNode,
  complete: (scene: ReturnType<typeof closeWebGLSceneComposer>) => void,
) {
  const driver: CRCBackendDriver<WebGLSceneComposer> = {
    token: WEBGL_BACKEND_TOKEN,
    name: 'webgl-test-composer',
    beginFrame(frame) {
      return { environment: createWebGLSceneComposer({
        frame,
        camera: resolveCamera(undefined, frame.logicalWidth, frame.logicalHeight),
        contextGeneration: 1,
        shadowQuality: 'medium',
      } as any) };
    },
    enterComponent() { return () => undefined; },
    runPrimitive(frame, input, runProgram) {
      const program = input.definition.program as CRCBackendPrimitiveProgram<
        Record<PropertyKey, unknown>,
        Record<PropertyKey, unknown>,
        WebGLSceneComposer
      >;
      runProgram(() => program(input.props, input.style, frame.environment));
    },
    finishFrame(frame, success) {
      if (success) complete(closeWebGLSceneComposer(frame.environment));
      else discardWebGLSceneComposer(frame.environment);
    },
    dispose() {},
  };
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const mount = mountBackendCRC(new OffscreenCanvas(16, 16), root, {
    parent: parentCanvas,
    logicalWidth: 16,
    logicalHeight: 16,
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

function compose(root: CRCNode) {
  return runComposition(root, closeWebGLSceneComposer);
}

function settleComposition(root: CRCNode) {
  return runComposition(root, settleWebGLScene);
}

function runComposition<T>(
  root: CRCNode,
  complete: (composer: WebGLSceneComposer) => T,
): T {
  let completed: T | undefined;
  const driver: CRCBackendDriver<WebGLSceneComposer> = {
    token: WEBGL_BACKEND_TOKEN,
    name: 'webgl-test-composer',
    beginFrame(frame) {
      return {
        environment: createWebGLSceneComposer({
          frame,
          camera: resolveCamera(undefined, frame.logicalWidth, frame.logicalHeight),
          contextGeneration: 1,
        }),
      };
    },
    enterComponent() {
      return () => undefined;
    },
    runPrimitive(frame, input, runProgram) {
      const program = input.definition.program as CRCBackendPrimitiveProgram<
        Record<PropertyKey, unknown>,
        Record<PropertyKey, unknown>,
        WebGLSceneComposer
      >;
      runProgram(() => program(input.props, input.style, frame.environment));
    },
    finishFrame(frame, success) {
      if (success) completed = complete(frame.environment);
      else discardWebGLSceneComposer(frame.environment);
    },
    dispose() {},
  };
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const mount = mountBackendCRC(new OffscreenCanvas(16, 16), root, {
    parent: parentCanvas,
    logicalWidth: 16,
    logicalHeight: 16,
    driver,
  });
  try {
    executeBackendCRC(mount, root, 1);
    if (!completed) throw new Error('test composer did not complete');
    return completed;
  } finally {
    mount.dispose();
    parent.dispose();
  }
}

function identity(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function translation(x: number, y: number, z: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}
