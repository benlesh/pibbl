import { crc, createElement, type CRCController, type CRCNode } from '@crc/core';
import {
  crcInternalCreatePropAttachment,
  type CRCInternalMountedPropAttachment,
  type CRCInternalPrimitiveAttachmentInput,
} from '@crc/core/internal';
import type {
  CubeProps,
  Group3DProps,
  MeshProps,
  SphereProps,
  WebGLLayerProps,
} from '@crc/webgl';
import type {
  CRCWebGLPhysicsPrimitiveFacts,
} from '@crc/webgl/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';

const publicEntry = await import(
  /* @vite-ignore */ new URL('../dist/index.mjs', import.meta.url).href
) as typeof import('@crc/webgl');
const internalEntry = await import(
  /* @vite-ignore */ new URL('../dist/internal.mjs', import.meta.url).href
) as typeof import('@crc/webgl/internal');
const {
  Cube,
  Group3D,
  Mesh,
  Sphere,
  WebGLLayer,
  createWebGLGeometry,
} = publicEntry;
const {
  getWebGLGeometrySnapshot,
  pushPhysicsPresentation,
  resolveWebGLPhysicsPrimitive,
} = internalEntry;

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('built @crc/webgl cross-entry identity', () => {
  it('snapshots geometry created through the public root', () => {
    const geometry = createWebGLGeometry({
      positions: [-1, -2, 0, 3, -2, 0, 0, 4, 1],
      indices: [0, 1, 2],
    });

    expect(getWebGLGeometrySnapshot(geometry)).toEqual({
      positions: [-1, -2, 0, 3, -2, 0, 0, 4, 1],
      indices: [0, 1, 2],
      bounds: {
        minimumX: -1,
        minimumY: -2,
        minimumZ: 0,
        maximumX: 3,
        maximumY: 4,
        maximumZ: 1,
      },
    });
  });

  it('uses the public WebGLLayer backend token for an internal presentation scope', () => {
    const trace: string[] = [];
    const physics = createAttachment({
      prepare() {
        trace.push('prepare');
        return pushPhysicsPresentation(identity());
      },
    });
    const group = createElement(Group3D, {
      physics,
      children: undefined,
    } as unknown as Group3DProps);

    renderBuiltScene(group);

    expect(trace).toEqual(['prepare']);
  });

  it('resolves public built-in receiver identities through the internal entry', () => {
    const facts: CRCWebGLPhysicsPrimitiveFacts[] = [];
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const attachment = () => createAttachment({
      prepare(input) {
        facts.push(resolveWebGLPhysicsPrimitive(input));
      },
    });
    const root = createElement(Group3D, {
      physics: attachment(),
      children: [
        createElement(Cube, {
          physics: attachment(),
          style: { lit: false },
        } as unknown as CubeProps),
        createElement(Sphere, {
          physics: attachment(),
          style: { lit: false },
        } as unknown as SphereProps),
        createElement(Mesh, {
          physics: attachment(),
          geometry,
          style: { lit: false },
        } as unknown as MeshProps),
      ],
    } as unknown as Group3DProps);

    renderBuiltScene(root);

    expect(facts.map(fact => fact.kind)).toEqual([
      'group',
      'cube',
      'sphere',
      'mesh',
    ]);
    const mesh = facts[3];
    expect(mesh?.kind).toBe('mesh');
    if (mesh?.kind !== 'mesh') throw new Error('Expected Mesh facts.');
    expect(mesh.geometry).toBe(geometry);
  });
});

function createAttachment(options: Readonly<{
  prepare(input: CRCInternalPrimitiveAttachmentInput): (() => void) | void;
}>): object {
  const value = Object.freeze({ kind: 'built-cross-entry-probe' });
  return crcInternalCreatePropAttachment('physics', value, () => {
    let release: (() => void) | undefined;
    const mounted: CRCInternalMountedPropAttachment = {
      update() {},
      enter() {},
      preparePrimitive(input) {
        release = options.prepare(input) ?? undefined;
      },
      exit() {
        release?.();
        release = undefined;
      },
      dispose() {},
    };
    return mounted;
  });
}

function renderBuiltScene(children: CRCNode): void {
  installComponentPlatform();
  vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
    .mockImplementation(() => undefined);
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frame = callback;
    return 1;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 50;
  document.body.appendChild(canvas);
  const layer = createElement(WebGLLayer, {
    style: { shadows: false },
    children,
  } as unknown as WebGLLayerProps);
  const controller = crc(canvas, layer, { pixelRatio: 1 });
  controllers.add(controller);
  expect(frame).toBeDefined();
  frame!(1);
}

function installComponentPlatform(): void {
  const gl = createNoopGL();
  const bitmap = {
    width: 1,
    height: 1,
    close: vi.fn(),
  } as unknown as ImageBitmap;
  class RecordingOffscreenCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext(): WebGL2RenderingContext {
      return gl;
    }

    transferToImageBitmap(): ImageBitmap {
      return bitmap;
    }
  }
  vi.stubGlobal('OffscreenCanvas', RecordingOffscreenCanvas);
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
            property === 'getContextAttributes' ? () => ({
              alpha: true,
              antialias: false,
              depth: true,
              desynchronized: false,
              failIfMajorPerformanceCaveat: false,
              powerPreference: 'default',
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
              stencil: false,
              xrCompatible: false,
            }) : property === 'getShaderParameter' ||
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

function identity(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}
