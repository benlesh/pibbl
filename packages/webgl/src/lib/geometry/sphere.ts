import type { CRCWebGLGeometry } from '../types.js';
import { createWebGLGeometry } from './geometry.js';

const LATITUDE_SEGMENTS = 16;
const LONGITUDE_SEGMENTS = 32;
const RADIUS = 0.5;

const createSphereGeometry = (): CRCWebGLGeometry => {
  const positions = new Float32Array(
    (LATITUDE_SEGMENTS + 1) * (LONGITUDE_SEGMENTS + 1) * 3,
  );
  const indices = new Uint32Array(LATITUDE_SEGMENTS * LONGITUDE_SEGMENTS * 6);
  let positionOffset = 0;
  for (let latitude = 0; latitude <= LATITUDE_SEGMENTS; latitude += 1) {
    const polar = (latitude * Math.PI) / LATITUDE_SEGMENTS;
    const ringRadius = Math.sin(polar);
    const y = Math.cos(polar);
    for (let longitude = 0; longitude <= LONGITUDE_SEGMENTS; longitude += 1) {
      const azimuth = (longitude * Math.PI * 2) / LONGITUDE_SEGMENTS;
      positions[positionOffset] = RADIUS * ringRadius * Math.cos(azimuth);
      positions[positionOffset + 1] = RADIUS * y;
      positions[positionOffset + 2] = RADIUS * ringRadius * Math.sin(azimuth);
      positionOffset += 3;
    }
  }

  let indexOffset = 0;
  const rowLength = LONGITUDE_SEGMENTS + 1;
  for (let latitude = 0; latitude < LATITUDE_SEGMENTS; latitude += 1) {
    for (let longitude = 0; longitude < LONGITUDE_SEGMENTS; longitude += 1) {
      const topLeft = latitude * rowLength + longitude;
      const bottomLeft = topLeft + rowLength;
      indices[indexOffset] = topLeft;
      indices[indexOffset + 1] = bottomLeft;
      indices[indexOffset + 2] = topLeft + 1;
      indices[indexOffset + 3] = bottomLeft;
      indices[indexOffset + 4] = bottomLeft + 1;
      indices[indexOffset + 5] = topLeft + 1;
      indexOffset += 6;
    }
  }

  return createWebGLGeometry({ positions, indices });
};

const sphereGeometry = createSphereGeometry();

export const getSphereGeometry = (): CRCWebGLGeometry => sphereGeometry;
