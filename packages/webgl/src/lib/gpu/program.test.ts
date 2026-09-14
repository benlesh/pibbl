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

    expect(() => createBuiltInProgram(gl, 'Cube')).toThrowError(
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

    expect(() => createBuiltInProgram(gl, 'Mesh')).toThrowError(
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

    expect(() => createBuiltInProgram(gl, 'Sphere')).toThrowError(
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
      returned = createBuiltInProgram(gl, 'LostMesh').program;
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
      returned = createBuiltInProgram(gl, 'LostSphere').program;
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
      createBuiltInProgram(gl, 'BrokenMesh');
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
      createBuiltInProgram(gl, 'BrokenMesh');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(operationalError);
    expect(deleteShader).toHaveBeenCalledOnce();
    expect(reported).toEqual([cleanupError]);
  });

  it('publishes a linked program only after resolving every built-in uniform', () => {
    const {
      gl,
      program,
      shaders,
      shaderCleanup,
      deleteProgram,
      deleteShader,
    } = createProgramGL();

    const builtIn = createBuiltInProgram(gl, 'Mesh');

    expect(builtIn).toEqual({
      program,
      model: { name: 'u_model' },
      view: { name: 'u_view' },
      projection: { name: 'u_projection' },
      color: { name: 'u_color' },
      positionAttribute: 0,
    });
    expect(deleteShader.mock.calls.map(([shader]) => shader)).toEqual(shaders);
    expect(shaderCleanup).toEqual([
      `detach:${shaders[0]!.id}`,
      `detach:${shaders[1]!.id}`,
      `delete:${shaders[0]!.id}`,
      `delete:${shaders[1]!.id}`,
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

    expect(() => createBuiltInProgram(gl, 'Cube')).toThrowError(
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

  it('publishes a real WebGL2 program with no attached shader intermediates', () => {
    const gl = new OffscreenCanvas(8, 8).getContext('webgl2');
    expect(gl).not.toBeNull();

    const builtIn = createBuiltInProgram(gl!, 'Mesh');

    expect(gl!.getAttachedShaders(builtIn.program)).toEqual([]);
    deleteBuiltInProgram(gl!, builtIn);
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
  const programs: Array<{ readonly kind: string }> = [];
  const shaderCleanup: string[] = [];
  const program = { kind: 'program' };
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
    programs.push(program);
    return program;
  });
  const deleteProgram = vi.fn();
  const shaderSource = vi.fn(() => {
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
    getUniformLocation: vi.fn((_program: object, name: string) =>
      name === options.missingUniform ? null : { name }),
    isContextLost,
  } as unknown as WebGL2RenderingContext;
  return {
    gl,
    program,
    programs,
    shaders,
    shaderCleanup,
    createProgram,
    attachShader,
    detachShader,
    deleteProgram,
    deleteShader,
  };
}
