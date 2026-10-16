import {
  ReflectionGpu,
  type ReflectionGpuCallbacks,
} from "./reflection-gpu.js";

const fragment = `#version 300 es
precision highp float;
uniform sampler2D scene, map, lightMap;
in vec2 uv;
out vec4 outputColor;
vec3 linearRgb(vec3 c) {
  return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
}
void main() {
  float coverage=texture(scene,uv).a;
  vec4 backdrop=texture(map,uv);
  // A transparent current target is evaluated over white; DOM pixels are unavailable.
  vec3 background=mix(vec3(1),backdrop.rgb,backdrop.a);
  float luminance=dot(linearRgb(background),vec3(.2126,.7152,.0722));
  // Equal black/white contrast occurs at sqrt(.05*1.05)-.05.
  int choice=luminance<.179128784747792?0:1;
  vec4 color=texelFetch(lightMap,ivec2(choice,0),0);
  float alpha=coverage*color.a;
  outputColor=vec4(color.rgb*alpha,alpha);
}
`;
/** Shares the existing private GPU resource/context-loss implementation. */
export class BackdropContrastGpu extends ReflectionGpu {
  constructor(callbacks: Readonly<ReflectionGpuCallbacks> = {}) {
    super(callbacks, fragment);
  }
}
