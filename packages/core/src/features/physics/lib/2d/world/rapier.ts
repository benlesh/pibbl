import RAPIER from "@dimforge/rapier2d-compat";
import type { BodyStore2D, ColliderStore2D } from "./storage.js";
import type { ShapeRecord2D, ConvexLeaf2D } from "../shape-records.js";
import type { PrivateManifold2D } from "../collision/manifold.js";
import { BODY_CCD_2D, collisionFiltersAllow2D } from "./ccd.js";
import {
  BODY_TYPE_DYNAMIC_2D,
  BODY_TYPE_KINEMATIC_2D,
  BODY_FIXED_ROTATION_2D,
} from "./integrator.js";
import { BODY_SLEEPING_2D, BODY_SLEEP_DISABLED_2D } from "./solver.js";
import {
  COLLIDER_SENSOR_2D,
  type SortedColliderPairs2D,
} from "./contact-cache.js";

// The compat build embeds WASM; initialization neither starts a clock nor fetches
// an external URL. Importers finish loading before any world can be mounted.
await RAPIER.init();
const SCALE = 100;
let ownedWorlds = 0;
export function liveRapierWorldsForTest(): number {
  return ownedWorlds;
}

interface BodyBinding {
  handle: number;
  generation: number;
  configuration?: string;
  staticPose?: readonly [number, number, number];
}
interface ColliderBinding {
  handles: number[];
  generation: number;
  shape: ShapeRecord2D;
  body: number;
  centerX: number;
  centerY: number;
  feature: number;
}
export interface RapierCheckpoint2D {
  bytes: Uint8Array;
  bodies: Map<number, BodyBinding>;
  colliders: Map<number, ColliderBinding>;
}

/** Private engine bridge. Pibbl retains identity, transactions, commands and time. */
export class RapierSimulation2D {
  private world = new RAPIER.World({ x: 0, y: 0 });
  private disposed = false;
  private bodyBindings = new Map<number, BodyBinding>();
  private colliderBindings = new Map<number, ColliderBinding>();
  private colliderIndices = new Map<number, number>();
  private impulses = new Map<string, number[]>();
  private impacts = new Map<
    string,
    {
      first: number;
      second: number;
      manifold: PrivateManifold2D;
      impulses: number[];
    }
  >();

  constructor() {
    this.world.lengthUnit = 1;
    ownedWorlds++;
  }

  checkpoint(): RapierCheckpoint2D {
    return {
      bytes: this.world.takeSnapshot(),
      bodies: new Map(this.bodyBindings),
      colliders: new Map(this.colliderBindings),
    };
  }

  restore(checkpoint: RapierCheckpoint2D): void {
    const restored = RAPIER.World.restoreSnapshot(checkpoint.bytes);
    this.world.free();
    this.world = restored;
    this.bodyBindings = new Map(checkpoint.bodies);
    this.colliderBindings = new Map(checkpoint.colliders);
    this.rebuildColliderIndices();
    this.impulses.clear();
    this.impacts.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
    ownedWorlds--;
    this.bodyBindings.clear();
    this.colliderBindings.clear();
    this.colliderIndices.clear();
    this.impulses.clear();
    this.impacts.clear();
  }

  step(
    bodies: BodyStore2D,
    colliders: ColliderStore2D,
    dt: number,
    gravityX: number,
    gravityY: number,
    sleeping: boolean,
    velocityIterations = 4,
    positionIterations = 1,
  ): void {
    validateEngineNumber(gravityX / SCALE);
    validateEngineNumber(gravityY / SCALE);
    this.synchronize(bodies, colliders, sleeping);
    const kinematicTargets = new Map<
      number,
      { x: number; y: number; angle: number }
    >();
    for (const [index, binding] of this.bodyBindings) {
      const body = this.world.getRigidBody(binding.handle);
      if (bodies.flags[index]! & BODY_TYPE_KINEMATIC_2D) {
        const target = {
          x: bodies.positionX[index]! + bodies.linearVelocityX[index]! * dt,
          y: bodies.positionY[index]! + bodies.linearVelocityY[index]! * dt,
          angle:
            bodies.rotationRadians[index]! +
            bodies.angularVelocity[index]! * dt,
        };
        body.setNextKinematicTranslation({
          x: target.x / SCALE,
          y: target.y / SCALE,
        });
        body.setNextKinematicRotation(target.angle);
        kinematicTargets.set(index, target);
      } else if (
        !(bodies.flags[index]! & BODY_SLEEPING_2D) &&
        (gravityX !== 0 || gravityY !== 0) &&
        bodies.gravityScale[index] !== 0 &&
        !this.hasSolidContact(body)
      )
        body.wakeUp();
    }
    this.world.gravity = { x: gravityX / SCALE, y: gravityY / SCALE };
    this.world.numSolverIterations = velocityIterations;
    this.world.numInternalPgsIterations = positionIterations;
    const substeps = this.ccdSubsteps(
      bodies,
      colliders,
      dt,
      gravityX,
      gravityY,
    );
    this.world.timestep = dt / substeps;
    this.world.integrationParameters.maxCcdSubsteps = 4;
    const allowed = (a: number, b: number) => {
      const first = this.colliderIndices.get(a);
      const second = this.colliderIndices.get(b);
      return (
        first !== undefined &&
        second !== undefined &&
        collisionFiltersAllow2D(
          colliders.filters[first],
          colliders.filters[second],
        )
      );
    };
    const hooks: RAPIER.PhysicsHooks = {
      filterContactPair: (a, b) =>
        allowed(a, b) ? RAPIER.SolverFlags.COMPUTE_IMPULSE : null,
      filterIntersectionPair: allowed,
    };
    const starts = new Map(
      [...kinematicTargets.keys()].map((index) => [
        index,
        {
          x: bodies.positionX[index]!,
          y: bodies.positionY[index]!,
          angle: bodies.rotationRadians[index]!,
        },
      ]),
    );
    this.impulses.clear();
    this.impacts.clear();
    for (let substep = 1; substep <= substeps; substep++) {
      const fraction = substep / substeps;
      for (const [index, target] of kinematicTargets) {
        const start = starts.get(index)!;
        const body = this.world.getRigidBody(
          this.bodyBindings.get(index)!.handle,
        );
        body.setNextKinematicTranslation({
          x: (start.x + (target.x - start.x) * fraction) / SCALE,
          y: (start.y + (target.y - start.y) * fraction) / SCALE,
        });
        body.setNextKinematicRotation(
          start.angle + (target.angle - start.angle) * fraction,
        );
      }
      this.world.step(undefined, hooks);
      if (substeps > 1) this.captureImpacts(bodies);
    }
    for (const [index, binding] of this.bodyBindings) {
      if (
        !(
          bodies.flags[index]! &
          (BODY_TYPE_DYNAMIC_2D | BODY_TYPE_KINEMATIC_2D)
        )
      )
        continue;
      const body = this.world.getRigidBody(binding.handle);
      const position = body.translation();
      const velocity = body.linvel();
      for (const value of [
        position.x,
        position.y,
        velocity.x,
        velocity.y,
        body.rotation(),
        body.angvel(),
      ])
        validateEngineNumber(value);
      const target = kinematicTargets.get(index);
      bodies.positionX[index] =
        target?.x ?? logicalValue(position.x, bodies.positionX[index]!);
      bodies.positionY[index] =
        target?.y ?? logicalValue(position.y, bodies.positionY[index]!);
      bodies.rotationRadians[index] = target?.angle ?? body.rotation();
      bodies.linearVelocityX[index] = logicalValue(
        velocity.x,
        bodies.linearVelocityX[index]!,
      );
      bodies.linearVelocityY[index] = logicalValue(
        velocity.y,
        bodies.linearVelocityY[index]!,
      );
      bodies.angularVelocity[index] = body.angvel();
      bodies.forceX[index] = 0;
      bodies.forceY[index] = 0;
      bodies.torque[index] = 0;
      if (body.isSleeping()) bodies.flags[index]! |= BODY_SLEEPING_2D;
      else bodies.flags[index]! &= ~BODY_SLEEPING_2D;
    }
  }

  manifold(first: number, second: number): PrivateManifold2D | null {
    const impact = this.impacts.get(`${first}:${second}`);
    if (impact) {
      this.impulses.set(`${first}:${second}`, impact.impulses);
      return impact.manifold;
    }
    return this.currentManifold(first, second);
  }

  contactPairs(
    pairs: SortedColliderPairs2D,
    colliders: ColliderStore2D,
  ): SortedColliderPairs2D {
    if (this.impacts.size === 0) return pairs;
    const merged = new Map<string, readonly [number, number]>();
    for (let i = 0; i < pairs.pairCount; i++) {
      const a = pairs.pairFirstColliderIndices[i]!,
        b = pairs.pairSecondColliderIndices[i]!;
      merged.set(`${a}:${b}`, [a, b]);
    }
    for (const [key, impact] of this.impacts)
      merged.set(key, [impact.first, impact.second]);
    const sorted = [...merged.values()].sort(
      (a, b) => a[0] - b[0] || a[1] - b[1],
    );
    return {
      pairCount: sorted.length,
      pairFirstColliderIndices: Int32Array.from(sorted, (pair) => pair[0]),
      pairSecondColliderIndices: Int32Array.from(sorted, (pair) => pair[1]),
      pairFirstColliderGenerations: Uint32Array.from(
        sorted,
        (pair) => colliders.generations[pair[0]]!,
      ),
      pairSecondColliderGenerations: Uint32Array.from(
        sorted,
        (pair) => colliders.generations[pair[1]]!,
      ),
    };
  }

  private captureImpacts(bodies: BodyStore2D): void {
    const seen = new Set<string>();
    for (const [index, binding] of this.colliderBindings) {
      if (!(bodies.flags[binding.body]! & BODY_CCD_2D)) continue;
      for (const handle of binding.handles) {
        const collider = this.world.getCollider(handle);
        if (collider.isSensor()) continue;
        this.world.contactPairsWith(collider, (other) => {
          if (other.isSensor()) return;
          const otherIndex = this.colliderIndices.get(other.handle);
          if (otherIndex === undefined || otherIndex === index) return;
          const first = Math.min(index, otherIndex),
            second = Math.max(index, otherIndex),
            key = `${first}:${second}`;
          if (seen.has(key)) return;
          seen.add(key);
          const manifold = this.currentManifold(first, second, true);
          const impulses = this.impulses.get(key);
          if (!manifold || !impulses?.some((value) => value > 0)) return;
          const previous = this.impacts.get(key);
          this.impacts.set(key, {
            first,
            second,
            manifold,
            impulses: impulses.map(
              (value, i) => value + (previous?.impulses[i] ?? 0),
            ),
          });
        });
      }
    }
  }

  private currentManifold(
    first: number,
    second: number,
    includePredictiveImpact = false,
  ): PrivateManifold2D | null {
    const a = this.colliderBindings.get(first);
    const b = this.colliderBindings.get(second);
    if (!a || !b) return null;
    let result: PrivateManifold2D | null = null;
    let depth = Infinity;
    for (let ai = 0; ai < a.handles.length; ai++)
      for (let bi = 0; bi < b.handles.length; bi++) {
        const ca = this.world.getCollider(a.handles[ai]!);
        const cb = this.world.getCollider(b.handles[bi]!);
        if (ca.isSensor() || cb.isSensor()) {
          if (this.world.intersectionPair(ca, cb))
            return {
              normalX: 1,
              normalY: 0,
              firstLeaf: ai,
              secondLeaf: bi,
              points: [
                {
                  firstX: ca.translation().x,
                  firstY: ca.translation().y,
                  secondX: cb.translation().x,
                  secondY: cb.translation().y,
                  separation: 0,
                  firstFeature: 0,
                  secondFeature: 0,
                },
              ],
            };
          continue;
        }
        this.world.contactPair(ca, cb, (contact, flipped) => {
          if (contact.numContacts() === 0) return;
          const separation =
            SCALE *
            Math.min(
              ...Array.from({ length: contact.numContacts() }, (_, i) =>
                contact.contactDist(i),
              ),
            );
          if (
            (!includePredictiveImpact && separation > 0.5) ||
            separation >= depth
          )
            return;
          const normal = contact.normal();
          const nx = normal.x * (flipped ? 1 : -1),
            ny = normal.y * (flipped ? 1 : -1);
          const points = [];
          const impulses = [];
          for (let i = 0; i < Math.min(2, contact.numContacts()); i++) {
            const pa = contact.localContactPoint1(i)!;
            const pb = contact.localContactPoint2(i)!;
            const wa = worldPoint(flipped ? cb : ca, pa);
            const wb = worldPoint(flipped ? ca : cb, pb);
            points.push({
              firstX: flipped ? wb.x : wa.x,
              firstY: flipped ? wb.y : wa.y,
              secondX: flipped ? wa.x : wb.x,
              secondY: flipped ? wa.y : wb.y,
              separation: contact.contactDist(i) * SCALE,
              firstFeature: contact.contactFid1(i),
              secondFeature: contact.contactFid2(i),
            });
            impulses.push(contact.contactImpulse(i) * SCALE);
          }
          result = {
            normalX: nx,
            normalY: ny,
            firstLeaf: ai,
            secondLeaf: bi,
            points,
          };
          depth = separation;
          this.impulses.set(`${first}:${second}`, impulses);
        });
      }
    return result;
  }

  normalImpulses(first: number, second: number): readonly number[] {
    return this.impulses.get(`${first}:${second}`) ?? [];
  }

  private synchronize(
    bodies: BodyStore2D,
    colliders: ColliderStore2D,
    sleeping: boolean,
  ): void {
    for (const [index, binding] of this.colliderBindings) {
      if (
        colliders.has(index, binding.generation) &&
        colliders.shapes[index] === binding.shape &&
        colliders.bodyIndices[index] === binding.body &&
        bodies.localCenterX[binding.body] === binding.centerX &&
        bodies.localCenterY[binding.body] === binding.centerY
      )
        continue;
      for (const handle of binding.handles) {
        const collider = this.world.getCollider(handle);
        if (collider) this.world.removeCollider(collider, false);
      }
      this.colliderBindings.delete(index);
    }
    for (const [index, binding] of this.bodyBindings) {
      if (bodies.has(index, binding.generation)) continue;
      this.world.removeRigidBody(this.world.getRigidBody(binding.handle));
      this.bodyBindings.delete(index);
    }
    for (let index = 0; index < bodies.capacity; index++) {
      const generation = bodies.generations[index]!;
      if (!bodies.has(index, generation)) continue;
      const flags = bodies.flags[index]!;
      for (const value of [
        bodies.positionX[index]! / SCALE,
        bodies.positionY[index]! / SCALE,
        bodies.linearVelocityX[index]! / SCALE,
        bodies.linearVelocityY[index]! / SCALE,
        bodies.rotationRadians[index]!,
        bodies.angularVelocity[index]!,
        bodies.forceX[index]! / SCALE,
        bodies.forceY[index]! / SCALE,
        bodies.torque[index]! / (SCALE * SCALE),
        bodies.gravityScale[index]!,
        bodies.linearDamping[index]!,
        bodies.angularDamping[index]!,
      ])
        validateEngineNumber(value);
      if (bodies.inverseMass[index]! > 0)
        validateEngineNumber(1 / bodies.inverseMass[index]!);
      if (bodies.inverseInertia[index]! > 0)
        validateEngineNumber(
          1 / bodies.inverseInertia[index]! / (SCALE * SCALE),
        );
      const type =
        flags & BODY_TYPE_DYNAMIC_2D
          ? RAPIER.RigidBodyType.Dynamic
          : flags & BODY_TYPE_KINEMATIC_2D
            ? RAPIER.RigidBodyType.KinematicPositionBased
            : RAPIER.RigidBodyType.Fixed;
      let binding = this.bodyBindings.get(index);
      if (!binding) {
        const created = this.world.createRigidBody(
          new RAPIER.RigidBodyDesc(type).setCanSleep(true),
        );
        binding = { handle: created.handle, generation };
        this.bodyBindings.set(index, binding);
      }
      const configuration = [
        type,
        bodies.gravityScale[index],
        bodies.linearDamping[index],
        bodies.angularDamping[index],
        flags & (BODY_CCD_2D | BODY_FIXED_ROTATION_2D),
        bodies.inverseMass[index],
        bodies.inverseInertia[index],
      ].join(":");
      if (
        type === RAPIER.RigidBodyType.Fixed &&
        binding.configuration === configuration &&
        binding.staticPose?.[0] === bodies.positionX[index] &&
        binding.staticPose[1] === bodies.positionY[index] &&
        binding.staticPose[2] === bodies.rotationRadians[index]
      )
        continue;
      const body = this.world.getRigidBody(binding.handle);
      if (body.bodyType() !== type) body.setBodyType(type, false);
      const position = body.translation();
      if (
        position.x !== Math.fround(bodies.positionX[index]! / SCALE) ||
        position.y !== Math.fround(bodies.positionY[index]! / SCALE)
      )
        body.setTranslation(
          {
            x: bodies.positionX[index]! / SCALE,
            y: bodies.positionY[index]! / SCALE,
          },
          false,
        );
      if (body.rotation() !== bodies.rotationRadians[index])
        body.setRotation(bodies.rotationRadians[index]!, false);
      const velocity = body.linvel();
      if (
        velocity.x !== Math.fround(bodies.linearVelocityX[index]! / SCALE) ||
        velocity.y !== Math.fround(bodies.linearVelocityY[index]! / SCALE)
      )
        body.setLinvel(
          {
            x: bodies.linearVelocityX[index]! / SCALE,
            y: bodies.linearVelocityY[index]! / SCALE,
          },
          false,
        );
      if (body.angvel() !== bodies.angularVelocity[index])
        body.setAngvel(bodies.angularVelocity[index]!, false);

      if (binding.configuration !== configuration) {
        this.bodyBindings.set(index, { ...binding, configuration });
        body.setGravityScale(bodies.gravityScale[index]!, false);
        body.setLinearDamping(bodies.linearDamping[index]!);
        body.setAngularDamping(bodies.angularDamping[index]!);
        body.enableCcd(!!(flags & BODY_CCD_2D));
        body.lockRotations(!!(flags & BODY_FIXED_ROTATION_2D), false);
        const inverseMass = bodies.inverseMass[index]!,
          inverseInertia = bodies.inverseInertia[index]!;
        body.setAdditionalMassProperties(
          inverseMass > 0 ? 1 / inverseMass : 0,
          { x: 0, y: 0 },
          inverseInertia > 0 ? 1 / inverseInertia / (SCALE * SCALE) : 0,
          false,
        );
      }
      if (type === RAPIER.RigidBodyType.Fixed) {
        this.bodyBindings.set(index, {
          ...this.bodyBindings.get(index)!,
          staticPose: [
            bodies.positionX[index]!,
            bodies.positionY[index]!,
            bodies.rotationRadians[index]!,
          ],
        });
        continue;
      }
      body.resetForces(false);
      body.resetTorques(false);
      body.addForce(
        { x: bodies.forceX[index]! / SCALE, y: bodies.forceY[index]! / SCALE },
        false,
      );
      body.addTorque(bodies.torque[index]! / (SCALE * SCALE), false);
      if (flags & BODY_SLEEPING_2D) {
        if (!body.isSleeping()) body.sleep();
      } else if (
        body.isSleeping() ||
        !sleeping ||
        flags & BODY_SLEEP_DISABLED_2D
      )
        body.wakeUp();
    }
    for (let index = 0; index < colliders.capacity; index++) {
      const generation = colliders.generations[index]!;
      if (!colliders.has(index, generation) || this.colliderBindings.has(index))
        continue;
      const shape = colliders.shapes[index]!;
      const bodyIndex = colliders.bodyIndices[index]!;
      const body = this.world.getRigidBody(
        this.bodyBindings.get(bodyIndex)!.handle,
      );
      const material = colliders.materials[index] as {
        friction?: number;
        restitution?: number;
      } | null;
      const handles = shape.leaves.map((leaf) => {
        const desc = leafDescriptor(
          leaf,
          shape,
          bodies.localCenterX[bodyIndex]!,
          bodies.localCenterY[bodyIndex]!,
        );
        desc
          .setDensity(0)
          .setFriction(Math.sqrt(material?.friction ?? 0.5))
          .setRestitution(material?.restitution ?? 0)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
          .setSensor(!!(colliders.flags[index]! & COLLIDER_SENSOR_2D))
          .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL)
          .setActiveHooks(
            RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS |
              RAPIER.ActiveHooks.FILTER_INTERSECTION_PAIRS,
          );
        return this.world.createCollider(desc, body).handle;
      });
      this.colliderBindings.set(index, {
        handles,
        generation,
        shape,
        body: bodyIndex,
        centerX: bodies.localCenterX[bodyIndex]!,
        centerY: bodies.localCenterY[bodyIndex]!,
        feature: Math.max(0.01, Math.min(...shape.leaves.map(minimumFeature))),
      });
    }
    this.rebuildColliderIndices();
  }

  private ccdSubsteps(
    bodies: BodyStore2D,
    colliders: ColliderStore2D,
    dt: number,
    gravityX: number,
    gravityY: number,
  ): number {
    let required = 1;
    for (const [index, binding] of this.colliderBindings) {
      const body = binding.body;
      if (
        !(bodies.flags[body]! & BODY_CCD_2D) ||
        !(bodies.flags[body]! & BODY_TYPE_DYNAMIC_2D) ||
        colliders.flags[index]! & COLLIDER_SENSOR_2D
      )
        continue;
      const bounds = binding.shape.localBounds;
      const width = bounds[2]! - bounds[0]!,
        height = bounds[3]! - bounds[1]!;
      const feature = Math.max(0.01, Math.min(width, height, binding.feature));
      // Bound every shape corner about the body's center of mass. Bounds can
      // occupy opposite quadrants, and collider descriptors are COM-relative.
      let radius = 0;
      for (let corner = 0; corner < 4; corner++) {
        const x =
          (corner % 2 === 0 ? bounds[0]! : bounds[2]!) -
          bodies.localCenterX[body]!;
        const y =
          (corner < 2 ? bounds[1]! : bounds[3]!) -
          bodies.localCenterY[body]!;
        radius = Math.max(radius, Math.hypot(x, y));
      }
      const acceleration = Math.hypot(
        gravityX * bodies.gravityScale[body]! +
          bodies.forceX[body]! * bodies.inverseMass[body]!,
        gravityY * bodies.gravityScale[body]! +
          bodies.forceY[body]! * bodies.inverseMass[body]!,
      );
      const angularAcceleration = Math.abs(
        bodies.torque[body]! * bodies.inverseInertia[body]!,
      );
      const speed =
        Math.hypot(
          bodies.linearVelocityX[body]!,
          bodies.linearVelocityY[body]!,
        ) +
        acceleration * dt +
        (Math.abs(bodies.angularVelocity[body]!) + angularAcceleration * dt) *
          radius;
      required = Math.max(required, Math.ceil((speed * dt) / (feature * 0.25)));
    }
    if (required > 64)
      throw new RangeError(
        `Physics CCD requires ${required} substeps (maximum 64). Reduce velocity or fixedStepMilliseconds, or enlarge the collider.`,
      );
    return required;
  }

  private hasSolidContact(body: RAPIER.RigidBody): boolean {
    let touching = false;
    for (let i = 0; i < body.numColliders(); i++) {
      const collider = body.collider(i);
      if (collider.isSensor()) continue;
      this.world.contactPairsWith(collider, (other) => {
        if (other.isSensor()) return;
        this.world.contactPair(collider, other, (contact) => {
          for (let point = 0; point < contact.numContacts(); point++)
            if (contact.contactDist(point) <= 0.5 / SCALE) touching = true;
        });
      });
    }
    return touching;
  }

  private rebuildColliderIndices(): void {
    this.colliderIndices.clear();
    for (const [index, binding] of this.colliderBindings)
      for (const handle of binding.handles)
        this.colliderIndices.set(handle, index);
  }
}

function worldPoint(
  collider: RAPIER.Collider,
  p: RAPIER.Vector,
): RAPIER.Vector {
  const position = collider.translation(),
    angle = collider.rotation();
  return {
    x: (position.x + Math.cos(angle) * p.x - Math.sin(angle) * p.y) * SCALE,
    y: (position.y + Math.sin(angle) * p.x + Math.cos(angle) * p.y) * SCALE,
  };
}

function leafDescriptor(
  leaf: ConvexLeaf2D,
  shape: ShapeRecord2D,
  centerX: number,
  centerY: number,
): RAPIER.ColliderDesc {
  // Reject overflow/underflow before crossing the f32 WASM boundary.
  for (const [key, value] of Object.entries(leaf)) {
    if (value instanceof Float64Array)
      for (const number of value) validateEngineNumber(number / SCALE);
    else if (typeof value === "number")
      validateEngineNumber(key === "rotationRadians" ? value : value / SCALE);
  }
  for (const value of [shape.localPose.x, shape.localPose.y, centerX, centerY])
    validateEngineNumber(value / SCALE);
  let desc: RAPIER.ColliderDesc;
  let x = 0,
    y = 0,
    angle = 0;
  if (leaf.kind === "circle") {
    desc = RAPIER.ColliderDesc.ball(leaf.radius / SCALE);
    [x, y] = [leaf.center[0]!, leaf.center[1]!];
  } else if (leaf.kind === "box") {
    desc = RAPIER.ColliderDesc.cuboid(
      leaf.halfWidth / SCALE,
      leaf.halfHeight / SCALE,
    );
    [x, y] = [leaf.center[0]!, leaf.center[1]!];
  } else if (leaf.kind === "capsule") {
    const dx = leaf.end[0]! - leaf.start[0]!,
      dy = leaf.end[1]! - leaf.start[1]!;
    desc = RAPIER.ColliderDesc.capsule(
      Math.hypot(dx, dy) / 2 / SCALE,
      leaf.radius / SCALE,
    );
    x = (leaf.start[0]! + leaf.end[0]!) / 2;
    y = (leaf.start[1]! + leaf.end[1]!) / 2;
    angle = Math.atan2(dy, dx) - Math.PI / 2;
  } else if (leaf.kind === "segment")
    desc = RAPIER.ColliderDesc.segment(
      { x: leaf.start[0]! / SCALE, y: leaf.start[1]! / SCALE },
      { x: leaf.end[0]! / SCALE, y: leaf.end[1]! / SCALE },
    );
  else {
    let vertices: Float32Array;
    if (leaf.kind === "polygon")
      vertices = Float32Array.from(leaf.vertices, (value) => value / SCALE);
    else {
      const radius =
        leaf.kind === "ellipse"
          ? Math.max(leaf.radiusX, leaf.radiusY)
          : Math.max(...leaf.radii);
      const count =
        4 *
        Math.max(
          8,
          Math.ceil(
            Math.PI /
              Math.acos(Math.max(-1, 1 - 0.01 / Math.max(radius, 0.01))) /
              4,
          ),
        );
      if (!Number.isFinite(count) || count > 4096)
        throw new RangeError(
          "Curved physics collider requires more than 4096 vertices at 0.01-unit accuracy. Reduce its size or provide explicit collision geometry.",
        );
      const points: number[] = [];
      if (leaf.kind === "ellipse") {
        const cosine = Math.cos(leaf.rotationRadians),
          sine = Math.sin(leaf.rotationRadians);
        for (let i = 0; i < count; i++) {
          const x = leaf.radiusX * Math.cos((i * Math.PI * 2) / count),
            y = leaf.radiusY * Math.sin((i * Math.PI * 2) / count);
          points.push(
            leaf.center[0]! + cosine * x - sine * y,
            leaf.center[1]! + sine * x + cosine * y,
          );
        }
      } else {
        // Parametric corner arcs bound chord error by r*(1-cos(angle/2)).
        for (let corner = 0; corner < 4; corner++) {
          const r = leaf.radii[corner]!,
            right = corner === 1 || corner === 2,
            bottom = corner >= 2;
          const cx =
            leaf.center[0]! +
            (right ? leaf.halfWidth - r : -leaf.halfWidth + r);
          const cy =
            leaf.center[1]! +
            (bottom ? leaf.halfHeight - r : -leaf.halfHeight + r);
          for (let i = 0; i <= count / 4; i++) {
            const a =
              Math.PI + (corner * Math.PI) / 2 + (i * Math.PI * 2) / count;
            points.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
          }
        }
      }
      vertices = Float32Array.from(points, (value) => value / SCALE);
    }
    const hull = RAPIER.ColliderDesc.convexHull(vertices);
    if (!hull)
      throw new Error(
        "Physics shape cannot form a finite convex Rapier collider.",
      );
    desc = hull;
  }
  const cosine = Math.cos(shape.localPose.rotationRadians),
    sine = Math.sin(shape.localPose.rotationRadians);
  const translationX =
    (shape.localPose.x + cosine * x - sine * y - centerX) / SCALE;
  const translationY =
    (shape.localPose.y + sine * x + cosine * y - centerY) / SCALE;
  const rotation = shape.localPose.rotationRadians + angle;
  validateEngineNumber(translationX);
  validateEngineNumber(translationY);
  validateEngineNumber(rotation);
  return desc.setTranslation(translationX, translationY).setRotation(rotation);
}

// A round trip through f32 must not move an axis the engine did not change.
function logicalValue(engineValue: number, previous: number): number {
  return engineValue === Math.fround(previous / SCALE)
    ? previous
    : engineValue * SCALE;
}

// Bound each convex leaf separately: a distant large leaf must not hide a thin one.
function minimumFeature(leaf: ConvexLeaf2D): number {
  if (leaf.kind === "circle" || leaf.kind === "capsule") return 2 * leaf.radius;
  if (leaf.kind === "ellipse") return 2 * Math.min(leaf.radiusX, leaf.radiusY);
  if (leaf.kind === "box" || leaf.kind === "rounded-box")
    return 2 * Math.min(leaf.halfWidth, leaf.halfHeight);
  if (leaf.kind === "segment") return 0;
  // Exhaustive edge-projection width: O(vertices²), without temporary arrays.
  // Cached on the collider binding; this is geometry setup, not per-tick work.
  let width = Infinity;
  const v = leaf.vertices;
  for (let i = 0; i < v.length; i += 2) {
    const j = (i + 2) % v.length;
    const dx = v[j]! - v[i]!,
      dy = v[j + 1]! - v[i + 1]!;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    let min = Infinity,
      max = -Infinity;
    for (let k = 0; k < v.length; k += 2) {
      const projection = (v[k]! * -dy + v[k + 1]! * dx) / length;
      min = Math.min(min, projection);
      max = Math.max(max, projection);
    }
    width = Math.min(width, max - min);
  }
  return width;
}

function validateEngineNumber(value: number): void {
  const rounded = Math.fround(value);
  if (!Number.isFinite(rounded) || (value !== 0 && rounded === 0))
    throw new RangeError(
      "Physics value cannot be represented at 100 logical units per engine meter. Reduce extreme coordinates, speeds, forces, or shape dimensions.",
    );
}
