import { crc, type CRCNode } from '@crc/core';
import type { CRCPhysicsAttachment3D } from '@crc/physics/3d';
import {
  crcInternalCreatePropAttachment,
  defineBackendPrimitive,
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendFrame,
  type CRCInternalMountedPropAttachment,
} from '@crc/core/internal';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import { describe, expect, it } from 'vitest';
import * as publicWebGL from '../index.js';
import {
  getWebGLGeometrySnapshot,
  pushPhysicsPresentation,
  resolveWebGLPhysicsPrimitive,
  type CRCWebGLPhysicsPrimitiveFacts,
} from '@crc/webgl/internal';
import { createWebGLBackend, WEBGL_BACKEND_TOKEN } from './backend.js';
import { Cube } from './components/cube.js';
import { Group3D } from './components/group-3d.js';
import { Mesh } from './components/mesh.js';
import { Sphere } from './components/sphere.js';
import { createWebGLGeometry } from './geometry/geometry.js';
import { resolveCamera } from './math/camera.js';
import type {
  WebGLMeshSubmission,
  WebGLSceneComposer,
} from './scene/types.js';

interface TestPhysicsAttachment {
  readonly label: string;
}

describe('WebGL physics friend seam', () => {
  it('keeps friend values out of the public root and returns isolated geometry copies', () => {
    expect(Object.keys(publicWebGL).sort()).toEqual([
      'Cube',
      'Group3D',
      'Mesh',
      'Sphere',
      'WebGLLayer',
      'crcAnimationFrame',
      'createWebGLGeometry',
    ]);
    const geometry = createWebGLGeometry({
      positions: [-2, -1, 0, 2, -1, 0, 0, 3, 1],
      indices: [0, 1, 2],
    });

    const first = getWebGLGeometrySnapshot(geometry);
    const second = getWebGLGeometrySnapshot(geometry);

    expect(first).toEqual({
      positions: [-2, -1, 0, 2, -1, 0, 0, 3, 1],
      indices: [0, 1, 2],
      bounds: {
        minimumX: -2,
        minimumY: -1,
        minimumZ: 0,
        maximumX: 2,
        maximumY: 3,
        maximumZ: 1,
      },
    });
    expect(first).not.toBe(second);
    expect(first.positions).not.toBe(second.positions);
    expect(first.indices).not.toBe(second.indices);
    expect(first.bounds).not.toBe(second.bounds);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.positions)).toBe(true);
    expect(Object.isFrozen(first.indices)).toBe(true);
    expect(Object.isFrozen(first.bounds)).toBe(true);
  });

  it('resolves exact supported-primitive facts and excludes presentation from authored lineage', () => {
    const facts = new Map<string, CRCWebGLPhysicsPrimitiveFacts>();
    const releases: (() => void)[] = [];
    const triangle = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const attachment = (label: string, presentationX = 0) =>
      createAttachment(label, facts, releases, presentationX);
    const root = (
      <Group3D
        physics={attachment('group', 1)}
        style={{
          translateX: 1,
          translateY: 2,
          translateZ: 3,
          rotationZDegrees: 90,
          scaleX: 2,
          scaleY: 3,
          scaleZ: 4,
        }}
      >
        <Cube
          physics={attachment('cube')}
          keyboardFocusable
          style={{ size: 2, translateX: 0.25, scaleX: 0.5 }}
        />
        <Sphere
          physics={attachment('sphere')}
          style={{ radius: 2, scaleY: 0.5 }}
        />
        <Mesh
          physics={attachment('mesh')}
          geometry={triangle}
          style={{ translateZ: 7, scaleZ: -2 }}
        />
      </Group3D>
    );
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 1);

    const group = facts.get('group')!;
    expect(group.kind).toBe('group');
    expect(group.authoredParentLineage).toEqual([]);
    expect(group.localTransform.translation).toEqual([1, 2, 3]);
    expectTupleClose(group.localTransform.orientation, [
      0,
      0,
      Math.SQRT1_2,
      Math.SQRT1_2,
    ]);
    expect(group.localTransform.scale).toEqual([2, 3, 4]);

    const cube = facts.get('cube')!;
    const sphere = facts.get('sphere')!;
    const mesh = facts.get('mesh')!;
    expect(cube.kind).toBe('cube');
    expect(sphere.kind).toBe('sphere');
    expect(mesh.kind).toBe('mesh');
    for (const fact of [cube, sphere, mesh]) {
      expect(fact.authoredParentLineage).toHaveLength(1);
      expect(fact.authoredParentLineage[0]).toBe(group.localTransform);
      expect(Object.isFrozen(fact.authoredParentLineage)).toBe(true);
    }
    expect(cube.localTransform.translation).toEqual([0.25, 0, 0]);
    expect(cube.localTransform.scale).toEqual([1, 2, 2]);
    expectTupleClose(cube.localTransform.matrix, [
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 2, 0,
      0.25, 0, 0, 1,
    ]);
    expect(sphere.localTransform.scale).toEqual([4, 2, 4]);
    expect(mesh.localTransform.scale).toEqual([1, 1, -2]);
    if (cube.kind !== 'cube' || sphere.kind !== 'sphere' || mesh.kind !== 'mesh') {
      throw new Error('Expected geometric primitive facts.');
    }
    expect(cube.geometry).not.toBe(sphere.geometry);
    expect(mesh.geometry).toBe(triangle);
    expect(mesh.geometrySnapshot).toEqual(getWebGLGeometrySnapshot(triangle));

    const completed = mounted.driver.takeCompletedFrame();
    const cubeSubmission = mounted.submissions[0]!;
    const cubePick = completed.pickEntries[0]!;
    expectTupleClose(Array.from(cubeSubmission.model), [
      0, 2, 0, 0,
      -6, 0, 0, 0,
      0, 0, 8, 0,
      2, 2.5, 3, 1,
    ]);
    expect(Array.from(cubeSubmission.model)).toEqual(Array.from(cubePick.model));
    expect(cubePick.keyboardNavigationPoints).toBeDefined();
    // Presentation translates the settled model but is absent from authored facts.
    expect(cubeSubmission.model[12]).toBeCloseTo(2, 6);
    expect(cubeSubmission.model[13]).toBeCloseTo(2.5, 6);
    expect(group.authoredParentLineage).toEqual([]);
    expect(releases).toHaveLength(0);
    expect(mounted.glCallsAtSettlement).toEqual([0]);
    expect(mounted.glCalls.length).toBeGreaterThan(0);
    mounted.dispose();
  });

  it('unwinds authored and presentation scopes when a descendant throws', () => {
    const facts = new Map<string, CRCWebGLPhysicsPrimitiveFacts>();
    const releases: (() => void)[] = [];
    const failure = new Error('descendant failed');
    const Throwing = defineBackendPrimitive<{}, {}, {}, {}, WebGLSceneComposer>(
      WEBGL_BACKEND_TOKEN,
      function renderThrowing() {
        throw failure;
      },
    );
    const root = (
      <Group3D physics={createAttachment('group', facts, releases, 4)}>
        <Throwing />
      </Group3D>
    );
    const mounted = mountScene(root);

    expect(() => executeBackendCRC(mounted.mount, root, 1)).toThrow(failure);
    expect(mounted.failedDepths).toEqual([{ model: 1, authored: 0 }]);
    expect(releases).toHaveLength(0);
    expect(mounted.glCalls).toEqual([]);
    mounted.dispose();
  });

  it('rejects unsupported receivers by component identity with source context', () => {
    const facts = new Map<string, CRCWebGLPhysicsPrimitiveFacts>();
    const releases: (() => void)[] = [];
    const Unsupported = defineBackendPrimitive<{}, {}, {}, {}, WebGLSceneComposer>(
      WEBGL_BACKEND_TOKEN,
      function renderUnsupported() {},
    );
    const physics = createAttachment('unsupported', facts, releases);
    const element = jsxDEV(
      Unsupported,
      { physics } as {},
      undefined,
      false,
      {
        fileName: '/app/unsupported-webgl.tsx',
        lineNumber: 12,
        columnNumber: 7,
      },
      undefined,
    );
    const mounted = mountScene(element);

    expect(() => executeBackendCRC(mounted.mount, element, 1))
      .toThrowError(
        /Unsupported.*supported WebGL physics primitive.*unsupported-webgl\.tsx:12:7/i,
      );
    mounted.dispose();
  });
});

function createAttachment(
  label: string,
  facts: Map<string, CRCWebGLPhysicsPrimitiveFacts>,
  releases: (() => void)[],
  presentationX = 0,
): TestPhysicsAttachment & CRCPhysicsAttachment3D {
  const value = Object.freeze({ label });
  return crcInternalCreatePropAttachment('physics', value, () => {
    let release: (() => void) | undefined;
    const mounted: CRCInternalMountedPropAttachment = {
      update() {},
      enter() {},
      preparePrimitive(input) {
        facts.set(label, resolveWebGLPhysicsPrimitive(input));
        if (presentationX !== 0) {
          release = pushPhysicsPresentation(translation(presentationX, 0, 0));
          releases.push(release);
        }
      },
      exit() {
        if (!release) return;
        release();
        releases.splice(releases.indexOf(release), 1);
        release = undefined;
      },
      dispose() {},
    };
    return mounted;
  }) as TestPhysicsAttachment & CRCPhysicsAttachment3D;
}

function mountScene(root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const glCalls: string[] = [];
  const gl = createRecordingGL(glCalls);
  const baseDriver = createWebGLBackend({
    gl,
    getCamera: () => resolveCamera(undefined, 20, 10),
    getContextGeneration: () => 1,
    isContextLost: () => false,
  });
  const submissions: WebGLMeshSubmission[] = [];
  const glCallsAtSettlement: number[] = [];
  const failedDepths: Array<{ model: number; authored: number }> = [];
  const driver = {
    ...baseDriver,
    finishFrame(
      frame: CRCBackendFrame<WebGLSceneComposer>,
      success: boolean,
    ) {
      if (success) {
        glCallsAtSettlement.push(glCalls.length);
        submissions.push(...frame.environment.meshes);
      } else {
        failedDepths.push({
          model: frame.environment.modelStack.length,
          authored: frame.environment.authoredTransformStack.length,
        });
      }
      baseDriver.finishFrame(frame, success);
    },
  };
  const mount = mountBackendCRC(new OffscreenCanvas(40, 20), root, {
    parent: parentCanvas,
    logicalWidth: 20,
    logicalHeight: 10,
    driver,
  });
  return {
    mount,
    driver,
    submissions,
    glCalls,
    glCallsAtSettlement,
    failedDepths,
    dispose() {
      mount.dispose();
      parent.dispose();
    },
  };
}

function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

function createRecordingGL(trace: string[]): WebGL2RenderingContext {
  let constant = 1;
  let handle = 0;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? recording(property, () => 8) :
            property === 'getShaderParameter' ||
            property === 'getProgramParameter' ? recording(property, () => true) :
              property === 'getShaderInfoLog' ||
              property === 'getProgramInfoLog' ? recording(property, () => '') :
                property === 'getUniformLocation' ?
                  recording(property, (_program: object, name: string) => ({ name })) :
                  property === 'createShader' ||
                  property === 'createProgram' ||
                  property === 'createVertexArray' ||
                  property === 'createBuffer' ?
                    recording(property, () => ({ kind: property, id: ++handle })) :
                    property === 'isContextLost' ? recording(property, () => false) :
                      recording(property, () => undefined);
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;

  function recording<T extends unknown[], R>(
    name: string,
    callback: (...args: T) => R,
  ): (...args: T) => R {
    return (...args) => {
      trace.push(name);
      return callback(...args);
    };
  }
}

function expectTupleClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 14);
  });
}
