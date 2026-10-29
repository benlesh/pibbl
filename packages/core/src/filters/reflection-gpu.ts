import type { BorrowedTextureRaster, TexturePlacement } from '../lib/textures/texture-protocol.js';

export interface ReflectionCoordinates {
  readonly originX: number;
  readonly originY: number;
  readonly density: number;
  readonly region: Readonly<{ x: number; y: number; width: number; height: number }>;
}
export interface ReflectionGpuCallbacks {
  readonly onContextLost?: () => void;
  readonly onContextRestored?: () => void;
}
const vertexSource = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = vec2((p.x + 1.) * .5, 1. - (p.y + 1.) * .5); gl_Position = vec4(p, 0, 1); }
`;
export interface ReflectionSettings {
  readonly opacity: number; readonly threshold: number; readonly softness: number;
  readonly direction: readonly [number, number];
  readonly depth?: number;
}
export type ReflectionLight = { readonly color: string } | { readonly image: HTMLImageElement | ImageBitmap } | { readonly raster: BorrowedTextureRaster };
export interface ReflectionWarp { readonly map: BorrowedTextureRaster; readonly strength: number; readonly region: ReflectionCoordinates['region']; }
const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D scene, map, lightMap, warpMap;
uniform vec2 logicalOrigin, logicalSize, mapOrigin, tileSize, lightOrigin, lightSize, warpOrigin, warpSize, warpStrength, direction;
uniform float rotation, lightRotation, warpRotation, opacity, threshold, softness;
in vec2 uv;
out vec4 outputColor;
float decode(float c) { float b=c*255.; return (b-128.)/(b<128.?128.:127.); }
vec2 coordinates(vec2 origin, vec2 size, float angle) {
  vec2 p=logicalOrigin+uv*logicalSize-origin;
  float c=cos(angle),s=sin(angle);
  return vec2(c*p.x+s*p.y,-s*p.x+c*p.y)/size;
}
vec4 sourcePixel(ivec2 p) {
  ivec2 size=textureSize(scene,0);
  if(any(lessThan(p,ivec2(0)))||any(greaterThanEqual(p,size))) return vec4(0);
  return texelFetch(scene,p,0);
}
vec4 sourceSample(vec2 p) {
  vec2 pixel=p*vec2(textureSize(scene,0))-.5;
  ivec2 base=ivec2(floor(pixel)); vec2 f=fract(pixel);
  return mix(mix(sourcePixel(base),sourcePixel(base+ivec2(1,0)),f.x),mix(sourcePixel(base+ivec2(0,1)),sourcePixel(base+ivec2(1,1)),f.x),f.y);
}
void main() {
  vec4 warp=texture(warpMap,coordinates(warpOrigin,warpSize,warpRotation));
  vec4 base=sourceSample(uv+vec2(decode(warp.r),decode(warp.g))*warp.a*warpStrength);
  vec4 field=texture(map,coordinates(mapOrigin,tileSize,rotation));
  vec2 slope=vec2(decode(field.r),decode(field.g));
  float coverage=smoothstep(threshold,threshold+softness,dot(slope,direction))*field.a*opacity;
  vec4 light=texture(lightMap,coordinates(lightOrigin,lightSize,lightRotation)+slope*.035);
  float amount=coverage*light.a;
  outputColor=vec4(base.rgb*(1.-amount)+base.a*light.rgb*amount,base.a);
}
`;

/** Optional synchronous image processor; scene pixels are never read back. */
export class ReflectionGpu {
  private readonly canvas = new OffscreenCanvas(1, 1);
  private gl: WebGL2RenderingContext | undefined;
  private resources: ReflectionResources | undefined;
  private readonly maps = new Map<object, { texture: WebGLTexture; revision: number }>();
  private readonly directKey = {};
  private colorCanvas: OffscreenCanvas | undefined;
  private directRevision = 0;
  private disposed = false;
  private lost = false;
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.disposed || this.lost) return;
    this.lost = true;
    this.releaseResources(false);
    this.callbacks.onContextLost?.();
  };
  private readonly onContextRestored = (): void => {
    if (this.disposed || !this.lost) return;
    this.lost = false;
    this.callbacks.onContextRestored?.();
  };

  constructor(private readonly callbacks: Readonly<ReflectionGpuCallbacks> = {}, private readonly fragment = fragmentSource) {
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  get isContextLost(): boolean {
    return this.lost || this.gl?.isContextLost() === true;
  }

  private acquireResources(): ReflectionResources {
    if (this.disposed) throw new Error('Cannot use a disposed reflection processor.');
    if (this.isContextLost) throw new Error('Reflection WebGL2 context was lost.');
    if (this.resources) return this.resources;
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error('Reflection requires OffscreenCanvas WebGL2 support.');
    if (gl.isContextLost()) throw new Error('Reflection WebGL2 context was lost.');
    this.gl = gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    let fragment: WebGLShader | undefined;
    let program: WebGLProgram | null = null;
    try {
      fragment = compile(gl, gl.FRAGMENT_SHADER, this.fragment);
      program = gl.createProgram();
      if (!program) throw new Error('Could not allocate reflection program.');
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Reflection shader link failed: ${gl.getProgramInfoLog(program)}`);
    } catch (error) { if (program) gl.deleteProgram(program); throw error; }
    finally { gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); }
    const vao = gl.createVertexArray(), buffer = gl.createBuffer();
    if (!vao || !buffer) { if (vao) gl.deleteVertexArray(vao); if (buffer) gl.deleteBuffer(buffer); gl.deleteProgram(program); throw new Error('Could not allocate reflection geometry.'); }
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    const source = gl.createTexture();
    if (!source) {
      if (source) gl.deleteTexture(source);
      gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program);
      throw new Error('Could not allocate reflection textures.');
    }
    const resources: ReflectionResources = { program, vao, buffer, source };
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    this.resources = resources;
    return resources;
  }

  apply(source: OffscreenCanvas, map: BorrowedTextureRaster, light: ReflectionLight, settings: ReflectionSettings, coordinates: ReflectionCoordinates, warp?: ReflectionWarp): ImageBitmap {
    const { gl, program, vao, source: sourceTexture } = this.acquireResourcesWithContext();
    const maximum = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (Math.max(source.width, source.height, map.width, map.height, warp?.map.width ?? 0, warp?.map.height ?? 0) > maximum) throw new RangeError('Reflection target exceeds WebGL2 maximum texture size.');
    if (this.canvas.width !== source.width) this.canvas.width = source.width;
    if (this.canvas.height !== source.height) this.canvas.height = source.height;
    gl.viewport(0, 0, source.width, source.height); gl.useProgram(program); gl.bindVertexArray(vao);
    this.upload(gl, 0, sourceTexture, source, true, false);
    const uploaded = new Map<object, number>();
    const bind = (unit: number, raster: {source: TexImageSource; width:number; height:number; resource:object; revision:number; placement:Readonly<TexturePlacement>}) => {
      if (Math.max(raster.width,raster.height)>maximum) throw new RangeError('Reflection light exceeds WebGL2 maximum texture size.');
      let cached=this.maps.get(raster.resource);
      if (!cached) {
        const texture=gl.createTexture(); if(!texture) throw new Error('Could not allocate reflection input texture.');
        cached={texture,revision:-1}; this.maps.set(raster.resource,cached);
      }
      this.upload(gl,unit,cached.texture,raster.source,false,raster.placement.mode!=='stretch',cached.revision!==raster.revision && uploaded.get(raster.resource)!==raster.revision);
      uploaded.set(raster.resource,raster.revision);
    };
    bind(1,map); bind(3,warp?.map ?? map);
    let lightPlacement: Readonly<TexturePlacement> = {mode:'stretch'};
    let lightWidth=1,lightHeight=1;
    if ('raster' in light) { bind(2,light.raster); lightPlacement=light.raster.placement; lightWidth=light.raster.width; lightHeight=light.raster.height; }
    else {
      let image: TexImageSource;
      if ('color' in light) {
        const canvas=this.colorCanvas ??= new OffscreenCanvas(1,1);
        const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Reflection colors require Canvas 2D.');
        ctx.clearRect(0,0,1,1); ctx.fillStyle=light.color; ctx.fillRect(0,0,1,1); image=canvas;
      } else { image=light.image; lightWidth='naturalWidth' in light.image?light.image.naturalWidth:light.image.width; lightHeight='naturalHeight' in light.image?light.image.naturalHeight:light.image.height; }
      bind(2,{source:image,width:lightWidth,height:lightHeight,resource:this.directKey,revision:++this.directRevision,placement:lightPlacement});
    }
    const uniform=(name:string)=>gl.getUniformLocation(program,name);
    const placement=(origin:string,size:string,angle:string,value:Readonly<TexturePlacement>,region:ReflectionCoordinates['region'],width:number,height:number)=>{
      gl.uniform2f(uniform(origin),region.x+(value.offsetX??0),region.y+(value.offsetY??0));
      gl.uniform2f(uniform(size),value.mode==='stretch'?region.width:value.tileWidth??width,value.mode==='stretch'?region.height:value.tileHeight??height);
      gl.uniform1f(uniform(angle),(value.rotation??0)*Math.PI/180);
    };
    gl.uniform1i(uniform('scene'),0); gl.uniform1i(uniform('map'),1); gl.uniform1i(uniform('lightMap'),2); gl.uniform1i(uniform('warpMap'),3);
    gl.uniform2f(uniform('logicalOrigin'),coordinates.originX,coordinates.originY);
    gl.uniform2f(uniform('logicalSize'),source.width/coordinates.density,source.height/coordinates.density);
    placement('mapOrigin','tileSize','rotation',map.placement,coordinates.region,map.width,map.height);
    placement('lightOrigin','lightSize','lightRotation',lightPlacement,coordinates.region,lightWidth,lightHeight);
    placement('warpOrigin','warpSize','warpRotation',warp?.map.placement??map.placement,warp?.region??coordinates.region,warp?.map.width??map.width,warp?.map.height??map.height);
    gl.uniform2f(uniform('warpStrength'),(warp?.strength??0)*coordinates.density/source.width,(warp?.strength??0)*coordinates.density/source.height);
    gl.uniform2f(uniform('direction'),settings.direction[0],settings.direction[1]);
    gl.uniform1f(uniform('depth'),settings.depth ?? 0);
    gl.uniform1f(uniform('opacity'),settings.opacity); gl.uniform1f(uniform('threshold'),settings.threshold); gl.uniform1f(uniform('softness'),settings.softness);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    if(this.isContextLost) throw new Error('Reflection WebGL2 context was lost.');
    const error=gl.getError(); if(error!==gl.NO_ERROR) throw new Error(`Reflection GPU processing failed (${error}).`);
    for(const [resource,revision] of uploaded) this.maps.get(resource)!.revision=revision;
    return this.canvas.transferToImageBitmap();
  }
  private acquireResourcesWithContext(): ReflectionResources & { gl: WebGL2RenderingContext } {
    const resources = this.acquireResources();
    const gl = this.gl;
    if (!gl || gl.isContextLost()) throw new Error('Reflection WebGL2 context was lost.');
    return { ...resources, gl };
  }
  private upload(gl: WebGL2RenderingContext, unit: number, texture: WebGLTexture, canvas: TexImageSource, premultiply: boolean, repeat: boolean, upload = true): void {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    if (upload) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  retainMaps(resources: ReadonlySet<object>): void {
    const gl = this.gl;
    for (const [resource, cached] of this.maps) {
      if (resource !== this.directKey && !resources.has(resource)) { if (gl && !gl.isContextLost()) gl.deleteTexture(cached.texture); this.maps.delete(resource); }
    }
  }
  private releaseResources(deleteResources: boolean): void {
    const gl = this.gl;
    const resources = this.resources;
    this.resources = undefined;
    if (gl && !gl.isContextLost() && deleteResources) {
      gl.deleteTexture(resources?.source ?? null);
      for (const cached of this.maps.values()) gl.deleteTexture(cached.texture);
      if (resources) { gl.deleteBuffer(resources.buffer); gl.deleteVertexArray(resources.vao); gl.deleteProgram(resources.program); }
    }
    this.maps.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.releaseResources(true);
    this.canvas.width = 0; this.canvas.height = 0;
    if(this.colorCanvas) this.colorCanvas.width=this.colorCanvas.height=0;
    this.colorCanvas=undefined;
  }
}
interface ReflectionResources {
  readonly program: WebGLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly buffer: WebGLBuffer;
  readonly source: WebGLTexture;
}
function compile(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error('Could not allocate reflection shader.');
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
    throw new Error(`Reflection shader compile failed: ${error}`);
  }
  return shader;
}
