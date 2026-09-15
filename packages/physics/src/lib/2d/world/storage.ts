import type { ShapeRecord2D } from "../shape-records.js";
import type { PhysicsOwnershipCounters2D } from "../runtime/ownership.js";

const DEFAULT_CAPACITY = 4;
const NO_INDEX = -1;
const MAX_GENERATION = 0xffff_ffff;

export interface BodyDefinition2D {
  readonly positionX: number;
  readonly positionY: number;
  readonly rotationRadians: number;
  readonly localCenterX?: number;
  readonly localCenterY?: number;
  readonly linearVelocityX: number;
  readonly linearVelocityY: number;
  readonly angularVelocity: number;
  readonly forceX: number;
  readonly forceY: number;
  readonly torque: number;
  readonly inverseMass: number;
  readonly inverseInertia: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  readonly sleepTime: number;
  readonly flags: number;
  readonly owner: unknown;
}

export interface ColliderDefinition2D {
  readonly bodyIndex: number;
  readonly bodyGeneration: number;
  readonly shape: ShapeRecord2D;
  readonly material: unknown;
  readonly filter: unknown;
  readonly tag: unknown;
  readonly handlers: unknown;
  readonly owner: unknown;
  readonly flags: number;
}

export class BodyStore2D {
  positionX: Float64Array;
  positionY: Float64Array;
  rotationRadians: Float64Array;
  localCenterX: Float64Array;
  localCenterY: Float64Array;
  linearVelocityX: Float64Array;
  linearVelocityY: Float64Array;
  angularVelocity: Float64Array;
  forceX: Float64Array;
  forceY: Float64Array;
  torque: Float64Array;
  inverseMass: Float64Array;
  inverseInertia: Float64Array;
  linearDamping: Float64Array;
  angularDamping: Float64Array;
  gravityScale: Float64Array;
  sleepTime: Float64Array;
  flags: Uint32Array;
  generations: Uint32Array;
  owners: (unknown | null)[];

  private active: Uint8Array;
  private nextFree: Int32Array;
  private freeHead = NO_INDEX;

  constructor(
    private readonly counters: PhysicsOwnershipCounters2D,
    initialCapacity = DEFAULT_CAPACITY,
  ) {
    const capacity = normalizedCapacity(initialCapacity);
    this.positionX = new Float64Array(capacity);
    this.positionY = new Float64Array(capacity);
    this.rotationRadians = new Float64Array(capacity);
    this.localCenterX = new Float64Array(capacity);
    this.localCenterY = new Float64Array(capacity);
    this.linearVelocityX = new Float64Array(capacity);
    this.linearVelocityY = new Float64Array(capacity);
    this.angularVelocity = new Float64Array(capacity);
    this.forceX = new Float64Array(capacity);
    this.forceY = new Float64Array(capacity);
    this.torque = new Float64Array(capacity);
    this.inverseMass = new Float64Array(capacity);
    this.inverseInertia = new Float64Array(capacity);
    this.linearDamping = new Float64Array(capacity);
    this.angularDamping = new Float64Array(capacity);
    this.gravityScale = new Float64Array(capacity);
    this.sleepTime = new Float64Array(capacity);
    this.flags = new Uint32Array(capacity);
    this.generations = new Uint32Array(capacity);
    this.owners = createReferenceArray(capacity);
    this.active = new Uint8Array(capacity);
    this.nextFree = createFreeList(capacity, 0);
    this.freeHead = 0;
    counters.bodyCapacity = capacity;
    counters.freeBodySlots = capacity;
  }

  get capacity(): number {
    return this.positionX.length;
  }

  allocate(definition: BodyDefinition2D): number {
    if (this.freeHead === NO_INDEX) this.grow();
    const index = this.freeHead;
    this.freeHead = this.nextFree[index]!;
    this.nextFree[index] = NO_INDEX;
    this.active[index] = 1;
    this.generations[index] = nextGeneration(this.generations[index]!);
    this.positionX[index] = definition.positionX;
    this.positionY[index] = definition.positionY;
    this.rotationRadians[index] = definition.rotationRadians;
    this.localCenterX[index] = definition.localCenterX ?? 0;
    this.localCenterY[index] = definition.localCenterY ?? 0;
    this.linearVelocityX[index] = definition.linearVelocityX;
    this.linearVelocityY[index] = definition.linearVelocityY;
    this.angularVelocity[index] = definition.angularVelocity;
    this.forceX[index] = definition.forceX;
    this.forceY[index] = definition.forceY;
    this.torque[index] = definition.torque;
    this.inverseMass[index] = definition.inverseMass;
    this.inverseInertia[index] = definition.inverseInertia;
    this.linearDamping[index] = definition.linearDamping;
    this.angularDamping[index] = definition.angularDamping;
    this.gravityScale[index] = definition.gravityScale;
    this.sleepTime[index] = definition.sleepTime;
    this.flags[index] = definition.flags;
    this.owners[index] = definition.owner;
    this.counters.bodyAllocations += 1;
    this.counters.liveBodies += 1;
    this.counters.freeBodySlots -= 1;
    return index;
  }

  has(index: number, generation: number): boolean {
    return isLive(this.active, this.generations, index, generation);
  }

  readPositionInto(
    index: number,
    generation: number,
    output: Float64Array,
    outputOffset: number,
  ): boolean {
    if (!this.has(index, generation)) return false;
    output[outputOffset] = this.positionX[index]!;
    output[outputOffset + 1] = this.positionY[index]!;
    return true;
  }

  setPosition(
    index: number,
    generation: number,
    positionX: number,
    positionY: number,
  ): boolean {
    if (!this.has(index, generation)) return false;
    this.positionX[index] = positionX;
    this.positionY[index] = positionY;
    return true;
  }

  release(index: number, generation: number): boolean {
    if (!this.has(index, generation)) return false;
    this.active[index] = 0;
    this.positionX[index] = 0;
    this.positionY[index] = 0;
    this.rotationRadians[index] = 0;
    this.localCenterX[index] = 0;
    this.localCenterY[index] = 0;
    this.linearVelocityX[index] = 0;
    this.linearVelocityY[index] = 0;
    this.angularVelocity[index] = 0;
    this.forceX[index] = 0;
    this.forceY[index] = 0;
    this.torque[index] = 0;
    this.inverseMass[index] = 0;
    this.inverseInertia[index] = 0;
    this.linearDamping[index] = 0;
    this.angularDamping[index] = 0;
    this.gravityScale[index] = 0;
    this.sleepTime[index] = 0;
    this.flags[index] = 0;
    this.owners[index] = null;
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

  private grow(): void {
    const oldCapacity = this.capacity;
    const capacity = oldCapacity * 2;
    this.positionX = growFloat64(this.positionX, capacity);
    this.positionY = growFloat64(this.positionY, capacity);
    this.rotationRadians = growFloat64(this.rotationRadians, capacity);
    this.localCenterX = growFloat64(this.localCenterX, capacity);
    this.localCenterY = growFloat64(this.localCenterY, capacity);
    this.linearVelocityX = growFloat64(this.linearVelocityX, capacity);
    this.linearVelocityY = growFloat64(this.linearVelocityY, capacity);
    this.angularVelocity = growFloat64(this.angularVelocity, capacity);
    this.forceX = growFloat64(this.forceX, capacity);
    this.forceY = growFloat64(this.forceY, capacity);
    this.torque = growFloat64(this.torque, capacity);
    this.inverseMass = growFloat64(this.inverseMass, capacity);
    this.inverseInertia = growFloat64(this.inverseInertia, capacity);
    this.linearDamping = growFloat64(this.linearDamping, capacity);
    this.angularDamping = growFloat64(this.angularDamping, capacity);
    this.gravityScale = growFloat64(this.gravityScale, capacity);
    this.sleepTime = growFloat64(this.sleepTime, capacity);
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
}

export class ColliderStore2D {
  bodyIndices: Int32Array;
  bodyGenerations: Uint32Array;
  proxyIndices: Int32Array;
  proxyGenerations: Uint32Array;
  flags: Uint32Array;
  generations: Uint32Array;
  shapes: (ShapeRecord2D | null)[];
  materials: (unknown | null)[];
  filters: (unknown | null)[];
  tags: (unknown | null)[];
  handlers: (unknown | null)[];
  owners: (unknown | null)[];

  private active: Uint8Array;
  private nextFree: Int32Array;
  private freeHead = NO_INDEX;

  constructor(
    private readonly counters: PhysicsOwnershipCounters2D,
    initialCapacity = DEFAULT_CAPACITY,
  ) {
    const capacity = normalizedCapacity(initialCapacity);
    this.bodyIndices = new Int32Array(capacity);
    this.bodyIndices.fill(NO_INDEX);
    this.bodyGenerations = new Uint32Array(capacity);
    this.proxyIndices = new Int32Array(capacity);
    this.proxyIndices.fill(NO_INDEX);
    this.proxyGenerations = new Uint32Array(capacity);
    this.flags = new Uint32Array(capacity);
    this.generations = new Uint32Array(capacity);
    this.shapes = createReferenceArray<ShapeRecord2D>(capacity);
    this.materials = createReferenceArray(capacity);
    this.filters = createReferenceArray(capacity);
    this.tags = createReferenceArray(capacity);
    this.handlers = createReferenceArray(capacity);
    this.owners = createReferenceArray(capacity);
    this.active = new Uint8Array(capacity);
    this.nextFree = createFreeList(capacity, 0);
    this.freeHead = 0;
    counters.colliderCapacity = capacity;
    counters.freeColliderSlots = capacity;
  }

  get capacity(): number {
    return this.bodyIndices.length;
  }

  allocate(definition: ColliderDefinition2D): number {
    if (this.freeHead === NO_INDEX) this.grow();
    const index = this.freeHead;
    this.freeHead = this.nextFree[index]!;
    this.nextFree[index] = NO_INDEX;
    this.active[index] = 1;
    this.generations[index] = nextGeneration(this.generations[index]!);
    this.bodyIndices[index] = definition.bodyIndex;
    this.bodyGenerations[index] = definition.bodyGeneration;
    this.proxyIndices[index] = NO_INDEX;
    this.proxyGenerations[index] = 0;
    this.flags[index] = definition.flags;
    this.shapes[index] = definition.shape;
    this.materials[index] = definition.material;
    this.filters[index] = definition.filter;
    this.tags[index] = definition.tag;
    this.handlers[index] = definition.handlers;
    this.owners[index] = definition.owner;
    this.counters.colliderAllocations += 1;
    this.counters.liveColliders += 1;
    this.counters.freeColliderSlots -= 1;
    return index;
  }

  has(index: number, generation: number): boolean {
    return isLive(this.active, this.generations, index, generation);
  }

  shapeAt(index: number, generation: number): ShapeRecord2D | undefined {
    if (!this.has(index, generation)) return undefined;
    return this.shapes[index] ?? undefined;
  }

  tagAt(index: number, generation: number): unknown {
    if (!this.has(index, generation)) return undefined;
    return this.tags[index] ?? undefined;
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
    this.bodyIndices[index] = NO_INDEX;
    this.bodyGenerations[index] = 0;
    this.proxyIndices[index] = NO_INDEX;
    this.proxyGenerations[index] = 0;
    this.flags[index] = 0;
    this.shapes[index] = null;
    this.materials[index] = null;
    this.filters[index] = null;
    this.tags[index] = null;
    this.handlers[index] = null;
    this.owners[index] = null;
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

  private grow(): void {
    const oldCapacity = this.capacity;
    const capacity = oldCapacity * 2;
    this.bodyIndices = growInt32(this.bodyIndices, capacity, NO_INDEX);
    this.bodyGenerations = growUint32(this.bodyGenerations, capacity);
    this.proxyIndices = growInt32(this.proxyIndices, capacity, NO_INDEX);
    this.proxyGenerations = growUint32(this.proxyGenerations, capacity);
    this.flags = growUint32(this.flags, capacity);
    this.generations = growUint32(this.generations, capacity);
    this.shapes = growReferences(this.shapes, capacity);
    this.materials = growReferences(this.materials, capacity);
    this.filters = growReferences(this.filters, capacity);
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
  const result = new Int32Array(capacity);
  result.fill(NO_INDEX);
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
  const result = new Int32Array(capacity);
  result.fill(fill);
  result.set(source);
  return result;
}
