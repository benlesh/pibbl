import type { BorrowedTextureRaster, TexturePlacement } from '../lib/textures/texture-protocol.js';

export interface DisplacementCoordinates {
  readonly originX: number;
  readonly originY: number;
  readonly density: number;
  readonly region: Readonly<{ x: number; y: number; width: number; height: number }>;
}
const vertexSource = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = vec2((p.x + 1.) * .5, 1. - (p.y + 1.) * .5); gl_Position = vec4(p, 0, 1); }
`;
const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D scene, map;
uniform vec2 strength, logicalOrigin, logicalSize, mapOrigin, tileSize;
uniform float rotation;
in vec2 uv;
out vec4 outputColor;
vec4 sourcePixel(ivec2 p) {
  ivec2 size = textureSize(scene, 0);
  if (any(lessThan(p, ivec2(0))) || any(greaterThanEqual(p, size))) return vec4(0);
  return texelFetch(scene, p, 0);
}
vec4 sourceSample(vec2 p) {
  vec2 pixel = p * vec2(textureSize(scene, 0)) - .5;
  ivec2 base = ivec2(floor(pixel));
  vec2 f = fract(pixel);
  return mix(mix(sourcePixel(base), sourcePixel(base + ivec2(1, 0)), f.x),
             mix(sourcePixel(base + ivec2(0, 1)), sourcePixel(base + ivec2(1, 1)), f.x), f.y);
}
float decode(float channel) {
  float byteValue = channel * 255.;
  return (byteValue - 128.) / (byteValue < 128. ? 128. : 127.);
}
void main() {
  vec2 local = logicalOrigin + uv * logicalSize - mapOrigin;
  float c = cos(rotation), s = sin(rotation);
  vec2 mapUV = vec2(c * local.x + s * local.y, -s * local.x + c * local.y) / tileSize;
  vec4 field = texture(map, mapUV);
  vec2 displacement = vec2(decode(field.r), decode(field.g)) * field.a * strength;
  outputColor = sourceSample(uv + displacement);
}
`;

/** Optional synchronous image processor; scene pixels are never read back. */
export class DisplacementGpu {
  private readonly canvas = new OffscreenCanvas(1, 1);
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buffer: WebGLBuffer;
  private readonly source: WebGLTexture;
  private readonly maps = new Map<object, { texture: WebGLTexture; revision: number }>();
  private disposed = false;

  constructor() {
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error('Displacement requires OffscreenCanvas WebGL2 support.');
    this.gl = gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    let fragment: WebGLShader | undefined;
    let program: WebGLProgram | null = null;
    try {
      fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error('Could not allocate displacement program.');
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Displacement shader link failed: ${gl.getProgramInfoLog(program)}`);
    } catch (error) { if (program) gl.deleteProgram(program); throw error; }
    finally { gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); }
    this.program = program;
    const vao = gl.createVertexArray(), buffer = gl.createBuffer();
    if (!vao || !buffer) { if (vao) gl.deleteVertexArray(vao); if (buffer) gl.deleteBuffer(buffer); gl.deleteProgram(program); throw new Error('Could not allocate displacement geometry.'); }
    this.vao = vao; this.buffer = buffer;
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    const source = gl.createTexture();
    if (!source) {
      if (source) gl.deleteTexture(source);
      gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program);
      throw new Error('Could not allocate displacement textures.');
    }
    this.source = source;
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }

  apply(source: OffscreenCanvas, map: BorrowedTextureRaster, strengthPixels: number, placement: Readonly<TexturePlacement> = map.placement, coordinates?: DisplacementCoordinates): ImageBitmap {
    if (this.disposed) throw new Error('Cannot use a disposed displacement processor.');
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error('Displacement WebGL2 context was lost.');
    const maximum = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (Math.max(source.width, source.height, map.width, map.height) > maximum) throw new RangeError('Displacement target exceeds WebGL2 maximum texture size.');
    if (this.canvas.width !== source.width) this.canvas.width = source.width;
    if (this.canvas.height !== source.height) this.canvas.height = source.height;
    gl.viewport(0, 0, source.width, source.height);
    gl.useProgram(this.program); gl.bindVertexArray(this.vao);
    this.upload(0, this.source, source, true, false);
    let cached = this.maps.get(map.resource);
    if (!cached) {
      const texture = gl.createTexture();
      if (!texture) throw new Error('Could not allocate displacement map texture.');
      cached = { texture, revision: -1 };
      this.maps.set(map.resource, cached);
    }
    this.upload(1, cached.texture, map.source, false, placement.mode !== 'stretch', cached.revision !== map.revision);
    cached.revision = map.revision;
    const density = coordinates?.density ?? 1;
    const region = coordinates?.region ?? { x: 0, y: 0, width: source.width / density, height: source.height / density };
    const uniform = (name: string) => gl.getUniformLocation(this.program, name);
    gl.uniform1i(uniform('scene'), 0); gl.uniform1i(uniform('map'), 1);
    gl.uniform2f(uniform('strength'), strengthPixels / source.width, strengthPixels / source.height);
    gl.uniform2f(uniform('logicalOrigin'), coordinates?.originX ?? 0, coordinates?.originY ?? 0);
    gl.uniform2f(uniform('logicalSize'), source.width / density, source.height / density);
    gl.uniform2f(uniform('mapOrigin'), region.x + (placement.offsetX ?? 0), region.y + (placement.offsetY ?? 0));
    gl.uniform2f(uniform('tileSize'), placement.mode === 'stretch' ? region.width : placement.tileWidth ?? map.width, placement.mode === 'stretch' ? region.height : placement.tileHeight ?? map.height);
    gl.uniform1f(uniform('rotation'), (placement.rotation ?? 0) * Math.PI / 180);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`Displacement GPU processing failed (${error}).`);
    return this.canvas.transferToImageBitmap();
  }
  private upload(unit: number, texture: WebGLTexture, canvas: OffscreenCanvas, premultiply: boolean, repeat: boolean, upload = true): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    if (upload) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  retainMaps(resources: ReadonlySet<object>): void {
    for (const [resource, cached] of this.maps) {
      if (!resources.has(resource)) { this.gl.deleteTexture(cached.texture); this.maps.delete(resource); }
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    gl.deleteTexture(this.source); this.retainMaps(new Set()); gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
    this.canvas.width = 0; this.canvas.height = 0;
  }
}
function compile(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error('Could not allocate displacement shader.');
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
    throw new Error(`Displacement shader compile failed: ${error}`);
  }
  return shader;
}
