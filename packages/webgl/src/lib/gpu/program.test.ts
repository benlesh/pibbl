import { describe, expect, it, vi } from 'vitest';
import {
  createBuiltInProgram,
  deleteBuiltInProgram,
} from './program.js';

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
}

function createProgramGL(options: ProgramGLOptions = {}) {
  const VERTEX_SHADER = 1;
  const FRAGMENT_SHADER = 2;
  const COMPILE_STATUS = 3;
  const LINK_STATUS = 4;
  const shaders: Array<{ readonly type: number; readonly id: number }> = [];
  const shaderCleanup: string[] = [];
  const program = { kind: 'program' };
  const createShader = vi.fn((type: number) => {
    const shader = { type, id: shaders.length + 1 };
    shaders.push(shader);
    return shader;
  });
  const deleteShader = vi.fn((shader: { readonly id: number }) => {
    shaderCleanup.push(`delete:${shader.id}`);
  });
  const createProgram = vi.fn(() => program);
  const deleteProgram = vi.fn();
  const gl = {
    VERTEX_SHADER,
    FRAGMENT_SHADER,
    COMPILE_STATUS,
    LINK_STATUS,
    createShader,
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter(shader: { readonly type: number }, parameter: number) {
      expect(parameter).toBe(COMPILE_STATUS);
      const failedType = options.failedShader === 'vertex' ?
        VERTEX_SHADER : FRAGMENT_SHADER;
      return options.failedShader === undefined || shader.type !== failedType;
    },
    getShaderInfoLog: vi.fn(() => options.shaderLog ?? ''),
    deleteShader,
    createProgram,
    attachShader: vi.fn(),
    detachShader: vi.fn((_program: object, shader: { readonly id: number }) => {
      shaderCleanup.push(`detach:${shader.id}`);
    }),
    linkProgram: vi.fn(),
    getProgramParameter(_program: object, parameter: number) {
      expect(parameter).toBe(LINK_STATUS);
      return !options.linkFailed;
    },
    getProgramInfoLog: vi.fn(() => options.programLog ?? ''),
    deleteProgram,
    getUniformLocation: vi.fn((_program: object, name: string) =>
      name === options.missingUniform ? null : { name }),
  } as unknown as WebGL2RenderingContext;
  return {
    gl,
    program,
    shaders,
    shaderCleanup,
    createProgram,
    deleteProgram,
    deleteShader,
  };
}
