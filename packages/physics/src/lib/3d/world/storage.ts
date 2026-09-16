import { copyCanonicalQuaternion } from "../math.js";
import type { PhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import type { ShapeRecord3D } from "../shape-records.js";

const DEFAULT_CAPACITY = 4;
const NO_INDEX = -1;
const MAX_GENERATION = 0xffff_ffff;

export const BODY_TYPE_DYNAMIC_3D = 1 << 0;
export const BODY_TYPE_KINEMATIC_3D = 1 << 1;
export const BODY_ENABLED_3D = 1 << 2;
export const BODY_TYPE_MASK_3D = BODY_TYPE_DYNAMIC_3D | BODY_TYPE_KINEMATIC_3D;

export const COLLIDER_ENABLED_3D = 1 << 0;
export const COLLIDER_SENSOR_3D = 1 << 1;
export const COLLIDER_CONTRIBUTES_TO_MASS_3D = 1 << 2;

export interface BodyDefinition3D {
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly orientationX: number;
  readonly orientationY: number;
  readonly orientationZ: number;
  readonly orientationW: number;
  readonly localCenterX?: number;
  readonly localCenterY?: number;
  readonly localCenterZ?: number;
  readonly linearVelocityX: number;
  readonly linearVelocityY: number;
  readonly linearVelocityZ: number;
  readonly angularVelocityX: number;
  readonly angularVelocityY: number;
  readonly angularVelocityZ: number;
  readonly forceX: number;
  readonly forceY: number;
  readonly forceZ: number;
  readonly torqueX: number;
  readonly torqueY: number;
  readonly torqueZ: number;
  readonly inverseMass: number;
  readonly localInverseInertiaXX: number;
  readonly localInverseInertiaYY: number;
  readonly localInverseInertiaZZ: number;
  readonly localInverseInertiaXY: number;
  readonly localInverseInertiaXZ: number;
  readonly localInverseInertiaYZ: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  readonly sleepTime: number;
  readonly translationLocks: number;
  readonly rotationLocks: number;
  readonly flags: number;
  readonly owner: unknown;
}

export interface ColliderDefinition3D {
  readonly bodyIndex: number;
  readonly bodyGeneration: number;
  readonly shape: ShapeRecord3D;
  readonly localPositionX: number;
  readonly localPositionY: number;
  readonly localPositionZ: number;
  readonly localOrientationX: number;
  readonly localOrientationY: number;
  readonly localOrientationZ: number;
  readonly localOrientationW: number;
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  readonly collisionCategory: number;
  readonly collisionMask: number;
  readonly collisionGroup: number;
  readonly tag: unknown;
  readonly handlers: unknown;
  readonly owner: unknown;
  readonly flags: number;
}

export class BodyStore3D {
  positionX: Float64Array;
  positionY: Float64Array;
  positionZ: Float64Array;
  orientationX: Float64Array;
  orientationY: Float64Array;
  orientationZ: Float64Array;
  orientationW: Float64Array;
  localCenterX: Float64Array;
  localCenterY: Float64Array;
  localCenterZ: Float64Array;
  linearVelocityX: Float64Array;
  linearVelocityY: Float64Array;
  linearVelocityZ: Float64Array;
  angularVelocityX: Float64Array;
  angularVelocityY: Float64Array;
  angularVelocityZ: Float64Array;
  forceX: Float64Array;
  forceY: Float64Array;
  forceZ: Float64Array;
  torqueX: Float64Array;
  torqueY: Float64Array;
  torqueZ: Float64Array;
  inverseMass: Float64Array;
  localInverseInertiaXX: Float64Array;
  localInverseInertiaYY: Float64Array;
  localInverseInertiaZZ: Float64Array;
  localInverseInertiaXY: Float64Array;
  localInverseInertiaXZ: Float64Array;
  localInverseInertiaYZ: Float64Array;
  linearDamping: Float64Array;
  angularDamping: Float64Array;
  gravityScale: Float64Array;
  sleepTime: Float64Array;
  translationLocks: Uint8Array;
  rotationLocks: Uint8Array;
  flags: Uint32Array;
  generations: Uint32Array;
  owners: (unknown | null)[];

  private active: Uint8Array;
  private nextFree: Int32Array;
  private freeHead = NO_INDEX;
  private disposed = false;

  constructor(
    private readonly counters: PhysicsOwnershipCounters3D,
    initialCapacity = DEFAULT_CAPACITY,
  ) {
    const capacity = normalizedCapacity(initialCapacity);
    this.positionX = new Float64Array(capacity);
    this.positionY = new Float64Array(capacity);
    this.positionZ = new Float64Array(capacity);
    this.orientationX = new Float64Array(capacity);
    this.orientationY = new Float64Array(capacity);
    this.orientationZ = new Float64Array(capacity);
    this.orientationW = new Float64Array(capacity);
    this.localCenterX = new Float64Array(capacity);
    this.localCenterY = new Float64Array(capacity);
    this.localCenterZ = new Float64Array(capacity);
    this.linearVelocityX = new Float64Array(capacity);
    this.linearVelocityY = new Float64Array(capacity);
    this.linearVelocityZ = new Float64Array(capacity);
    this.angularVelocityX = new Float64Array(capacity);
    this.angularVelocityY = new Float64Array(capacity);
    this.angularVelocityZ = new Float64Array(capacity);
    this.forceX = new Float64Array(capacity);
    this.forceY = new Float64Array(capacity);
    this.forceZ = new Float64Array(capacity);
    this.torqueX = new Float64Array(capacity);
    this.torqueY = new Float64Array(capacity);
    this.torqueZ = new Float64Array(capacity);
    this.inverseMass = new Float64Array(capacity);
    this.localInverseInertiaXX = new Float64Array(capacity);
    this.localInverseInertiaYY = new Float64Array(capacity);
    this.localInverseInertiaZZ = new Float64Array(capacity);
    this.localInverseInertiaXY = new Float64Array(capacity);
    this.localInverseInertiaXZ = new Float64Array(capacity);
    this.localInverseInertiaYZ = new Float64Array(capacity);
    this.linearDamping = new Float64Array(capacity);
    this.angularDamping = new Float64Array(capacity);
    this.gravityScale = new Float64Array(capacity);
    this.sleepTime = new Float64Array(capacity);
    this.translationLocks = new Uint8Array(capacity);
    this.rotationLocks = new Uint8Array(capacity);
    this.flags = new Uint32Array(capacity);
    this.generations = new Uint32Array(capacity);
    this.owners = createReferenceArray(capacity);
    this.active = new Uint8Array(capacity);
    this.nextFree = createFreeList(capacity, 0);
    this.freeHead = 0;
    counters.bodyStoreAllocations += 1;
    counters.liveBodyStores += 1;
    counters.bodyCapacity = capacity;
    counters.freeBodySlots = capacity;
  }

  get capacity(): number {
    return this.positionX.length;
  }

  allocate(definition: BodyDefinition3D): number {
    this.assertUsable();
    const orientation = canonicalQuaternion(
      definition.orientationX,
      definition.orientationY,
      definition.orientationZ,
      definition.orientationW,
      "body orientation",
    );
    if (this.freeHead === NO_INDEX) this.grow();
    const index = this.freeHead;
    this.freeHead = this.nextFree[index]!;
    this.nextFree[index] = NO_INDEX;
    this.active[index] = 1;
    const previousGeneration = this.generations[index]!;
    this.generations[index] = nextGeneration(previousGeneration);
    try {
      this.write(index, definition, orientation);
    } catch (error) {
      this.active[index] = 0;
      this.clear(index);
      this.generations[index] = previousGeneration;
      this.nextFree[index] = this.freeHead;
      this.freeHead = index;
      throw error;
    }
    this.counters.bodyAllocations += 1;
    this.counters.liveBodies += 1;
    this.counters.freeBodySlots -= 1;
    return index;
  }

  has(index: number, generation: number): boolean {
    return (
      !this.disposed && isLive(this.active, this.generations, index, generation)
    );
  }

  readPoseInto(
    index: number,
    generation: number,
    output: Float64Array,
    outputOffset: number,
  ): boolean {
    if (!this.has(index, generation)) return false;
    output[outputOffset] = this.positionX[index]!;
    output[outputOffset + 1] = this.positionY[index]!;
    output[outputOffset + 2] = this.positionZ[index]!;
    output[outputOffset + 3] = this.orientationX[index]!;
    output[outputOffset + 4] = this.orientationY[index]!;
    output[outputOffset + 5] = this.orientationZ[index]!;
    output[outputOffset + 6] = this.orientationW[index]!;
    return true;
  }

  setPose(
    index: number,
    generation: number,
    positionX: number,
    positionY: number,
    positionZ: number,
    orientationX: number,
    orientationY: number,
    orientationZ: number,
    orientationW: number,
  ): boolean {
    if (!this.has(index, generation)) return false;
    const orientation = canonicalQuaternion(
      orientationX,
      orientationY,
      orientationZ,
      orientationW,
      "orientation",
    );
    this.positionX[index] = positionX;
    this.positionY[index] = positionY;
    this.positionZ[index] = positionZ;
    this.orientationX[index] = orientation[0]!;
    this.orientationY[index] = orientation[1]!;
    this.orientationZ[index] = orientation[2]!;
    this.orientationW[index] = orientation[3]!;
    return true;
  }

  release(index: number, generation: number): boolean {
    if (!this.has(index, generation)) return false;
    this.active[index] = 0;
    this.clear(index);
    this.counters.bodyReleases += 1;
    this.counters.liveBodies -= 1;
    if (generation === MAX_GENERATION) {
      this.nextFree[index] = NO_INDEX;
      this.counters.retiredBodySlots += 1;
    } else {
      this.nextFree[index] = this.freeHead;
      this.freeHead = index;
      this.counters.freeBodySlots += 1;
    }
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    for (let index = 0; index < this.capacity; index += 1) {
      if (this.active[index] === 1) {
        this.release(index, this.generations[index]!);
      }
    }
    this.disposed = true;
    this.counters.bodyStoreReleases += 1;
    this.counters.liveBodyStores -= 1;
  }

  private write(
    index: number,
    definition: BodyDefinition3D,
    orientation: Float64Array,
  ): void {
    this.positionX[index] = definition.positionX;
    this.positionY[index] = definition.positionY;
    this.positionZ[index] = definition.positionZ;
    this.orientationX[index] = orientation[0]!;
    this.orientationY[index] = orientation[1]!;
    this.orientationZ[index] = orientation[2]!;
    this.orientationW[index] = orientation[3]!;
    this.localCenterX[index] = definition.localCenterX ?? 0;
    this.localCenterY[index] = definition.localCenterY ?? 0;
    this.localCenterZ[index] = definition.localCenterZ ?? 0;
    this.linearVelocityX[index] = definition.linearVelocityX;
    this.linearVelocityY[index] = definition.linearVelocityY;
    this.linearVelocityZ[index] = definition.linearVelocityZ;
    this.angularVelocityX[index] = definition.angularVelocityX;
    this.angularVelocityY[index] = definition.angularVelocityY;
    this.angularVelocityZ[index] = definition.angularVelocityZ;
    this.forceX[index] = definition.forceX;
    this.forceY[index] = definition.forceY;
    this.forceZ[index] = definition.forceZ;
    this.torqueX[index] = definition.torqueX;
    this.torqueY[index] = definition.torqueY;
    this.torqueZ[index] = definition.torqueZ;
    const dynamic =
      (definition.flags & BODY_ENABLED_3D) !== 0 &&
      (definition.flags & BODY_TYPE_MASK_3D) === BODY_TYPE_DYNAMIC_3D;
    this.inverseMass[index] = dynamic ? definition.inverseMass : 0;
    this.localInverseInertiaXX[index] = dynamic
      ? definition.localInverseInertiaXX
      : 0;
    this.localInverseInertiaYY[index] = dynamic
      ? definition.localInverseInertiaYY
      : 0;
    this.localInverseInertiaZZ[index] = dynamic
      ? definition.localInverseInertiaZZ
      : 0;
    this.localInverseInertiaXY[index] = dynamic
      ? definition.localInverseInertiaXY
      : 0;
    this.localInverseInertiaXZ[index] = dynamic
      ? definition.localInverseInertiaXZ
      : 0;
    this.localInverseInertiaYZ[index] = dynamic
      ? definition.localInverseInertiaYZ
      : 0;
    this.linearDamping[index] = definition.linearDamping;
    this.angularDamping[index] = definition.angularDamping;
    this.gravityScale[index] = definition.gravityScale;
    this.sleepTime[index] = definition.sleepTime;
    this.translationLocks[index] = definition.translationLocks;
    this.rotationLocks[index] = definition.rotationLocks;
    this.flags[index] = definition.flags;
    this.owners[index] = definition.owner;
  }

  private clear(index: number): void {
    for (const values of this.numericArrays()) values[index] = 0;
    this.translationLocks[index] = 0;
    this.rotationLocks[index] = 0;
    this.flags[index] = 0;
    this.owners[index] = null;
  }

  private numericArrays(): readonly Float64Array[] {
    return [
      this.positionX,
      this.positionY,
      this.positionZ,
      this.orientationX,
      this.orientationY,
      this.orientationZ,
      this.orientationW,
      this.localCenterX,
      this.localCenterY,
      this.localCenterZ,
      this.linearVelocityX,
      this.linearVelocityY,
      this.linearVelocityZ,
      this.angularVelocityX,
      this.angularVelocityY,
      this.angularVelocityZ,
      this.forceX,
      this.forceY,
      this.forceZ,
      this.torqueX,
      this.torqueY,
      this.torqueZ,
      this.inverseMass,
      this.localInverseInertiaXX,
      this.localInverseInertiaYY,
      this.localInverseInertiaZZ,
      this.localInverseInertiaXY,
      this.localInverseInertiaXZ,
      this.localInverseInertiaYZ,
      this.linearDamping,
      this.angularDamping,
      this.gravityScale,
      this.sleepTime,
    ];
  }

  private grow(): void {
    const oldCapacity = this.capacity;
    const capacity = oldCapacity * 2;
    const arrays = this.numericArrays().map((source) =>
      growFloat64(source, capacity),
    );
    let offset = 0;
    this.positionX = arrays[offset++]!;
    this.positionY = arrays[offset++]!;
    this.positionZ = arrays[offset++]!;
    this.orientationX = arrays[offset++]!;
    this.orientationY = arrays[offset++]!;
    this.orientationZ = arrays[offset++]!;
    this.orientationW = arrays[offset++]!;
    this.localCenterX = arrays[offset++]!;
    this.localCenterY = arrays[offset++]!;
    this.localCenterZ = arrays[offset++]!;
    this.linearVelocityX = arrays[offset++]!;
    this.linearVelocityY = arrays[offset++]!;
    this.linearVelocityZ = arrays[offset++]!;
    this.angularVelocityX = arrays[offset++]!;
    this.angularVelocityY = arrays[offset++]!;
    this.angularVelocityZ = arrays[offset++]!;
    this.forceX = arrays[offset++]!;
    this.forceY = arrays[offset++]!;
    this.forceZ = arrays[offset++]!;
    this.torqueX = arrays[offset++]!;
    this.torqueY = arrays[offset++]!;
    this.torqueZ = arrays[offset++]!;
    this.inverseMass = arrays[offset++]!;
    this.localInverseInertiaXX = arrays[offset++]!;
    this.localInverseInertiaYY = arrays[offset++]!;
    this.localInverseInertiaZZ = arrays[offset++]!;
    this.localInverseInertiaXY = arrays[offset++]!;
    this.localInverseInertiaXZ = arrays[offset++]!;
    this.localInverseInertiaYZ = arrays[offset++]!;
    this.linearDamping = arrays[offset++]!;
    this.angularDamping = arrays[offset++]!;
    this.gravityScale = arrays[offset++]!;
    this.sleepTime = arrays[offset]!;
    this.translationLocks = growUint8(this.translationLocks, capacity);
    this.rotationLocks = growUint8(this.rotationLocks, capacity);
    this.flags = growUint32(this.flags, capacity);
    this.generations = growUint32(this.generations, capacity);
    this.owners = growReferences(this.owners, capacity);
    this.active = growUint8(this.active, capacity);
    this.nextFree = growFreeList(this.nextFree, capacity, oldCapacity);
    this.freeHead = oldCapacity;
    this.counters.bodyCapacity = capacity;
    this.counters.bodyCapacityGrowths += 1;
    this.counters.freeBodySlots += capacity - oldCapacity;
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("body store is disposed.");
  }
}

export class ColliderStore3D {
  bodyIndices: Int32Array;
  bodyGenerations: Uint32Array;
  proxyIndices: Int32Array;
  proxyGenerations: Uint32Array;
  localPositionX: Float64Array;
  localPositionY: Float64Array;
  localPositionZ: Float64Array;
  localOrientationX: Float64Array;
  localOrientationY: Float64Array;
  localOrientationZ: Float64Array;
  localOrientationW: Float64Array;
  densities: Float64Array;
  frictions: Float64Array;
  restitutions: Float64Array;
  collisionCategories: Uint32Array;
  collisionMasks: Uint32Array;
  collisionGroup: Int32Array;
  flags: Uint32Array;
  generations: Uint32Array;
  shapes: (ShapeRecord3D | null)[];
  tags: (unknown | null)[];
  handlers: (unknown | null)[];
  owners: (unknown | null)[];

  private active: Uint8Array;
  private nextFree: Int32Array;
  private freeHead = NO_INDEX;
  private disposed = false;

  constructor(
    private readonly counters: PhysicsOwnershipCounters3D,
    initialCapacity = DEFAULT_CAPACITY,
  ) {
    const capacity = normalizedCapacity(initialCapacity);
    this.bodyIndices = filledInt32(capacity, NO_INDEX);
    this.bodyGenerations = new Uint32Array(capacity);
    this.proxyIndices = filledInt32(capacity, NO_INDEX);
    this.proxyGenerations = new Uint32Array(capacity);
    this.localPositionX = new Float64Array(capacity);
    this.localPositionY = new Float64Array(capacity);
    this.localPositionZ = new Float64Array(capacity);
    this.localOrientationX = new Float64Array(capacity);
    this.localOrientationY = new Float64Array(capacity);
    this.localOrientationZ = new Float64Array(capacity);
    this.localOrientationW = new Float64Array(capacity);
    this.densities = new Float64Array(capacity);
    this.frictions = new Float64Array(capacity);
    this.restitutions = new Float64Array(capacity);
    this.collisionCategories = new Uint32Array(capacity);
    this.collisionMasks = new Uint32Array(capacity);
    this.collisionGroup = new Int32Array(capacity);
    this.flags = new Uint32Array(capacity);
    this.generations = new Uint32Array(capacity);
    this.shapes = createReferenceArray<ShapeRecord3D>(capacity);
    this.tags = createReferenceArray(capacity);
    this.handlers = createReferenceArray(capacity);
    this.owners = createReferenceArray(capacity);
    this.active = new Uint8Array(capacity);
    this.nextFree = createFreeList(capacity, 0);
    this.freeHead = 0;
    counters.colliderStoreAllocations += 1;
    counters.liveColliderStores += 1;
    counters.colliderCapacity = capacity;
    counters.freeColliderSlots = capacity;
  }

  get capacity(): number {
    return this.bodyIndices.length;
  }

  allocate(definition: ColliderDefinition3D): number {
    this.assertUsable();
    const orientation = canonicalQuaternion(
      definition.localOrientationX,
      definition.localOrientationY,
      definition.localOrientationZ,
      definition.localOrientationW,
      "collider local orientation",
    );
    if (this.freeHead === NO_INDEX) this.grow();
    const index = this.freeHead;
    this.freeHead = this.nextFree[index]!;
    this.nextFree[index] = NO_INDEX;
    this.active[index] = 1;
    const previousGeneration = this.generations[index]!;
    this.generations[index] = nextGeneration(previousGeneration);
    try {
      this.bodyIndices[index] = definition.bodyIndex;
      this.bodyGenerations[index] = definition.bodyGeneration;
      this.proxyIndices[index] = NO_INDEX;
      this.proxyGenerations[index] = 0;
      this.localPositionX[index] = definition.localPositionX;
      this.localPositionY[index] = definition.localPositionY;
      this.localPositionZ[index] = definition.localPositionZ;
      this.localOrientationX[index] = orientation[0]!;
      this.localOrientationY[index] = orientation[1]!;
      this.localOrientationZ[index] = orientation[2]!;
      this.localOrientationW[index] = orientation[3]!;
      this.densities[index] = definition.density;
      this.frictions[index] = definition.friction;
      this.restitutions[index] = definition.restitution;
      this.collisionCategories[index] = definition.collisionCategory;
      this.collisionMasks[index] = definition.collisionMask;
      this.collisionGroup[index] = definition.collisionGroup;
      this.flags[index] = definition.flags;
      this.shapes[index] = definition.shape;
      this.tags[index] = definition.tag;
      this.handlers[index] = definition.handlers;
      this.owners[index] = definition.owner;
    } catch (error) {
      this.active[index] = 0;
      this.clear(index);
      this.generations[index] = previousGeneration;
      this.nextFree[index] = this.freeHead;
      this.freeHead = index;
      throw error;
    }
    this.counters.colliderAllocations += 1;
    this.counters.liveColliders += 1;
    this.counters.freeColliderSlots -= 1;
    return index;
  }

  has(index: number, generation: number): boolean {
    return (
      !this.disposed && isLive(this.active, this.generations, index, generation)
    );
  }

  shapeAt(index: number, generation: number): ShapeRecord3D | undefined {
    return this.has(index, generation)
      ? (this.shapes[index] ?? undefined)
      : undefined;
  }

  setTag(index: number, generation: number, tag: unknown): boolean {
    if (!this.has(index, generation)) return false;
    this.tags[index] = tag;
    return true;
  }

  setProxy(
    index: number,
    generation: number,
    proxyIndex: number,
    proxyGeneration: number,
  ): boolean {
    if (!this.has(index, generation)) return false;
    this.proxyIndices[index] = proxyIndex;
    this.proxyGenerations[index] = proxyGeneration;
    return true;
  }

  release(index: number, generation: number): boolean {
    if (!this.has(index, generation)) return false;
    this.active[index] = 0;
    this.clear(index);
    this.counters.colliderReleases += 1;
    this.counters.liveColliders -= 1;
    if (generation === MAX_GENERATION) {
      this.nextFree[index] = NO_INDEX;
      this.counters.retiredColliderSlots += 1;
    } else {
      this.nextFree[index] = this.freeHead;
      this.freeHead = index;
      this.counters.freeColliderSlots += 1;
    }
    return true;
  }

  private clear(index: number): void {
    this.bodyIndices[index] = NO_INDEX;
    this.bodyGenerations[index] = 0;
    this.proxyIndices[index] = NO_INDEX;
    this.proxyGenerations[index] = 0;
    this.localPositionX[index] = 0;
    this.localPositionY[index] = 0;
    this.localPositionZ[index] = 0;
    this.localOrientationX[index] = 0;
    this.localOrientationY[index] = 0;
    this.localOrientationZ[index] = 0;
    this.localOrientationW[index] = 0;
    this.densities[index] = 0;
    this.frictions[index] = 0;
    this.restitutions[index] = 0;
    this.collisionCategories[index] = 0;
    this.collisionMasks[index] = 0;
    this.collisionGroup[index] = 0;
    this.flags[index] = 0;
    this.shapes[index] = null;
    this.tags[index] = null;
    this.handlers[index] = null;
    this.owners[index] = null;
  }

  dispose(): void {
    if (this.disposed) return;
    for (let index = 0; index < this.capacity; index += 1) {
      if (this.active[index] === 1) {
        this.release(index, this.generations[index]!);
      }
    }
    this.disposed = true;
    this.counters.colliderStoreReleases += 1;
    this.counters.liveColliderStores -= 1;
  }

  private grow(): void {
    const oldCapacity = this.capacity;
    const capacity = oldCapacity * 2;
    this.bodyIndices = growInt32(this.bodyIndices, capacity, NO_INDEX);
    this.bodyGenerations = growUint32(this.bodyGenerations, capacity);
    this.proxyIndices = growInt32(this.proxyIndices, capacity, NO_INDEX);
    this.proxyGenerations = growUint32(this.proxyGenerations, capacity);
    this.localPositionX = growFloat64(this.localPositionX, capacity);
    this.localPositionY = growFloat64(this.localPositionY, capacity);
    this.localPositionZ = growFloat64(this.localPositionZ, capacity);
    this.localOrientationX = growFloat64(this.localOrientationX, capacity);
    this.localOrientationY = growFloat64(this.localOrientationY, capacity);
    this.localOrientationZ = growFloat64(this.localOrientationZ, capacity);
    this.localOrientationW = growFloat64(this.localOrientationW, capacity);
    this.densities = growFloat64(this.densities, capacity);
    this.frictions = growFloat64(this.frictions, capacity);
    this.restitutions = growFloat64(this.restitutions, capacity);
    this.collisionCategories = growUint32(this.collisionCategories, capacity);
    this.collisionMasks = growUint32(this.collisionMasks, capacity);
    this.collisionGroup = growInt32(this.collisionGroup, capacity, 0);
    this.flags = growUint32(this.flags, capacity);
    this.generations = growUint32(this.generations, capacity);
    this.shapes = growReferences(this.shapes, capacity);
    this.tags = growReferences(this.tags, capacity);
    this.handlers = growReferences(this.handlers, capacity);
    this.owners = growReferences(this.owners, capacity);
    this.active = growUint8(this.active, capacity);
    this.nextFree = growFreeList(this.nextFree, capacity, oldCapacity);
    this.freeHead = oldCapacity;
    this.counters.colliderCapacity = capacity;
    this.counters.colliderCapacityGrowths += 1;
    this.counters.freeColliderSlots += capacity - oldCapacity;
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("collider store is disposed.");
  }
}

function canonicalQuaternion(
  x: number,
  y: number,
  z: number,
  w: number,
  path: string,
): Float64Array {
  return copyCanonicalQuaternion([x, y, z, w], path);
}

function normalizedCapacity(initialCapacity: number): number {
  if (!Number.isInteger(initialCapacity) || initialCapacity < 1) {
    throw new RangeError("initialCapacity must be a positive integer.");
  }
  let capacity = 1;
  while (capacity < initialCapacity) capacity *= 2;
  return capacity;
}

function nextGeneration(generation: number): number {
  return generation + 1;
}

function isLive(
  active: Uint8Array,
  generations: Uint32Array,
  index: number,
  generation: number,
): boolean {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < active.length &&
    active[index] === 1 &&
    generations[index] === generation
  );
}

function createFreeList(capacity: number, start: number): Int32Array {
  const result = filledInt32(capacity, NO_INDEX);
  for (let index = start; index + 1 < capacity; index += 1) {
    result[index] = index + 1;
  }
  return result;
}

function growFreeList(
  source: Int32Array,
  capacity: number,
  start: number,
): Int32Array {
  const result = createFreeList(capacity, start);
  result.set(source);
  return result;
}

function createReferenceArray<T = unknown>(capacity: number): (T | null)[] {
  return Array<T | null>(capacity).fill(null);
}

function growReferences<T>(
  source: (T | null)[],
  capacity: number,
): (T | null)[] {
  const result = createReferenceArray<T>(capacity);
  for (let index = 0; index < source.length; index += 1) {
    result[index] = source[index]!;
  }
  return result;
}

function filledInt32(capacity: number, fill: number): Int32Array {
  const result = new Int32Array(capacity);
  result.fill(fill);
  return result;
}

function growFloat64(source: Float64Array, capacity: number): Float64Array {
  const result = new Float64Array(capacity);
  result.set(source);
  return result;
}

function growUint32(source: Uint32Array, capacity: number): Uint32Array {
  const result = new Uint32Array(capacity);
  result.set(source);
  return result;
}

function growUint8(source: Uint8Array, capacity: number): Uint8Array {
  const result = new Uint8Array(capacity);
  result.set(source);
  return result;
}

function growInt32(
  source: Int32Array,
  capacity: number,
  fill: number,
): Int32Array {
  const result = filledInt32(capacity, fill);
  result.set(source);
  return result;
}
