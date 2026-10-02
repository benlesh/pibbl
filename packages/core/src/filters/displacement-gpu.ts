import type { BorrowedTextureRaster } from '../lib/textures/texture-protocol.js';

/** Small, lazy WebGL2 processor. It never reads captured scene pixels back. */
export class DisplacementGpu {
  private readonly canvas = new OffscreenCanvas(1, 1);
  private readonly gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: false });
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly source: WebGLTexture;
  private readonly map: WebGLTexture;

  constructor() {
    if (!this.gl) throw new Error('Displacement requires OffscreenCanvas WebGL2 support.');
    const gl = this.gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; out vec2 uv; void main(){uv=(p+1.)*.5;gl_Position=vec4(p,0,1);}');
    const fragment = compile(gl, gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; uniform sampler2D s,m; uniform float strength; in vec2 uv; out vec4 o; void main(){vec4 q=texture(m,uv); vec2 d=vec2(q.r<.501?(q.r*255.-128.)/128.:(q.r*255.-128.)/127.,q.g<.501?(q.g*255.-128.)/128.:(q.g*255.-128.)/127.)*q.a*strength; o=texture(s,uv+d);}');
    this.program = gl.createProgram()!; gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(`Displacement shader link failed: ${gl.getProgramInfoLog(this.program)}`);
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(this.program, 'p'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    this.source = texture(gl); this.map = texture(gl);
  }
  apply(source: OffscreenCanvas, map: BorrowedTextureRaster, strengthPixels: number): ImageBitmap {
    const gl = this.gl!; this.canvas.width = source.width; this.canvas.height = source.height; gl.viewport(0,0,source.width,source.height);
    gl.useProgram(this.program); gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.source); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.map); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,map.source);
    gl.uniform1i(gl.getUniformLocation(this.program,'s'),0); gl.uniform1i(gl.getUniformLocation(this.program,'m'),1); gl.uniform1f(gl.getUniformLocation(this.program,'strength'),strengthPixels/source.width);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); return this.canvas.transferToImageBitmap();
  }
  dispose(): void { const gl=this.gl; if (!gl) return; gl.deleteTexture(this.source); gl.deleteTexture(this.map); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program); }
}
function texture(gl: WebGL2RenderingContext): WebGLTexture { const value=gl.createTexture(); if(!value) throw new Error('Could not allocate displacement texture.'); gl.bindTexture(gl.TEXTURE_2D,value); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE); return value; }
function compile(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader { const shader=gl.createShader(kind)!; gl.shaderSource(shader,source); gl.compileShader(shader); if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(`Displacement shader compile failed: ${gl.getShaderInfoLog(shader)}`); return shader; }
