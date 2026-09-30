import { TextureSource, type BufferGeometry, type Camera, type Material, type Object3D, type Scene, type Skeleton, type LOD, type Texture } from "three";

type PickObject = Object3D & {
  geometry?: BufferGeometry;
  material?: Material | Material[];
  skeleton?: Skeleton;
};

/** CPU-only resources; never submitted to the renderer or uploaded to a GPU. */
export function snapshotPickingScene(scene: Scene, camera: Camera) {
  const copies = new Map<Object3D, Object3D>();
  const originals = new Map<Object3D, Object3D>();
  const geometries = new Map<BufferGeometry, BufferGeometry>();
  const materials = new Map<Material, Material>();
  const copyMaterial = (material: Material) => {
    let copy = materials.get(material);
    if (!copy) { copy = cloneWithoutMetadata(material); materials.set(material, copy); }
    return copy;
  };
  const copyObject = (source: PickObject): PickObject => {
    const existing = copies.get(source);
    if (existing) return existing;
    const copy = cloneWithoutMetadata(source) as PickObject;
    copies.set(source, copy); originals.set(copy, source);
    // Own raycast overrides retain their normal receiver. Closures over external
    // mutable state still require an application-supplied generation-safe picker.
    copy.raycast = source.raycast;
    if (source.geometry) {
      let geometry = geometries.get(source.geometry);
      if (!geometry) { geometry = source.geometry.clone(); geometries.set(source.geometry, geometry); }
      copy.geometry = geometry;
    }
    if (source.material) copy.material = Array.isArray(source.material)
      ? source.material.map(copyMaterial) : copyMaterial(source.material);
    for (const child of source.children) copy.add(copyObject(child));
    if ((source as LOD).isLOD) {
      // LOD.copy normally recursively clones these independently of children.
      // Reconnect its level table to the one generation-owned identity map.
      for (const level of (source as LOD).levels) (copy as LOD).levels.push({
        object: copyObject(level.object), distance: level.distance, hysteresis: level.hysteresis,
      });
    }
    return copy;
  };
  const root = copyObject(scene) as Scene;
  const cameraCopy = copyObject(camera) as Camera;
  // Skeleton.clone alone retains live bones and inverse matrices.
  for (const [source, copy] of copies) {
    const skeleton = (source as PickObject).skeleton;
    if (!skeleton) continue;
    const snapshot = skeleton.clone();
    snapshot.bones = skeleton.bones.map(bone => copyObject(bone) as typeof bone);
    snapshot.boneInverses = skeleton.boneInverses.map(matrix => matrix.clone());
    (copy as PickObject).skeleton = snapshot;
  }
  return { scene: root, camera: cameraCopy, copies, originals };
}

/** Three copy() serializes userData; built-in raycasting does not consume it.
 * Supply a metadata-free copy input without mutating application resources or
 * reading their userData accessors. Metadata stays opaque and application-owned;
 * custom raycasts using it are not made generation-safe by this copy.
 */
function cloneWithoutMetadata<T extends Object3D | Material>(source: T): T {
  const metadata = Object.getOwnPropertyDescriptor(source, "userData");
  // A shadow input inherits ordinary fields, avoiding one descriptor allocation
  // per source property. Only metadata is overridden for Three's copy() call.
  const input = Object.create(source, {
    userData: { value: {}, writable: true, enumerable: true, configurable: true },
  }) as T;
  if ((source as unknown as LOD).isLOD) Object.defineProperty(input, "levels", { value: [] });
  if ((source as unknown as { isBatchedMesh?: boolean }).isBatchedMesh) {
    // BatchedMesh.copy clones its textures, then writes image.data. Texture.clone
    // shares Source, so give that copy operation detached image containers first.
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(source))) {
      const texture = descriptor.value as Texture | undefined;
      if (!texture?.isTexture) continue;
      const view = Object.create(texture, {
        source: { value: new TextureSource({ ...(texture.image as object) }) },
      });
      Object.defineProperty(input, key, { value: view });
    }
  }
  const copy = input.clone(false) as T;
  if (metadata) Object.defineProperty(copy, "userData", metadata);
  return copy;
}
