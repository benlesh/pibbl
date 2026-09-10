export interface WebGLBuiltInProgram {
  readonly program: WebGLProgram;
  readonly model: WebGLUniformLocation;
  readonly view: WebGLUniformLocation;
  readonly projection: WebGLUniformLocation;
  readonly color: WebGLUniformLocation;
  readonly positionAttribute: 0;
}

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 a_position;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

void main() {
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
}
`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 out_color;

void main() {
  out_color = u_color;
}
`;

/** Compiles and links the one positions-only unlit built-in program. */
export function createBuiltInProgram(
  gl: WebGL2RenderingContext,
  componentName: string,
): WebGLBuiltInProgram {
  let vertex: WebGLShader | undefined;
  let fragment: WebGLShader | undefined;
  let program: WebGLProgram | undefined;
  let published = false;
  try {
    vertex = compileShader(
      gl,
      componentName,
      'vertex',
      gl.VERTEX_SHADER,
      VERTEX_SOURCE,
    );
    fragment = compileShader(
      gl,
      componentName,
      'fragment',
      gl.FRAGMENT_SHADER,
      FRAGMENT_SOURCE,
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

    const builtIn = Object.freeze({
      program,
      model: requireUniform(gl, program, componentName, 'u_model'),
      view: requireUniform(gl, program, componentName, 'u_view'),
      projection: requireUniform(
        gl,
        program,
        componentName,
        'u_projection',
      ),
      color: requireUniform(gl, program, componentName, 'u_color'),
      positionAttribute: 0 as const,
    });
    published = true;
    return builtIn;
  } finally {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    if (!published && program) gl.deleteProgram(program);
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
    gl.deleteShader(shader);
    throw error;
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
