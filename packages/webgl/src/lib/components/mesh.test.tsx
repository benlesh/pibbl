import {
  crc,
  type CRCNode,
  type PrimitiveInputOf,
} from '@crc/core';
import { executeBackendCRC, mountBackendCRC } from '@crc/core/internal';
import { describe, expect, it, vi } from 'vitest';
import {
  Cube,
  Mesh,
  Sphere,
  createWebGLGeometry,
  type MeshStyle,
} from '../../index.js';
import { createWebGLBackend } from '../backend.js';
import { resolveCamera } from '../math/camera.js';
import type { CRCWebGLGeometryPickRecord } from '../pick-ledger.js';

describe('Mesh built-in rendering', () => {
  it('settles transformed built-ins once, draws opaque before transparent, and omits zero alpha', () => {
    const recording = createDrawGL();
    const triangle = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const root = [
      <Mesh
        key="mesh"
        geometry={triangle}
        style={{
          translateX: 2,
          rotationZDegrees: 90,
          scaleX: 2,
          scaleY: 3,
          scaleZ: 4,
          color: 'rgba(255, 0, 128, 0.5)',
          opacity: 0.5,
          lit: false,
        }}
      />,
      <Cube
        key="cube"
        style={{ size: 2, translateY: 1, scaleX: 0.5, lit: false }}
      />,
      <Sphere
        key="sphere"
        onClick={() => undefined}
        keyboardFocusable
        style={{
          radius: 2,
          translateZ: -1,
          scaleZ: 0.5,
          opacity: 0,
          lit: false,
        }}
      />,
    ];
    const mounted = mountScene(recording.gl, root);

    executeBackendCRC(mounted.mount, root, 10);

    expect(recording.clears).toEqual([
      recording.constants.COLOR_BUFFER_BIT |
      recording.constants.DEPTH_BUFFER_BIT,
    ]);
    expect(recording.draws.map(draw => [draw.kind, draw.count])).toEqual([
      ['elements', 36],
      ['arrays', 3],
    ]);
    expectMatrix(recording.draws[0]!.model, [
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 2, 0,
      0, 1, 0, 1,
    ]);
    expectMatrix(recording.draws[1]!.model, [
      0, 2, 0, 0,
      -3, 0, 0, 0,
      0, 0, 4, 0,
      2, 0, 0, 1,
    ]);
    expect(recording.draws[0]!.color).toEqual([1, 1, 1, 1]);
    expect(recording.draws[1]!.color).toEqual([
      1,
      0,
      128 / 255,
      (128 / 255) * 0.5,
    ]);
    for (const draw of recording.draws) {
      expect(draw.enabled).toContain(recording.constants.DEPTH_TEST);
      expect(draw.enabled).not.toContain(recording.constants.CULL_FACE);
      expect(draw.depthFunction).toBe(recording.constants.LEQUAL);
      expect(draw.view).toHaveLength(16);
      expect(draw.projection).toHaveLength(16);
    }
    const completed = mounted.driver.takeCompletedFrame();
    const picks = completed.pickEntries as readonly CRCWebGLGeometryPickRecord[];
    expect(picks.map(entry => entry.sourceOrder)).toEqual([0, 1, 2]);
    expectMatrix(picks[0]!.model, [
      0, 2, 0, 0,
      -3, 0, 0, 0,
      0, 0, 4, 0,
      2, 0, 0, 1,
    ]);
    expectMatrix(picks[1]!.model, [
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 2, 0,
      0, 1, 0, 1,
    ]);
    expectMatrix(picks[2]!.model, [
      4, 0, 0, 0,
      0, 4, 0, 0,
      0, 0, 2, 0,
      0, 0, -1, 1,
    ]);
    expect(picks[2]!.target.keyboardFocusable).toBe(true);
    expect(picks[2]!.target.live).toBe(true);

    mounted.dispose();
  });

  it.each([
    [{ color: 'not-a-concrete-color' }, /Mesh.*color.*concrete/i],
    [{ opacity: -0.01 }, /Mesh.*opacity.*between 0 and 1/i],
    [{ opacity: 1.01 }, /Mesh.*opacity.*between 0 and 1/i],
    [{ opacity: Number.NaN }, /Mesh.*opacity.*finite/i],
    [{ castShadow: 'yes' }, /Mesh.*castShadow.*boolean/i],
    [{ receiveShadow: 1 }, /Mesh.*receiveShadow.*boolean/i],
  ] as const)('rejects invalid paint before acquiring GPU resources %#', (style, message) => {
    const recording = createDrawGL();
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const invalidStyle = runtimeInvalidMeshStyle({ ...style, lit: false });
    const root = <Mesh geometry={geometry} style={invalidStyle} />;
    const mounted = mountScene(recording.gl, root);

    expect(() => executeBackendCRC(mounted.mount, root, 1))
      .toThrowError(message);
    expect(recording.draws).toEqual([]);
    expect(recording.createProgram).not.toHaveBeenCalled();

    mounted.dispose();
  });

  it.each([
    'CanvasText',
    'Mark',
    'currentColor',
    'color-mix(in srgb, currentColor, red)',
    'rgb(from currentColor r g b)',
    'color-mix(in srgb, rgb(from curr\\65 ntColor r g b), red)',
    'light-dark(red, blue)',
    'color-mix(in srgb, l\\69 ght-dark(red, blue), black)',
    'env(--mesh-color, red)',
    'attr(data-mesh-color type(<color>), red)',
    'var(--mesh-color, red)',
    'initial',
    'color-mix(in srgb, red, inherit)',
    'color-mix(in srgb, red, unset)',
    'color-mix(in srgb, red, revert)',
    'color-mix(in srgb, red, revert-layer)',
  ])(
    'rejects contextual color %s before acquiring GPU resources',
    color => {
      const recording = createDrawGL();
      const geometry = createWebGLGeometry({
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      });
      const root = <Mesh geometry={geometry} style={{ color, lit: false }} />;
      const mounted = mountScene(recording.gl, root);

      expect(() => executeBackendCRC(mounted.mount, root, 1))
        .toThrowError(/Mesh.*style\.color.*contextual/i);
      expect(recording.draws).toEqual([]);
      expect(recording.createProgram).not.toHaveBeenCalled();
      expect(recording.createVertexArray).not.toHaveBeenCalled();
      expect(recording.createBuffer).not.toHaveBeenCalled();

      mounted.dispose();
    },
  );

  it.each([
    'red) blur(100px',
    'rgb(0 0 0',
    'color-mix(in srgb, red, blue]]',
  ])(
    'rejects malformed color boundary %s before acquiring GPU resources',
    color => {
      const recording = createDrawGL();
      const geometry = createWebGLGeometry({
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      });
      const root = <Mesh geometry={geometry} style={{ color, lit: false }} />;
      const mounted = mountScene(recording.gl, root);

      expect(() => executeBackendCRC(mounted.mount, root, 1))
        .toThrowError(/Mesh.*style\.color.*balanced.*boundary/i);
      expect(recording.createProgram).not.toHaveBeenCalled();
      expect(recording.createVertexArray).not.toHaveBeenCalled();
      expect(recording.createBuffer).not.toHaveBeenCalled();

      mounted.dispose();
    },
  );

  it.each([
    'red',
    '#1234',
    'rgb(1 2 3 / 50%)',
    'hsl(120 50% 50%)',
    'hwb(120 10% 20%)',
    'lab(50% 20 30)',
    'lch(50% 20 30)',
    'oklab(50% .1 .1)',
    'oklch(50% .1 30)',
    'color(display-p3 1 0 0)',
    'color-mix(in srgb, red, blue)',
    'rgb(from red r g b)',
    'color-mix(in srgb, red, /* currentColor light-dark(red, blue) ) */ blue)',
  ])('accepts concrete browser color %s', color => {
    const recording = createDrawGL();
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const root = <Mesh geometry={geometry} style={{ color, lit: false }} />;
    const mounted = mountScene(recording.gl, root);

    expect(() => executeBackendCRC(mounted.mount, root, 1)).not.toThrow();
    expect(recording.draws).toHaveLength(1);

    mounted.dispose();
  });

  it.each([
    'color-mix(in srgb, red, "currentColor)")',
    'r\\29 ed',
    'currentColorful',
    'CanvasTexture',
    'Marking',
  ])(
    'leaves non-token contextual text %s to browser color validation',
    color => {
      const recording = createDrawGL();
      const geometry = createWebGLGeometry({
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      });
      const root = <Mesh geometry={geometry} style={{ color, lit: false }} />;
      const mounted = mountScene(recording.gl, root);

      let error: unknown;
      try {
        executeBackendCRC(mounted.mount, root, 1);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(TypeError);
      expect(String(error)).toMatch(/Mesh.*style\.color.*concrete Canvas color/i);
      expect(String(error)).not.toMatch(/contextual|balanced.*boundary/i);
      expect(recording.createProgram).not.toHaveBeenCalled();

      mounted.dispose();
    },
  );

  it('uses unit Cube and radius-0.5 Sphere defaults without extra model scale', () => {
    const recording = createDrawGL();
    const root = [
      <Cube key="cube" style={{ lit: false }} />,
      <Sphere key="sphere" style={{ lit: false }} />,
    ];
    const mounted = mountScene(recording.gl, root);

    executeBackendCRC(mounted.mount, root, 1);

    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    expectMatrix(recording.draws[0]!.model, identity);
    expectMatrix(recording.draws[1]!.model, identity);
    expect(recording.draws.map(draw => draw.color)).toEqual([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ]);
    mounted.dispose();
  });

  it('keeps opacity-zero geometry on the interactive public branch', () => {
    type MeshInput = PrimitiveInputOf<typeof Mesh>;
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const typeContract = () => {
      const interactive: MeshInput = {
        geometry,
        onClick() {},
        pointerEvents: 'auto',
        keyboardFocusable: true,
        style: {
          opacity: 0,
          cursor: 'pointer',
          lit: false,
          material: { type: 'lambert', emissiveIntensity: 0 },
          castShadow: true,
          receiveShadow: false,
        },
      };
      const filtered: MeshInput = {
        geometry,
        style: {
          // @ts-expect-error WebGL mesh filters belong on WebGLLayer.
          filter: { type: 'blur', radius: 1 },
        },
      };
      return { interactive, filtered };
    };
    void typeContract;
  });

  it.each([
    ['default-lit black without lights', false, [0, 0, 0, 255]],
    ['explicit-unlit legacy color', true, [255, 0, 0, 255]],
  ] as const)('renders public %s through a real Chromium WebGL2 context', (
    _label,
    unlit,
    expected,
  ) => {
    const surface = new OffscreenCanvas(32, 32);
    const gl = surface.getContext('webgl2', {
      alpha: true,
      depth: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    expect(gl).not.toBeNull();
    const parentCanvas = document.createElement('canvas');
    const parent = crc(parentCanvas, undefined);
    const root = unlit ? (
      <Cube style={{ color: '#ff0000', lit: false }} />
    ) : (
      <Cube style={{ color: '#ff0000' }} />
    );
    const driver = createWebGLBackend({
      gl: gl!,
      getCamera: () => resolveCamera(undefined, 32, 32),
      getContextGeneration: () => 1,
    });
    const mount = mountBackendCRC(surface, root, {
      parent: parentCanvas,
      logicalWidth: 32,
      logicalHeight: 32,
      driver,
    });

    executeBackendCRC(mount, root, 1);
    const pixel = new Uint8Array(4);
    gl!.readPixels(16, 16, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);

    expect(gl!.getError()).toBe(gl!.NO_ERROR);
    expect(Array.from(pixel)).toEqual(expected);
    mount.dispose();
    parent.dispose();
  });
});

function runtimeInvalidMeshStyle(style: unknown): MeshStyle {
  return style as MeshStyle;
}

interface DrawRecord {
  readonly kind: 'arrays' | 'elements';
  readonly count: number;
  readonly model: readonly number[];
  readonly view: readonly number[];
  readonly projection: readonly number[];
  readonly color: readonly number[];
  readonly enabled: readonly number[];
  readonly depthFunction: number | undefined;
}

function mountScene(gl: WebGL2RenderingContext, root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const driver = createWebGLBackend({
    gl,
    getCamera: () => resolveCamera(undefined, 20, 10),
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
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 6);
  });
}

function createDrawGL() {
  const constants = createConstants();
  let nextHandle = 0;
  const handle = (kind: string, type?: number) => ({
    kind,
    type,
    id: ++nextHandle,
  });
  const enabled = new Set<number>();
  const uniforms = new Map<string, number[]>();
  let depthFunction: number | undefined;
  const draws: DrawRecord[] = [];
  const clears: number[] = [];
  const createProgram = vi.fn(() => handle('program'));
  const createVertexArray = vi.fn(() => handle('vertex-array'));
  const createBuffer = vi.fn(() => handle('buffer'));
  const recordDraw = (kind: DrawRecord['kind'], count: number) => {
    draws.push({
      kind,
      count,
      model: uniforms.get('u_model')?.slice() ?? [],
      view: uniforms.get('u_view')?.slice() ?? [],
      projection: uniforms.get('u_projection')?.slice() ?? [],
      color: uniforms.get('u_display_base_color')?.slice() ?? [],
      enabled: Array.from(enabled),
      depthFunction,
    });
  };
  const methods: Record<string, unknown> = {
    getParameter: () => 8,
    isContextLost: () => false,
    createShader: (type: number) => handle('shader', type),
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram,
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    getUniformLocation: (_program: object, name: string) => ({ name }),
    createVertexArray,
    createBuffer,
    enable(capability: number) {
      enabled.add(capability);
    },
    disable(capability: number) {
      enabled.delete(capability);
    },
    depthFunc(value: number) {
      depthFunction = value;
    },
    uniformMatrix4fv(
      location: { readonly name: string },
      _transpose: boolean,
      values: ArrayLike<number>,
    ) {
      uniforms.set(location.name, Array.from(values));
    },
    uniform4f(
      location: { readonly name: string },
      red: number,
      green: number,
      blue: number,
      alpha: number,
    ) {
      uniforms.set(location.name, [red, green, blue, alpha]);
    },
    drawElements(_mode: number, count: number) {
      recordDraw('elements', count);
    },
    drawArrays(_mode: number, _first: number, count: number) {
      recordDraw('arrays', count);
    },
    clear(mask: number) {
      clears.push(mask);
    },
  };
  const gl = new Proxy({ ...constants, ...methods }, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      if (property in target) return target[property as keyof typeof target];
      const noop = () => undefined;
      Object.assign(target, { [property]: noop });
      return noop;
    },
  }) as unknown as WebGL2RenderingContext;
  return {
    gl,
    constants,
    draws,
    clears,
    createProgram,
    createVertexArray,
    createBuffer,
  };
}

function createConstants(): Record<string, number> {
  const constants: Record<string, number> = {
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
  };
  const names = [
    'ALWAYS', 'ARRAY_BUFFER', 'BACK', 'BLEND', 'BROWSER_DEFAULT_WEBGL',
    'CCW', 'COMPILE_STATUS', 'CULL_FACE', 'DEPTH_TEST',
    'ELEMENT_ARRAY_BUFFER', 'FLOAT', 'FRAGMENT_SHADER', 'FRAMEBUFFER',
    'FRONT', 'FUNC_ADD', 'KEEP', 'LEQUAL', 'LESS', 'LINK_STATUS',
    'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'ONE', 'PACK_ALIGNMENT',
    'PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS',
    'POLYGON_OFFSET_FILL', 'SCISSOR_TEST', 'STATIC_DRAW', 'STENCIL_TEST',
    'TEXTURE0', 'TEXTURE_2D', 'TEXTURE_2D_ARRAY', 'TEXTURE_3D',
    'TEXTURE_CUBE_MAP', 'TRIANGLES', 'UNPACK_ALIGNMENT',
    'UNPACK_COLORSPACE_CONVERSION_WEBGL', 'UNPACK_FLIP_Y_WEBGL',
    'UNPACK_IMAGE_HEIGHT', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'UNPACK_ROW_LENGTH', 'UNPACK_SKIP_IMAGES', 'UNPACK_SKIP_PIXELS',
    'UNPACK_SKIP_ROWS', 'UNSIGNED_INT', 'VERTEX_SHADER', 'ZERO',
  ];
  for (const [index, name] of names.entries()) {
    constants[name] = 100 + index;
  }
  return constants;
}
