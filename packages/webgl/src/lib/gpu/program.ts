import { WEBGL_BUILT_IN_PROGRAM_SOURCES } from './program-sources.js';

export type WebGLProgramKey = 'unlit' | 'lambert' | 'shadow-depth';

interface WebGLProgramBase {
  readonly key: WebGLProgramKey;
  readonly program: WebGLProgram;
  readonly model: WebGLUniformLocation;
  readonly positionAttribute: 0;
}

interface WebGLMaterialProgramBase extends WebGLProgramBase {
  readonly view: WebGLUniformLocation;
  readonly projection: WebGLUniformLocation;
}

export interface WebGLUnlitProgram extends WebGLMaterialProgramBase {
  readonly key: 'unlit';
  readonly displayBaseColor: WebGLUniformLocation;
  readonly linearEmissive: WebGLUniformLocation;
}

export interface WebGLLambertProgram extends WebGLMaterialProgramBase {
  readonly key: 'lambert';
  readonly normalMatrix: WebGLUniformLocation;
  readonly linearBaseColor: WebGLUniformLocation;
  readonly linearEmissive: WebGLUniformLocation;
  readonly alpha: WebGLUniformLocation;
  readonly lightCount: WebGLUniformLocation;
  readonly lightKinds: WebGLUniformLocation;
  readonly lightColorIntensities: WebGLUniformLocation;
  readonly lightPositionRanges: WebGLUniformLocation;
  readonly lightDirectionInnerCosines: WebGLUniformLocation;
  readonly lightGroundOuterCosines: WebGLUniformLocation;
  readonly shadowEnabled: WebGLUniformLocation;
  readonly shadowMatrices: WebGLUniformLocation;
  readonly shadowParameters: WebGLUniformLocation;
  readonly shadowLayers: WebGLUniformLocation;
  readonly receiveShadow: WebGLUniformLocation;
  readonly shadowMap: WebGLUniformLocation;
  readonly normalAttribute: 1;
}

export interface WebGLShadowDepthProgram extends WebGLProgramBase {
  readonly key: 'shadow-depth';
  readonly shadowProjectionView: WebGLUniformLocation;
  readonly shadowLightPositionFar: WebGLUniformLocation;
}

export type WebGLBuiltInProgram =
  | WebGLUnlitProgram
  | WebGLLambertProgram
  | WebGLShadowDepthProgram;

/** Compiles and links one closed built-in material program. */
export function createBuiltInProgram(
  gl: WebGL2RenderingContext,
  key: WebGLProgramKey,
  componentName: string,
): WebGLBuiltInProgram {
  const sources = WEBGL_BUILT_IN_PROGRAM_SOURCES[key];
  let vertex: WebGLShader | undefined;
  let fragment: WebGLShader | undefined;
  let program: WebGLProgram | undefined;
  let linked = false;
  let published = false;
  let abandonFailedHandles: boolean | undefined;
  const shouldAbandonFailedHandles = (): boolean => {
    abandonFailedHandles ??= contextLossPreventsProgramCleanup(gl);
    return abandonFailedHandles;
  };
  try {
    vertex = compileShader(
      gl,
      componentName,
      'vertex',
      gl.VERTEX_SHADER,
      sources.vertex,
      shouldAbandonFailedHandles,
    );
    fragment = compileShader(
      gl,
      componentName,
      'fragment',
      gl.FRAGMENT_SHADER,
      sources.fragment,
      shouldAbandonFailedHandles,
    );
    program = gl.createProgram() ?? undefined;
    if (!program) {
      throw new Error(
        `${componentName} built-in program creation failed during link setup.`,
      );
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(
        `${componentName} built-in program link failed: ` +
        sanitizePlatformLog(gl.getProgramInfoLog(program)),
      );
    }
    linked = true;

    const common = {
      key,
      program,
      model: requireUniform(gl, program, componentName, 'u_model'),
      positionAttribute: 0 as const,
    };
    const materialCommon = key === 'shadow-depth' ? undefined : {
      ...common,
      view: requireUniform(gl, program, componentName, 'u_view'),
      projection: requireUniform(
        gl,
        program,
        componentName,
        'u_projection',
      ),
    };
    const builtIn: WebGLBuiltInProgram = key === 'unlit' ?
      Object.freeze({
        ...materialCommon!,
        key,
        displayBaseColor: requireUniform(
          gl,
          program,
          componentName,
          'u_display_base_color',
        ),
        linearEmissive: requireUniform(
          gl,
          program,
          componentName,
          'u_linear_emissive',
        ),
      }) : key === 'lambert' ? Object.freeze({
        ...materialCommon!,
        key,
        normalMatrix: requireUniform(
          gl,
          program,
          componentName,
          'u_normal_matrix',
        ),
        linearBaseColor: requireUniform(
          gl,
          program,
          componentName,
          'u_linear_base_color',
        ),
        linearEmissive: requireUniform(
          gl,
          program,
          componentName,
          'u_linear_emissive',
        ),
        alpha: requireUniform(gl, program, componentName, 'u_alpha'),
        lightCount: requireUniform(
          gl,
          program,
          componentName,
          'u_light_count',
        ),
        lightKinds: requireUniform(
          gl,
          program,
          componentName,
          'u_light_kind[0]',
        ),
        lightColorIntensities: requireUniform(
          gl,
          program,
          componentName,
          'u_light_color_intensity[0]',
        ),
        lightPositionRanges: requireUniform(
          gl,
          program,
          componentName,
          'u_light_position_range[0]',
        ),
        lightDirectionInnerCosines: requireUniform(
          gl,
          program,
          componentName,
          'u_light_direction_inner_cosine[0]',
        ),
        lightGroundOuterCosines: requireUniform(
          gl,
          program,
          componentName,
          'u_light_ground_outer_cosine[0]',
        ),
        shadowEnabled: requireUniform(
          gl,
          program,
          componentName,
          'u_shadow_enabled[0]',
        ),
        shadowMatrices: requireUniform(
          gl,
          program,
          componentName,
          'u_shadow_matrix[0]',
        ),
        shadowParameters: requireUniform(
          gl,
          program,
          componentName,
          'u_shadow_parameters[0]',
        ),
        shadowLayers: requireUniform(
          gl,
          program,
          componentName,
          'u_shadow_layer[0]',
        ),
        receiveShadow: requireUniform(
          gl,
          program,
          componentName,
          'u_receive_shadow',
        ),
        shadowMap: requireUniform(
          gl,
          program,
          componentName,
          'u_shadow_map',
        ),
        normalAttribute: 1 as const,
      }) : Object.freeze({
        ...common,
        key,
        shadowProjectionView: requireUniform(
          gl,
          program,
          componentName,
          'u_shadow_projection_view',
        ),
        shadowLightPositionFar: requireUniform(
          gl,
          program,
          componentName,
          'u_shadow_light_position_far',
        ),
      });
    runProgramCleanup(() => gl.detachShader(program!, vertex!));
    runProgramCleanup(() => gl.detachShader(program!, fragment!));
    runProgramCleanup(() => gl.deleteShader(vertex!));
    vertex = undefined;
    runProgramCleanup(() => gl.deleteShader(fragment!));
    fragment = undefined;
    published = true;
    return builtIn;
  } catch (error) {
    shouldAbandonFailedHandles();
    throw error;
  } finally {
    if (abandonFailedHandles !== true) {
      if (linked && program) {
        if (vertex) {
          runProgramCleanup(() => gl.detachShader(program!, vertex!));
        }
        if (fragment) {
          runProgramCleanup(() => gl.detachShader(program!, fragment!));
        }
      }
      if (vertex) runProgramCleanup(() => gl.deleteShader(vertex!));
      if (fragment) runProgramCleanup(() => gl.deleteShader(fragment!));
      if (!published && program) {
        runProgramCleanup(() => gl.deleteProgram(program!));
      }
    }
  }
}

export function deleteBuiltInProgram(
  gl: WebGL2RenderingContext,
  builtIn: WebGLBuiltInProgram,
): void {
  gl.deleteProgram(builtIn.program);
}

function compileShader(
  gl: WebGL2RenderingContext,
  componentName: string,
  stage: 'vertex' | 'fragment',
  shaderType: number,
  source: string,
  shouldAbandonFailedHandles: () => boolean,
): WebGLShader {
  const shader = gl.createShader(shaderType);
  if (!shader) {
    throw new Error(
      `${componentName} ${stage} shader creation failed before compilation.`,
    );
  }
  try {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(
        `${componentName} ${stage} shader compilation failed: ` +
        sanitizePlatformLog(gl.getShaderInfoLog(shader)),
      );
    }
    return shader;
  } catch (error) {
    if (!shouldAbandonFailedHandles()) {
      runProgramCleanup(() => gl.deleteShader(shader));
    }
    throw error;
  }
}

function contextLossPreventsProgramCleanup(
  gl: WebGL2RenderingContext,
): boolean {
  try {
    return gl.isContextLost();
  } catch (error) {
    reportSecondaryProgramError(error);
    // Unknown context validity is not permission to delete generation handles.
    return true;
  }
}

function runProgramCleanup(cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    reportSecondaryProgramError(error);
  }
}

function reportSecondaryProgramError(error: unknown): void {
  try {
    globalThis.reportError(error);
  } catch {
    // Reporting cannot suppress release of later shader intermediates.
  }
}

function requireUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  componentName: string,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) {
    throw new Error(
      `${componentName} built-in program link did not expose ${name}.`,
    );
  }
  return location;
}

function sanitizePlatformLog(log: string | null): string {
  const sanitized = Array.from(log ?? '', character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f ? ' ' : character;
  }).join('')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || 'no platform diagnostic was provided';
}
