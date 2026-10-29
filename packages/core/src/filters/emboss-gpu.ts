import {
  ReflectionGpu,
  type ReflectionGpuCallbacks,
} from "./reflection-gpu.js";

// Reuses the existing GPU surface/cache ownership; this shader consumes scalar
// height instead of the reflected-light operation's pre-encoded RG slopes.
const fragment = `#version 300 es
precision highp float;
uniform sampler2D scene, map;
uniform vec2 logicalOrigin, logicalSize, mapOrigin, tileSize, direction;
uniform float rotation, opacity, depth;
in vec2 uv;
out vec4 outputColor;
vec2 coordinates(vec2 logical) {
  vec2 p=logical-mapOrigin;
  float c=cos(rotation),s=sin(rotation);
  return vec2(c*p.x+s*p.y,-s*p.x+c*p.y)/tileSize;
}
float height(vec2 p) {
  vec4 field=texture(map,coordinates(p));
  return dot(field.rgb,vec3(.2126,.7152,.0722))*field.a;
}
void main() {
  vec4 base=texture(scene,uv);
  vec2 p=logicalOrigin+uv*logicalSize;
  vec2 gradient=.5*vec2(height(p+vec2(1,0))-height(p-vec2(1,0)),height(p+vec2(0,1))-height(p-vec2(0,1)));
  vec3 normal=normalize(vec3(-depth*gradient,1.));
  vec3 light=normalize(vec3(direction*.8,1.));
  float shade=max(0.,dot(normal,light))/light.z;
  // A flat map is exactly neutral. Multiply premultiplied color, preserve alpha.
  outputColor=vec4(clamp(base.rgb*mix(1.,shade,opacity),vec3(0),vec3(base.a)),base.a);
}
`;
export class EmbossGpu extends ReflectionGpu {
  constructor(callbacks: Readonly<ReflectionGpuCallbacks> = {}) {
    super(callbacks, fragment);
  }
}
