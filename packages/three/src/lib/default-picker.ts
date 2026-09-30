import { snapshotPickingScene } from "./picking-snapshot.js";
import {
  Vector2,
  type Camera,
  type Intersection,
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
  const snapshot = snapshotPickingScene(scene, camera);
  const snapshotTargets = new Map<Object3D, CRCThreeTarget>();
  const snapshotDisabled = new Set<Object3D>();
  for (const [object, target] of targetMap) {
    const copy = snapshot.copies.get(object);
    if (copy) snapshotTargets.set(copy, target);
  }
  for (const object of disabledRoots) {
    const copy = snapshot.copies.get(object);
    if (copy) snapshotDisabled.add(copy);
  }
  const ndc = new Vector2();
  return (point) => {
    ndc.set((point.x / size.width) * 2 - 1, 1 - (point.y / size.height) * 2);
    raycaster.layers.mask = snapshot.camera.layers.mask;
    raycaster.setFromCamera(ndc, snapshot.camera);
    const intersections = raycaster.intersectObject(snapshot.scene, true);
    for (const intersection of intersections) {
      if (!isEligible(intersection, snapshotDisabled)) continue;
      const matched = nearestTarget(intersection.object, snapshotTargets);
      const target = matched && snapshot.originals.get(matched);
      return target
        ? Object.freeze({ kind: "target" as const, target })
        : Object.freeze({ kind: "block" as const });
    }
    return Object.freeze({ kind: "miss" as const });
  };
}

function isEligible(
  intersection: Intersection<Object3D>,
  disabledRoots: ReadonlySet<Object3D>,
): boolean {
  const object = intersection.object;
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
  if (!isMaterialArray(material)) return material?.visible !== false;
  const materialIndex = intersection.face?.materialIndex;
  if (
    typeof materialIndex === "number" &&
    Number.isInteger(materialIndex) &&
    materialIndex >= 0 &&
    materialIndex < material.length
  ) {
    const intersectedMaterial = material[materialIndex];
    return (
      intersectedMaterial !== undefined && intersectedMaterial.visible !== false
    );
  }
  return material.some((candidate) => candidate.visible !== false);
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
