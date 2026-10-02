import { expect, it } from "vitest";
import { BoxGeometry, BatchedMesh, Matrix4, LOD, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { snapshotPickingScene } from "./picking-snapshot.js";

it("bounds shared-resource copying by unique geometry, not object count", () => {
  const scene = new Scene();
  const geometry = new BoxGeometry(2, 2, 2);
  const material = new MeshBasicMaterial();
  const camera = new PerspectiveCamera();
  for (let index = 0; index < 1024; index++) scene.add(new Mesh(geometry, material));
  try {
    const first = snapshotPickingScene(scene, camera);
    const meshes = first.scene.children as Mesh[];
    expect(meshes).toHaveLength(1024);
    const geometries = new Set(meshes.map(mesh => mesh.geometry));
    expect(geometries.size).toBe(1);
    expect(new Set(meshes.map(mesh => mesh.material)).size).toBe(1);
    const copied = meshes[0].geometry;
    expect(copied).not.toBe(geometry);
    expect(meshes[0].material).not.toBe(material);
    // Box: 24 positions + 24 normals (float3), 24 UVs (float2), 36 uint16 indices.
    const bytes = Object.values(copied.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0)
      + copied.index!.array.byteLength;
    expect(bytes).toBe(840);
    expect(copied.attributes.position.array).not.toBe(geometry.attributes.position.array);
    for (let index = 0; index < meshes.length; index++) expect(first.originals.get(meshes[index])).toBe(scene.children[index]);
    const second = snapshotPickingScene(scene, camera);
    expect((second.scene.children[0] as Mesh).geometry).not.toBe(copied);
    geometry.translate(20, 0, 0);
    expect(copied.attributes.position.getX(0)).toBe(1);
    expect(((second.scene.children[0] as Mesh).geometry).attributes.position.getX(0)).toBe(1);
  } finally { geometry.dispose(); material.dispose(); }
});

it("copies LOD level children exactly once through the snapshot identity map", () => {
  const scene = new Scene(), camera = new PerspectiveCamera();
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const lod = new LOD(), near = new Mesh(geometry, material), far = new Mesh(geometry, material);
  lod.addLevel(near, 0); lod.addLevel(far, 10); scene.add(lod);
  try {
    const snapshot = snapshotPickingScene(scene, camera);
    const copy = snapshot.copies.get(lod) as LOD;
    expect(copy.children).toHaveLength(2);
    expect(copy.levels.map(level => level.object)).toEqual(copy.children);
    expect(copy.levels.map(level => snapshot.originals.get(level.object))).toEqual([near, far]);
    expect(copy.levels.map(level => level.distance)).toEqual([0, 10]);
  } finally { geometry.dispose(); material.dispose(); }
});

it("isolates batched transform texture data without replacing application storage", () => {
  const scene = new Scene(), camera = new PerspectiveCamera();
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const batch = new BatchedMesh(1, 24, 36, material);
  batch.addInstance(batch.addGeometry(geometry)); scene.add(batch);
  const storage = (batch as unknown as { _matricesTexture: { image: { data: Float32Array } } })._matricesTexture.image.data;
  try {
    const snapshot = snapshotPickingScene(scene, camera);
    const copy = snapshot.copies.get(batch) as BatchedMesh;
    expect((batch as unknown as { _matricesTexture: { image: { data: Float32Array } } })._matricesTexture.image.data).toBe(storage);
    batch.setMatrixAt(0, new Matrix4().makeTranslation(20, 0, 0));
    expect(copy.getMatrixAt(0, new Matrix4()).elements[12]).toBe(0);
    expect(batch.getMatrixAt(0, new Matrix4()).elements[12]).toBe(20);
  } finally { batch.dispose(); geometry.dispose(); material.dispose(); }
});

it('copies BatchedMesh children exactly once through the snapshot identity map', () => {
  const scene = new Scene(), camera = new PerspectiveCamera();
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const batch = new BatchedMesh(1, 24, 36, material), child = new Mesh(geometry, material);
  batch.addInstance(batch.addGeometry(geometry)); batch.add(child); scene.add(batch);
  try {
    const snapshot = snapshotPickingScene(scene, camera);
    const copy = snapshot.copies.get(batch)!;
    expect(copy.children).toHaveLength(1);
    expect(copy.children[0]).toBe(snapshot.copies.get(child));
    expect(snapshot.originals.get(copy.children[0])).toBe(child);
    expect(batch.children).toEqual([child]);
    expect(child.parent).toBe(batch);
  } finally { batch.dispose(); geometry.dispose(); material.dispose(); }
});
