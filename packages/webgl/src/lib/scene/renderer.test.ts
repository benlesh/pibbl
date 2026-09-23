import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { createInternalWebGLTexture } from '../texture/texture.js';
import {
  WebGLRendererResourceCache,
  type WebGLRendererResourceTransaction,
} from '../gpu/renderer-resources.js';
import type { WebGLProgramKey } from '../gpu/program.js';
import type { SettledWebGLMesh, SettledWebGLScene } from './settle.js';
import type {
  SettledWebGLBackground,
  SettledWebGLLight,
  SettledWebGLPointShadowPlan,
  SettledWebGLSpotShadowPlan,
  SettledWebGLShadowPlan,
} from './types.js';
import { WebGLSceneRenderer } from './renderer.js';
import { createWebGLShadowPlans } from './shadows.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebGLSceneRenderer', () => {
  it('installs the baseline before one background clear and opens the resource transaction afterward', () => {
    const recording = createRendererGL();
    traceTransactions(recording);
    const renderer = new WebGLSceneRenderer(recording.gl, 7);

    expect(recording.operations).toEqual([]);
    renderer.render(scene({
      background: background([0.1, 0.2, 0.3, 0.4]),
    }));

    expect(recording.getParameter).toHaveBeenCalledOnce();
    expect(recording.clearColors).toEqual([
      [0, 0, 0, 0],
      [0.1, 0.2, 0.3, 0.4],
      [0, 0, 0, 0],
    ]);
    expect(recording.clears).toEqual([[0.1, 0.2, 0.3, 0.4]]);
    expect(recording.clear).toHaveBeenCalledExactlyOnceWith(
      recording.gl.COLOR_BUFFER_BIT | recording.gl.DEPTH_BUFFER_BIT,
    );
    const clearIndex = indexOf(recording.operations, 'clear');
    expect(recording.operations[clearIndex - 1]?.[0]).toBe('clearColor');
    expect(recording.operations[clearIndex - 2]?.[0]).toBe('pixelStorei');
    expect(indexOf(recording.operations, 'clear')).toBeGreaterThan(
      indexOf(recording.operations, 'pixelStorei'),
    );
    expect(indexOf(recording.operations, 'beginRender')).toBeGreaterThan(
      indexOf(recording.operations, 'clear'),
    );
    expect(lastIndexOf(recording.operations, 'pixelStorei')).toBeLessThan(
      indexOf(recording.operations, 'commit'),
    );
    expect(recording.bindFramebuffer.mock.calls).toEqual([
      [recording.gl.FRAMEBUFFER, null],
      [recording.gl.FRAMEBUFFER, null],
    ]);
    expect(recording.drawArrays).not.toHaveBeenCalled();
    expect(recording.drawElements).not.toHaveBeenCalled();
    expect(recording.createFramebuffer).not.toHaveBeenCalled();
    expect(recording.readPixels).not.toHaveBeenCalled();
  });

  it('clears omitted backgrounds to transparent black and commits empty used sets', () => {
    const recording = createRendererGL();
    traceTransactions(recording);
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 0, 0, 1]);

    renderer.render(scene({ meshes: [drawable], opaque: [drawable] }));
    renderer.render(scene({ background: background([0, 0, 1, 1]) }));
    renderer.render(scene());

    expect(recording.clears).toEqual([
      [0, 0, 0, 0],
      [0, 0, 1, 1],
      [0, 0, 0, 0],
    ]);
    expect(operationCount(recording.operations, 'beginRender')).toBe(3);
    expect(operationCount(recording.operations, 'commit')).toBe(3);
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(recording.createFramebuffer).not.toHaveBeenCalled();
    expect(recording.readPixels).not.toHaveBeenCalled();
  });

  it('switches keyed programs without changing opaque or transparent queue order', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const opaqueUnlit = mesh(0, [1, 0, 0, 1], { seed: 1 });
    const opaqueLambert = mesh(1, [0, 1, 0, 1], {
      shading: 'lambert',
      seed: 2,
    });
    const opaqueUnlitLast = mesh(2, [0, 0, 1, 1], { seed: 3 });
    const transparentNear = mesh(3, [1, 1, 0, 0.5], {
      shading: 'lambert',
      seed: 4,
    });
    const transparentFar = mesh(4, [1, 0, 1, 0.25], {
      indexed: true,
      shading: 'lambert',
      seed: 5,
    });
    const transparentMiddle = mesh(5, [0, 1, 1, 0.75], { seed: 6 });

    renderer.render(scene({
      meshes: [
        opaqueUnlit,
        opaqueLambert,
        opaqueUnlitLast,
        transparentNear,
        transparentFar,
        transparentMiddle,
      ],
      opaque: [opaqueUnlit, opaqueLambert, opaqueUnlitLast],
      transparent: [
        transparentFar,
        transparentMiddle,
        transparentNear,
      ],
    }));

    expect(recording.draws.map(draw => draw.model[0])).toEqual([
      1, 2, 3, 5, 6, 4,
    ]);
    expect(recording.draws.map(draw => draw.programKey)).toEqual([
      'unlit', 'lambert', 'unlit', 'lambert', 'unlit', 'lambert',
    ]);
    expect(recording.draws.map(draw => draw.attributeLocations)).toEqual([
      [0], [0, 1], [0], [0, 1], [0], [0, 1],
    ]);
    expect(recording.draws.slice(0, 3)).toMatchObject([
      { blend: false, depthTest: true, depthMask: true },
      { blend: false, depthTest: true, depthMask: true },
      { blend: false, depthTest: true, depthMask: true },
    ]);
    expect(recording.draws.slice(3)).toMatchObject([
      {
        blend: true,
        blendFunction: [
          recording.gl.SRC_ALPHA,
          recording.gl.ONE_MINUS_SRC_ALPHA,
          recording.gl.ONE,
          recording.gl.ONE_MINUS_SRC_ALPHA,
        ],
        depthTest: true,
        depthMask: false,
      },
      { blend: true, depthTest: true, depthMask: false },
      { blend: true, depthTest: true, depthMask: false },
    ]);
    expect(
      recording.draws.every(draw => draw.depthFunction === recording.gl.LEQUAL),
    ).toBe(true);
    expect(recording.draws[0]?.uniforms).toMatchObject({
      u_display_base_color: opaqueUnlit.color,
      u_linear_emissive: [0, 0, 0],
    });
    expect(recording.draws[1]?.uniforms).toMatchObject({
      u_linear_base_color: [0, 1, 0],
      u_linear_emissive: [0, 0, 0],
      u_alpha: [1],
      u_normal_matrix: Array.from(
        opaqueLambert.shading.kind === 'lambert' ?
          opaqueLambert.shading.normalMatrix : [],
      ),
    });
    expect(recording.drawElements).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TRIANGLES,
      3,
      recording.gl.UNSIGNED_INT,
      0,
    );
    expect(recording.drawArrays).toHaveBeenCalledTimes(5);
    expect(recording.createProgram).toHaveBeenCalledTimes(2);
    expect(recording.createTexture).toHaveBeenCalledOnce();
    expect(recording.createFramebuffer).not.toHaveBeenCalled();
    expect(recording.framebufferTexture2D).not.toHaveBeenCalled();
    expect(recording.clear).toHaveBeenCalledOnce();
    expect(recording.readPixels).not.toHaveBeenCalled();
  });

  it('binds one imported base-color texture through the PBR program', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const producer = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap);
    const drawable = pbrMesh(0, producer.texture);

    renderer.render(scene({
      meshes: [drawable],
      lights: [directionalLight()],
      opaque: [drawable],
    }));

    expect(recording.draws.map(draw => draw.programKey)).toEqual([
      'pbr-metallic-roughness',
    ]);
    expect(recording.draws[0]?.attributeLocations).toEqual([0, 1, 2]);
    expect(recording.draws[0]?.uniforms).toMatchObject({
      u_linear_base_color_factor: [0.5, 0.25, 0.75, 1],
      u_metallic_factor: [0.2],
      u_roughness_factor: [0.6],
      u_has_base_color_texture: [1],
      u_base_color_texture: [1],
    });
    expect(recording.createTexture).toHaveBeenCalledTimes(2);

    renderer.dispose(false);
    producer.release();
  });

  it('rolls back PBR program, texture, and fallback-shadow candidates after draw failure', () => {
    const failure = new Error('PBR draw failed');
    const recording = createRendererGL({
      throws: [{ operation: 'drawArrays', at: 1, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const producer = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap);
    const drawable = pbrMesh(0, producer.texture);
    const input = scene({
      meshes: [drawable],
      lights: [directionalLight()],
      opaque: [drawable],
    });

    expect(() => renderer.render(input)).toThrow(failure);
    expect(recording.deleteTexture).toHaveBeenCalledTimes(2);
    expect(() => renderer.render(input)).not.toThrow();
    expect(recording.createTexture).toHaveBeenCalledTimes(4);

    renderer.dispose(false);
    producer.release();
  });

  it('decodes base-color texture RGB as sRGB before linear tint while preserving alpha', () => {
    const canvas = new OffscreenCanvas(8, 8);
    const gl = canvas.getContext('webgl2');
    expect(gl).not.toBeNull();
    const source = new OffscreenCanvas(1, 1);
    const sourceContext = source.getContext('2d');
    expect(sourceContext).not.toBeNull();
    sourceContext!.putImageData(new ImageData(
      new Uint8ClampedArray([128, 0, 0, 255]),
      1,
      1,
    ), 0, 0);
    const producer = createInternalWebGLTexture(source.transferToImageBitmap());
    const original = pbrMesh(0, producer.texture);
    const drawable = Object.freeze({
      ...original,
      geometry: createWebGLGeometry({
        positions: [-1, -1, 0, 3, -1, 0, -1, 3, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        textureCoordinates0: [0, 0, 0, 0, 0, 0],
      }),
    });
    const renderer = new WebGLSceneRenderer(gl!, 7);

    renderer.render(realPBRScene(drawable, [Object.freeze({
      kind: 'ambient' as const,
      linearColor: Object.freeze([1, 1, 1] as const),
      intensity: 1,
    })]));

    const pixel = new Uint8Array(4);
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    expect(Array.from(pixel)).toEqual([81, 0, 0, 255]);

    renderer.dispose(false);
    producer.release();
  });

  it('keeps sampled base-color alpha linear without changing the opaque queue', () => {
    const canvas = new OffscreenCanvas(8, 8);
    const gl = canvas.getContext('webgl2');
    expect(gl).not.toBeNull();
    const source = new OffscreenCanvas(1, 1);
    const sourceContext = source.getContext('2d');
    expect(sourceContext).not.toBeNull();
    sourceContext!.putImageData(new ImageData(
      new Uint8ClampedArray([0, 0, 0, 128]),
      1,
      1,
    ), 0, 0);
    const producer = createInternalWebGLTexture(source.transferToImageBitmap());
    const original = pbrMesh(0, producer.texture);
    const drawable = Object.freeze({
      ...original,
      geometry: createWebGLGeometry({
        positions: [-1, -1, 0, 3, -1, 0, -1, 3, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        textureCoordinates0: [0, 0, 0, 0, 0, 0],
      }),
    });
    const renderer = new WebGLSceneRenderer(gl!, 7);

    renderer.render(realPBRScene(drawable, []));

    const pixel = new Uint8Array(4);
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    expect(Array.from(pixel)).toEqual([0, 0, 0, 128]);

    renderer.dispose(false);
    producer.release();
  });

  it('keeps ambient fill diffuse-only and changes the direct GGX lobe with roughness', () => {
    const canvas = new OffscreenCanvas(8, 8);
    const gl = canvas.getContext('webgl2');
    expect(gl).not.toBeNull();
    const renderer = new WebGLSceneRenderer(gl!, 7);
    const pixel = new Uint8Array(4);
    const ambient = Object.freeze({
      kind: 'ambient' as const,
      linearColor: Object.freeze([1, 1, 1] as const),
      intensity: 1,
    });

    const metal = untexturedPBRMesh({ metallic: 1, roughness: 0.5 });
    renderer.render(realPBRScene(metal, [ambient]));
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    expect(Array.from(pixel)).toEqual([0, 0, 0, 255]);

    const dielectric = untexturedPBRMesh({ metallic: 0, roughness: 0.5 });
    renderer.render(realPBRScene(dielectric, [ambient]));
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    expect(pixel[0]).toBeGreaterThan(0);

    const angledDirectional = Object.freeze({
      kind: 'directional' as const,
      identity: Object.freeze({}),
      linearColor: Object.freeze([1, 1, 1] as const),
      direction: Object.freeze([0.5, 0, -0.8660254] as const),
      intensity: 1,
      castShadow: false,
    });
    const smooth = untexturedPBRMesh({ metallic: 1, roughness: 0.2 });
    renderer.render(realPBRScene(smooth, [angledDirectional]));
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    const smoothRed = pixel[0]!;
    const rough = untexturedPBRMesh({ metallic: 1, roughness: 0.8 });
    renderer.render(realPBRScene(rough, [angledDirectional]));
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    expect(pixel[0]).not.toBe(smoothRed);

    renderer.dispose(false);
  });

  it('attenuates only the direct light owning a PBR shadow plan', () => {
    const canvas = new OffscreenCanvas(8, 8);
    const gl = canvas.getContext('webgl2');
    expect(gl).not.toBeNull();
    const renderer = new WebGLSceneRenderer(gl!, 7);
    const caster = untexturedPBRMesh({ metallic: 0, roughness: 0.5 });
    const receiver = untexturedPBRMesh({
      metallic: 0,
      roughness: 0.5,
      z: 0.5,
    });
    const shadowedIdentity = Object.freeze({});
    const shadowed = Object.freeze({
      kind: 'directional' as const,
      identity: shadowedIdentity,
      linearColor: Object.freeze([1, 0, 0] as const),
      direction: Object.freeze([0, 0, -1] as const),
      intensity: 1,
      castShadow: true,
    });
    const unshadowed = Object.freeze({
      kind: 'directional' as const,
      identity: Object.freeze({}),
      linearColor: Object.freeze([0, 1, 0] as const),
      direction: Object.freeze([0, 0, -1] as const),
      intensity: 1,
      castShadow: false,
    });
    const withoutShadow = realPBRScene(receiver, [shadowed, unshadowed]);
    const withShadow = Object.freeze({
      ...withoutShadow,
      shadowPlans: Object.freeze([Object.freeze({
        kind: 'directional' as const,
        lightIdentity: shadowedIdentity,
        lightIndex: 0,
        projectionViewMatrix: matrix(1),
        bias: 0,
        casters: Object.freeze([caster]),
        receivers: Object.freeze([receiver]),
        requestedResolution: 8,
        comparisonCount: 1 as const,
        contextGeneration: 7,
        shadowProgramGeneration: 1,
      })]),
    });
    const pixel = new Uint8Array(4);

    renderer.render(withShadow);
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    const shadowedPixel = Array.from(pixel);
    expect(shadowedPixel[0]).toBe(0);
    expect(shadowedPixel[1]).toBeGreaterThan(0);

    renderer.render(withoutShadow);
    gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
    expect(pixel[0]).toBeGreaterThan(0);
    expect(pixel[1]).toBe(shadowedPixel[1]);

    renderer.dispose(false);
  });

  it.each(['point', 'spot'] as const)(
    'renders PBR %s attenuation and applies only that light shadow',
    kind => {
      const canvas = new OffscreenCanvas(8, 8);
      const gl = canvas.getContext('webgl2');
      expect(gl).not.toBeNull();
      const renderer = new WebGLSceneRenderer(gl!, 7);
      const caster = untexturedPBRMesh({
        metallic: 0,
        roughness: 0.5,
        z: 0.5,
      });
      const receiver = untexturedPBRMesh({ metallic: 0, roughness: 0.5 });
      const shadowedIdentity = Object.freeze({});
      const directFields = {
        position: Object.freeze([0, 0, 1] as const),
        range: 10,
        ...(kind === 'spot' ? {
          direction: Object.freeze([0, 0, -1] as const),
          innerConeCosine: 0.9,
          outerConeCosine: 0.7,
        } : {}),
      };
      const shadowed = Object.freeze({
        kind,
        identity: shadowedIdentity,
        linearColor: Object.freeze([1, 0, 0] as const),
        intensity: 1,
        castShadow: true,
        ...directFields,
      }) as SettledWebGLLight;
      const unshadowed = Object.freeze({
        kind,
        identity: Object.freeze({}),
        linearColor: Object.freeze([0, 1, 0] as const),
        intensity: 1,
        castShadow: false,
        ...directFields,
      }) as SettledWebGLLight;
      const generatedPlans = createWebGLShadowPlans({
        meshes: [caster, receiver],
        lights: [shadowed, unshadowed],
        quality: 'low',
        contextGeneration: 7,
      });
      expect(generatedPlans).toHaveLength(1);
      const plan = Object.freeze({
        ...generatedPlans[0]!,
        requestedResolution: 8,
        comparisonCount: 1 as const,
      }) as SettledWebGLShadowPlan;
      const withoutShadow = realPBRScene(receiver, [shadowed, unshadowed]);
      const withShadow = Object.freeze({
        ...withoutShadow,
        shadowPlans: Object.freeze([plan]),
      });
      const pixel = new Uint8Array(4);

      renderer.render(withShadow);
      gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
      const shadowedPixel = Array.from(pixel);
      expect(shadowedPixel[0]).toBe(0);
      expect(shadowedPixel[1]).toBeGreaterThan(0);

      renderer.render(withoutShadow);
      gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
      expect(pixel[0]).toBeGreaterThan(0);
      expect(pixel[1]).toBe(shadowedPixel[1]);

      const outOfRange = Object.freeze({
        ...shadowed,
        identity: Object.freeze({}),
        position: Object.freeze([0, 0, 11] as const),
        castShadow: false,
      }) as SettledWebGLLight;
      renderer.render(realPBRScene(receiver, [outOfRange]));
      gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
      expect(Array.from(pixel)).toEqual([0, 0, 0, 255]);

      if (kind === 'spot') {
        const outOfCone = Object.freeze({
          ...shadowed,
          identity: Object.freeze({}),
          direction: Object.freeze([0, 0, 1] as const),
          castShadow: false,
        }) as SettledWebGLLight;
        renderer.render(realPBRScene(receiver, [outOfCone]));
        gl!.readPixels(4, 4, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, pixel);
        expect(Array.from(pixel)).toEqual([0, 0, 0, 255]);
      }

      renderer.dispose(false);
    },
  );

  it.each([
    ['point', pointLight()],
    ['spot', spotLight()],
  ] as const)(
    'keeps a Lambert %s-light frame without a relevant shadow plan free of shadow targets and depth passes',
    (_kind, light) => {
      const recording = createRendererGL();
      const renderer = new WebGLSceneRenderer(recording.gl, 7);
      const drawable = mesh(0, [1, 1, 1, 1], {
        shading: 'lambert',
        seed: 11,
      });

      renderer.render(scene({
        meshes: [drawable],
        lights: [light],
        opaque: [drawable],
        shadowPlans: [],
      }));

      expect(recording.draws.map(draw => draw.programKey)).toEqual([
        'lambert',
      ]);
      expect(recording.createTexture).toHaveBeenCalledOnce();
      expect(recording.createFramebuffer).not.toHaveBeenCalled();
      expect(recording.framebufferTexture2D).not.toHaveBeenCalled();
      expect(recording.clear).toHaveBeenCalledExactlyOnceWith(
        recording.gl.COLOR_BUFFER_BIT | recording.gl.DEPTH_BUFFER_BIT,
      );
    },
  );

  it('reuses one Lambert program and geometry while uploading fixed light data once per frame', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    });
    const first = mesh(0, [1, 1, 1, 1], {
      geometry,
      shading: 'lambert',
      seed: 11,
    });
    const second = mesh(1, [0.5, 0.5, 0.5, 1], {
      geometry,
      shading: 'lambert',
      seed: 21,
    });
    const lights = fixedLights();

    let lastWrites: readonly UniformWrite[] = [];
    for (let count = 0; count <= 8; count += 1) {
      const firstWrite = recording.uniformWrites.length;
      renderer.render(scene({
        meshes: [first, second],
        lights: lights.slice(0, count),
        opaque: [first, second],
      }));
      const writes = recording.uniformWrites.slice(firstWrite);
      lastWrites = writes;
      expect(valuesFor(writes, 'u_light_count')).toEqual([[count]]);
      expect(valuesFor(writes, 'u_light_kind[0]')).toHaveLength(1);
      expect(valuesFor(writes, 'u_light_kind[0]')[0]).toHaveLength(8);
      expect(valuesFor(writes, 'u_light_color_intensity[0]')[0]).toHaveLength(32);
      expect(valuesFor(writes, 'u_light_position_range[0]')[0]).toHaveLength(32);
      expect(valuesFor(writes, 'u_light_direction_inner_cosine[0]')[0])
        .toHaveLength(32);
      expect(valuesFor(writes, 'u_light_ground_outer_cosine[0]')[0])
        .toHaveLength(32);
      expect(valuesFor(writes, 'u_view')).toHaveLength(1);
      expect(valuesFor(writes, 'u_projection')).toHaveLength(1);
      expect(valuesFor(writes, 'u_model')).toHaveLength(2);
      expect(valuesFor(writes, 'u_normal_matrix')).toHaveLength(2);
    }

    expect(valuesFor(lastWrites, 'u_light_kind[0]')).toEqual([
      [0, 1, 2, 3, 4, 0, 3, 4],
    ]);
    const positions = valuesFor(
      lastWrites,
      'u_light_position_range[0]',
    )[0]!;
    expect(positions.slice(12, 16)).toEqual(float32([1, 2, 3, 0]));
    expect(positions.slice(16, 20)).toEqual(float32([-1, -2, -3, 5]));
    const directions = valuesFor(
      lastWrites,
      'u_light_direction_inner_cosine[0]',
    )[0]!;
    expect(directions.slice(4, 8)).toEqual(float32([0, 1, 0, 0]));
    expect(directions.slice(8, 12)).toEqual(float32([0, 0, -1, 0]));
    expect(directions.slice(16, 20)).toEqual(float32([0, -1, 0, 0.9]));
    const ground = valuesFor(
      lastWrites,
      'u_light_ground_outer_cosine[0]',
    )[0]!;
    expect(ground.slice(4, 8)).toEqual(float32([0.8, 0.9, 1, 0]));
    expect(ground.slice(16, 20)).toEqual(float32([0, 0, 0, 0.7]));
    expect(recording.createProgram).toHaveBeenCalledOnce();
    expect(recording.createVertexArray).toHaveBeenCalledOnce();
    expect(recording.createBuffer).toHaveBeenCalledTimes(2);
  });

  it('renders dirty directional depth before the color clear and reuses it across a camera-only frame', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });
    const plan = directionalPlan(drawable);
    const firstScene = scene({
      meshes: [drawable],
      lights: [directionalLight()],
      opaque: [drawable],
      shadowPlans: [plan],
    });

    renderer.render(firstScene);
    expect(recording.draws.map(draw => draw.programKey)).toEqual([
      'shadow-depth',
      'lambert',
    ]);
    expect(recording.clear.mock.calls.map(([mask]) => mask)).toEqual([
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.COLOR_BUFFER_BIT | recording.gl.DEPTH_BUFFER_BIT,
    ]);
    expect(recording.clear.mock.invocationCallOrder[0]).toBeLessThan(
      recording.drawArrays.mock.invocationCallOrder[0]!,
    );
    expect(recording.drawArrays.mock.invocationCallOrder[0]).toBeLessThan(
      recording.clear.mock.invocationCallOrder[1]!,
    );
    expect(recording.draws[0]).toMatchObject({
      blend: false,
      depthTest: true,
      depthMask: true,
    });
    expect(recording.draws[1]?.uniforms).toMatchObject({
      'u_shadow_enabled[0]': [1, 0, 0, 0, 0, 0, 0, 0],
      u_receive_shadow: [1],
    });
    const firstTextureCount = recording.createTexture.mock.calls.length;

    renderer.render(scene({
      meshes: [drawable],
      lights: [directionalLight()],
      opaque: [drawable],
      shadowPlans: [plan],
      cameraSeed: 999,
    }));
    expect(recording.draws.map(draw => draw.programKey)).toEqual([
      'shadow-depth',
      'lambert',
      'lambert',
    ]);
    expect(recording.createTexture).toHaveBeenCalledTimes(firstTextureCount);
  });

  it('renders six radial point layers before color, binds the array, and reuses it for camera-only work', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });
    const plan = pointPlan(drawable);

    renderer.render(scene({
      meshes: [drawable],
      lights: [pointLight()],
      opaque: [drawable],
      shadowPlans: [plan],
    }));

    expect(recording.draws.map(draw => draw.programKey)).toEqual([
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'lambert',
    ]);
    expect(recording.draws.slice(0, 6).map(draw =>
      draw.uniforms.u_shadow_projection_view?.[0])).toEqual([
      711, 712, 713, 714, 715, 716,
    ]);
    expect(recording.draws.slice(0, 6).map(draw =>
      draw.uniforms.u_shadow_light_position_far)).toEqual(
      Array.from({ length: 6 }, () => [1, 2, 3, 10]),
    );
    expect(recording.clear.mock.calls.map(([mask]) => mask)).toEqual([
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.COLOR_BUFFER_BIT | recording.gl.DEPTH_BUFFER_BIT,
    ]);
    const layerAttachments = recording.framebufferTextureLayer.mock.calls;
    expect(layerAttachments.map(call => call[4])).toEqual([0, 1, 2, 3, 4, 5]);
    const pointTexture = layerAttachments[0]![2];
    expect(recording.bindTexture).toHaveBeenCalledWith(
      recording.gl.TEXTURE_2D_ARRAY,
      pointTexture,
    );
    expect(recording.draws[6]?.uniforms).toMatchObject({
      'u_shadow_enabled[0]': [2, 0, 0, 0, 0, 0, 0, 0],
      'u_shadow_parameters[0]': float32([
        0.001, 1 / 1024, 4, 10,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]),
      u_receive_shadow: [1],
    });
    const textureCount = recording.createTexture.mock.calls.length;

    renderer.render(scene({
      meshes: [drawable],
      lights: [pointLight()],
      opaque: [drawable],
      shadowPlans: [plan],
      cameraSeed: 999,
    }));
    expect(recording.draws.map(draw => draw.programKey)).toEqual([
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'shadow-depth',
      'lambert',
      'lambert',
    ]);
    expect(recording.createTexture).toHaveBeenCalledTimes(textureCount);
  });

  it('attaches point faces to array layers and binds one color sampler', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });

    renderer.render(scene({
      meshes: [drawable],
      lights: [pointLight()],
      opaque: [drawable],
      shadowPlans: [pointPlan(drawable)],
    }));

    expect(recording.texStorage3D).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TEXTURE_2D_ARRAY,
      1,
      recording.gl.DEPTH_COMPONENT24,
      1024,
      1024,
      48,
    );
    const shadowArray = recording.createTexture.mock.results[0]!.value;
    expect(recording.framebufferTextureLayer.mock.calls).toEqual(
      Array.from({ length: 6 }, (_, layer) => [
        recording.gl.FRAMEBUFFER,
        recording.gl.DEPTH_ATTACHMENT,
        shadowArray,
        0,
        layer,
      ]),
    );
    const lambertDraw = recording.draws.at(-1)!;
    expect(lambertDraw.uniforms.u_shadow_map).toEqual([0]);
    expect(valuesFor(recording.uniformWrites, 'u_shadow_map')).toHaveLength(1);
    expect(recording.bindTexture).toHaveBeenCalledWith(
      recording.gl.TEXTURE_2D_ARRAY,
      expect.anything(),
    );
  });

  it('reuses point depth after a non-shadow light changes its slot and binds the current slot', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });

    renderer.render(scene({
      meshes: [drawable],
      lights: [pointLight()],
      opaque: [drawable],
      shadowPlans: [pointPlan(drawable)],
    }));
    renderer.render(scene({
      meshes: [drawable],
      lights: [fixedLights()[0]!, pointLight()],
      opaque: [drawable],
      shadowPlans: [pointPlan(drawable, { lightIndex: 1 })],
    }));

    expect(recording.draws.filter(draw => draw.programKey === 'shadow-depth'))
      .toHaveLength(6);
    expect(recording.draws.at(-1)?.uniforms).toMatchObject({
      'u_shadow_enabled[0]': [0, 2, 0, 0, 0, 0, 0, 0],
    });
  });

  it('invalidates a point cube when caster depth changes', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const first = mesh(0, [1, 1, 1, 1], { shading: 'lambert', seed: 11 });
    renderer.render(scene({
      meshes: [first],
      lights: [pointLight()],
      opaque: [first],
      shadowPlans: [pointPlan(first)],
    }));
    const replacement = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 12,
    });
    renderer.render(scene({
      meshes: [replacement],
      lights: [pointLight()],
      opaque: [replacement],
      shadowPlans: [pointPlan(replacement)],
    }));

    expect(recording.draws.filter(draw => draw.programKey === 'shadow-depth'))
      .toHaveLength(12);
    expect(recording.deleteTexture).toHaveBeenCalled();
  });

  it('renders one spot depth view and binds it only to the matching light slot', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });
    const ambient = fixedLights()[0]!;
    const plan = spotPlan(drawable, { lightIndex: 1 });

    renderer.render(scene({
      meshes: [drawable],
      lights: [ambient, spotLight()],
      opaque: [drawable],
      shadowPlans: [plan],
    }));

    expect(recording.draws.map(draw => draw.programKey)).toEqual([
      'shadow-depth',
      'lambert',
    ]);
    expect(recording.draws[0]?.uniforms).toMatchObject({
      u_shadow_projection_view: [721, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      u_shadow_light_position_far: [1, 2, 3, 10],
    });
    expect(recording.draws[1]?.uniforms).toMatchObject({
      'u_shadow_enabled[0]': [0, 3, 0, 0, 0, 0, 0, 0],
      'u_shadow_parameters[0]': float32([
        0, 0, 0, 0,
        0.001, 1 / 1024, 4, 10,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]),
      'u_shadow_matrix[0]': [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        721, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      u_receive_shadow: [1],
    });
    expect(recording.clear.mock.calls.map(([mask]) => mask)).toEqual([
      recording.gl.DEPTH_BUFFER_BIT,
      recording.gl.COLOR_BUFFER_BIT | recording.gl.DEPTH_BUFFER_BIT,
    ]);
  });

  it.each([
    ['depth', 4],
    ['color', 7],
  ] as const)('rolls back a point candidate when the %s draw fails', (
    _stage,
    at,
  ) => {
    const failure = new Error('point render failed');
    const recording = createRendererGL({
      throws: [{ operation: 'drawArrays', at, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });

    expect(() => renderer.render(scene({
      meshes: [drawable],
      lights: [pointLight()],
      opaque: [drawable],
      shadowPlans: [pointPlan(drawable)],
    }))).toThrow(failure);
    expect(recording.deleteTexture).toHaveBeenCalled();
    expect(() => renderer.render(scene())).not.toThrow();
  });

  it('rolls back a directional candidate when the later color draw fails', () => {
    const failure = new Error('color draw failed');
    const recording = createRendererGL({
      throws: [{ operation: 'drawArrays', at: 2, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });

    expect(() => renderer.render(scene({
      meshes: [drawable],
      lights: [directionalLight()],
      opaque: [drawable],
      shadowPlans: [directionalPlan(drawable)],
    }))).toThrow(failure);
    expect(recording.deleteTexture).toHaveBeenCalled();
    expect(() => renderer.render(scene())).not.toThrow();
  });

  it('rejects another context generation before any GL work', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 8);

    expect(() => renderer.render(scene({ contextGeneration: 7 }))).toThrowError(
      /scene.*generation 7.*renderer.*generation 8/i,
    );
    expect(recording.operations).toEqual([]);
  });

  it('does not retain a failed baseline capability read', () => {
    const failure = new Error('capability read failed');
    const recording = createRendererGL({
      throws: [{ operation: 'getParameter', at: 1, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);

    expect(() => renderer.render(scene())).toThrow(failure);
    expect(recording.bindFramebuffer).not.toHaveBeenCalled();
    expect(recording.createProgram).not.toHaveBeenCalled();

    renderer.render(scene());
    expect(recording.getParameter).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: 'background clear',
      operation: 'clear',
      at: 1,
      transaction: false,
      programs: 0,
      geometries: 0,
    },
    {
      name: 'program acquisition',
      operation: 'createProgram',
      at: 1,
      transaction: true,
      programs: 0,
      geometries: 0,
    },
    {
      name: 'geometry upload',
      operation: 'bufferData',
      at: 1,
      transaction: true,
      programs: 1,
      geometries: 1,
    },
    {
      name: 'draw',
      operation: 'drawArrays',
      at: 1,
      transaction: true,
      programs: 1,
      geometries: 1,
    },
    {
      name: 'final baseline restoration',
      operation: 'bindFramebuffer',
      at: 2,
      transaction: true,
      programs: 1,
      geometries: 1,
    },
  ])(
    'rolls back candidate resources and restores the baseline after $name fails',
    ({ operation, at, transaction, programs, geometries }) => {
      const recording = createRendererGL({
        throws: [{ operation, at, error: new Error(`${operation} failed`) }],
      });
      traceTransactions(recording);
      const renderer = new WebGLSceneRenderer(recording.gl, 7);
      const drawable = mesh(0, [1, 0, 0, 1]);

      expect(() => renderer.render(scene({
        meshes: [drawable],
        opaque: [drawable],
      }))).toThrow();

      expect(operationCount(recording.operations, 'beginRender'))
        .toBe(transaction ? 1 : 0);
      expect(operationCount(recording.operations, 'rollback'))
        .toBe(transaction ? 1 : 0);
      expect(recording.bindFramebuffer.mock.calls.length)
        .toBeGreaterThanOrEqual(2);
      expect(recording.deleteProgram).toHaveBeenCalledTimes(programs);
      expect(recording.deleteVertexArray).toHaveBeenCalledTimes(geometries);
      expect(lastIndexOf(recording.operations, 'pixelStorei')).toBeGreaterThan(
        lastIndexOf(recording.operations, 'bindFramebuffer'),
      );
      expect(() => renderer.render(scene())).not.toThrow();
    },
  );

  it('keeps the draw failure authoritative while attempting every healthy cleanup', () => {
    const drawFailure = new Error('draw failed');
    const programCleanupFailure = new Error('program cleanup failed');
    const bufferCleanupFailure = new Error('buffer cleanup failed');
    const restoreFailure = new Error('restore failed');
    const recording = createRendererGL({
      throws: [
        { operation: 'drawArrays', at: 1, error: drawFailure },
        { operation: 'deleteProgram', at: 1, error: programCleanupFailure },
        { operation: 'deleteBuffer', at: 1, error: bufferCleanupFailure },
        { operation: 'bindFramebuffer', at: 2, error: restoreFailure },
      ],
    });
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 0, 0, 1]);

    expect(() => renderer.render(scene({
      meshes: [drawable],
      opaque: [drawable],
    }))).toThrow(drawFailure);

    expect(reported).toEqual([
      programCleanupFailure,
      bufferCleanupFailure,
      restoreFailure,
    ]);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(lastIndexOf(recording.operations, 'pixelStorei')).toBeGreaterThan(
      lastIndexOf(recording.operations, 'bindFramebuffer'),
    );
  });

  it('abandons lost-generation handles without restoring the baseline', () => {
    const failure = new Error('context-losing draw failed');
    const recording = createRendererGL({
      loseContextAt: { operation: 'drawArrays', at: 1 },
      throws: [{ operation: 'drawArrays', at: 1, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 0, 0, 1]);

    expect(() => renderer.render(scene({
      meshes: [drawable],
      opaque: [drawable],
    }))).toThrow(failure);

    expect(recording.bindFramebuffer).toHaveBeenCalledOnce();
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('abandons a partially allocated shadow array after context loss', () => {
    const failure = new Error('context-losing shadow allocation failed');
    const recording = createRendererGL({
      loseContextAt: { operation: 'texStorage3D', at: 1 },
      throws: [{ operation: 'texStorage3D', at: 1, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });

    expect(() => renderer.render(scene({
      meshes: [drawable],
      lights: [directionalLight()],
      opaque: [drawable],
      shadowPlans: [directionalPlan(drawable)],
    }))).toThrow(failure);

    expect(recording.deleteTexture).not.toHaveBeenCalled();
    expect(recording.deleteFramebuffer).not.toHaveBeenCalled();
  });

  it('abandons a shadow array after a context-losing depth draw', () => {
    const failure = new Error('context-losing shadow draw failed');
    const recording = createRendererGL({
      loseContextAt: { operation: 'drawArrays', at: 1 },
      throws: [{ operation: 'drawArrays', at: 1, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 1, 1, 1], {
      shading: 'lambert',
      seed: 11,
    });

    expect(() => renderer.render(scene({
      meshes: [drawable],
      lights: [directionalLight()],
      opaque: [drawable],
      shadowPlans: [directionalPlan(drawable)],
    }))).toThrow(failure);

    expect(recording.deleteTexture).not.toHaveBeenCalled();
    expect(recording.deleteFramebuffer).not.toHaveBeenCalled();
  });

  it('delegates context invalidation and ordinary disposal exactly once', () => {
    const lost = createRendererGL();
    const lostRenderer = new WebGLSceneRenderer(lost.gl, 7);
    const lostMesh = mesh(0, [1, 0, 0, 1]);
    lostRenderer.render(scene({ meshes: [lostMesh], opaque: [lostMesh] }));

    lostRenderer.invalidateContext();
    lostRenderer.invalidateContext();
    expect(lost.deleteProgram).not.toHaveBeenCalled();
    expect(lost.deleteBuffer).not.toHaveBeenCalled();
    expect(lost.deleteVertexArray).not.toHaveBeenCalled();
    expect(() => lostRenderer.render(scene())).toThrowError(/invalid/i);
    lostRenderer.dispose(false);
    expect(() => lostRenderer.render(scene())).toThrowError(/disposed/i);

    const live = createRendererGL();
    const liveRenderer = new WebGLSceneRenderer(live.gl, 7);
    const liveMesh = mesh(0, [1, 0, 0, 1]);
    liveRenderer.render(scene({ meshes: [liveMesh], opaque: [liveMesh] }));
    liveRenderer.dispose(false);
    liveRenderer.dispose(false);

    expect(live.deleteProgram).toHaveBeenCalledOnce();
    expect(live.deleteBuffer).toHaveBeenCalledOnce();
    expect(live.deleteVertexArray).toHaveBeenCalledOnce();
    expect(() => liveRenderer.render(scene())).toThrowError(/disposed/i);
  });
});

interface SceneOverrides {
  readonly contextGeneration?: number;
  readonly meshes?: readonly SettledWebGLMesh[];
  readonly lights?: readonly SettledWebGLLight[];
  readonly background?: SettledWebGLBackground;
  readonly opaque?: readonly SettledWebGLMesh[];
  readonly transparent?: readonly SettledWebGLMesh[];
  readonly shadowPlans?: readonly SettledWebGLShadowPlan[];
  readonly cameraSeed?: number;
}

function scene(overrides: SceneOverrides = {}): SettledWebGLScene {
  return Object.freeze({
    contextGeneration: overrides.contextGeneration ?? 7,
    camera: Object.freeze({
      descriptor: Object.freeze({
        type: 'perspective' as const,
        fieldOfViewDegrees: 60,
        near: 0.1,
        far: 100,
        position: [0, 0, 5] as const,
        lookAt: [0, 0, 0] as const,
        up: [0, 1, 0] as const,
      }),
      aspect: 2,
      viewMatrix: matrix(overrides.cameraSeed ?? 101),
      projectionMatrix: matrix((overrides.cameraSeed ?? 101) + 100),
      projectionViewMatrix: matrix((overrides.cameraSeed ?? 101) + 200),
      inverseProjectionViewMatrix: matrix((overrides.cameraSeed ?? 101) + 300),
      viewport: Object.freeze({ width: 160, height: 90 }),
      generationValues: Object.freeze([]),
    }),
    logicalViewport: Object.freeze({ width: 160, height: 90 }),
    backingViewport: Object.freeze({ width: 320, height: 180 }),
    density: Object.freeze({ x: 2, y: 2 }),
    timestamp: 123,
    meshes: overrides.meshes ?? Object.freeze([]),
    instanced: Object.freeze([]),
    entries: overrides.meshes ?? Object.freeze([]),
    lights: overrides.lights ?? Object.freeze([]),
    background: overrides.background,
    opaque: overrides.opaque ?? Object.freeze([]),
    transparent: overrides.transparent ?? Object.freeze([]),
    additive: Object.freeze([]),
    shadowQuality: 'medium',
    shadowPlans: overrides.shadowPlans ?? Object.freeze([]),
    pickEntries: Object.freeze([]),
  });
}

function directionalLight(): SettledWebGLLight {
  return Object.freeze({
    kind: 'directional' as const,
    identity: DIRECTIONAL_LIGHT_IDENTITY,
    linearColor: Object.freeze([1, 1, 1] as const),
    direction: Object.freeze([0, 0, -1] as const),
    intensity: 1,
    castShadow: true,
  });
}

function directionalPlan(mesh: SettledWebGLMesh): SettledWebGLShadowPlan {
  return Object.freeze({
    kind: 'directional' as const,
    lightIdentity: DIRECTIONAL_LIGHT_IDENTITY,
    lightIndex: 0,
    projectionViewMatrix: matrix(701),
    bias: 0.001,
    casters: Object.freeze([mesh]),
    receivers: Object.freeze([mesh]),
    requestedResolution: 1024,
    comparisonCount: 4,
    contextGeneration: 7,
    shadowProgramGeneration: 1,
  });
}

function pointLight(): SettledWebGLLight {
  return Object.freeze({
    kind: 'point' as const,
    identity: POINT_LIGHT_IDENTITY,
    linearColor: Object.freeze([1, 1, 1] as const),
    position: Object.freeze([1, 2, 3] as const),
    range: 10,
    intensity: 1,
    castShadow: true,
  });
}

function pointPlan(
  mesh: SettledWebGLMesh,
  overrides: Partial<SettledWebGLPointShadowPlan> = {},
): SettledWebGLPointShadowPlan {
  return Object.freeze({
    kind: 'point',
    lightIdentity: POINT_LIGHT_IDENTITY,
    lightIndex: 0,
    projectionViewMatrices: Object.freeze(Array.from(
      { length: 6 },
      (_, face) => matrix(711 + face),
    )),
    lightPosition: Object.freeze([1, 2, 3] as const),
    nearDistance: 0.01,
    farDistance: 10,
    bias: 0.001,
    casters: Object.freeze([mesh]),
    receivers: Object.freeze([mesh]),
    requestedResolution: 1024,
    comparisonCount: 4,
    contextGeneration: 7,
    shadowProgramGeneration: 1,
    ...overrides,
  });
}

function spotLight(): SettledWebGLLight {
  return Object.freeze({
    kind: 'spot' as const,
    identity: SPOT_LIGHT_IDENTITY,
    linearColor: Object.freeze([1, 1, 1] as const),
    position: Object.freeze([1, 2, 3] as const),
    direction: Object.freeze([0, -1, 0] as const),
    range: 10,
    innerConeCosine: 0.9,
    outerConeCosine: 0.7,
    intensity: 1,
    castShadow: true,
  });
}

function spotPlan(
  mesh: SettledWebGLMesh,
  overrides: Partial<SettledWebGLSpotShadowPlan> = {},
): SettledWebGLSpotShadowPlan {
  return Object.freeze({
    kind: 'spot',
    lightIdentity: SPOT_LIGHT_IDENTITY,
    lightIndex: 0,
    projectionViewMatrix: matrix(721),
    lightPosition: Object.freeze([1, 2, 3] as const),
    nearDistance: 0.01,
    farDistance: 10,
    bias: 0.001,
    casters: Object.freeze([mesh]),
    receivers: Object.freeze([mesh]),
    requestedResolution: 1024,
    comparisonCount: 4,
    contextGeneration: 7,
    shadowProgramGeneration: 1,
    ...overrides,
  });
}

const DIRECTIONAL_LIGHT_IDENTITY = Object.freeze({});
const POINT_LIGHT_IDENTITY = Object.freeze({});
const SPOT_LIGHT_IDENTITY = Object.freeze({});
const SECOND_POINT_LIGHT_IDENTITY = Object.freeze({});
const SECOND_SPOT_LIGHT_IDENTITY = Object.freeze({});

interface MeshOptions {
  readonly indexed?: boolean;
  readonly shading?: WebGLProgramKey;
  readonly seed?: number;
  readonly geometry?: SettledWebGLMesh['geometry'];
}

function mesh(
  sourceIndex: number,
  color: SettledWebGLMesh['color'],
  options: MeshOptions = {},
): SettledWebGLMesh {
  const shading = options.shading ?? 'unlit';
  const seed = options.seed ?? sourceIndex + 1;
  const geometry = options.geometry ?? createWebGLGeometry({
    positions: [0, 0, 0, seed, 0, 0, 0, seed, 0],
    normals: shading === 'lambert' ?
      [0, 0, 1, 0, 0, 1, 0, 0, 1] : undefined,
    indices: options.indexed ? [0, 1, 2] : undefined,
  });
  const linearEmissive = Object.freeze([0, 0, 0] as const);
  return Object.freeze({
    kind: 'mesh' as const,
    componentName: `Mesh${sourceIndex}`,
    source: undefined,
    geometry,
    identity: Object.freeze({}),
    model: matrix(seed),
    color: Object.freeze(color),
    lit: shading === 'lambert',
    material: Object.freeze({
      type: 'lambert' as const,
      emissiveColor: Object.freeze([0, 0, 0, 1] as const),
      emissiveIntensity: 1,
    }),
    shading: shading === 'unlit' ? Object.freeze({
      kind: 'unlit' as const,
      displayBaseColor: Object.freeze(color),
      linearEmissive,
    }) : Object.freeze({
      kind: 'lambert' as const,
      linearBaseColor: Object.freeze(color),
      linearEmissive,
      normalMatrix: normalMatrix(seed),
    }),
    sourceIndex,
    target: undefined,
    keyboardNavigationBounds: undefined,
    viewDepth: 10 - sourceIndex,
    worldBounds: Object.freeze({
      minimumX: 0,
      minimumY: 0,
      minimumZ: 0,
      maximumX: seed,
      maximumY: seed,
      maximumZ: 0,
    }),
    castShadow: true,
    receiveShadow: shading === 'lambert',
  });
}

function pbrMesh(
  sourceIndex: number,
  texture: import('../types.js').CRCWebGLTexture,
): SettledWebGLMesh {
  const seed = sourceIndex + 1;
  const geometry = createWebGLGeometry({
    positions: [0, 0, 0, seed, 0, 0, 0, seed, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    textureCoordinates0: [0, 0, 1, 0, 0, 1],
  });
  const binding = Object.freeze({ texture, textureCoordinate: 0 as const });
  return Object.freeze({
    kind: 'mesh' as const,
    componentName: `ImportedMesh${sourceIndex}`,
    source: undefined,
    geometry,
    identity: Object.freeze({}),
    model: matrix(seed),
    color: Object.freeze([1, 1, 1, 1] as const),
    lit: true,
    material: Object.freeze({
      type: 'pbr-metallic-roughness' as const,
      baseColorFactor: Object.freeze([0.5, 0.25, 0.75, 1] as const),
      baseColorTexture: binding,
      metallicFactor: 0.2,
      roughnessFactor: 0.6,
    }),
    shading: Object.freeze({
      kind: 'pbr-metallic-roughness' as const,
      linearBaseColorFactor: Object.freeze([0.5, 0.25, 0.75, 1] as const),
      baseColorTexture: binding,
      metallicFactor: 0.2,
      roughnessFactor: 0.6,
      normalMatrix: normalMatrix(seed),
    }),
    sourceIndex,
    target: undefined,
    keyboardNavigationBounds: undefined,
    viewDepth: 10,
    worldBounds: Object.freeze({
      minimumX: 0,
      minimumY: 0,
      minimumZ: 0,
      maximumX: seed,
      maximumY: seed,
      maximumZ: 0,
    }),
    castShadow: true,
    receiveShadow: true,
  });
}

function realPBRScene(
  drawable: SettledWebGLMesh,
  lights: readonly SettledWebGLLight[],
): SettledWebGLScene {
  const identityMatrix = matrix(1);
  return Object.freeze({
    ...scene({ meshes: [drawable], lights, opaque: [drawable] }),
    camera: Object.freeze({
      descriptor: Object.freeze({
        type: 'perspective' as const,
        fieldOfViewDegrees: 60,
        near: 0.1,
        far: 100,
        position: [0, 0, 1] as const,
        lookAt: [0, 0, 0] as const,
        up: [0, 1, 0] as const,
      }),
      aspect: 1,
      viewMatrix: new Float32Array(identityMatrix),
      projectionMatrix: new Float32Array(identityMatrix),
      projectionViewMatrix: new Float32Array(identityMatrix),
      inverseProjectionViewMatrix: new Float32Array(identityMatrix),
      viewport: Object.freeze({ width: 8, height: 8 }),
      generationValues: Object.freeze([]),
    }),
    logicalViewport: Object.freeze({ width: 8, height: 8 }),
    backingViewport: Object.freeze({ width: 8, height: 8 }),
    density: Object.freeze({ x: 1, y: 1 }),
  });
}

function untexturedPBRMesh(options: Readonly<{
  metallic: number;
  roughness: number;
  z?: number;
}>): SettledWebGLMesh {
  const model = matrix(1);
  model[14] = options.z ?? 0;
  const factor = Object.freeze([0.5, 0.5, 0.5, 1] as const);
  return Object.freeze({
    kind: 'mesh' as const,
    componentName: 'ImportedSurface',
    source: undefined,
    geometry: createWebGLGeometry({
      positions: [-1, -1, 0, 3, -1, 0, -1, 3, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    }),
    identity: Object.freeze({}),
    model,
    color: Object.freeze([1, 1, 1, 1] as const),
    lit: true,
    material: Object.freeze({
      type: 'pbr-metallic-roughness' as const,
      baseColorFactor: factor,
      metallicFactor: options.metallic,
      roughnessFactor: options.roughness,
    }),
    shading: Object.freeze({
      kind: 'pbr-metallic-roughness' as const,
      linearBaseColorFactor: factor,
      metallicFactor: options.metallic,
      roughnessFactor: options.roughness,
      normalMatrix: normalMatrix(1),
    }),
    sourceIndex: 0,
    target: undefined,
    keyboardNavigationBounds: undefined,
    viewDepth: 1,
    worldBounds: Object.freeze({
      minimumX: -1,
      minimumY: -1,
      minimumZ: options.z ?? 0,
      maximumX: 3,
      maximumY: 3,
      maximumZ: options.z ?? 0,
    }),
    castShadow: true,
    receiveShadow: true,
  });
}

function background(
  color: SettledWebGLBackground['color'],
): SettledWebGLBackground {
  return Object.freeze({ kind: 'background', color: Object.freeze(color) });
}

function fixedLights(): readonly SettledWebGLLight[] {
  return Object.freeze([
    Object.freeze({
      kind: 'ambient' as const,
      linearColor: Object.freeze([0.1, 0.2, 0.3] as const),
      intensity: 0.4,
    }),
    Object.freeze({
      kind: 'hemisphere' as const,
      linearSkyColor: Object.freeze([0.5, 0.6, 0.7] as const),
      linearGroundColor: Object.freeze([0.8, 0.9, 1] as const),
      axis: Object.freeze([0, 1, 0] as const),
      intensity: 1.1,
    }),
    Object.freeze({
      kind: 'directional' as const,
      identity: DIRECTIONAL_LIGHT_IDENTITY,
      linearColor: Object.freeze([0.2, 0.3, 0.4] as const),
      direction: Object.freeze([0, 0, -1] as const),
      intensity: 2,
      castShadow: true,
    }),
    Object.freeze({
      kind: 'point' as const,
      identity: POINT_LIGHT_IDENTITY,
      linearColor: Object.freeze([0.3, 0.4, 0.5] as const),
      position: Object.freeze([1, 2, 3] as const),
      range: undefined,
      intensity: 3,
      castShadow: true,
    }),
    Object.freeze({
      kind: 'spot' as const,
      identity: SPOT_LIGHT_IDENTITY,
      linearColor: Object.freeze([0.4, 0.5, 0.6] as const),
      position: Object.freeze([-1, -2, -3] as const),
      direction: Object.freeze([0, -1, 0] as const),
      range: 5,
      innerConeCosine: 0.9,
      outerConeCosine: 0.7,
      intensity: 4,
      castShadow: true,
    }),
    Object.freeze({
      kind: 'ambient' as const,
      linearColor: Object.freeze([0, 0, 0] as const),
      intensity: 0,
    }),
    Object.freeze({
      kind: 'point' as const,
      identity: SECOND_POINT_LIGHT_IDENTITY,
      linearColor: Object.freeze([1, 0, 0] as const),
      position: Object.freeze([0, 0, 1] as const),
      range: 2,
      intensity: 1,
      castShadow: false,
    }),
    Object.freeze({
      kind: 'spot' as const,
      identity: SECOND_SPOT_LIGHT_IDENTITY,
      linearColor: Object.freeze([0, 1, 0] as const),
      position: Object.freeze([0, 0, 1] as const),
      direction: Object.freeze([0, 0, -1] as const),
      range: undefined,
      innerConeCosine: 1,
      outerConeCosine: 1,
      intensity: 1,
      castShadow: false,
    }),
  ]);
}

function matrix(seed: number): Float32Array {
  const value = new Float32Array(16);
  value[0] = seed;
  value[5] = 1;
  value[10] = 1;
  value[15] = 1;
  return value;
}

function normalMatrix(seed: number): Float32Array {
  return new Float32Array([
    seed, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
}

interface ThrowPoint {
  readonly operation: string;
  readonly at: number;
  readonly error: Error;
}

interface RendererGLOptions {
  readonly throws?: readonly ThrowPoint[];
  readonly loseContextAt?: Omit<ThrowPoint, 'error'>;
}

interface UniformWrite {
  readonly programKey: WebGLProgramKey | undefined;
  readonly name: string;
  readonly value: readonly number[];
}

interface DrawSnapshot {
  readonly method: 'drawArrays' | 'drawElements';
  readonly programKey: WebGLProgramKey | undefined;
  readonly blend: boolean;
  readonly blendFunction: readonly unknown[];
  readonly depthTest: boolean;
  readonly depthMask: boolean;
  readonly depthFunction: unknown;
  readonly attributeLocations: readonly number[];
  readonly model: readonly number[];
  readonly uniforms: Readonly<Record<string, readonly number[]>>;
}

interface ProgramHandle {
  readonly kind: 'program';
  readonly id: number;
  key?: WebGLProgramKey;
}

interface UniformLocationHandle {
  readonly program: ProgramHandle;
  readonly name: string;
}

interface RendererGLRecording {
  readonly gl: WebGL2RenderingContext;
  readonly operations: unknown[][];
  readonly draws: DrawSnapshot[];
  readonly clearColors: number[][];
  readonly clears: number[][];
  readonly uniformWrites: UniformWrite[];
  readonly getParameter: ReturnType<typeof vi.fn>;
  readonly bindFramebuffer: ReturnType<typeof vi.fn>;
  readonly bindTexture: ReturnType<typeof vi.fn>;
  readonly clear: ReturnType<typeof vi.fn>;
  readonly createProgram: ReturnType<typeof vi.fn>;
  readonly deleteProgram: ReturnType<typeof vi.fn>;
  readonly createVertexArray: ReturnType<typeof vi.fn>;
  readonly deleteVertexArray: ReturnType<typeof vi.fn>;
  readonly createBuffer: ReturnType<typeof vi.fn>;
  readonly deleteBuffer: ReturnType<typeof vi.fn>;
  readonly drawArrays: ReturnType<typeof vi.fn>;
  readonly drawElements: ReturnType<typeof vi.fn>;
  readonly readPixels: ReturnType<typeof vi.fn>;
  readonly createFramebuffer: ReturnType<typeof vi.fn>;
  readonly deleteFramebuffer: ReturnType<typeof vi.fn>;
  readonly framebufferTexture2D: ReturnType<typeof vi.fn>;
  readonly framebufferTextureLayer: ReturnType<typeof vi.fn>;
  readonly createTexture: ReturnType<typeof vi.fn>;
  readonly deleteTexture: ReturnType<typeof vi.fn>;
  readonly texStorage3D: ReturnType<typeof vi.fn>;
}

function createRendererGL(
  options: RendererGLOptions = {},
): RendererGLRecording {
  const constants = createConstants();
  const operations: unknown[][] = [];
  const counts = new Map<string, number>();
  const state = {
    capabilities: new Map<number, boolean>(),
    depthMask: true,
    depthFunction: 0,
    blendFunction: [] as unknown[],
    clearColor: [0, 0, 0, 0] as number[],
    currentProgram: null as ProgramHandle | null,
    attributeLocations: [] as number[],
    uniforms: new Map<ProgramHandle, Map<string, readonly number[]>>(),
  };
  const draws: DrawSnapshot[] = [];
  const clearColors: number[][] = [];
  const clears: number[][] = [];
  const uniformWrites: UniformWrite[] = [];
  let nextHandle = 0;
  let contextLost = false;
  const handle = (kind: string) => ({ kind, id: ++nextHandle });
  const maybeThrow = (operation: string) => {
    const at = (counts.get(operation) ?? 0) + 1;
    counts.set(operation, at);
    if (
      options.loseContextAt?.operation === operation &&
      options.loseContextAt.at === at
    ) {
      contextLost = true;
    }
    const point = options.throws?.find(
      candidate => candidate.operation === operation && candidate.at === at,
    );
    if (point) throw point.error;
  };
  const record = (operation: string, args: unknown[]) => {
    operations.push([operation, ...args]);
    maybeThrow(operation);
  };
  const method = <T extends unknown[], R>(
    operation: string,
    implementation?: (...args: T) => R,
  ) => vi.fn((...args: T) => {
    record(operation, args);
    return implementation?.(...args) as R;
  });
  const writeUniform = (
    operation: string,
    location: UniformLocationHandle,
    value: readonly number[],
  ) => {
    record(operation, [location, value]);
    const copied = [...value];
    let programUniforms = state.uniforms.get(location.program);
    if (!programUniforms) {
      programUniforms = new Map();
      state.uniforms.set(location.program, programUniforms);
    }
    programUniforms.set(location.name, copied);
    uniformWrites.push({
      programKey: location.program.key,
      name: location.name,
      value: copied,
    });
  };
  const draw = (operation: DrawSnapshot['method'], args: unknown[]) => {
    record(operation, args);
    const program = state.currentProgram;
    const uniforms = program === null ? new Map() :
      state.uniforms.get(program) ?? new Map();
    const snapshot = Object.fromEntries(
      Array.from(uniforms, ([name, value]) => [name, [...value]]),
    );
    draws.push({
      method: operation,
      programKey: program?.key,
      blend: state.capabilities.get(constants.BLEND) ?? false,
      blendFunction: [...state.blendFunction],
      depthTest: state.capabilities.get(constants.DEPTH_TEST) ?? false,
      depthMask: state.depthMask,
      depthFunction: state.depthFunction,
      attributeLocations: [...state.attributeLocations],
      model: [...(snapshot.u_model ?? [])],
      uniforms: snapshot,
    });
    state.attributeLocations.length = 0;
  };
  const methods = {
    getParameter: method<[number], number>('getParameter', parameter =>
      parameter === constants.MAX_COMBINED_TEXTURE_IMAGE_UNITS ? 16 : 4096),
    getError: method<[], number>('getError', () => constants.NO_ERROR),
    isContextLost: method<[], boolean>('isContextLost', () => contextLost),
    bindFramebuffer: method('bindFramebuffer'),
    viewport: method('viewport'),
    disable: method<[number], void>('disable', capability => {
      state.capabilities.set(capability, false);
    }),
    scissor: method('scissor'),
    useProgram: method<[ProgramHandle | null], void>('useProgram', program => {
      state.currentProgram = program;
      state.attributeLocations.length = 0;
    }),
    bindVertexArray: method('bindVertexArray'),
    bindBuffer: method('bindBuffer'),
    activeTexture: method('activeTexture'),
    bindTexture: method('bindTexture'),
    bindSampler: method('bindSampler'),
    colorMask: method('colorMask'),
    depthMask: method<[boolean], void>('depthMask', value => {
      state.depthMask = value;
    }),
    stencilMaskSeparate: method('stencilMaskSeparate'),
    enable: method<[number], void>('enable', capability => {
      state.capabilities.set(capability, true);
    }),
    blendColor: method('blendColor'),
    blendEquationSeparate: method('blendEquationSeparate'),
    blendFuncSeparate: method<unknown[], void>(
      'blendFuncSeparate',
      (...values) => {
        state.blendFunction = values;
      },
    ),
    depthFunc: method<[number], void>('depthFunc', value => {
      state.depthFunction = value;
    }),
    depthRange: method('depthRange'),
    cullFace: method('cullFace'),
    frontFace: method('frontFace'),
    stencilFuncSeparate: method('stencilFuncSeparate'),
    stencilOpSeparate: method('stencilOpSeparate'),
    polygonOffset: method('polygonOffset'),
    clearColor: method<[number, number, number, number], void>(
      'clearColor',
      (...color) => {
        state.clearColor = color;
        clearColors.push([...color]);
      },
    ),
    clearDepth: method('clearDepth'),
    clearStencil: method('clearStencil'),
    pixelStorei: method('pixelStorei'),
    clear: method<[number], void>('clear', () => {
      clears.push([...state.clearColor]);
    }),
    createShader: method<[number], object>('createShader', type => ({
      ...handle('shader'),
      type,
    })),
    shaderSource: method('shaderSource'),
    compileShader: method('compileShader'),
    getShaderParameter: method<unknown[], boolean>(
      'getShaderParameter',
      () => true,
    ),
    getShaderInfoLog: method<unknown[], string>('getShaderInfoLog', () => ''),
    deleteShader: method('deleteShader'),
    createProgram: method<[], ProgramHandle>('createProgram', () =>
      handle('program') as ProgramHandle,
    ),
    attachShader: method('attachShader'),
    detachShader: method('detachShader'),
    linkProgram: method('linkProgram'),
    getProgramParameter: method<unknown[], boolean>(
      'getProgramParameter',
      () => true,
    ),
    getProgramInfoLog: method<unknown[], string>('getProgramInfoLog', () => ''),
    deleteProgram: method('deleteProgram'),
    getUniformLocation: method<
      [ProgramHandle, string],
      UniformLocationHandle
    >('getUniformLocation', (program, name) => {
      if (name === 'u_display_base_color') program.key = 'unlit';
      if (name === 'u_normal_matrix') program.key = 'lambert';
      if (name === 'u_metallic_factor') {
        program.key = 'pbr-metallic-roughness' as WebGLProgramKey;
      }
      if (name === 'u_shadow_projection_view') program.key = 'shadow-depth';
      return { program, name };
    }),
    createVertexArray: method<[], object>('createVertexArray', () =>
      handle('vertex-array'),
    ),
    deleteVertexArray: method('deleteVertexArray'),
    createBuffer: method<[], object>('createBuffer', () => handle('buffer')),
    deleteBuffer: method('deleteBuffer'),
    bufferData: method('bufferData'),
    enableVertexAttribArray: method('enableVertexAttribArray'),
    disableVertexAttribArray: method('disableVertexAttribArray'),
    vertexAttrib2f: method('vertexAttrib2f'),
    vertexAttrib4f: method('vertexAttrib4f'),
    vertexAttribPointer: method<[number, ...unknown[]], void>(
      'vertexAttribPointer',
      location => {
        if (state.currentProgram !== null) {
          state.attributeLocations.push(location);
        }
      },
    ),
    uniformMatrix4fv: vi.fn((
      location: UniformLocationHandle,
      _transpose: boolean,
      value: Float32Array,
    ) => writeUniform('uniformMatrix4fv', location, Array.from(value))),
    uniformMatrix3fv: vi.fn((
      location: UniformLocationHandle,
      _transpose: boolean,
      value: Float32Array,
    ) => writeUniform('uniformMatrix3fv', location, Array.from(value))),
    uniform4f: vi.fn((
      location: UniformLocationHandle,
      ...value: number[]
    ) => writeUniform('uniform4f', location, value)),
    uniform3f: vi.fn((
      location: UniformLocationHandle,
      ...value: number[]
    ) => writeUniform('uniform3f', location, value)),
    uniform1f: vi.fn((location: UniformLocationHandle, value: number) =>
      writeUniform('uniform1f', location, [value])),
    uniform1i: vi.fn((location: UniformLocationHandle, value: number) =>
      writeUniform('uniform1i', location, [value])),
    uniform1iv: vi.fn((
      location: UniformLocationHandle,
      value: Int32Array,
    ) => writeUniform('uniform1iv', location, Array.from(value))),
    uniform4fv: vi.fn((
      location: UniformLocationHandle,
      value: Float32Array,
    ) => writeUniform('uniform4fv', location, Array.from(value))),
    drawArrays: vi.fn((...args: unknown[]) => draw('drawArrays', args)),
    drawElements: vi.fn((...args: unknown[]) => draw('drawElements', args)),
    readPixels: method('readPixels'),
    createFramebuffer: method<[], object>('createFramebuffer', () =>
      handle('framebuffer'),
    ),
    deleteFramebuffer: method('deleteFramebuffer'),
    framebufferTexture2D: method('framebufferTexture2D'),
    framebufferTextureLayer: method('framebufferTextureLayer'),
    blitFramebuffer: method('blitFramebuffer'),
    checkFramebufferStatus: method<[], number>(
      'checkFramebufferStatus',
      () => constants.FRAMEBUFFER_COMPLETE,
    ),
    drawBuffers: method('drawBuffers'),
    readBuffer: method('readBuffer'),
    createTexture: method<[], object>('createTexture', () => handle('texture')),
    deleteTexture: method('deleteTexture'),
    texParameteri: method('texParameteri'),
    texImage2D: method('texImage2D'),
    texStorage3D: method('texStorage3D'),
  };
  const gl = { ...constants, ...methods } as unknown as WebGL2RenderingContext;
  return {
    gl,
    operations,
    draws,
    clearColors,
    clears,
    uniformWrites,
    ...methods,
  };
}

function traceTransactions(recording: RendererGLRecording): void {
  const original = WebGLRendererResourceCache.prototype.beginRender;
  vi.spyOn(WebGLRendererResourceCache.prototype, 'beginRender')
    .mockImplementation(function (this: WebGLRendererResourceCache) {
      recording.operations.push(['beginRender']);
      const transaction = original.call(this);
      return Object.freeze({
        useProgram: transaction.useProgram,
        useGeometry: transaction.useGeometry,
        useTexture: transaction.useTexture,
        useInstanced: transaction.useInstanced,
        commit() {
          recording.operations.push(['commit']);
          transaction.commit();
        },
        rollback(contextLost?: boolean) {
          recording.operations.push(['rollback', contextLost]);
          transaction.rollback(contextLost);
        },
      }) satisfies WebGLRendererResourceTransaction;
    });
}

function valuesFor(
  writes: readonly UniformWrite[],
  name: string,
): readonly (readonly number[])[] {
  return writes.filter(write => write.name === name).map(write => write.value);
}

function float32(values: readonly number[]): number[] {
  return Array.from(new Float32Array(values));
}

function createConstants(): Record<string, number> {
  const names = [
    'ACTIVE_TEXTURE', 'ALWAYS', 'ARRAY_BUFFER', 'BACK', 'BLEND',
    'BROWSER_DEFAULT_WEBGL', 'CCW', 'COLOR_BUFFER_BIT', 'COMPILE_STATUS',
    'CULL_FACE', 'DEPTH_BUFFER_BIT', 'DEPTH_TEST', 'ELEMENT_ARRAY_BUFFER',
    'DEPTH_ATTACHMENT', 'DEPTH_COMPONENT', 'DEPTH_COMPONENT24',
    'DRAW_FRAMEBUFFER',
    'FLOAT', 'FRAGMENT_SHADER', 'FRAMEBUFFER', 'FRAMEBUFFER_COMPLETE', 'FRONT', 'FUNC_ADD', 'KEEP',
    'LEQUAL', 'LESS', 'LINK_STATUS', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
    'MAX_CUBE_MAP_TEXTURE_SIZE', 'MAX_TEXTURE_SIZE', 'NEAREST', 'NONE',
    'ONE', 'ONE_MINUS_SRC_ALPHA', 'PACK_ALIGNMENT', 'PACK_ROW_LENGTH',
    'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS', 'POLYGON_OFFSET_FILL',
    'READ_FRAMEBUFFER', 'SCISSOR_TEST', 'SRC_ALPHA', 'STATIC_DRAW',
    'STENCIL_TEST', 'TEXTURE0',
    'TEXTURE_2D', 'TEXTURE_2D_ARRAY', 'TEXTURE_3D', 'TEXTURE_CUBE_MAP',
    'TEXTURE_CUBE_MAP_POSITIVE_X', 'TEXTURE_MAG_FILTER', 'TEXTURE_MIN_FILTER',
    'TEXTURE_WRAP_R', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'CLAMP_TO_EDGE',
    'LINEAR', 'MIRRORED_REPEAT', 'REPEAT', 'RGBA',
    'TRIANGLES', 'UNPACK_ALIGNMENT', 'UNPACK_COLORSPACE_CONVERSION_WEBGL',
    'UNPACK_FLIP_Y_WEBGL', 'UNPACK_IMAGE_HEIGHT',
    'UNPACK_PREMULTIPLY_ALPHA_WEBGL', 'UNPACK_ROW_LENGTH',
    'UNPACK_SKIP_IMAGES', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS',
    'UNSIGNED_BYTE', 'UNSIGNED_INT', 'VERTEX_SHADER', 'ZERO',
  ];
  return {
    NO_ERROR: 0,
    ...Object.fromEntries(names.map((name, index) => [name, index + 1])),
  };
}

function operationCount(
  operations: readonly unknown[][],
  operation: string,
): number {
  return operations.filter(([name]) => name === operation).length;
}

function indexOf(operations: readonly unknown[][], operation: string): number {
  return operations.findIndex(([name]) => name === operation);
}

function lastIndexOf(
  operations: readonly unknown[][],
  operation: string,
): number {
  return operations.findLastIndex(([name]) => name === operation);
}
