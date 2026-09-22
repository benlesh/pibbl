import { Box3, Vector3, type Camera, type Object3D } from "three";
import type { CRCRenderLayerSize, LayoutBox } from "@crc/core";

const bounds = new Box3();
const point = new Vector3();

export function projectObjectBounds(
  object: Object3D,
  camera: Camera,
  size: Readonly<CRCRenderLayerSize>,
): Readonly<LayoutBox> | undefined {
  bounds.setFromObject(object);
  if (bounds.isEmpty()) return undefined;

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).project(camera);
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          return undefined;
        }
        const projectedX = ((point.x + 1) * size.width) / 2;
        const projectedY = ((1 - point.y) * size.height) / 2;
        left = Math.min(left, projectedX);
        top = Math.min(top, projectedY);
        right = Math.max(right, projectedX);
        bottom = Math.max(bottom, projectedY);
      }
    }
  }

  left = Math.max(0, Math.min(size.width, left));
  top = Math.max(0, Math.min(size.height, top));
  right = Math.max(0, Math.min(size.width, right));
  bottom = Math.max(0, Math.min(size.height, bottom));
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom) ||
    right <= left ||
    bottom <= top
  ) {
    return undefined;
  }
  return Object.freeze({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}
