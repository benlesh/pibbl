import {
  boundsOfShape3D,
  type CRCPhysicsAabb3D,
  type CRCPhysicsPose3D,
  type CRCPhysicsRay3D,
  type CRCPhysicsShape3D,
  type CRCPhysicsShapeHit3D,
  type CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import { requireNonnegativeNumber } from "../../shared/validation.js";
import { raycastShape3D, shapeCastAgainstShape3D } from "../collision/casts.js";
import {
  containsPoint3D,
  overlapPreparedShapes3D,
} from "../collision/pairs.js";
import {
  composePose3D,
  copyCanonicalQuaternion,
  copyFiniteVector3,
  rotateVectorInto,
  type InternalPose3D,
} from "../math.js";
import { shapeForRecord3D } from "../shape-records.js";
import type {
  CRCPhysicsBodyHandle3D,
  CRCPhysicsColliderHandle3D,
  CRCPhysicsCollisionFilter,
  CRCPhysicsQueryHit3D,
  CRCPhysicsQueryMatch3D,
  CRCPhysicsQueryMode,
  CRCPhysicsQueryOptions3D,
  CRCPhysicsQueryResult3D,
} from "../types.js";
import { collisionFiltersAllow3D } from "./ccd.js";
import type { DynamicAabbBroadPhase3D } from "./broad-phase.js";
import {
  BODY_ENABLED_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  type BodyStore3D,
  type ColliderStore3D,
} from "./storage.js";

interface HandleIdentity3D {
  readonly index: number;
  readonly generation: number;
}

export interface CommittedWorldQueriesOptions3D {
  readonly generation: number;
  readonly bodies: BodyStore3D;
  readonly colliders: ColliderStore3D;
  readonly broadPhase: DynamicAabbBroadPhase3D;
  readonly materializeBody: (
    index: number,
    generation: number,
  ) => CRCPhysicsBodyHandle3D;
  readonly materializeCollider: (
    index: number,
    generation: number,
  ) => CRCPhysicsColliderHandle3D;
  readonly resolveBody: (
    handle: CRCPhysicsBodyHandle3D,
  ) => HandleIdentity3D | null;
  readonly resolveCollider: (
    handle: CRCPhysicsColliderHandle3D,
  ) => HandleIdentity3D | null;
  readonly assertReadable: () => void;
}

interface PreparedQueryOptions3D {
  readonly mode: CRCPhysicsQueryMode;
  readonly sensors: "include" | "exclude" | "only";
  readonly collisionFilter: CRCPhysicsCollisionFilter | null;
  readonly excludeBody: HandleIdentity3D | null;
  readonly excludeCollider: HandleIdentity3D | null;
  readonly valid: boolean;
}

interface SemanticCollider3D {
  readonly colliderIndex: number;
  readonly colliderGeneration: number;
  readonly bodyIndex: number;
  readonly bodyGeneration: number;
  readonly shape: CRCPhysicsShape3D;
  readonly pose: CRCPhysicsPose3D;
}

interface RawHit3D extends CRCPhysicsShapeHit3D {
  readonly collider: SemanticCollider3D;
}

export class CommittedWorldQueries3D {
  private active = true;

  constructor(private readonly options: CommittedWorldQueriesOptions3D) {
    if (typeof options.assertReadable !== "function") {
      throw new Error(
        "committed queries require an owner-bound committed-read guard.",
      );
    }
  }

  invalidate(): void {
    this.active = false;
  }

  raycast<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    ray: CRCPhysicsRay3D,
    queryOptions?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D> {
    this.options.assertReadable();
    const prepared = this.prepareOptions(queryOptions);
    if (!this.isUsable(worldGeneration, prepared)) {
      return emptyResult(prepared.mode);
    }
    const origin = copyFiniteVector3(ray.origin, "ray.origin");
    const direction = copyFiniteVector3(ray.direction, "ray.direction");
    if (Math.hypot(direction[0]!, direction[1]!, direction[2]!) === 0) {
      throw new RangeError("ray.direction must be non-zero.");
    }
    const maxDistance = requireNonnegativeNumber(
      ray.maxDistance,
      "ray.maxDistance",
    );
    const copiedRay: CRCPhysicsRay3D = {
      origin: publicVector(origin),
      direction: publicVector(direction),
      maxDistance,
    };
    const hits: RawHit3D[] = [];
    for (const index of this.candidateColliderIndices(rayBounds(copiedRay))) {
      const collider = this.semanticCollider(index, prepared);
      if (collider === null) continue;
      const hit = raycastShape3D(collider.shape, collider.pose, copiedRay);
      if (hit === null) continue;
      if (prepared.mode === "any") {
        return true as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D>;
      }
      hits.push({ collider, ...hit });
    }
    return this.finishHits<Mode>(prepared.mode, hits);
  }

  shapeCast<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    shape: CRCPhysicsShape3D,
    from: CRCPhysicsPose3D,
    translation: CRCPhysicsVector3,
    queryOptions?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D> {
    this.options.assertReadable();
    const prepared = this.prepareOptions(queryOptions);
    if (!this.isUsable(worldGeneration, prepared)) {
      return emptyResult(prepared.mode);
    }
    const startingBounds = boundsOfShape3D(shape, from);
    const copiedTranslation = publicVector(
      copyFiniteVector3(translation, "translation"),
    );
    const copiedFrom = publicPose(from);
    const endingPose: CRCPhysicsPose3D = {
      position: [
        copiedFrom.position[0] + copiedTranslation[0],
        copiedFrom.position[1] + copiedTranslation[1],
        copiedFrom.position[2] + copiedTranslation[2],
      ],
      orientation: copiedFrom.orientation,
    };
    const sweptBounds = unionAabb(
      startingBounds,
      boundsOfShape3D(shape, endingPose),
    );
    const hits: RawHit3D[] = [];
    for (const index of this.candidateColliderIndices(sweptBounds)) {
      const collider = this.semanticCollider(index, prepared);
      if (collider === null) continue;
      const hit = shapeCastAgainstShape3D(
        shape,
        copiedFrom,
        copiedTranslation,
        collider.shape,
        collider.pose,
      );
      if (hit === null) continue;
      if (prepared.mode === "any") {
        return true as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D>;
      }
      hits.push({ collider, ...hit });
    }
    return this.finishHits<Mode>(prepared.mode, hits);
  }

  overlapShape<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    shape: CRCPhysicsShape3D,
    pose: CRCPhysicsPose3D,
    queryOptions?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
    this.options.assertReadable();
    if (!this.isGenerationLive(worldGeneration)) {
      return emptyResult(modeOf(queryOptions));
    }
    const queryBounds = boundsOfShape3D(shape, pose);
    const copiedPose = publicPose(pose);
    return this.runMatchQuery(
      worldGeneration,
      queryOptions,
      queryBounds,
      (collider) =>
        overlapPreparedShapes3D(
          shape,
          copiedPose,
          collider.shape,
          collider.pose,
        ),
    );
  }

  queryAabb<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    bounds: CRCPhysicsAabb3D,
    queryOptions?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
    this.options.assertReadable();
    if (!this.isGenerationLive(worldGeneration)) {
      return emptyResult(modeOf(queryOptions));
    }
    const copied = copyAabb(bounds);
    return this.runMatchQuery(
      worldGeneration,
      queryOptions,
      copied,
      (collider) =>
        aabbsOverlap(copied, boundsOfShape3D(collider.shape, collider.pose)),
    );
  }

  queryPoint<Mode extends CRCPhysicsQueryMode = "closest">(
    worldGeneration: number,
    point: CRCPhysicsVector3,
    queryOptions?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
    this.options.assertReadable();
    if (!this.isGenerationLive(worldGeneration)) {
      return emptyResult(modeOf(queryOptions));
    }
    const copied = publicVector(copyFiniteVector3(point, "point"));
    const pointBounds = { min: copied, max: copied };
    return this.runMatchQuery(
      worldGeneration,
      queryOptions,
      pointBounds,
      (collider) => containsPoint3D(collider.shape, collider.pose, copied),
    );
  }

  private runMatchQuery<Mode extends CRCPhysicsQueryMode>(
    worldGeneration: number,
    queryOptions: CRCPhysicsQueryOptions3D<Mode> | undefined,
    bounds: CRCPhysicsAabb3D,
    matches: (collider: SemanticCollider3D) => boolean,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
    const prepared = this.prepareOptions(queryOptions);
    if (!this.isUsable(worldGeneration, prepared)) {
      return emptyResult(prepared.mode);
    }
    const matchesFound: SemanticCollider3D[] = [];
    for (const index of this.candidateColliderIndices(bounds)) {
      const collider = this.semanticCollider(index, prepared);
      if (collider === null || !matches(collider)) continue;
      if (prepared.mode === "any") {
        return true as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D>;
      }
      matchesFound.push(collider);
    }
    matchesFound.sort(compareSemanticIdentity);
    if (prepared.mode === "any") {
      return false as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D>;
    }
    if (prepared.mode === "closest") {
      return (
        matchesFound.length === 0
          ? null
          : this.materializeMatch(matchesFound[0]!)
      ) as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D>;
    }
    return Object.freeze(
      matchesFound.map((collider) => this.materializeMatch(collider)),
    ) as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D>;
  }

  private candidateColliderIndices(
    bounds: CRCPhysicsAabb3D,
  ): readonly number[] {
    const broadPhase = this.options.broadPhase;
    const proxies = new Int32Array(Math.max(1, broadPhase.proxyCapacity));
    const count = broadPhase.queryAabbInto(
      bounds.min[0],
      bounds.min[1],
      bounds.min[2],
      bounds.max[0],
      bounds.max[1],
      bounds.max[2],
      proxies,
      0,
      proxies.length,
    );
    const colliders: number[] = [];
    for (let offset = 0; offset < count; offset += 1) {
      const proxy = proxies[offset]!;
      const collider = broadPhase.proxyColliderIndices[proxy]!;
      if (collider >= 0) colliders.push(collider);
    }
    colliders.sort(
      (left, right) =>
        left - right ||
        this.options.colliders.generations[left]! -
          this.options.colliders.generations[right]!,
    );
    return colliders;
  }

  private prepareOptions<Mode extends CRCPhysicsQueryMode>(
    queryOptions: CRCPhysicsQueryOptions3D<Mode> | undefined,
  ): PreparedQueryOptions3D {
    const mode = modeOf(queryOptions);
    const sensors = queryOptions?.sensors ?? "include";
    if (sensors !== "include" && sensors !== "exclude" && sensors !== "only") {
      throw new RangeError("query sensors must be include, exclude, or only.");
    }
    const excludeBody =
      queryOptions?.excludeBody === undefined
        ? null
        : this.options.resolveBody(queryOptions.excludeBody);
    const excludeCollider =
      queryOptions?.excludeCollider === undefined
        ? null
        : this.options.resolveCollider(queryOptions.excludeCollider);
    return {
      mode,
      sensors,
      collisionFilter: queryOptions?.collisionFilter ?? null,
      excludeBody,
      excludeCollider,
      valid:
        (queryOptions?.excludeBody === undefined ||
          (excludeBody !== null &&
            this.options.bodies.has(
              excludeBody.index,
              excludeBody.generation,
            ))) &&
        (queryOptions?.excludeCollider === undefined ||
          (excludeCollider !== null &&
            this.options.colliders.has(
              excludeCollider.index,
              excludeCollider.generation,
            ))),
    };
  }

  private isUsable(
    worldGeneration: number,
    prepared: PreparedQueryOptions3D,
  ): boolean {
    return this.isGenerationLive(worldGeneration) && prepared.valid;
  }

  private isGenerationLive(worldGeneration: number): boolean {
    return this.active && worldGeneration === this.options.generation;
  }

  private semanticCollider(
    colliderIndex: number,
    prepared: PreparedQueryOptions3D,
  ): SemanticCollider3D | null {
    const { bodies, colliders } = this.options;
    const colliderGeneration = colliders.generations[colliderIndex]!;
    if (
      !colliders.has(colliderIndex, colliderGeneration) ||
      (colliders.flags[colliderIndex]! & COLLIDER_ENABLED_3D) === 0
    ) {
      return null;
    }
    const bodyIndex = colliders.bodyIndices[colliderIndex]!;
    const bodyGeneration = colliders.bodyGenerations[colliderIndex]!;
    if (
      !bodies.has(bodyIndex, bodyGeneration) ||
      (bodies.flags[bodyIndex]! & BODY_ENABLED_3D) === 0 ||
      sameIdentity(prepared.excludeBody, bodyIndex, bodyGeneration) ||
      sameIdentity(prepared.excludeCollider, colliderIndex, colliderGeneration)
    ) {
      return null;
    }
    const sensor = (colliders.flags[colliderIndex]! & COLLIDER_SENSOR_3D) !== 0;
    if (
      (prepared.sensors === "exclude" && sensor) ||
      (prepared.sensors === "only" && !sensor)
    ) {
      return null;
    }
    if (
      prepared.collisionFilter !== null &&
      !collisionFiltersAllow3D(prepared.collisionFilter, {
        category: colliders.collisionCategories[colliderIndex]!,
        mask: colliders.collisionMasks[colliderIndex]!,
        group: colliders.collisionGroup[colliderIndex]!,
      })
    ) {
      return null;
    }
    const record = colliders.shapes[colliderIndex];
    if (record === null) return null;
    return {
      colliderIndex,
      colliderGeneration,
      bodyIndex,
      bodyGeneration,
      shape: shapeForRecord3D(record),
      pose: colliderPose(bodies, colliders, colliderIndex),
    };
  }

  private finishHits<Mode extends CRCPhysicsQueryMode>(
    mode: CRCPhysicsQueryMode,
    hits: RawHit3D[],
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D> {
    hits.sort(compareHits);
    if (mode === "any") {
      return false as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D>;
    }
    if (mode === "closest") {
      return (
        hits.length === 0 ? null : this.materializeHit(hits[0]!)
      ) as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D>;
    }
    return Object.freeze(
      hits.map((hit) => this.materializeHit(hit)),
    ) as CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D>;
  }

  private materializeHit(hit: RawHit3D): CRCPhysicsQueryHit3D {
    return Object.freeze({
      ...this.materializeMatch(hit.collider),
      ...projectQueryHitGeometry3D(hit),
    });
  }

  private materializeMatch(
    collider: SemanticCollider3D,
  ): CRCPhysicsQueryMatch3D {
    return Object.freeze({
      body: this.options.materializeBody(
        collider.bodyIndex,
        collider.bodyGeneration,
      ),
      collider: this.options.materializeCollider(
        collider.colliderIndex,
        collider.colliderGeneration,
      ),
      bodyGeneration: collider.bodyGeneration,
      colliderGeneration: collider.colliderGeneration,
      tag: this.options.colliders.tags[collider.colliderIndex],
    });
  }
}

export function projectQueryHitGeometry3D(
  hit: CRCPhysicsShapeHit3D,
): CRCPhysicsShapeHit3D {
  return Object.freeze({
    point: Object.freeze([...hit.point]) as CRCPhysicsVector3,
    normal: Object.freeze([...hit.normal]) as CRCPhysicsVector3,
    distance: hit.distance,
    timeOfImpact: hit.timeOfImpact,
    ...(hit.triangleIndex === undefined
      ? {}
      : { triangleIndex: hit.triangleIndex }),
    ...(hit.barycentric === undefined
      ? {}
      : {
          barycentric: Object.freeze([...hit.barycentric]) as CRCPhysicsVector3,
        }),
  });
}

function colliderPose(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  collider: number,
): CRCPhysicsPose3D {
  const body = colliders.bodyIndices[collider]!;
  const orientation = new Float64Array([
    bodies.orientationX[body]!,
    bodies.orientationY[body]!,
    bodies.orientationZ[body]!,
    bodies.orientationW[body]!,
  ]);
  const centerOffset = new Float64Array(3);
  rotateVectorInto(
    centerOffset,
    [
      bodies.localCenterX[body]!,
      bodies.localCenterY[body]!,
      bodies.localCenterZ[body]!,
    ],
    orientation,
  );
  const bodyPose: InternalPose3D = {
    position: new Float64Array([
      bodies.positionX[body]! - centerOffset[0]!,
      bodies.positionY[body]! - centerOffset[1]!,
      bodies.positionZ[body]! - centerOffset[2]!,
    ]),
    orientation,
  };
  const composed = composePose3D(bodyPose, {
    position: new Float64Array([
      colliders.localPositionX[collider]!,
      colliders.localPositionY[collider]!,
      colliders.localPositionZ[collider]!,
    ]),
    orientation: new Float64Array([
      colliders.localOrientationX[collider]!,
      colliders.localOrientationY[collider]!,
      colliders.localOrientationZ[collider]!,
      colliders.localOrientationW[collider]!,
    ]),
  });
  return {
    position: publicVector(composed.position),
    orientation: Object.freeze([
      composed.orientation[0]!,
      composed.orientation[1]!,
      composed.orientation[2]!,
      composed.orientation[3]!,
    ]),
  };
}

function publicPose(pose: CRCPhysicsPose3D): CRCPhysicsPose3D {
  const position = copyFiniteVector3(pose.position, "pose.position");
  const orientation = copyCanonicalQuaternion(
    pose.orientation,
    "pose.orientation",
  );
  return {
    position: publicVector(position),
    orientation: Object.freeze([
      orientation[0]!,
      orientation[1]!,
      orientation[2]!,
      orientation[3]!,
    ]),
  };
}

function copyAabb(bounds: CRCPhysicsAabb3D): CRCPhysicsAabb3D {
  const min = publicVector(copyFiniteVector3(bounds.min, "bounds.min"));
  const max = publicVector(copyFiniteVector3(bounds.max, "bounds.max"));
  if (min[0] > max[0] || min[1] > max[1] || min[2] > max[2]) {
    throw new RangeError("bounds.min must not exceed bounds.max.");
  }
  return Object.freeze({ min, max });
}

function aabbsOverlap(
  first: CRCPhysicsAabb3D,
  second: CRCPhysicsAabb3D,
): boolean {
  return (
    first.min[0] <= second.max[0] &&
    first.max[0] >= second.min[0] &&
    first.min[1] <= second.max[1] &&
    first.max[1] >= second.min[1] &&
    first.min[2] <= second.max[2] &&
    first.max[2] >= second.min[2]
  );
}

function rayBounds(ray: CRCPhysicsRay3D): CRCPhysicsAabb3D {
  const scale = Math.max(
    Math.abs(ray.direction[0]),
    Math.abs(ray.direction[1]),
    Math.abs(ray.direction[2]),
  );
  const scaled = [
    ray.direction[0] / scale,
    ray.direction[1] / scale,
    ray.direction[2] / scale,
  ] as const;
  const length = Math.hypot(...scaled);
  const end = [
    ray.origin[0] + (scaled[0] / length) * ray.maxDistance,
    ray.origin[1] + (scaled[1] / length) * ray.maxDistance,
    ray.origin[2] + (scaled[2] / length) * ray.maxDistance,
  ] as const;
  return {
    min: [
      Math.min(ray.origin[0], end[0]),
      Math.min(ray.origin[1], end[1]),
      Math.min(ray.origin[2], end[2]),
    ],
    max: [
      Math.max(ray.origin[0], end[0]),
      Math.max(ray.origin[1], end[1]),
      Math.max(ray.origin[2], end[2]),
    ],
  };
}

function unionAabb(
  first: CRCPhysicsAabb3D,
  second: CRCPhysicsAabb3D,
): CRCPhysicsAabb3D {
  return {
    min: [
      Math.min(first.min[0], second.min[0]),
      Math.min(first.min[1], second.min[1]),
      Math.min(first.min[2], second.min[2]),
    ],
    max: [
      Math.max(first.max[0], second.max[0]),
      Math.max(first.max[1], second.max[1]),
      Math.max(first.max[2], second.max[2]),
    ],
  };
}

function compareHits(first: RawHit3D, second: RawHit3D): number {
  return (
    first.timeOfImpact - second.timeOfImpact ||
    compareSemanticIdentity(first.collider, second.collider)
  );
}

function compareSemanticIdentity(
  first: SemanticCollider3D,
  second: SemanticCollider3D,
): number {
  return (
    first.colliderIndex - second.colliderIndex ||
    first.colliderGeneration - second.colliderGeneration
  );
}

function modeOf<Mode extends CRCPhysicsQueryMode>(
  options: CRCPhysicsQueryOptions3D<Mode> | undefined,
): CRCPhysicsQueryMode {
  const mode = options?.mode ?? "closest";
  if (mode !== "closest" && mode !== "any" && mode !== "all") {
    throw new RangeError("query mode must be closest, any, or all.");
  }
  return mode;
}

function emptyResult<Mode extends CRCPhysicsQueryMode, Result>(
  mode: CRCPhysicsQueryMode,
): CRCPhysicsQueryResult3D<Mode, Result> {
  return (
    mode === "any" ? false : mode === "all" ? Object.freeze([]) : null
  ) as CRCPhysicsQueryResult3D<Mode, Result>;
}

function sameIdentity(
  identity: HandleIdentity3D | null,
  index: number,
  generation: number,
): boolean {
  return (
    identity !== null &&
    identity.index === index &&
    identity.generation === generation
  );
}

function publicVector(values: ArrayLike<number>): CRCPhysicsVector3 {
  return Object.freeze([values[0]!, values[1]!, values[2]!] as const);
}
