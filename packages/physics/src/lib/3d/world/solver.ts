import {
  CONTACT_SLOP_3D,
  MAX_POSITION_CORRECTION_3D,
  RESTITUTION_VELOCITY_THRESHOLD_3D,
  SLEEP_ANGULAR_SPEED_DEGREES_3D,
  SLEEP_DURATION_SECONDS_3D,
  SLEEP_LINEAR_SPEED_3D,
} from "../numeric-policy.js";
import { rotationMatrixInto } from "../math.js";
import type { PhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import type { ContactCache3D } from "./contact-cache.js";
import {
  writeCanonicalQuaternionInto3D,
  writeWorldInverseInertia3D,
} from "./integrator.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  BODY_TYPE_MASK_3D,
  type BodyStore3D,
} from "./storage.js";

const DEFAULT_VELOCITY_ITERATIONS_3D = 8;
const DEFAULT_POSITION_ITERATIONS_3D = 3;
const POINTS_PER_CONTACT = 4;
const NO_INDEX = -1;
const DEGREES_TO_RADIANS = Math.PI / 180;

export const BODY_SLEEP_DISABLED_3D = 1 << 3;
export const BODY_SLEEPING_3D = 1 << 4;

export interface SleepingCandidateOptions3D {
  readonly enabled: boolean;
  readonly recordTransition?: (bodyIndex: number, sleeping: boolean) => void;
}

export class SequentialImpulseSolver3D {
  constraintCount = 0;
  islandCount = 0;
  islandBodyCount = 0;
  velocityIterationsPerformed = 0;
  positionIterationsPerformed = 0;
  solvedIslandCount = 0;
  advanceEligible = true;

  islandBodyIndices: Int32Array;
  islandContactIndices: Int32Array;
  islandBodyOffsets: Int32Array;
  islandContactOffsets: Int32Array;
  pointNormalMasses: Float64Array;
  pointTangentMasses1: Float64Array;
  pointTangentMasses2: Float64Array;

  private sortedBodyIndices: Int32Array;
  private bodyToDynamic: Int32Array;
  private dynamicParents: Int32Array;
  private dynamicIslandIndices: Int32Array;
  private islandBodyCounts: Int32Array;
  private islandContactCounts: Int32Array;
  private islandBodyWrites: Int32Array;
  private islandContactWrites: Int32Array;
  private islandAwake: Uint8Array;
  private constraintContactIndices: Int32Array;
  private tangent1X: Float64Array;
  private tangent1Y: Float64Array;
  private tangent1Z: Float64Array;
  private tangent2X: Float64Array;
  private tangent2Y: Float64Array;
  private tangent2Z: Float64Array;
  private pointFirstLocalX: Float64Array;
  private pointFirstLocalY: Float64Array;
  private pointFirstLocalZ: Float64Array;
  private pointSecondLocalX: Float64Array;
  private pointSecondLocalY: Float64Array;
  private pointSecondLocalZ: Float64Array;
  private pointVelocityBias: Float64Array;
  private bodyWorldInverseInertia: Float64Array;
  private readonly firstTensorScratch = new Float64Array(9);
  private readonly secondTensorScratch = new Float64Array(9);
  private readonly rotationScratch = new Float64Array(9);
  private readonly quaternionScratch = new Float64Array(4);
  private readonly firstOffsetScratch = new Float64Array(3);
  private readonly secondOffsetScratch = new Float64Array(3);
  private disposed = false;

  constructor(
    private readonly counters: PhysicsOwnershipCounters3D,
    initialBodyCapacity = 4,
    initialContactCapacity = 4,
  ) {
    const bodyCapacity = normalizedCapacity(initialBodyCapacity);
    const contactCapacity = normalizedCapacity(initialContactCapacity);
    this.islandBodyIndices = new Int32Array(bodyCapacity);
    this.islandContactIndices = new Int32Array(contactCapacity);
    this.islandBodyOffsets = new Int32Array(bodyCapacity + 1);
    this.islandContactOffsets = new Int32Array(bodyCapacity + 1);
    this.pointNormalMasses = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointTangentMasses1 = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointTangentMasses2 = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.sortedBodyIndices = new Int32Array(bodyCapacity);
    this.bodyToDynamic = filledInt32(bodyCapacity, NO_INDEX);
    this.dynamicParents = new Int32Array(bodyCapacity);
    this.dynamicIslandIndices = new Int32Array(bodyCapacity);
    this.islandBodyCounts = new Int32Array(bodyCapacity);
    this.islandContactCounts = new Int32Array(bodyCapacity);
    this.islandBodyWrites = new Int32Array(bodyCapacity);
    this.islandContactWrites = new Int32Array(bodyCapacity);
    this.islandAwake = new Uint8Array(bodyCapacity);
    this.constraintContactIndices = new Int32Array(contactCapacity);
    this.tangent1X = new Float64Array(contactCapacity);
    this.tangent1Y = new Float64Array(contactCapacity);
    this.tangent1Z = new Float64Array(contactCapacity);
    this.tangent2X = new Float64Array(contactCapacity);
    this.tangent2Y = new Float64Array(contactCapacity);
    this.tangent2Z = new Float64Array(contactCapacity);
    this.pointFirstLocalX = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointFirstLocalY = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointFirstLocalZ = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointSecondLocalX = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointSecondLocalY = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointSecondLocalZ = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.pointVelocityBias = new Float64Array(
      contactCapacity * POINTS_PER_CONTACT,
    );
    this.bodyWorldInverseInertia = new Float64Array(bodyCapacity * 9);
    counters.solverAllocations += 1;
    counters.liveSolvers += 1;
    counters.solverBodyCapacity = bodyCapacity;
    counters.solverContactCapacity = contactCapacity;
  }

  solveCandidate(
    bodies: BodyStore3D,
    bodyIndices: Int32Array,
    bodyCount: number,
    contacts: ContactCache3D,
    velocityIterations = DEFAULT_VELOCITY_ITERATIONS_3D,
    positionIterations = DEFAULT_POSITION_ITERATIONS_3D,
  ): void {
    this.assertUsable();
    requireIterationCount(velocityIterations, "velocityIterations");
    requireIterationCount(positionIterations, "positionIterations");
    this.ensureBodyCapacity(Math.max(bodies.capacity, bodyCount));
    this.ensureContactCapacity(contacts.contactCount);
    this.buildIslands(bodies, bodyIndices, bodyCount, contacts);
    this.markAwakeIslands(bodies);
    this.prepareConstraints(bodies, contacts);
    this.warmStart(bodies, contacts);
    this.velocityIterationsPerformed = 0;
    this.positionIterationsPerformed = 0;
    if (this.solvedIslandCount > 0) {
      for (let iteration = 0; iteration < velocityIterations; iteration += 1) {
        this.solveVelocityConstraints(bodies, contacts);
        this.velocityIterationsPerformed += 1;
      }
      for (let iteration = 0; iteration < positionIterations; iteration += 1) {
        this.solvePositionConstraints(bodies, contacts);
        this.positionIterationsPerformed += 1;
      }
    }
  }

  updateSleepingCandidate(
    bodies: BodyStore3D,
    contacts: ContactCache3D,
    dt: number,
    options: SleepingCandidateOptions3D,
  ): boolean {
    this.assertUsable();
    if (!Number.isFinite(dt) || dt < 0) {
      throw new RangeError("sleep dt must be finite and nonnegative.");
    }
    if (!options.enabled) {
      for (let island = 0; island < this.islandCount; island += 1) {
        this.wakeIsland(bodies, island, options.recordTransition);
      }
      this.advanceEligible = true;
      return false;
    }

    let sleepingIslands = 0;
    for (let island = 0; island < this.islandCount; island += 1) {
      let belowThresholds = true;
      let sleepDisabled = false;
      let hasSleeping = false;
      let hasAwake = false;
      let minimumTime = Number.POSITIVE_INFINITY;
      for (
        let offset = this.islandBodyOffsets[island]!;
        offset < this.islandBodyOffsets[island + 1]!;
        offset += 1
      ) {
        const body = this.islandBodyIndices[offset]!;
        const flags = bodies.flags[body]!;
        sleepDisabled ||= (flags & BODY_SLEEP_DISABLED_3D) !== 0;
        hasSleeping ||= (flags & BODY_SLEEPING_3D) !== 0;
        hasAwake ||= (flags & BODY_SLEEPING_3D) === 0;
        minimumTime = Math.min(minimumTime, bodies.sleepTime[body]!);
        belowThresholds &&=
          Math.hypot(
            bodies.linearVelocityX[body]!,
            bodies.linearVelocityY[body]!,
            bodies.linearVelocityZ[body]!,
          ) < SLEEP_LINEAR_SPEED_3D &&
          Math.hypot(
            bodies.angularVelocityX[body]!,
            bodies.angularVelocityY[body]!,
            bodies.angularVelocityZ[body]!,
          ) <
            SLEEP_ANGULAR_SPEED_DEGREES_3D * DEGREES_TO_RADIANS;
      }
      const wakeFromContact =
        (hasSleeping && hasAwake) ||
        this.touchesMovingKinematic(bodies, contacts, island);
      if (sleepDisabled || wakeFromContact || !belowThresholds) {
        this.wakeIsland(bodies, island, options.recordTransition);
        continue;
      }
      if (hasSleeping) {
        sleepingIslands += 1;
        continue;
      }
      const elapsed = minimumTime + dt;
      if (elapsed + Number.EPSILON < SLEEP_DURATION_SECONDS_3D) {
        this.setIslandSleepTime(bodies, island, elapsed);
        continue;
      }
      this.sleepIsland(bodies, island, options.recordTransition);
      sleepingIslands += 1;
    }
    const allSleeping =
      this.islandCount > 0 && sleepingIslands === this.islandCount;
    this.advanceEligible = !allSleeping;
    return allSleeping;
  }

  wakeIslandContainingCandidate(
    bodies: BodyStore3D,
    bodyIndex: number,
    recordTransition?: (bodyIndex: number, sleeping: boolean) => void,
  ): boolean {
    this.assertUsable();
    const dynamic = this.dynamicIndex(bodyIndex);
    if (dynamic === NO_INDEX) return false;
    const island = this.dynamicIslandIndices[dynamic]!;
    const changed = this.wakeIsland(bodies, island, recordTransition);
    this.advanceEligible = this.islandCount > 0;
    return changed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.constraintCount = 0;
    this.islandCount = 0;
    this.islandBodyCount = 0;
    this.solvedIslandCount = 0;
    this.counters.solverReleases += 1;
    this.counters.liveSolvers -= 1;
  }

  private buildIslands(
    bodies: BodyStore3D,
    bodyIndices: Int32Array,
    bodyCount: number,
    contacts: ContactCache3D,
  ): void {
    let dynamicCount = 0;
    this.bodyToDynamic.fill(NO_INDEX);
    for (let source = 0; source < bodyCount; source += 1) {
      const body = bodyIndices[source]!;
      if (!isDynamicBody(bodies, body)) continue;
      let insertion = dynamicCount;
      while (insertion > 0 && this.sortedBodyIndices[insertion - 1]! > body) {
        this.sortedBodyIndices[insertion] =
          this.sortedBodyIndices[insertion - 1]!;
        insertion -= 1;
      }
      this.sortedBodyIndices[insertion] = body;
      dynamicCount += 1;
    }
    for (let dynamic = 0; dynamic < dynamicCount; dynamic += 1) {
      this.bodyToDynamic[this.sortedBodyIndices[dynamic]!] = dynamic;
      this.dynamicParents[dynamic] = dynamic;
    }

    this.constraintCount = 0;
    for (let contact = 0; contact < contacts.contactCount; contact += 1) {
      if (
        contacts.sensorFlags[contact] !== 0 ||
        contacts.pointCounts[contact] === 0
      )
        continue;
      const firstDynamic = this.dynamicIndex(
        contacts.firstBodyIndices[contact]!,
      );
      const secondDynamic = this.dynamicIndex(
        contacts.secondBodyIndices[contact]!,
      );
      if (firstDynamic === NO_INDEX && secondDynamic === NO_INDEX) continue;
      this.constraintContactIndices[this.constraintCount] = contact;
      this.constraintCount += 1;
      if (firstDynamic !== NO_INDEX && secondDynamic !== NO_INDEX) {
        this.unionDynamic(firstDynamic, secondDynamic);
      }
    }

    this.islandCount = 0;
    this.islandBodyCounts.fill(0);
    this.islandContactCounts.fill(0);
    for (let dynamic = 0; dynamic < dynamicCount; dynamic += 1) {
      const root = this.findRoot(dynamic);
      if (root === dynamic) {
        this.dynamicIslandIndices[root] = this.islandCount;
        this.islandCount += 1;
      }
    }
    for (let dynamic = 0; dynamic < dynamicCount; dynamic += 1) {
      const island = this.dynamicIslandIndices[this.findRoot(dynamic)]!;
      this.dynamicIslandIndices[dynamic] = island;
      this.islandBodyCounts[island] += 1;
    }
    for (
      let constraint = 0;
      constraint < this.constraintCount;
      constraint += 1
    ) {
      const contact = this.constraintContactIndices[constraint]!;
      const firstDynamic = this.dynamicIndex(
        contacts.firstBodyIndices[contact]!,
      );
      const dynamic =
        firstDynamic !== NO_INDEX
          ? firstDynamic
          : this.dynamicIndex(contacts.secondBodyIndices[contact]!);
      const island = this.dynamicIslandIndices[dynamic]!;
      this.islandContactCounts[island] += 1;
    }
    this.islandBodyOffsets[0] = 0;
    this.islandContactOffsets[0] = 0;
    for (let island = 0; island < this.islandCount; island += 1) {
      this.islandBodyOffsets[island + 1] =
        this.islandBodyOffsets[island]! + this.islandBodyCounts[island]!;
      this.islandContactOffsets[island + 1] =
        this.islandContactOffsets[island]! + this.islandContactCounts[island]!;
      this.islandBodyWrites[island] = this.islandBodyOffsets[island]!;
      this.islandContactWrites[island] = this.islandContactOffsets[island]!;
    }
    for (let dynamic = 0; dynamic < dynamicCount; dynamic += 1) {
      const island = this.dynamicIslandIndices[dynamic]!;
      const target = this.islandBodyWrites[island]!;
      this.islandBodyIndices[target] = this.sortedBodyIndices[dynamic]!;
      this.islandBodyWrites[island] = target + 1;
    }
    for (
      let constraint = 0;
      constraint < this.constraintCount;
      constraint += 1
    ) {
      const contact = this.constraintContactIndices[constraint]!;
      const firstDynamic = this.dynamicIndex(
        contacts.firstBodyIndices[contact]!,
      );
      const dynamic =
        firstDynamic !== NO_INDEX
          ? firstDynamic
          : this.dynamicIndex(contacts.secondBodyIndices[contact]!);
      const island = this.dynamicIslandIndices[dynamic]!;
      const target = this.islandContactWrites[island]!;
      this.islandContactIndices[target] = contact;
      this.islandContactWrites[island] = target + 1;
    }
    this.islandBodyCount = dynamicCount;
  }

  private markAwakeIslands(bodies: BodyStore3D): void {
    this.solvedIslandCount = 0;
    for (let island = 0; island < this.islandCount; island += 1) {
      let awake = false;
      for (
        let offset = this.islandBodyOffsets[island]!;
        offset < this.islandBodyOffsets[island + 1]!;
        offset += 1
      ) {
        if (
          (bodies.flags[this.islandBodyIndices[offset]!]! &
            BODY_SLEEPING_3D) ===
          0
        ) {
          awake = true;
          break;
        }
      }
      this.islandAwake[island] = awake ? 1 : 0;
      if (awake) this.solvedIslandCount += 1;
    }
  }

  private touchesMovingKinematic(
    bodies: BodyStore3D,
    contacts: ContactCache3D,
    island: number,
  ): boolean {
    for (
      let offset = this.islandContactOffsets[island]!;
      offset < this.islandContactOffsets[island + 1]!;
      offset += 1
    ) {
      const contact = this.islandContactIndices[offset]!;
      if (
        isMovingKinematic(bodies, contacts.firstBodyIndices[contact]!) ||
        isMovingKinematic(bodies, contacts.secondBodyIndices[contact]!)
      ) {
        return true;
      }
    }
    return false;
  }

  private setIslandSleepTime(
    bodies: BodyStore3D,
    island: number,
    sleepTime: number,
  ): void {
    for (
      let offset = this.islandBodyOffsets[island]!;
      offset < this.islandBodyOffsets[island + 1]!;
      offset += 1
    ) {
      bodies.sleepTime[this.islandBodyIndices[offset]!] = sleepTime;
    }
  }

  private sleepIsland(
    bodies: BodyStore3D,
    island: number,
    recordTransition?: (bodyIndex: number, sleeping: boolean) => void,
  ): void {
    for (
      let offset = this.islandBodyOffsets[island]!;
      offset < this.islandBodyOffsets[island + 1]!;
      offset += 1
    ) {
      const body = this.islandBodyIndices[offset]!;
      const wasSleeping = (bodies.flags[body]! & BODY_SLEEPING_3D) !== 0;
      bodies.flags[body] |= BODY_SLEEPING_3D;
      bodies.sleepTime[body] = SLEEP_DURATION_SECONDS_3D;
      bodies.linearVelocityX[body] = 0;
      bodies.linearVelocityY[body] = 0;
      bodies.linearVelocityZ[body] = 0;
      bodies.angularVelocityX[body] = 0;
      bodies.angularVelocityY[body] = 0;
      bodies.angularVelocityZ[body] = 0;
      bodies.forceX[body] = 0;
      bodies.forceY[body] = 0;
      bodies.forceZ[body] = 0;
      bodies.torqueX[body] = 0;
      bodies.torqueY[body] = 0;
      bodies.torqueZ[body] = 0;
      if (!wasSleeping) recordTransition?.(body, true);
    }
  }

  private wakeIsland(
    bodies: BodyStore3D,
    island: number,
    recordTransition?: (bodyIndex: number, sleeping: boolean) => void,
  ): boolean {
    let changed = false;
    for (
      let offset = this.islandBodyOffsets[island]!;
      offset < this.islandBodyOffsets[island + 1]!;
      offset += 1
    ) {
      const body = this.islandBodyIndices[offset]!;
      const wasSleeping = (bodies.flags[body]! & BODY_SLEEPING_3D) !== 0;
      bodies.flags[body] &= ~BODY_SLEEPING_3D;
      bodies.sleepTime[body] = 0;
      if (wasSleeping) {
        changed = true;
        recordTransition?.(body, false);
      }
    }
    return changed;
  }

  private contactBelongsToAwakeIsland(
    contacts: ContactCache3D,
    contact: number,
  ): boolean {
    const firstDynamic = this.dynamicIndex(contacts.firstBodyIndices[contact]!);
    const dynamic =
      firstDynamic !== NO_INDEX
        ? firstDynamic
        : this.dynamicIndex(contacts.secondBodyIndices[contact]!);
    return (
      dynamic !== NO_INDEX &&
      this.islandAwake[this.dynamicIslandIndices[dynamic]!] === 1
    );
  }

  private prepareConstraints(
    bodies: BodyStore3D,
    contacts: ContactCache3D,
  ): void {
    this.bodyWorldInverseInertia.fill(0);
    for (
      let constraint = 0;
      constraint < this.constraintCount;
      constraint += 1
    ) {
      const contact = this.constraintContactIndices[constraint]!;
      if (!this.contactBelongsToAwakeIsland(contacts, contact)) continue;
      const firstBody = contacts.firstBodyIndices[contact]!;
      const secondBody = contacts.secondBodyIndices[contact]!;
      writeWorldInverseInertia3D(
        bodies,
        firstBody,
        this.bodyWorldInverseInertia,
        firstBody * 9,
        this.rotationScratch,
      );
      writeWorldInverseInertia3D(
        bodies,
        secondBody,
        this.bodyWorldInverseInertia,
        secondBody * 9,
        this.rotationScratch,
      );
      const normalX = contacts.normalX[contact]!;
      const normalY = contacts.normalY[contact]!;
      const normalZ = contacts.normalZ[contact]!;
      this.writeTangents(contact, normalX, normalY, normalZ);
      const tangent1X = this.tangent1X[contact]!;
      const tangent1Y = this.tangent1Y[contact]!;
      const tangent1Z = this.tangent1Z[contact]!;
      const tangent2X = this.tangent2X[contact]!;
      const tangent2Y = this.tangent2Y[contact]!;
      const tangent2Z = this.tangent2Z[contact]!;
      const base = contact * POINTS_PER_CONTACT;
      for (let point = 0; point < POINTS_PER_CONTACT; point += 1) {
        const index = base + point;
        if (point >= contacts.pointCounts[contact]!) {
          this.clearPreparedPoint(index);
          continue;
        }
        const firstWorldX =
          contacts.pointFirstX[index]! - bodies.positionX[firstBody]!;
        const firstWorldY =
          contacts.pointFirstY[index]! - bodies.positionY[firstBody]!;
        const firstWorldZ =
          contacts.pointFirstZ[index]! - bodies.positionZ[firstBody]!;
        const secondWorldX =
          contacts.pointSecondX[index]! - bodies.positionX[secondBody]!;
        const secondWorldY =
          contacts.pointSecondY[index]! - bodies.positionY[secondBody]!;
        const secondWorldZ =
          contacts.pointSecondZ[index]! - bodies.positionZ[secondBody]!;
        this.worldOffsetToLocal(
          bodies,
          firstBody,
          firstWorldX,
          firstWorldY,
          firstWorldZ,
          this.pointFirstLocalX,
          this.pointFirstLocalY,
          this.pointFirstLocalZ,
          index,
        );
        this.worldOffsetToLocal(
          bodies,
          secondBody,
          secondWorldX,
          secondWorldY,
          secondWorldZ,
          this.pointSecondLocalX,
          this.pointSecondLocalY,
          this.pointSecondLocalZ,
          index,
        );
        const normalDenominator = this.effectiveMassDenominator(
          bodies,
          firstBody,
          secondBody,
          firstWorldX,
          firstWorldY,
          firstWorldZ,
          secondWorldX,
          secondWorldY,
          secondWorldZ,
          normalX,
          normalY,
          normalZ,
        );
        const tangent1Denominator = this.effectiveMassDenominator(
          bodies,
          firstBody,
          secondBody,
          firstWorldX,
          firstWorldY,
          firstWorldZ,
          secondWorldX,
          secondWorldY,
          secondWorldZ,
          tangent1X,
          tangent1Y,
          tangent1Z,
        );
        const tangent2Denominator = this.effectiveMassDenominator(
          bodies,
          firstBody,
          secondBody,
          firstWorldX,
          firstWorldY,
          firstWorldZ,
          secondWorldX,
          secondWorldY,
          secondWorldZ,
          tangent2X,
          tangent2Y,
          tangent2Z,
        );
        this.pointNormalMasses[index] =
          normalDenominator > 0 ? 1 / normalDenominator : 0;
        this.pointTangentMasses1[index] =
          tangent1Denominator > 0 ? 1 / tangent1Denominator : 0;
        this.pointTangentMasses2[index] =
          tangent2Denominator > 0 ? 1 / tangent2Denominator : 0;
        const normalVelocity = relativeVelocityAlong(
          bodies,
          firstBody,
          secondBody,
          firstWorldX,
          firstWorldY,
          firstWorldZ,
          secondWorldX,
          secondWorldY,
          secondWorldZ,
          normalX,
          normalY,
          normalZ,
        );
        this.pointVelocityBias[index] =
          normalVelocity < -RESTITUTION_VELOCITY_THRESHOLD_3D
            ? contacts.mixedRestitution[contact]! * normalVelocity
            : 0;
      }
    }
  }

  private warmStart(bodies: BodyStore3D, contacts: ContactCache3D): void {
    for (
      let constraint = 0;
      constraint < this.constraintCount;
      constraint += 1
    ) {
      const contact = this.constraintContactIndices[constraint]!;
      if (!this.contactBelongsToAwakeIsland(contacts, contact)) continue;
      const normalX = contacts.normalX[contact]!;
      const normalY = contacts.normalY[contact]!;
      const normalZ = contacts.normalZ[contact]!;
      const tangent1X = this.tangent1X[contact]!;
      const tangent1Y = this.tangent1Y[contact]!;
      const tangent1Z = this.tangent1Z[contact]!;
      const tangent2X = this.tangent2X[contact]!;
      const tangent2Y = this.tangent2Y[contact]!;
      const tangent2Z = this.tangent2Z[contact]!;
      const base = contact * POINTS_PER_CONTACT;
      for (let point = 0; point < contacts.pointCounts[contact]!; point += 1) {
        const index = base + point;
        const normalImpulse = contacts.pointNormalImpulses[index]!;
        const tangentImpulse1 = contacts.pointTangentImpulse1[index]!;
        const tangentImpulse2 = contacts.pointTangentImpulse2[index]!;
        this.applyPointVelocityImpulse(
          bodies,
          contacts,
          contact,
          index,
          normalX * normalImpulse +
            tangent1X * tangentImpulse1 +
            tangent2X * tangentImpulse2,
          normalY * normalImpulse +
            tangent1Y * tangentImpulse1 +
            tangent2Y * tangentImpulse2,
          normalZ * normalImpulse +
            tangent1Z * tangentImpulse1 +
            tangent2Z * tangentImpulse2,
        );
      }
    }
  }

  private solveVelocityConstraints(
    bodies: BodyStore3D,
    contacts: ContactCache3D,
  ): void {
    for (
      let constraint = 0;
      constraint < this.constraintCount;
      constraint += 1
    ) {
      const contact = this.constraintContactIndices[constraint]!;
      if (!this.contactBelongsToAwakeIsland(contacts, contact)) continue;
      const firstBody = contacts.firstBodyIndices[contact]!;
      const secondBody = contacts.secondBodyIndices[contact]!;
      const normalX = contacts.normalX[contact]!;
      const normalY = contacts.normalY[contact]!;
      const normalZ = contacts.normalZ[contact]!;
      const tangent1X = this.tangent1X[contact]!;
      const tangent1Y = this.tangent1Y[contact]!;
      const tangent1Z = this.tangent1Z[contact]!;
      const tangent2X = this.tangent2X[contact]!;
      const tangent2Y = this.tangent2Y[contact]!;
      const tangent2Z = this.tangent2Z[contact]!;
      const base = contact * POINTS_PER_CONTACT;
      for (let point = 0; point < contacts.pointCounts[contact]!; point += 1) {
        const index = base + point;
        this.writeLocalOffsetToWorld(
          bodies,
          firstBody,
          index,
          true,
          this.firstOffsetScratch,
        );
        this.writeLocalOffsetToWorld(
          bodies,
          secondBody,
          index,
          false,
          this.secondOffsetScratch,
        );
        const firstWorld = this.firstOffsetScratch;
        const secondWorld = this.secondOffsetScratch;
        const normalVelocity = relativeVelocityAlong(
          bodies,
          firstBody,
          secondBody,
          firstWorld[0],
          firstWorld[1],
          firstWorld[2],
          secondWorld[0],
          secondWorld[1],
          secondWorld[2],
          normalX,
          normalY,
          normalZ,
        );
        const normalDelta =
          -this.pointNormalMasses[index]! *
          (normalVelocity + this.pointVelocityBias[index]!);
        const previousNormal = contacts.pointNormalImpulses[index]!;
        const accumulatedNormal = Math.max(0, previousNormal + normalDelta);
        contacts.pointNormalImpulses[index] = accumulatedNormal;
        const appliedNormal = accumulatedNormal - previousNormal;
        this.applyPointVelocityImpulse(
          bodies,
          contacts,
          contact,
          index,
          normalX * appliedNormal,
          normalY * appliedNormal,
          normalZ * appliedNormal,
        );

        const tangentVelocity1 = relativeVelocityAlong(
          bodies,
          firstBody,
          secondBody,
          firstWorld[0],
          firstWorld[1],
          firstWorld[2],
          secondWorld[0],
          secondWorld[1],
          secondWorld[2],
          tangent1X,
          tangent1Y,
          tangent1Z,
        );
        const tangentVelocity2 = relativeVelocityAlong(
          bodies,
          firstBody,
          secondBody,
          firstWorld[0],
          firstWorld[1],
          firstWorld[2],
          secondWorld[0],
          secondWorld[1],
          secondWorld[2],
          tangent2X,
          tangent2Y,
          tangent2Z,
        );
        const previousTangent1 = contacts.pointTangentImpulse1[index]!;
        const previousTangent2 = contacts.pointTangentImpulse2[index]!;
        let accumulatedTangent1 =
          previousTangent1 -
          this.pointTangentMasses1[index]! * tangentVelocity1;
        let accumulatedTangent2 =
          previousTangent2 -
          this.pointTangentMasses2[index]! * tangentVelocity2;
        const frictionLimit =
          contacts.mixedFriction[contact]! * accumulatedNormal;
        const tangentLength = Math.hypot(
          accumulatedTangent1,
          accumulatedTangent2,
        );
        if (tangentLength > frictionLimit && tangentLength > 0) {
          const scale = frictionLimit / tangentLength;
          accumulatedTangent1 *= scale;
          accumulatedTangent2 *= scale;
        }
        contacts.pointTangentImpulse1[index] = accumulatedTangent1;
        contacts.pointTangentImpulse2[index] = accumulatedTangent2;
        const appliedTangent1 = accumulatedTangent1 - previousTangent1;
        const appliedTangent2 = accumulatedTangent2 - previousTangent2;
        this.applyPointVelocityImpulse(
          bodies,
          contacts,
          contact,
          index,
          tangent1X * appliedTangent1 + tangent2X * appliedTangent2,
          tangent1Y * appliedTangent1 + tangent2Y * appliedTangent2,
          tangent1Z * appliedTangent1 + tangent2Z * appliedTangent2,
        );
      }
    }
  }

  private solvePositionConstraints(
    bodies: BodyStore3D,
    contacts: ContactCache3D,
  ): void {
    for (
      let constraint = 0;
      constraint < this.constraintCount;
      constraint += 1
    ) {
      const contact = this.constraintContactIndices[constraint]!;
      if (!this.contactBelongsToAwakeIsland(contacts, contact)) continue;
      const firstBody = contacts.firstBodyIndices[contact]!;
      const secondBody = contacts.secondBodyIndices[contact]!;
      const normalX = contacts.normalX[contact]!;
      const normalY = contacts.normalY[contact]!;
      const normalZ = contacts.normalZ[contact]!;
      const base = contact * POINTS_PER_CONTACT;
      for (let point = 0; point < contacts.pointCounts[contact]!; point += 1) {
        const index = base + point;
        this.writeLocalOffsetToWorld(
          bodies,
          firstBody,
          index,
          true,
          this.firstOffsetScratch,
        );
        this.writeLocalOffsetToWorld(
          bodies,
          secondBody,
          index,
          false,
          this.secondOffsetScratch,
        );
        const firstWorld = this.firstOffsetScratch;
        const secondWorld = this.secondOffsetScratch;
        const separation =
          (bodies.positionX[firstBody]! +
            firstWorld[0] -
            bodies.positionX[secondBody]! -
            secondWorld[0]) *
            normalX +
          (bodies.positionY[firstBody]! +
            firstWorld[1] -
            bodies.positionY[secondBody]! -
            secondWorld[1]) *
            normalY +
          (bodies.positionZ[firstBody]! +
            firstWorld[2] -
            bodies.positionZ[secondBody]! -
            secondWorld[2]) *
            normalZ;
        const correction = Math.min(
          MAX_POSITION_CORRECTION_3D,
          Math.max(0, -(separation + CONTACT_SLOP_3D)),
        );
        if (correction === 0) continue;
        writeWorldInverseInertia3D(
          bodies,
          firstBody,
          this.firstTensorScratch,
          0,
          this.rotationScratch,
        );
        writeWorldInverseInertia3D(
          bodies,
          secondBody,
          this.secondTensorScratch,
          0,
          this.rotationScratch,
        );
        const denominator =
          translationalInverseAlong(
            bodies,
            firstBody,
            normalX,
            normalY,
            normalZ,
          ) +
          translationalInverseAlong(
            bodies,
            secondBody,
            normalX,
            normalY,
            normalZ,
          ) +
          angularInverseAlong(
            this.firstTensorScratch,
            0,
            firstWorld[0],
            firstWorld[1],
            firstWorld[2],
            normalX,
            normalY,
            normalZ,
          ) +
          angularInverseAlong(
            this.secondTensorScratch,
            0,
            secondWorld[0],
            secondWorld[1],
            secondWorld[2],
            normalX,
            normalY,
            normalZ,
          );
        if (denominator <= 0) continue;
        const impulse = correction / denominator;
        this.applyPointPositionImpulse(
          bodies,
          firstBody,
          firstWorld[0],
          firstWorld[1],
          firstWorld[2],
          normalX * impulse,
          normalY * impulse,
          normalZ * impulse,
          this.firstTensorScratch,
        );
        this.applyPointPositionImpulse(
          bodies,
          secondBody,
          secondWorld[0],
          secondWorld[1],
          secondWorld[2],
          -normalX * impulse,
          -normalY * impulse,
          -normalZ * impulse,
          this.secondTensorScratch,
        );
      }
    }
  }

  private applyPointVelocityImpulse(
    bodies: BodyStore3D,
    contacts: ContactCache3D,
    contact: number,
    pointIndex: number,
    impulseX: number,
    impulseY: number,
    impulseZ: number,
  ): void {
    const firstBody = contacts.firstBodyIndices[contact]!;
    const secondBody = contacts.secondBodyIndices[contact]!;
    this.writeLocalOffsetToWorld(
      bodies,
      firstBody,
      pointIndex,
      true,
      this.firstOffsetScratch,
    );
    this.writeLocalOffsetToWorld(
      bodies,
      secondBody,
      pointIndex,
      false,
      this.secondOffsetScratch,
    );
    const firstWorld = this.firstOffsetScratch;
    const secondWorld = this.secondOffsetScratch;
    applyLinearVelocityImpulse(bodies, firstBody, impulseX, impulseY, impulseZ);
    applyAngularVelocityImpulse(
      bodies,
      firstBody,
      firstWorld[0],
      firstWorld[1],
      firstWorld[2],
      impulseX,
      impulseY,
      impulseZ,
      this.bodyWorldInverseInertia,
      firstBody * 9,
    );
    applyLinearVelocityImpulse(
      bodies,
      secondBody,
      -impulseX,
      -impulseY,
      -impulseZ,
    );
    applyAngularVelocityImpulse(
      bodies,
      secondBody,
      secondWorld[0],
      secondWorld[1],
      secondWorld[2],
      -impulseX,
      -impulseY,
      -impulseZ,
      this.bodyWorldInverseInertia,
      secondBody * 9,
    );
  }

  private applyPointPositionImpulse(
    bodies: BodyStore3D,
    body: number,
    offsetX: number,
    offsetY: number,
    offsetZ: number,
    impulseX: number,
    impulseY: number,
    impulseZ: number,
    tensor: Float64Array,
  ): void {
    if (!isDynamicBody(bodies, body)) return;
    const inverseMass = bodies.inverseMass[body]!;
    const locks = bodies.translationLocks[body]!;
    if ((locks & 1) === 0) bodies.positionX[body] += impulseX * inverseMass;
    if ((locks & 2) === 0) bodies.positionY[body] += impulseY * inverseMass;
    if ((locks & 4) === 0) bodies.positionZ[body] += impulseZ * inverseMass;
    const angularImpulseX = offsetY * impulseZ - offsetZ * impulseY;
    const angularImpulseY = offsetZ * impulseX - offsetX * impulseZ;
    const angularImpulseZ = offsetX * impulseY - offsetY * impulseX;
    const deltaX =
      tensor[0]! * angularImpulseX +
      tensor[1]! * angularImpulseY +
      tensor[2]! * angularImpulseZ;
    const deltaY =
      tensor[3]! * angularImpulseX +
      tensor[4]! * angularImpulseY +
      tensor[5]! * angularImpulseZ;
    const deltaZ =
      tensor[6]! * angularImpulseX +
      tensor[7]! * angularImpulseY +
      tensor[8]! * angularImpulseZ;
    applyWorldAngularDisplacement(
      bodies,
      body,
      deltaX,
      deltaY,
      deltaZ,
      this.quaternionScratch,
    );
  }

  private effectiveMassDenominator(
    bodies: BodyStore3D,
    firstBody: number,
    secondBody: number,
    firstX: number,
    firstY: number,
    firstZ: number,
    secondX: number,
    secondY: number,
    secondZ: number,
    axisX: number,
    axisY: number,
    axisZ: number,
  ): number {
    return (
      translationalInverseAlong(bodies, firstBody, axisX, axisY, axisZ) +
      translationalInverseAlong(bodies, secondBody, axisX, axisY, axisZ) +
      angularInverseAlong(
        this.bodyWorldInverseInertia,
        firstBody * 9,
        firstX,
        firstY,
        firstZ,
        axisX,
        axisY,
        axisZ,
      ) +
      angularInverseAlong(
        this.bodyWorldInverseInertia,
        secondBody * 9,
        secondX,
        secondY,
        secondZ,
        axisX,
        axisY,
        axisZ,
      )
    );
  }

  private writeTangents(
    contact: number,
    normalX: number,
    normalY: number,
    normalZ: number,
  ): void {
    const absoluteX = Math.abs(normalX);
    const absoluteY = Math.abs(normalY);
    const absoluteZ = Math.abs(normalZ);
    let referenceX = 0;
    let referenceY = 0;
    let referenceZ = 0;
    if (absoluteX <= absoluteY && absoluteX <= absoluteZ) referenceX = 1;
    else if (absoluteY <= absoluteZ) referenceY = 1;
    else referenceZ = 1;
    let tangent1X = referenceY * normalZ - referenceZ * normalY;
    let tangent1Y = referenceZ * normalX - referenceX * normalZ;
    let tangent1Z = referenceX * normalY - referenceY * normalX;
    const length = Math.hypot(tangent1X, tangent1Y, tangent1Z);
    tangent1X /= length;
    tangent1Y /= length;
    tangent1Z /= length;
    this.tangent1X[contact] = tangent1X;
    this.tangent1Y[contact] = tangent1Y;
    this.tangent1Z[contact] = tangent1Z;
    this.tangent2X[contact] = normalY * tangent1Z - normalZ * tangent1Y;
    this.tangent2Y[contact] = normalZ * tangent1X - normalX * tangent1Z;
    this.tangent2Z[contact] = normalX * tangent1Y - normalY * tangent1X;
  }

  private worldOffsetToLocal(
    bodies: BodyStore3D,
    body: number,
    worldX: number,
    worldY: number,
    worldZ: number,
    outputX: Float64Array,
    outputY: Float64Array,
    outputZ: Float64Array,
    outputIndex: number,
  ): void {
    this.writeBodyRotation(bodies, body);
    outputX[outputIndex] =
      this.rotationScratch[0]! * worldX +
      this.rotationScratch[3]! * worldY +
      this.rotationScratch[6]! * worldZ;
    outputY[outputIndex] =
      this.rotationScratch[1]! * worldX +
      this.rotationScratch[4]! * worldY +
      this.rotationScratch[7]! * worldZ;
    outputZ[outputIndex] =
      this.rotationScratch[2]! * worldX +
      this.rotationScratch[5]! * worldY +
      this.rotationScratch[8]! * worldZ;
  }

  private writeLocalOffsetToWorld(
    bodies: BodyStore3D,
    body: number,
    pointIndex: number,
    first: boolean,
    output: Float64Array,
  ): void {
    this.writeBodyRotation(bodies, body);
    const localX = first
      ? this.pointFirstLocalX[pointIndex]!
      : this.pointSecondLocalX[pointIndex]!;
    const localY = first
      ? this.pointFirstLocalY[pointIndex]!
      : this.pointSecondLocalY[pointIndex]!;
    const localZ = first
      ? this.pointFirstLocalZ[pointIndex]!
      : this.pointSecondLocalZ[pointIndex]!;
    output[0] =
      this.rotationScratch[0]! * localX +
      this.rotationScratch[1]! * localY +
      this.rotationScratch[2]! * localZ;
    output[1] =
      this.rotationScratch[3]! * localX +
      this.rotationScratch[4]! * localY +
      this.rotationScratch[5]! * localZ;
    output[2] =
      this.rotationScratch[6]! * localX +
      this.rotationScratch[7]! * localY +
      this.rotationScratch[8]! * localZ;
  }

  private writeBodyRotation(bodies: BodyStore3D, body: number): void {
    this.quaternionScratch[0] = bodies.orientationX[body]!;
    this.quaternionScratch[1] = bodies.orientationY[body]!;
    this.quaternionScratch[2] = bodies.orientationZ[body]!;
    this.quaternionScratch[3] = bodies.orientationW[body]!;
    rotationMatrixInto(this.rotationScratch, this.quaternionScratch);
  }

  private clearPreparedPoint(index: number): void {
    this.pointNormalMasses[index] = 0;
    this.pointTangentMasses1[index] = 0;
    this.pointTangentMasses2[index] = 0;
    this.pointFirstLocalX[index] = 0;
    this.pointFirstLocalY[index] = 0;
    this.pointFirstLocalZ[index] = 0;
    this.pointSecondLocalX[index] = 0;
    this.pointSecondLocalY[index] = 0;
    this.pointSecondLocalZ[index] = 0;
    this.pointVelocityBias[index] = 0;
  }

  private dynamicIndex(body: number): number {
    return body >= 0 && body < this.bodyToDynamic.length
      ? this.bodyToDynamic[body]!
      : NO_INDEX;
  }

  private findRoot(dynamic: number): number {
    let root = dynamic;
    while (this.dynamicParents[root] !== root)
      root = this.dynamicParents[root]!;
    let current = dynamic;
    while (this.dynamicParents[current] !== current) {
      const parent = this.dynamicParents[current]!;
      this.dynamicParents[current] = root;
      current = parent;
    }
    return root;
  }

  private unionDynamic(first: number, second: number): void {
    const firstRoot = this.findRoot(first);
    const secondRoot = this.findRoot(second);
    if (firstRoot === secondRoot) return;
    if (
      this.sortedBodyIndices[firstRoot]! <= this.sortedBodyIndices[secondRoot]!
    ) {
      this.dynamicParents[secondRoot] = firstRoot;
    } else {
      this.dynamicParents[firstRoot] = secondRoot;
    }
  }

  private ensureBodyCapacity(required: number): void {
    if (required <= this.sortedBodyIndices.length) return;
    const capacity = nextCapacity(this.sortedBodyIndices.length, required);
    this.islandBodyIndices = growInt32(this.islandBodyIndices, capacity);
    this.islandBodyOffsets = growInt32(this.islandBodyOffsets, capacity + 1);
    this.islandContactOffsets = growInt32(
      this.islandContactOffsets,
      capacity + 1,
    );
    this.sortedBodyIndices = growInt32(this.sortedBodyIndices, capacity);
    this.bodyToDynamic = growInt32(this.bodyToDynamic, capacity, NO_INDEX);
    this.dynamicParents = growInt32(this.dynamicParents, capacity);
    this.dynamicIslandIndices = growInt32(this.dynamicIslandIndices, capacity);
    this.islandBodyCounts = growInt32(this.islandBodyCounts, capacity);
    this.islandContactCounts = growInt32(this.islandContactCounts, capacity);
    this.islandBodyWrites = growInt32(this.islandBodyWrites, capacity);
    this.islandContactWrites = growInt32(this.islandContactWrites, capacity);
    this.islandAwake = growUint8(this.islandAwake, capacity);
    this.bodyWorldInverseInertia = growFloat64(
      this.bodyWorldInverseInertia,
      capacity * 9,
    );
    this.counters.solverBodyCapacity = capacity;
    this.counters.solverBodyCapacityGrowths += 1;
  }

  private ensureContactCapacity(required: number): void {
    if (required <= this.constraintContactIndices.length) return;
    const capacity = nextCapacity(
      this.constraintContactIndices.length,
      required,
    );
    this.islandContactIndices = growInt32(this.islandContactIndices, capacity);
    this.constraintContactIndices = growInt32(
      this.constraintContactIndices,
      capacity,
    );
    this.tangent1X = growFloat64(this.tangent1X, capacity);
    this.tangent1Y = growFloat64(this.tangent1Y, capacity);
    this.tangent1Z = growFloat64(this.tangent1Z, capacity);
    this.tangent2X = growFloat64(this.tangent2X, capacity);
    this.tangent2Y = growFloat64(this.tangent2Y, capacity);
    this.tangent2Z = growFloat64(this.tangent2Z, capacity);
    const pointCapacity = capacity * POINTS_PER_CONTACT;
    this.pointNormalMasses = growFloat64(this.pointNormalMasses, pointCapacity);
    this.pointTangentMasses1 = growFloat64(
      this.pointTangentMasses1,
      pointCapacity,
    );
    this.pointTangentMasses2 = growFloat64(
      this.pointTangentMasses2,
      pointCapacity,
    );
    this.pointFirstLocalX = growFloat64(this.pointFirstLocalX, pointCapacity);
    this.pointFirstLocalY = growFloat64(this.pointFirstLocalY, pointCapacity);
    this.pointFirstLocalZ = growFloat64(this.pointFirstLocalZ, pointCapacity);
    this.pointSecondLocalX = growFloat64(this.pointSecondLocalX, pointCapacity);
    this.pointSecondLocalY = growFloat64(this.pointSecondLocalY, pointCapacity);
    this.pointSecondLocalZ = growFloat64(this.pointSecondLocalZ, pointCapacity);
    this.pointVelocityBias = growFloat64(this.pointVelocityBias, pointCapacity);
    this.counters.solverContactCapacity = capacity;
    this.counters.solverContactCapacityGrowths += 1;
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("solver is disposed.");
  }
}

function isDynamicBody(bodies: BodyStore3D, body: number): boolean {
  return (
    body >= 0 &&
    body < bodies.capacity &&
    (bodies.flags[body]! & BODY_ENABLED_3D) !== 0 &&
    (bodies.flags[body]! & BODY_TYPE_MASK_3D) === BODY_TYPE_DYNAMIC_3D &&
    bodies.inverseMass[body]! > 0
  );
}

function isMovingKinematic(bodies: BodyStore3D, body: number): boolean {
  return (
    body >= 0 &&
    body < bodies.capacity &&
    (bodies.flags[body]! & BODY_ENABLED_3D) !== 0 &&
    (bodies.flags[body]! & BODY_TYPE_MASK_3D) === BODY_TYPE_KINEMATIC_3D &&
    (bodies.linearVelocityX[body] !== 0 ||
      bodies.linearVelocityY[body] !== 0 ||
      bodies.linearVelocityZ[body] !== 0 ||
      bodies.angularVelocityX[body] !== 0 ||
      bodies.angularVelocityY[body] !== 0 ||
      bodies.angularVelocityZ[body] !== 0)
  );
}

function translationalInverseAlong(
  bodies: BodyStore3D,
  body: number,
  axisX: number,
  axisY: number,
  axisZ: number,
): number {
  if (!isDynamicBody(bodies, body)) return 0;
  const locks = bodies.translationLocks[body]!;
  const inverseMass = bodies.inverseMass[body]!;
  return (
    inverseMass *
    (((locks & 1) === 0 ? axisX * axisX : 0) +
      ((locks & 2) === 0 ? axisY * axisY : 0) +
      ((locks & 4) === 0 ? axisZ * axisZ : 0))
  );
}

function angularInverseAlong(
  tensor: Float64Array,
  tensorOffset: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  axisX: number,
  axisY: number,
  axisZ: number,
): number {
  const crossX = offsetY * axisZ - offsetZ * axisY;
  const crossY = offsetZ * axisX - offsetX * axisZ;
  const crossZ = offsetX * axisY - offsetY * axisX;
  const responseX =
    tensor[tensorOffset]! * crossX +
    tensor[tensorOffset + 1]! * crossY +
    tensor[tensorOffset + 2]! * crossZ;
  const responseY =
    tensor[tensorOffset + 3]! * crossX +
    tensor[tensorOffset + 4]! * crossY +
    tensor[tensorOffset + 5]! * crossZ;
  const responseZ =
    tensor[tensorOffset + 6]! * crossX +
    tensor[tensorOffset + 7]! * crossY +
    tensor[tensorOffset + 8]! * crossZ;
  return crossX * responseX + crossY * responseY + crossZ * responseZ;
}

function relativeVelocityAlong(
  bodies: BodyStore3D,
  firstBody: number,
  secondBody: number,
  firstX: number,
  firstY: number,
  firstZ: number,
  secondX: number,
  secondY: number,
  secondZ: number,
  axisX: number,
  axisY: number,
  axisZ: number,
): number {
  const firstAngularX = bodies.angularVelocityX[firstBody]!;
  const firstAngularY = bodies.angularVelocityY[firstBody]!;
  const firstAngularZ = bodies.angularVelocityZ[firstBody]!;
  const secondAngularX = bodies.angularVelocityX[secondBody]!;
  const secondAngularY = bodies.angularVelocityY[secondBody]!;
  const secondAngularZ = bodies.angularVelocityZ[secondBody]!;
  const relativeX =
    bodies.linearVelocityX[firstBody]! +
    firstAngularY * firstZ -
    firstAngularZ * firstY -
    bodies.linearVelocityX[secondBody]! -
    secondAngularY * secondZ +
    secondAngularZ * secondY;
  const relativeY =
    bodies.linearVelocityY[firstBody]! +
    firstAngularZ * firstX -
    firstAngularX * firstZ -
    bodies.linearVelocityY[secondBody]! -
    secondAngularZ * secondX +
    secondAngularX * secondZ;
  const relativeZ =
    bodies.linearVelocityZ[firstBody]! +
    firstAngularX * firstY -
    firstAngularY * firstX -
    bodies.linearVelocityZ[secondBody]! -
    secondAngularX * secondY +
    secondAngularY * secondX;
  return relativeX * axisX + relativeY * axisY + relativeZ * axisZ;
}

function applyLinearVelocityImpulse(
  bodies: BodyStore3D,
  body: number,
  impulseX: number,
  impulseY: number,
  impulseZ: number,
): void {
  if (!isDynamicBody(bodies, body)) return;
  const inverseMass = bodies.inverseMass[body]!;
  const locks = bodies.translationLocks[body]!;
  if ((locks & 1) === 0) bodies.linearVelocityX[body] += impulseX * inverseMass;
  if ((locks & 2) === 0) bodies.linearVelocityY[body] += impulseY * inverseMass;
  if ((locks & 4) === 0) bodies.linearVelocityZ[body] += impulseZ * inverseMass;
}

function applyAngularVelocityImpulse(
  bodies: BodyStore3D,
  body: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  impulseX: number,
  impulseY: number,
  impulseZ: number,
  tensor: Float64Array,
  tensorOffset: number,
): void {
  if (!isDynamicBody(bodies, body)) return;
  const angularImpulseX = offsetY * impulseZ - offsetZ * impulseY;
  const angularImpulseY = offsetZ * impulseX - offsetX * impulseZ;
  const angularImpulseZ = offsetX * impulseY - offsetY * impulseX;
  bodies.angularVelocityX[body] +=
    tensor[tensorOffset]! * angularImpulseX +
    tensor[tensorOffset + 1]! * angularImpulseY +
    tensor[tensorOffset + 2]! * angularImpulseZ;
  bodies.angularVelocityY[body] +=
    tensor[tensorOffset + 3]! * angularImpulseX +
    tensor[tensorOffset + 4]! * angularImpulseY +
    tensor[tensorOffset + 5]! * angularImpulseZ;
  bodies.angularVelocityZ[body] +=
    tensor[tensorOffset + 6]! * angularImpulseX +
    tensor[tensorOffset + 7]! * angularImpulseY +
    tensor[tensorOffset + 8]! * angularImpulseZ;
}

function applyWorldAngularDisplacement(
  bodies: BodyStore3D,
  body: number,
  deltaX: number,
  deltaY: number,
  deltaZ: number,
  orientation: Float64Array,
): void {
  const qx = bodies.orientationX[body]!;
  const qy = bodies.orientationY[body]!;
  const qz = bodies.orientationZ[body]!;
  const qw = bodies.orientationW[body]!;
  writeCanonicalQuaternionInto3D(
    orientation,
    qx + 0.5 * (deltaX * qw + deltaY * qz - deltaZ * qy),
    qy + 0.5 * (-deltaX * qz + deltaY * qw + deltaZ * qx),
    qz + 0.5 * (deltaX * qy - deltaY * qx + deltaZ * qw),
    qw + 0.5 * (-deltaX * qx - deltaY * qy - deltaZ * qz),
  );
  bodies.orientationX[body] = orientation[0]!;
  bodies.orientationY[body] = orientation[1]!;
  bodies.orientationZ[body] = orientation[2]!;
  bodies.orientationW[body] = orientation[3]!;
}

function requireIterationCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a nonnegative integer.`);
  }
}

function normalizedCapacity(initialCapacity: number): number {
  if (!Number.isInteger(initialCapacity) || initialCapacity < 1) {
    throw new RangeError("initial capacity must be a positive integer.");
  }
  return nextCapacity(1, initialCapacity);
}

function nextCapacity(current: number, required: number): number {
  let capacity = current;
  while (capacity < required) capacity *= 2;
  return capacity;
}

function filledInt32(capacity: number, fill: number): Int32Array {
  const result = new Int32Array(capacity);
  result.fill(fill);
  return result;
}

function growInt32(
  source: Int32Array,
  capacity: number,
  fill?: number,
): Int32Array {
  const result = new Int32Array(capacity);
  if (fill !== undefined) result.fill(fill);
  result.set(source);
  return result;
}

function growFloat64(source: Float64Array, capacity: number): Float64Array {
  const result = new Float64Array(capacity);
  result.set(source);
  return result;
}

function growUint8(source: Uint8Array, capacity: number): Uint8Array {
  const result = new Uint8Array(capacity);
  result.set(source);
  return result;
}
