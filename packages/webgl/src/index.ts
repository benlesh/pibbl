export { createWebGLGeometry } from './lib/geometry/geometry.js';
export { crcAnimationFrame } from './lib/hooks/crc-animation-frame.js';
export {
  crcOrbitCamera,
  type CRCOrbitCameraHandlers,
  type CRCOrbitCameraOptions,
  type CRCOrbitCameraResult,
} from './lib/hooks/crc-orbit-camera.js';
export {
  WebGLLayer,
  type WebGLLayerProps,
  type WebGLLayerStyle,
} from './lib/components/webgl-layer.js';
export {
  Group3D,
  type Group3DProps,
  type Group3DStyle,
} from './lib/components/group-3d.js';
export {
  Mesh,
  type MeshProps,
  type MeshStyle,
} from './lib/components/mesh.js';
export {
  Cube,
  type CubeProps,
  type CubeStyle,
} from './lib/components/cube.js';
export {
  Sphere,
  type SphereProps,
  type SphereStyle,
} from './lib/components/sphere.js';
export {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  SpotLight,
  type AmbientLightProps,
  type AmbientLightStyle,
  type DirectionalLightProps,
  type DirectionalLightStyle,
  type HemisphereLightProps,
  type HemisphereLightStyle,
  type PointLightProps,
  type PointLightStyle,
  type SpotLightProps,
  type SpotLightStyle,
} from './lib/components/lights.js';
export {
  WebGLBackground,
  type WebGLBackgroundProps,
  type WebGLBackgroundStyle,
} from './lib/components/webgl-background.js';
export type {
  CRCWebGLGeometry,
  CRCWebGLGeometryInput,
  CRCWebGLLambertMaterial,
  CRCWebGLMaterial,
  CRCWebGLPerspectiveCamera,
  CRCWebGLShadowQuality,
  CRCWebGLTransformStyle,
  CRCWebGLVector3,
} from './lib/types.js';
