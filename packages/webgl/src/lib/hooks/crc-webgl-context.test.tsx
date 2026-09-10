import {
  crc,
  definePrimitive,
  measureElement,
  type CRCNode,
} from '@crc/core';
import { executeBackendCRC, mountBackendCRC } from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebGLBackend } from '../backend.js';
import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import { resolveCamera } from '../math/camera.js';
import type {
  CRCWebGLContext,
  CRCWebGLTransformStyle,
} from '../types.js';
import { crcWebGLContext } from './crc-webgl-context.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('crcWebGLContext', () => {
  it('reports targeted errors outside a WebGL primitive, under Canvas 2D, and during measurement', () => {
    expect(() => crcWebGLContext()).toThrowError(
      /crcWebGLContext.*only.*WebGL primitive.*render/i,
    );

    const CanvasProbe = definePrimitive(function renderCanvasProbe() {
      crcWebGLContext();
    });
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100px;height:50px';
    document.body.appendChild(canvas);
    const controller = crc(canvas, <CanvasProbe />);
    expect(() => callbacks[0]!(1)).toThrowError(
      /crcWebGLContext.*Canvas 2D.*WebGLLayer/i,
    );
    controller.dispose();

    const Measured = definePrimitive(function renderMeasured() {}, {
      measure() {
        crcWebGLContext();
        return { status: 'measured', size: { width: 1, height: 1 } };
      },
    });
    expect(() => measureElement(<Measured />, {
      minWidth: 0,
      maxWidth: 10,
      minHeight: 0,
      maxHeight: 10,
    }, {
      measureText: () => ({ width: 0 }) as TextMetrics,
    })).toThrowError(/crcWebGLContext.*measurement.*not available/i);
  });

  it('exposes immutable per-callback frame and model snapshots', () => {
    const gl = createNoopGL();
    const camera = resolveCamera(undefined, 30, 15);
    let argumentContext: CRCWebGLContext | undefined;
    let hookContext: CRCWebGLContext | undefined;
    const Probe = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderContextProbe(_props, _style, context) {
        argumentContext = context;
        hookContext = crcWebGLContext();
      },
      { hit: { kind: 'none' } },
    );
    const mounted = mountScene(gl, <Probe pointerEvents="none" />, {
      camera,
      generation: () => 7,
    });

    executeBackendCRC(mounted.mount, mounted.root, 123.5);

    expect(hookContext).toBe(argumentContext);
    expect(argumentContext).toMatchObject({
      gl,
      contextGeneration: 7,
      logicalViewport: { width: 30, height: 15 },
      backingViewport: { width: 90, height: 30 },
      density: { x: 3, y: 2 },
      timestamp: 123.5,
    });
    expect(Array.from(argumentContext!.modelMatrix)).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    expect(argumentContext!.camera).not.toBe(camera);
    expect(argumentContext!.camera.projectionViewMatrix)
      .not.toBe(camera.projectionViewMatrix);
    mounted.dispose();
  });

  it('retains equal dependencies and releases before dependency or generation replacement', () => {
    const gl = createNoopGL();
    let generation = 1;
    const calls: string[] = [];
    let nextResource = 0;
    const Resource = defineWebGLPrimitive<{
      dependency: string;
    }, CRCWebGLTransformStyle>(
      function renderResource({ dependency }, _style, context) {
        context.resources.use(
          () => {
            const value = `resource-${++nextResource}`;
            calls.push(`create:${value}`);
            return value;
          },
          (value, releaseContext) => {
            calls.push(`release:${value}:lost=${releaseContext.contextLost}`);
          },
          [dependency],
        );
      },
      { hit: { kind: 'none' } },
    );
    const root = (dependency: string) =>
      <Resource key="stable" dependency={dependency} pointerEvents="none" />;
    const mounted = mountScene(gl, root('a'), {
      generation: () => generation,
    });

    executeBackendCRC(mounted.mount, root('a'), 1);
    executeBackendCRC(mounted.mount, root('a'), 2);
    executeBackendCRC(mounted.mount, root('b'), 3);
    generation = 2;
    executeBackendCRC(mounted.mount, root('b'), 4);
    executeBackendCRC(mounted.mount, undefined, 5);

    expect(calls).toEqual([
      'create:resource-1',
      'release:resource-1:lost=false',
      'create:resource-2',
      'release:resource-2:lost=false',
      'create:resource-3',
      'release:resource-3:lost=false',
    ]);
    mounted.dispose();
  });

  it('reports context loss to the exact final resource release', () => {
    const gl = createNoopGL();
    let lost = false;
    const releases: Array<{ id: number; contextLost: boolean }> = [];
    const Resource = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderLostResource(_props, _style, context) {
        context.resources.use(
          () => ({ id: 1 }),
          (value, releaseContext) => releases.push({
            id: value.id,
            contextLost: releaseContext.contextLost,
          }),
          [],
        );
      },
      { hit: { kind: 'none' } },
    );
    const mounted = mountScene(gl, <Resource pointerEvents="none" />, {
      isContextLost: () => lost,
    });

    executeBackendCRC(mounted.mount, mounted.root, 1);
    lost = true;
    mounted.dispose();

    expect(releases).toEqual([{ id: 1, contextLost: true }]);
  });
});

function mountScene(
  gl: WebGL2RenderingContext,
  root: CRCNode,
  options: {
    readonly camera?: ReturnType<typeof resolveCamera>;
    readonly generation?: () => number;
    readonly isContextLost?: (generation: number) => boolean;
  } = {},
) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const camera = options.camera ?? resolveCamera(undefined, 30, 15);
  const driver = createWebGLBackend({
    gl,
    getCamera: () => camera,
    getContextGeneration: options.generation ?? (() => 1),
    isContextLost: options.isContextLost,
  });
  const mount = mountBackendCRC(new OffscreenCanvas(90, 30), root, {
    parent: parentCanvas,
    logicalWidth: 30,
    logicalHeight: 15,
    driver,
  });
  return {
    root,
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
      if (property === 'isContextLost') return () => false;
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 : () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}
