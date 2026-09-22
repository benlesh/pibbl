import {
  Vector2,
  type Camera,
  type Object3D,
  type Raycaster,
  type Scene,
} from "three";
import type { CRCRenderLayerSize } from "@crc/core";
import type { CRCThreePicker, CRCThreeTarget } from "./types.js";

export function createDefaultPicker(
  scene: Scene,
  camera: Camera,
  raycaster: Raycaster,
  size: Readonly<CRCRenderLayerSize>,
  targetMap: ReadonlyMap<Object3D, CRCThreeTarget>,
  disabledRoots: ReadonlySet<Object3D>,
): CRCThreePicker {
  const ndc = new Vector2();
  return (point) => {
    ndc.set((point.x / size.width) * 2 - 1, 1 - (point.y / size.height) * 2);
    raycaster.setFromCamera(ndc, camera);
    const intersections = raycaster.intersectObject(scene, true);
    for (const intersection of intersections) {
      if (!isEligible(intersection.object, disabledRoots)) continue;
      const target = nearestTarget(intersection.object, targetMap);
      return target
        ? Object.freeze({ kind: "target" as const, target })
        : Object.freeze({ kind: "block" as const });
    }
    return Object.freeze({ kind: "miss" as const });
  };
}

function isEligible(
  object: Object3D,
  disabledRoots: ReadonlySet<Object3D>,
): boolean {
  for (
    let current: Object3D | null = object;
    current;
    current = current.parent
  ) {
    if (!current.visible || disabledRoots.has(current)) return false;
  }
  const material = (
    object as Object3D & {
      material?: { visible?: boolean } | readonly { visible?: boolean }[];
    }
  ).material;
  return isMaterialArray(material)
    ? material.some((candidate) => candidate.visible !== false)
    : material?.visible !== false;
}

function isMaterialArray(
  material:
    { visible?: boolean } | readonly { visible?: boolean }[] | undefined,
): material is readonly { visible?: boolean }[] {
  return Array.isArray(material);
}

function nearestTarget(
  object: Object3D,
  targetMap: ReadonlyMap<Object3D, CRCThreeTarget>,
): Object3D | undefined {
  for (
    let current: Object3D | null = object;
    current;
    current = current.parent
  ) {
    if (targetMap.has(current)) return current;
  }
  return undefined;
}
