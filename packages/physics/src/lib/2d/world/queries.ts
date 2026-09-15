import {
  boundsOfShape2D,
  type CRCPhysicsAabb2D,
  type CRCPhysicsPose2D,
  type CRCPhysicsRay2D,
  type CRCPhysicsShape2D,
  type CRCPhysicsVector2,
} from "../../../2d-geometry.js";
import { copyFiniteVector2, requireNonnegativeNumber } from "../../shared/validation.js";
import { containsPointInShape2D, overlapPreparedShapes2D } from "../collision/pairs.js";
import { raycastShape2D, shapeCastAgainstShape2D } from "../collision/casts.js";
import { RADIANS_TO_DEGREES } from "../numeric-policy.js";
import { createShape2D, type ShapeRecord2D } from "../shape-records.js";
import type {
  CRCPhysicsBodyHandle2D,
  CRCPhysicsColliderHandle2D,
  CRCPhysicsCollisionFilter,
  CRCPhysicsQueryHit2D,
  CRCPhysicsQueryMatch2D,
  CRCPhysicsQueryMode,
  CRCPhysicsQueryOptions2D,
  CRCPhysicsQueryResult2D,
} from "../types.js";
import type { DynamicAabbBroadPhase2D } from "./broad-phase.js";
import { collisionFiltersAllow2D } from "./ccd.js";
import { COLLIDER_SENSOR_2D } from "./contact-cache.js";
import type { BodyStore2D, ColliderStore2D } from "./storage.js";

interface HandleIdentity2D {
  readonly index: number;
  readonly generation: number;
}

export interface CommittedWorldQueriesOptions2D {
  readonly generation: number;
  readonly bodies: BodyStore2D;
  readonly colliders: ColliderStore2D;
  readonly broadPhase: DynamicAabbBroadPhase2D;
  readonly materializeBody: (index: number, generation: number) => CRCPhysicsBodyHandle2D;
  readonly materializeCollider: (index: number, generation: number) => CRCPhysicsColliderHandle2D;
  readonly resolveBody: (handle: CRCPhysicsBodyHandle2D) => HandleIdentity2D | null;
  readonly resolveCollider: (handle: CRCPhysicsColliderHandle2D) => HandleIdentity2D | null;
}

interface PreparedQueryOptions2D {
  readonly mode: CRCPhysicsQueryMode;
  readonly sensors: "include" | "exclude" | "only";
  readonly collisionFilter: CRCPhysicsCollisionFilter | null;
  readonly excludeBody: HandleIdentity2D | null;
  readonly excludeCollider: HandleIdentity2D | null;
  readonly valid: boolean;
}

export class CommittedWorldQueries2D {
  private active = true;
  private candidateProxies: Int32Array;
  private hitColliderIndices: Int32Array;
  private hitColliderGenerations: Uint32Array;
  private hitBodyIndices: Int32Array;
  private hitBodyGenerations: Uint32Array;
  private hitPointX: Float64Array;
  private hitPointY: Float64Array;
  private hitNormalX: Float64Array;
  private hitNormalY: Float64Array;
  private hitDistances: Float64Array;
  private hitTimes: Float64Array;
  private hitCount = 0;
  private readonly shapeShells = new WeakMap<ShapeRecord2D, CRCPhysicsShape2D>();

  constructor(private readonly options: CommittedWorldQueriesOptions2D) {
    const capacity = normalizedCapacity(options.broadPhase.proxyCapacity);
    this.candidateProxies = new Int32Array(capacity);
    this.hitColliderIndices = new Int32Array(capacity);
    this.hitColliderGenerations = new Uint32Array(capacity);
    this.hitBodyIndices = new Int32Array(capacity);
    this.hitBodyGenerations = new Uint32Array(capacity);
    this.hitPointX = new Float64Array(capacity);
    this.hitPointY = new Float64Array(capacity);
    this.hitNormalX = new Float64Array(capacity);
    this.hitNormalY = new Float64Array(capacity);
    this.hitDistances = new Float64Array(capacity);
    this.hitTimes = new Float64Array(capacity);
  }

  invalidate(): void {
    this.active = false;
    this.hitCount = 0;
  }

  raycast<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    ray: CRCPhysicsRay2D,
    queryOptions?: CRCPhysicsQueryOptions2D<Mode>,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
    const prepared = this.prepareOptions(queryOptions);
    if (!this.isUsable(worldGeneration, prepared)) return emptyResult(prepared.mode);
    const origin = copyFiniteVector2(ray.origin, "ray.origin");
    const direction = copyFiniteVector2(ray.direction, "ray.direction");
    const directionLength = Math.hypot(direction[0], direction[1]);
    if (directionLength === 0) throw new RangeError("ray.direction must be non-zero.");
    const maxDistance = requireNonnegativeNumber(ray.maxDistance, "ray.maxDistance");
    const endX = origin[0] + (direction[0] / directionLength) * maxDistance;
    const endY = origin[1] + (direction[1] / directionLength) * maxDistance;
    this.beginQuery();
    const candidateCount = this.queryCandidates(
      Math.min(origin[0], endX),
      Math.min(origin[1], endY),
      Math.max(origin[0], endX),
      Math.max(origin[1], endY),
    );
    for (let candidate = 0; candidate < candidateCount; candidate += 1) {
      const collider = this.semanticColliderAt(candidate, prepared);
      if (collider === null) continue;
      const hit = raycastShape2D(collider.shape, collider.pose, ray);
      if (hit === null) continue;
      if (prepared.mode === "any") return true as CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;
      this.appendHit(collider, hit.point, hit.normal, hit.distance, hit.timeOfImpact);
    }
    return this.finishHits<Mode>(prepared.mode);
  }

  shapeCast<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    shape: CRCPhysicsShape2D,
    from: CRCPhysicsPose2D,
    translation: CRCPhysicsVector2,
    queryOptions?: CRCPhysicsQueryOptions2D<Mode>,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
    const prepared = this.prepareOptions(queryOptions);
    if (!this.isUsable(worldGeneration, prepared)) return emptyResult(prepared.mode);
    const copiedTranslation = copyFiniteVector2(translation, "translation");
    const start = boundsOfShape2D(shape, from);
    const end = boundsOfShape2D(shape, {
      position: [from.position[0] + copiedTranslation[0], from.position[1] + copiedTranslation[1]],
      rotationDegrees: from.rotationDegrees,
    });
    this.beginQuery();
    const candidateCount = this.queryCandidates(
      Math.min(start.min[0], end.min[0]),
      Math.min(start.min[1], end.min[1]),
      Math.max(start.max[0], end.max[0]),
      Math.max(start.max[1], end.max[1]),
    );
    for (let candidate = 0; candidate < candidateCount; candidate += 1) {
      const collider = this.semanticColliderAt(candidate, prepared);
      if (collider === null) continue;
      const hit = shapeCastAgainstShape2D(shape, from, copiedTranslation, collider.shape, collider.pose);
      if (hit === null) continue;
      if (prepared.mode === "any") return true as CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;
      this.appendHit(collider, hit.point, hit.normal, hit.distance, hit.timeOfImpact);
    }
    return this.finishHits<Mode>(prepared.mode);
  }

  overlapShape<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    shape: CRCPhysicsShape2D,
    pose: CRCPhysicsPose2D,
    queryOptions?: CRCPhysicsQueryOptions2D<Mode>,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
    const bounds = this.isGenerationLive(worldGeneration) ? boundsOfShape2D(shape, pose) : null;
    return this.runMatchQuery(worldGeneration, bounds, queryOptions, (collider) =>
      overlapPreparedShapes2D(shape, pose, collider.shape, collider.pose),
    );
  }

  queryAabb<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    bounds: CRCPhysicsAabb2D,
    queryOptions?: CRCPhysicsQueryOptions2D<Mode>,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
    if (!this.isGenerationLive(worldGeneration)) {
      return emptyResult(modeOf(queryOptions));
    }
    const copied = copyAabb(bounds);
    return this.runMatchQuery(worldGeneration, copied, queryOptions, (collider) => {
      const colliderBounds = boundsOfShape2D(collider.shape, collider.pose);
      return aabbsOverlap(copied, colliderBounds);
    });
  }

  queryPoint<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    point: CRCPhysicsVector2,
    queryOptions?: CRCPhysicsQueryOptions2D<Mode>,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
    if (!this.isGenerationLive(worldGeneration)) {
      return emptyResult(modeOf(queryOptions));
    }
    const copied = copyFiniteVector2(point, "point");
    const bounds = Object.freeze({ min: copied, max: copied });
    return this.runMatchQuery(worldGeneration, bounds, queryOptions, (collider) =>
      containsPointInShape2D(collider.shape, collider.pose, copied),
    );
  }

  private runMatchQuery<Mode extends CRCPhysicsQueryMode>(
    worldGeneration: number,
    bounds: CRCPhysicsAabb2D | null,
    queryOptions: CRCPhysicsQueryOptions2D<Mode> | undefined,
    matches: (collider: SemanticCollider2D) => boolean,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
    const prepared = this.prepareOptions(queryOptions);
    if (bounds === null || !this.isUsable(worldGeneration, prepared)) {
      return emptyResult(prepared.mode);
    }
    this.beginQuery();
    const candidateCount = this.queryCandidates(bounds.min[0], bounds.min[1], bounds.max[0], bounds.max[1]);
    for (let candidate = 0; candidate < candidateCount; candidate += 1) {
      const collider = this.semanticColliderAt(candidate, prepared);
      if (collider === null || !matches(collider)) continue;
      if (prepared.mode === "any") {
        return true as CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;
      }
      this.appendMatch(collider);
    }
    return this.finishMatches<Mode>(prepared.mode);
  }

  private prepareOptions<Mode extends CRCPhysicsQueryMode>(
    queryOptions: CRCPhysicsQueryOptions2D<Mode> | undefined,
  ): PreparedQueryOptions2D {
    const mode = modeOf(queryOptions);
    const sensors = queryOptions?.sensors ?? "include";
    if (sensors !== "include" && sensors !== "exclude" && sensors !== "only") {
      throw new RangeError("query sensors must be include, exclude, or only.");
    }
    const excludeBody =
      queryOptions?.excludeBody === undefined ? null : this.options.resolveBody(queryOptions.excludeBody);
    const excludeCollider =
      queryOptions?.excludeCollider === undefined ? null : this.options.resolveCollider(queryOptions.excludeCollider);
    const validBody =
      queryOptions?.excludeBody === undefined ||
      (excludeBody !== null && this.options.bodies.has(excludeBody.index, excludeBody.generation));
    const validCollider =
      queryOptions?.excludeCollider === undefined ||
      (excludeCollider !== null && this.options.colliders.has(excludeCollider.index, excludeCollider.generation));
    return {
      mode,
      sensors,
      collisionFilter: queryOptions?.collisionFilter ?? null,
      excludeBody,
      excludeCollider,
      valid: validBody && validCollider,
    };
  }

  private isUsable(worldGeneration: number, prepared: PreparedQueryOptions2D): boolean {
    return this.isGenerationLive(worldGeneration) && prepared.valid;
  }

  private isGenerationLive(worldGeneration: number): boolean {
    return this.active && worldGeneration === this.options.generation;
  }

  private beginQuery(): void {
    this.hitCount = 0;
    this.ensureCapacity(this.options.broadPhase.proxyCapacity);
  }

  private queryCandidates(minX: number, minY: number, maxX: number, maxY: number): number {
    return this.options.broadPhase.queryAabbInto(
      minX,
      minY,
      maxX,
      maxY,
      this.candidateProxies,
      0,
      this.candidateProxies.length,
    );
  }

  private semanticColliderAt(candidate: number, prepared: PreparedQueryOptions2D): SemanticCollider2D | null {
    const proxy = this.candidateProxies[candidate]!;
    const colliderIndex = this.options.broadPhase.proxyColliderIndices[proxy]!;
    const colliderGeneration = this.options.broadPhase.proxyColliderGenerations[proxy]!;
    const { colliders, bodies } = this.options;
    if (!colliders.has(colliderIndex, colliderGeneration)) return null;
    const bodyIndex = colliders.bodyIndices[colliderIndex]!;
    const bodyGeneration = colliders.bodyGenerations[colliderIndex]!;
    if (!bodies.has(bodyIndex, bodyGeneration)) return null;
    if (sameIdentity(prepared.excludeBody, bodyIndex, bodyGeneration)) return null;
    if (sameIdentity(prepared.excludeCollider, colliderIndex, colliderGeneration)) return null;
    const sensor = (colliders.flags[colliderIndex]! & COLLIDER_SENSOR_2D) !== 0;
    if (prepared.sensors === "exclude" && sensor) return null;
    if (prepared.sensors === "only" && !sensor) return null;
    if (
      prepared.collisionFilter !== null &&
      !collisionFiltersAllow2D(prepared.collisionFilter, colliders.filters[colliderIndex])
    )
      return null;
    const record = colliders.shapes[colliderIndex];
    if (record === null) return null;
    return {
      colliderIndex,
      colliderGeneration,
      bodyIndex,
      bodyGeneration,
      shape: this.shapeShell(record),
      pose: publicPose(bodies.positionX[bodyIndex]!, bodies.positionY[bodyIndex]!, bodies.rotationRadians[bodyIndex]!),
    };
  }

  private appendHit(
    collider: SemanticCollider2D,
    point: CRCPhysicsVector2,
    normal: CRCPhysicsVector2,
    distance: number,
    time: number,
  ): void {
    const target = this.hitCount;
    this.writeIdentity(target, collider);
    this.hitPointX[target] = point[0];
    this.hitPointY[target] = point[1];
    this.hitNormalX[target] = normal[0];
    this.hitNormalY[target] = normal[1];
    this.hitDistances[target] = distance;
    this.hitTimes[target] = time;
    this.hitCount += 1;
  }

  private appendMatch(collider: SemanticCollider2D): void {
    this.writeIdentity(this.hitCount, collider);
    this.hitCount += 1;
  }

  private writeIdentity(target: number, collider: SemanticCollider2D): void {
    this.hitColliderIndices[target] = collider.colliderIndex;
    this.hitColliderGenerations[target] = collider.colliderGeneration;
    this.hitBodyIndices[target] = collider.bodyIndex;
    this.hitBodyGenerations[target] = collider.bodyGeneration;
  }

  private finishHits<Mode extends CRCPhysicsQueryMode>(
    mode: CRCPhysicsQueryMode,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
    this.sortHits(true);
    if (mode === "any") {
      return false as CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;
    }
    if (mode === "closest") {
      return (this.hitCount === 0 ? null : this.materializeHit(0)) as CRCPhysicsQueryResult2D<
        Mode,
        CRCPhysicsQueryHit2D
      >;
    }
    const results: CRCPhysicsQueryHit2D[] = [];
    for (let index = 0; index < this.hitCount; index += 1) {
      results.push(this.materializeHit(index));
    }
    return Object.freeze(results) as CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;
  }

  private finishMatches<Mode extends CRCPhysicsQueryMode>(
    mode: CRCPhysicsQueryMode,
  ): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
    this.sortHits(false);
    if (mode === "any") {
      return false as CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;
    }
    if (mode === "closest") {
      return (this.hitCount === 0 ? null : this.materializeMatch(0)) as CRCPhysicsQueryResult2D<
        Mode,
        CRCPhysicsQueryMatch2D
      >;
    }
    const results: CRCPhysicsQueryMatch2D[] = [];
    for (let index = 0; index < this.hitCount; index += 1) {
      results.push(this.materializeMatch(index));
    }
    return Object.freeze(results) as CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;
  }

  private materializeHit(index: number): CRCPhysicsQueryHit2D {
    return Object.freeze({
      ...this.materializeMatch(index),
      point: freezeVector(this.hitPointX[index]!, this.hitPointY[index]!),
      normal: freezeVector(this.hitNormalX[index]!, this.hitNormalY[index]!),
      distance: this.hitDistances[index]!,
      timeOfImpact: this.hitTimes[index]!,
    });
  }

  private materializeMatch(index: number): CRCPhysicsQueryMatch2D {
    const bodyIndex = this.hitBodyIndices[index]!;
    const bodyGeneration = this.hitBodyGenerations[index]!;
    const colliderIndex = this.hitColliderIndices[index]!;
    const colliderGeneration = this.hitColliderGenerations[index]!;
    return Object.freeze({
      body: this.options.materializeBody(bodyIndex, bodyGeneration),
      collider: this.options.materializeCollider(colliderIndex, colliderGeneration),
      bodyGeneration,
      colliderGeneration,
      tag: this.options.colliders.tags[colliderIndex],
    });
  }

  private sortHits(withDistance: boolean): void {
    for (let index = 1; index < this.hitCount; index += 1) {
      let current = index;
      while (current > 0 && this.compareHits(current, current - 1, withDistance) < 0) {
        this.swapHits(current, current - 1, withDistance);
        current -= 1;
      }
    }
  }

  private compareHits(first: number, second: number, withDistance: boolean): number {
    if (withDistance) {
      const time = this.hitTimes[first]! - this.hitTimes[second]!;
      if (time !== 0) return time;
      const distance = this.hitDistances[first]! - this.hitDistances[second]!;
      if (distance !== 0) return distance;
    }
    return (
      this.hitColliderIndices[first]! - this.hitColliderIndices[second]! ||
      this.hitColliderGenerations[first]! - this.hitColliderGenerations[second]!
    );
  }

  private swapHits(first: number, second: number, withDistance: boolean): void {
    swapInt32(this.hitColliderIndices, first, second);
    swapUint32(this.hitColliderGenerations, first, second);
    swapInt32(this.hitBodyIndices, first, second);
    swapUint32(this.hitBodyGenerations, first, second);
    if (!withDistance) return;
    swapFloat64(this.hitPointX, first, second);
    swapFloat64(this.hitPointY, first, second);
    swapFloat64(this.hitNormalX, first, second);
    swapFloat64(this.hitNormalY, first, second);
    swapFloat64(this.hitDistances, first, second);
    swapFloat64(this.hitTimes, first, second);
  }

  private shapeShell(record: ShapeRecord2D): CRCPhysicsShape2D {
    let shell = this.shapeShells.get(record);
    if (shell === undefined) {
      shell = createShape2D(record);
      this.shapeShells.set(record, shell);
    }
    return shell;
  }

  private ensureCapacity(required: number): void {
    if (required <= this.candidateProxies.length) return;
    const capacity = normalizedCapacity(required);
    this.candidateProxies = growInt32(this.candidateProxies, capacity);
    this.hitColliderIndices = growInt32(this.hitColliderIndices, capacity);
    this.hitColliderGenerations = growUint32(this.hitColliderGenerations, capacity);
    this.hitBodyIndices = growInt32(this.hitBodyIndices, capacity);
    this.hitBodyGenerations = growUint32(this.hitBodyGenerations, capacity);
    this.hitPointX = growFloat64(this.hitPointX, capacity);
    this.hitPointY = growFloat64(this.hitPointY, capacity);
    this.hitNormalX = growFloat64(this.hitNormalX, capacity);
    this.hitNormalY = growFloat64(this.hitNormalY, capacity);
    this.hitDistances = growFloat64(this.hitDistances, capacity);
    this.hitTimes = growFloat64(this.hitTimes, capacity);
  }
}

interface SemanticCollider2D {
  readonly colliderIndex: number;
  readonly colliderGeneration: number;
  readonly bodyIndex: number;
  readonly bodyGeneration: number;
  readonly shape: CRCPhysicsShape2D;
  readonly pose: CRCPhysicsPose2D;
}

function modeOf<Mode extends CRCPhysicsQueryMode>(
  options: CRCPhysicsQueryOptions2D<Mode> | undefined,
): CRCPhysicsQueryMode {
  const mode = options?.mode ?? "closest";
  if (mode !== "closest" && mode !== "any" && mode !== "all") {
    throw new RangeError("query mode must be closest, any, or all.");
  }
  return mode;
}

function emptyResult<Mode extends CRCPhysicsQueryMode, Result>(
  mode: CRCPhysicsQueryMode,
): CRCPhysicsQueryResult2D<Mode, Result> {
  return (mode === "any" ? false : mode === "all" ? Object.freeze([]) : null) as CRCPhysicsQueryResult2D<Mode, Result>;
}

function sameIdentity(identity: HandleIdentity2D | null, index: number, generation: number): boolean {
  return identity !== null && identity.index === index && identity.generation === generation;
}

function publicPose(x: number, y: number, rotationRadians: number): CRCPhysicsPose2D {
  return {
    position: [x, y],
    rotationDegrees: rotationRadians * RADIANS_TO_DEGREES,
  };
}

function copyAabb(bounds: CRCPhysicsAabb2D): CRCPhysicsAabb2D {
  const min = copyFiniteVector2(bounds.min, "bounds.min");
  const max = copyFiniteVector2(bounds.max, "bounds.max");
  if (min[0] > max[0] || min[1] > max[1]) {
    throw new RangeError("bounds.min must not exceed bounds.max.");
  }
  return Object.freeze({ min, max });
}

function aabbsOverlap(first: CRCPhysicsAabb2D, second: CRCPhysicsAabb2D): boolean {
  return (
    first.min[0] <= second.max[0] &&
    first.max[0] >= second.min[0] &&
    first.min[1] <= second.max[1] &&
    first.max[1] >= second.min[1]
  );
}

function freezeVector(x: number, y: number): CRCPhysicsVector2 {
  return Object.freeze([x, y] as const);
}

function normalizedCapacity(required: number): number {
  let capacity = 1;
  while (capacity < required) capacity *= 2;
  return capacity;
}

function growInt32(source: Int32Array, capacity: number): Int32Array {
  const result = new Int32Array(capacity);
  result.set(source);
  return result;
}

function growUint32(source: Uint32Array, capacity: number): Uint32Array {
  const result = new Uint32Array(capacity);
  result.set(source);
  return result;
}

function growFloat64(source: Float64Array, capacity: number): Float64Array {
  const result = new Float64Array(capacity);
  result.set(source);
  return result;
}

function swapInt32(values: Int32Array, first: number, second: number): void {
  const value = values[first]!;
  values[first] = values[second]!;
  values[second] = value;
}

function swapUint32(values: Uint32Array, first: number, second: number): void {
  const value = values[first]!;
  values[first] = values[second]!;
  values[second] = value;
}

function swapFloat64(values: Float64Array, first: number, second: number): void {
  const value = values[first]!;
  values[first] = values[second]!;
  values[second] = value;
}
