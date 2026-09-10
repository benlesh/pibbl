import type { CRCWebGLGeometry } from '../types.js';
import { createWebGLGeometry } from './geometry.js';

const cubeGeometry = createWebGLGeometry({
  positions: [
    -0.5, -0.5, -0.5,
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5,
  ],
  indices: [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
    3, 7, 6, 3, 6, 2,
    0, 1, 5, 0, 5, 4,
  ],
});

export const getCubeGeometry = (): CRCWebGLGeometry => cubeGeometry;
