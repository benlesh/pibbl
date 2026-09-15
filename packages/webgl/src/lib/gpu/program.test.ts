import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBuiltInProgram,
  deleteBuiltInProgram,
} from './program.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createBuiltInProgram', () => {
  it('names the component and vertex stage and deletes a failed shader', () => {
    const { gl, shaders, deleteShader, createProgram } = createProgramGL({
      failedShader: 'vertex',
      shaderLog: ' driver\n vertex\t failure ',
    });

    expect(() => createBuiltInProgram(gl, 'lambert', 'Cube')).toThrowError(
      /Cube.*vertex.*compil.*driver vertex failure/i,
    );
    expect(deleteShader).toHaveBeenCalledOnce();
    expect(deleteShader).toHaveBeenCalledWith(shaders[0]);
    expect(createProgram).not.toHaveBeenCalled();
  });

  it('deletes both shader intermediates when fragment compilation fails', () => {
    const { gl, shaders, deleteShader, createProgram } = createProgramGL({
      failedShader: 'fragment',
      shaderLog: 'fragment failure',
    });

    expect(() => createBuiltInProgram(gl, 'lambert', 'Mesh')).toThrowError(
      /Mesh.*fragment.*compil.*fragment failure/i,
    );
    expect(deleteShader.mock.calls.map(([shader]) => shader)).toEqual([
      shaders[1],
      shaders[0],
    ]);
    expect(createProgram).not.toHaveBeenCalled();
  });

  it('names the link stage and deletes the program and shader intermediates', () => {
    const {
      gl,
      program,
      shaders,
      deleteProgram,
      deleteShader,
    } = createProgramGL({
      linkFailed: true,
      programLog: ' link\n failure ',
    });

    expect(() => createBuiltInProgram(gl, 'lambert', 'Sphere')).toThrowError(
      /Sphere.*program.*link.*link failure/i,
    );
    expect(deleteProgram).toHaveBeenCalledOnce();
    expect(deleteProgram).toHaveBeenCalledWith(program);
    expect(deleteShader.mock.calls.map(([shader]) => shader)).toEqual([
      shaders[0],
      shaders[1],
    ]);
  });

  it('abandons a compile-status-failed shader without deletion when the context is lost', () => {
    const {
      gl,
      shaders,
      detachShader,
      deleteProgram,
      deleteShader,
      createProgram,
    } = createProgramGL({
      failedShader: 'vertex',
      contextLostOnFailedShaderStatus: true,
    });

    let returned: WebGLProgram | undefined;
    let caught: unknown;
    try {
      returned = createBuiltInProgram(gl, 'lambert', 'LostMesh').program;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/LostMesh.*vertex.*compil/i);
    expect(returned).toBeUndefined();
    expect(shaders).toHaveLength(1);
    expect(createProgram).not.toHaveBeenCalled();
    expect(detachShader).not.toHaveBeenCalled();
    expect(deleteShader).not.toHaveBeenCalled();
    expect(deleteProgram).not.toHaveBeenCalled();
  });

  it('abandons link-status-failed shaders and program without deletion when the context is lost', () => {
    const {
      gl,
      shaders,
      programs,
      attachShader,
      detachShader,
      deleteProgram,
      deleteShader,
    } = createProgramGL({
      linkFailed: true,
      contextLostOnFailedProgramStatus: true,
    });

    let returned: WebGLProgram | undefined;
    let caught: unknown;
    try {
      returned = createBuiltInProgram(gl, 'lambert', 'LostSphere').program;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/LostSphere.*program.*link/i);
    expect(returned).toBeUndefined();
    expect(shaders).toHaveLength(2);
    expect(programs).toHaveLength(1);
    expect(attachShader).toHaveBeenCalledTimes(2);
    expect(detachShader).not.toHaveBeenCalled();
    expect(deleteShader).not.toHaveBeenCalled();
    expect(deleteProgram).not.toHaveBeenCalled();
  });

  it('preserves a shader failure when context-loss detection itself fails', () => {
    const operationalError = new Error('shader source failed');
    const detectionError = new Error('isContextLost failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const { gl, detachShader, deleteProgram, deleteShader } = createProgramGL({
      shaderSourceError: operationalError,
      contextLossCheckError: detectionError,
    });

    let caught: unknown;
    try {
      createBuiltInProgram(gl, 'lambert', 'BrokenMesh');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(operationalError);
    expect(reported).toEqual([detectionError]);
    expect(detachShader).not.toHaveBeenCalled();
    expect(deleteShader).not.toHaveBeenCalled();
    expect(deleteProgram).not.toHaveBeenCalled();
  });

  it('preserves a shader failure when healthy-context cleanup itself fails', () => {
    const operationalError = new Error('shader source failed');
    const cleanupError = new Error('shader deletion failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const { gl, deleteShader } = createProgramGL({
      shaderSourceError: operationalError,
      deleteShaderError: cleanupError,
    });

    let caught: unknown;
    try {
      createBuiltInProgram(gl, 'lambert', 'BrokenMesh');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(operationalError);
    expect(deleteShader).toHaveBeenCalledOnce();
    expect(reported).toEqual([cleanupError]);
  });

  it('selects separate keyed sources and resolves every required location', () => {
    const {
      gl,
      programs,
      shaders,
      shaderSources,
      uniformNames,
      shaderCleanup,
      deleteProgram,
      deleteShader,
    } = createProgramGL();

    const unlit = createBuiltInProgram(gl, 'unlit', 'Mesh');
    const lambert = createBuiltInProgram(gl, 'lambert', 'Cube');

    expect(unlit).toEqual({
      key: 'unlit',
      program: programs[0],
      model: { name: 'u_model' },
      view: { name: 'u_view' },
      projection: { name: 'u_projection' },
      displayBaseColor: { name: 'u_display_base_color' },
      linearEmissive: { name: 'u_linear_emissive' },
      positionAttribute: 0,
    });
    expect(lambert).toEqual({
      key: 'lambert',
      program: programs[1],
      model: { name: 'u_model' },
      view: { name: 'u_view' },
      projection: { name: 'u_projection' },
      normalMatrix: { name: 'u_normal_matrix' },
      linearBaseColor: { name: 'u_linear_base_color' },
      linearEmissive: { name: 'u_linear_emissive' },
      alpha: { name: 'u_alpha' },
      lightCount: { name: 'u_light_count' },
      lightKinds: { name: 'u_light_kind[0]' },
      lightColorIntensities: {
        name: 'u_light_color_intensity[0]',
      },
      lightPositionRanges: { name: 'u_light_position_range[0]' },
      lightDirectionInnerCosines: {
        name: 'u_light_direction_inner_cosine[0]',
      },
      lightGroundOuterCosines: {
        name: 'u_light_ground_outer_cosine[0]',
      },
      shadowEnabled: { name: 'u_shadow_enabled[0]' },
      shadowMatrices: { name: 'u_shadow_matrix[0]' },
      shadowParameters: { name: 'u_shadow_parameters[0]' },
      receiveShadow: { name: 'u_receive_shadow' },
      shadow2DSamplers: Array.from(
        { length: 8 },
        (_, index) => ({ name: `u_shadow_map_2d_${index}` }),
      ),
      shadowCubeSamplers: Array.from(
        { length: 8 },
        (_, index) => ({ name: `u_shadow_map_cube_${index}` }),
      ),
      positionAttribute: 0,
      normalAttribute: 1,
    });
    expect(shaderSources.slice(0, 2)).not.toEqual(shaderSources.slice(2));
    expect(uniformNames).toContain('u_light_kind[0]');
    expect(uniformNames).toContain('u_light_color_intensity[0]');
    expect(deleteShader.mock.calls.map(([shader]) => shader)).toEqual(shaders);
    expect(shaderCleanup).toEqual([
      `detach:${shaders[0]!.id}`,
      `detach:${shaders[1]!.id}`,
      `delete:${shaders[0]!.id}`,
      `delete:${shaders[1]!.id}`,
      `detach:${shaders[2]!.id}`,
      `detach:${shaders[3]!.id}`,
      `delete:${shaders[2]!.id}`,
      `delete:${shaders[3]!.id}`,
    ]);
    expect(deleteProgram).not.toHaveBeenCalled();
  });

  it('detaches and deletes linked shaders before deleting a uniform-failed program', () => {
    const {
      gl,
      program,
      shaders,
      shaderCleanup,
      deleteProgram,
    } = createProgramGL({ missingUniform: 'u_projection' });

    expect(() => createBuiltInProgram(gl, 'unlit', 'Cube')).toThrowError(
      /Cube.*program.*u_projection/i,
    );
    expect(shaderCleanup).toEqual([
      `detach:${shaders[0]!.id}`,
      `detach:${shaders[1]!.id}`,
      `delete:${shaders[0]!.id}`,
      `delete:${shaders[1]!.id}`,
    ]);
    expect(deleteProgram).toHaveBeenCalledOnce();
    expect(deleteProgram).toHaveBeenCalledWith(program);
  });

  it('diagnoses an inactive Lambert array uniform by its portable [0] name', () => {
    const {
      gl,
      program,
      shaders,
      shaderCleanup,
      deleteProgram,
      uniformNames,
    } = createProgramGL({ missingUniform: 'u_light_kind[0]' });

    expect(() => createBuiltInProgram(gl, 'lambert', 'Cube')).toThrowError(
      /Cube.*program.*u_light_kind\[0\]/i,
    );
    expect(uniformNames).toContain('u_light_kind[0]');
    expect(shaderCleanup).toEqual([
      `detach:${shaders[0]!.id}`,
      `detach:${shaders[1]!.id}`,
      `delete:${shaders[0]!.id}`,
      `delete:${shaders[1]!.id}`,
    ]);
    expect(deleteProgram).toHaveBeenCalledExactlyOnceWith(program);
  });

  it('deletes each published keyed program by its exact handle once', () => {
    const { gl, programs, deleteProgram } = createProgramGL();
    const unlit = createBuiltInProgram(gl, 'unlit', 'Mesh');
    const lambert = createBuiltInProgram(gl, 'lambert', 'Cube');

    deleteBuiltInProgram(gl, lambert);
    deleteBuiltInProgram(gl, unlit);

    expect(deleteProgram.mock.calls.map(([program]) => program)).toEqual([
      programs[1],
      programs[0],
    ]);
  });

  it('links the depth program and fixed Lambert shadow sampler locations', () => {
    const { gl, shaderSources, uniformNames } = createProgramGL();
    const depth = createBuiltInProgram(gl, 'shadow-depth' as never, 'DirectionalLight') as any;
    const lambert = createBuiltInProgram(gl, 'lambert', 'Cube') as any;

    expect(depth).toMatchObject({
      key: 'shadow-depth',
      model: { name: 'u_model' },
      shadowProjectionView: { name: 'u_shadow_projection_view' },
      positionAttribute: 0,
    });
    expect(lambert.shadowEnabled).toEqual({ name: 'u_shadow_enabled[0]' });
    expect(lambert.shadowMatrices).toEqual({ name: 'u_shadow_matrix[0]' });
    expect(lambert.receiveShadow).toEqual({ name: 'u_receive_shadow' });
    expect(lambert.shadow2DSamplers).toHaveLength(8);
    expect(lambert.shadowCubeSamplers).toHaveLength(8);
    expect(uniformNames).toContain('u_shadow_map_2d_7');
    expect(uniformNames).toContain('u_shadow_map_cube_7');
    expect(shaderSources.join('\n')).toMatch(/gl_FragDepth\s*=\s*gl_FragCoord\.z/);
  });

  it('compiles and links both built-in programs in real WebGL2', () => {
    const gl = new OffscreenCanvas(8, 8).getContext('webgl2');
    expect(gl).not.toBeNull();

    for (const key of ['unlit', 'lambert', 'shadow-depth'] as const) {
      const builtIn = createBuiltInProgram(gl!, key, 'Mesh');
      expect(builtIn.key).toBe(key);
      expect(gl!.getAttachedShaders(builtIn.program)).toEqual([]);
      deleteBuiltInProgram(gl!, builtIn);
    }
    expect(gl!.getError()).toBe(gl!.NO_ERROR);
  });
});

interface ProgramGLOptions {
  readonly failedShader?: 'vertex' | 'fragment';
  readonly linkFailed?: boolean;
  readonly shaderLog?: string;
  readonly programLog?: string;
  readonly missingUniform?: string;
  readonly shaderSourceError?: Error;
  readonly contextLostOnFailedShaderStatus?: boolean;
  readonly contextLostOnFailedProgramStatus?: boolean;
  readonly contextLossCheckError?: Error;
  readonly deleteShaderError?: Error;
}

function createProgramGL(options: ProgramGLOptions = {}) {
  const VERTEX_SHADER = 1;
  const FRAGMENT_SHADER = 2;
  const COMPILE_STATUS = 3;
  const LINK_STATUS = 4;
  const shaders: Array<{ readonly type: number; readonly id: number }> = [];
  const programs: Array<{ readonly kind: string; readonly id: number }> = [];
  const program = { kind: 'program', id: 1 };
  const shaderCleanup: string[] = [];
  const shaderSources: string[] = [];
  const uniformNames: string[] = [];
  let operationalFailure = false;
  let contextLost = false;
  const createShader = vi.fn((type: number) => {
    const shader = { type, id: shaders.length + 1 };
    shaders.push(shader);
    return shader;
  });
  const deleteShader = vi.fn((shader: { readonly id: number }) => {
    shaderCleanup.push(`delete:${shader.id}`);
    if (options.deleteShaderError) throw options.deleteShaderError;
  });
  const createProgram = vi.fn(() => {
    const created = programs.length === 0 ?
      program : { kind: 'program', id: programs.length + 1 };
    programs.push(created);
    return created;
  });
  const deleteProgram = vi.fn();
  const shaderSource = vi.fn((_shader: object, source: string) => {
    shaderSources.push(source);
    if (options.shaderSourceError) {
      operationalFailure = true;
      throw options.shaderSourceError;
    }
  });
  const attachShader = vi.fn();
  const detachShader = vi.fn(
    (_program: object, shader: { readonly id: number }) => {
      shaderCleanup.push(`detach:${shader.id}`);
    },
  );
  const linkProgram = vi.fn();
  const isContextLost = vi.fn(() => {
    if (operationalFailure && options.contextLossCheckError) {
      throw options.contextLossCheckError;
    }
    return contextLost;
  });
  const gl = {
    VERTEX_SHADER,
    FRAGMENT_SHADER,
    COMPILE_STATUS,
    LINK_STATUS,
    createShader,
    shaderSource,
    compileShader: vi.fn(),
    getShaderParameter(shader: { readonly type: number }, parameter: number) {
      expect(parameter).toBe(COMPILE_STATUS);
      const failedType = options.failedShader === 'vertex' ?
        VERTEX_SHADER : FRAGMENT_SHADER;
      const succeeded =
        options.failedShader === undefined || shader.type !== failedType;
      if (!succeeded && options.contextLostOnFailedShaderStatus) {
        contextLost = true;
      }
      return succeeded;
    },
    getShaderInfoLog: vi.fn(() => options.shaderLog ?? ''),
    deleteShader,
    createProgram,
    attachShader,
    detachShader,
    linkProgram,
    getProgramParameter(_program: object, parameter: number) {
      expect(parameter).toBe(LINK_STATUS);
      if (options.linkFailed && options.contextLostOnFailedProgramStatus) {
        contextLost = true;
      }
      return !options.linkFailed;
    },
    getProgramInfoLog: vi.fn(() => options.programLog ?? ''),
    deleteProgram,
    getUniformLocation: vi.fn((_program: object, name: string) => {
      uniformNames.push(name);
      return name === options.missingUniform ? null : { name };
    }),
    isContextLost,
  } as unknown as WebGL2RenderingContext;
  return {
    gl,
    program,
    programs,
    shaders,
    shaderSources,
    uniformNames,
    shaderCleanup,
    createProgram,
    attachShader,
    detachShader,
    deleteProgram,
    deleteShader,
  };
}
