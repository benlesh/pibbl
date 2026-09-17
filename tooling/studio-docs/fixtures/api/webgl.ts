export const WebGLLayer = 'webgl-layer';
export type CRCWebGLVector3 = readonly [x: number, y: number, z: number];
export interface CRCWebGLPerspectiveCamera {
  readonly type: 'perspective';
  readonly position: CRCWebGLVector3;
  readonly lookAt: CRCWebGLVector3;
}
export interface CRCOrbitCameraOptions {
  readonly orbitPoint: CRCWebGLVector3;
  readonly initialPosition: CRCWebGLVector3;
}
export type CRCOrbitCameraHandlers = Readonly<{
  onPointerDown: (event: unknown) => void;
  onWheel: (event: unknown) => void;
}>;
export interface CRCOrbitCameraResult {
  readonly position: CRCWebGLVector3;
  readonly lookAt: CRCWebGLVector3;
  readonly handlers: CRCOrbitCameraHandlers;
}
export function useOrbitCamera(
  _options: CRCOrbitCameraOptions,
): CRCOrbitCameraResult {
  throw new Error('Studio API inventory fixture only.');
}
