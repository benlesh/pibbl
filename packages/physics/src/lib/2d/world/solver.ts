import {
  CONTACT_SLOP,
  DEFAULT_POSITION_ITERATIONS,
  DEFAULT_VELOCITY_ITERATIONS,
  MAX_POSITION_CORRECTION,
  RESTITUTION_VELOCITY_THRESHOLD,
} from "../numeric-policy.js";
import type { ContactCache2D } from "./contact-cache.js";
import { BODY_TYPE_DYNAMIC_2D } from "./integrator.js";
import type { BodyStore2D } from "./storage.js";

const POINTS_PER_CONTACT = 2;
const NO_INDEX = -1;

export class SequentialImpulseSolver2D {
  constraintCount = 0;
  islandCount = 0;
  islandBodyCount = 0;
  velocityIterationsPerformed = 0;
  positionIterationsPerformed = 0;

  islandBodyIndices: Int32Array;
  islandContactIndices: Int32Array;
  islandBodyOffsets: Int32Array;
  islandContactOffsets: Int32Array;
  pointNormalMasses: Float64Array;
  pointTangentMasses: Float64Array;

  private sortedBodyIndices: Int32Array;
  private bodyToDynamic: Int32Array;
  private dynamicParents: Int32Array;
  private dynamicIslandIndices: Int32Array;
  private islandBodyCounts: Int32Array;
  private islandContactCounts: Int32Array;
  private islandBodyWrites: Int32Array;
  private islandContactWrites: Int32Array;
  private constraintContactIndices: Int32Array;
  private pointFirstLocalX: Float64Array;
  private pointFirstLocalY: Float64Array;
  private pointSecondLocalX: Float64Array;
  private pointSecondLocalY: Float64Array;
  private pointVelocityBias: Float64Array;

  constructor(initialBodyCapacity = 4, initialContactCapacity = 4) {
    const bodyCapacity = normalizedCapacity(initialBodyCapacity);
    const contactCapacity = normalizedCapacity(initialContactCapacity);
    this.islandBodyIndices = new Int32Array(bodyCapacity);
    this.islandContactIndices = new Int32Array(contactCapacity);
    this.islandBodyOffsets = new Int32Array(bodyCapacity + 1);
    this.islandContactOffsets = new Int32Array(bodyCapacity + 1);
    this.pointNormalMasses = new Float64Array(contactCapacity * POINTS_PER_CONTACT);
    this.pointTangentMasses = new Float64Array(contactCapacity * POINTS_PER_CONTACT);
    this.sortedBodyIndices = new Int32Array(bodyCapacity);
    this.bodyToDynamic = filledInt32(bodyCapacity, NO_INDEX);
    this.dynamicParents = new Int32Array(bodyCapacity);
    this.dynamicIslandIndices = new Int32Array(bodyCapacity);
    this.islandBodyCounts = new Int32Array(bodyCapacity);
    this.islandContactCounts = new Int32Array(bodyCapacity);
    this.islandBodyWrites = new Int32Array(bodyCapacity);
    this.islandContactWrites = new Int32Array(bodyCapacity);
    this.constraintContactIndices = new Int32Array(contactCapacity);
    this.pointFirstLocalX = new Float64Array(contactCapacity * POINTS_PER_CONTACT);
    this.pointFirstLocalY = new Float64Array(contactCapacity * POINTS_PER_CONTACT);
    this.pointSecondLocalX = new Float64Array(contactCapacity * POINTS_PER_CONTACT);
    this.pointSecondLocalY = new Float64Array(contactCapacity * POINTS_PER_CONTACT);
    this.pointVelocityBias = new Float64Array(contactCapacity * POINTS_PER_CONTACT);
  }

  solveCandidate(
    bodies: BodyStore2D,
    bodyIndices: Int32Array,
    bodyCount: number,
    contacts: ContactCache2D,
    velocityIterations = DEFAULT_VELOCITY_ITERATIONS,
    positionIterations = DEFAULT_POSITION_ITERATIONS,
  ): void {
    this.ensureBodyCapacity(Math.max(bodies.capacity, bodyCount));
    this.ensureContactCapacity(contacts.contactCount);
    this.buildIslands(bodies, bodyIndices, bodyCount, contacts);
    this.prepareConstraints(bodies, contacts);
    this.warmStart(bodies, contacts);
    for (let iteration = 0; iteration < velocityIterations; iteration += 1) {
      this.solveVelocityConstraints(bodies, contacts);
    }
    for (let iteration = 0; iteration < positionIterations; iteration += 1) {
      this.solvePositionConstraints(bodies, contacts);
    }
    this.velocityIterationsPerformed = velocityIterations;
    this.positionIterationsPerformed = positionIterations;
  }

  private buildIslands(
    bodies: BodyStore2D,
    bodyIndices: Int32Array,
    bodyCount: number,
    contacts: ContactCache2D,
  ): void {
    let dynamicCount = 0;
    this.bodyToDynamic.fill(NO_INDEX);
    for (let source = 0; source < bodyCount; source += 1) {
      const body = bodyIndices[source]!;
      if (!isDynamic(bodies, body)) continue;
      let insertion = dynamicCount;
      while (
        insertion > 0 &&
        this.sortedBodyIndices[insertion - 1]! > body
      ) {
        this.sortedBodyIndices[insertion] = this.sortedBodyIndices[insertion - 1]!;
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
      if (contacts.sensorFlags[contact] !== 0 || contacts.pointCounts[contact] === 0) continue;
      const firstDynamic = this.dynamicIndex(contacts.firstBodyIndices[contact]!);
      const secondDynamic = this.dynamicIndex(contacts.secondBodyIndices[contact]!);
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
    for (let constraint = 0; constraint < this.constraintCount; constraint += 1) {
      const contact = this.constraintContactIndices[constraint]!;
      const firstDynamic = this.dynamicIndex(contacts.firstBodyIndices[contact]!);
      const secondDynamic = this.dynamicIndex(contacts.secondBodyIndices[contact]!);
      const dynamic = firstDynamic !== NO_INDEX ? firstDynamic : secondDynamic;
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
    for (let constraint = 0; constraint < this.constraintCount; constraint += 1) {
      const contact = this.constraintContactIndices[constraint]!;
      const firstDynamic = this.dynamicIndex(contacts.firstBodyIndices[contact]!);
      const secondDynamic = this.dynamicIndex(contacts.secondBodyIndices[contact]!);
      const dynamic = firstDynamic !== NO_INDEX ? firstDynamic : secondDynamic;
      const island = this.dynamicIslandIndices[dynamic]!;
      const target = this.islandContactWrites[island]!;
      this.islandContactIndices[target] = contact;
      this.islandContactWrites[island] = target + 1;
    }
    this.islandBodyCount = dynamicCount;
  }

  private prepareConstraints(
    bodies: BodyStore2D,
    contacts: ContactCache2D,
  ): void {
    for (let constraint = 0; constraint < this.constraintCount; constraint += 1) {
      const contact = this.constraintContactIndices[constraint]!;
      const firstBody = contacts.firstBodyIndices[contact]!;
      const secondBody = contacts.secondBodyIndices[contact]!;
      const normalX = contacts.normalX[contact]!;
      const normalY = contacts.normalY[contact]!;
      const tangentX = -normalY;
      const tangentY = normalX;
      const firstInverseMass = bodies.inverseMass[firstBody]!;
      const secondInverseMass = bodies.inverseMass[secondBody]!;
      const firstInverseInertia = bodies.inverseInertia[firstBody]!;
      const secondInverseInertia = bodies.inverseInertia[secondBody]!;
      const firstCosine = Math.cos(bodies.rotationRadians[firstBody]!);
      const firstSine = Math.sin(bodies.rotationRadians[firstBody]!);
      const secondCosine = Math.cos(bodies.rotationRadians[secondBody]!);
      const secondSine = Math.sin(bodies.rotationRadians[secondBody]!);
      const base = contact * POINTS_PER_CONTACT;
      for (let point = 0; point < contacts.pointCounts[contact]!; point += 1) {
        const index = base + point;
        const firstWorldX = contacts.pointFirstX[index]! - bodies.positionX[firstBody]!;
        const firstWorldY = contacts.pointFirstY[index]! - bodies.positionY[firstBody]!;
        const secondWorldX = contacts.pointSecondX[index]! - bodies.positionX[secondBody]!;
        const secondWorldY = contacts.pointSecondY[index]! - bodies.positionY[secondBody]!;
        this.pointFirstLocalX[index] = firstCosine * firstWorldX + firstSine * firstWorldY;
        this.pointFirstLocalY[index] = -firstSine * firstWorldX + firstCosine * firstWorldY;
        this.pointSecondLocalX[index] = secondCosine * secondWorldX + secondSine * secondWorldY;
        this.pointSecondLocalY[index] = -secondSine * secondWorldX + secondCosine * secondWorldY;
        const firstNormalCross = cross(firstWorldX, firstWorldY, normalX, normalY);
        const secondNormalCross = cross(secondWorldX, secondWorldY, normalX, normalY);
        const normalDenominator =
          firstInverseMass + secondInverseMass +
          firstInverseInertia * firstNormalCross * firstNormalCross +
          secondInverseInertia * secondNormalCross * secondNormalCross;
        this.pointNormalMasses[index] = normalDenominator > 0 ? 1 / normalDenominator : 0;
        const firstTangentCross = cross(firstWorldX, firstWorldY, tangentX, tangentY);
        const secondTangentCross = cross(secondWorldX, secondWorldY, tangentX, tangentY);
        const tangentDenominator =
          firstInverseMass + secondInverseMass +
          firstInverseInertia * firstTangentCross * firstTangentCross +
          secondInverseInertia * secondTangentCross * secondTangentCross;
        this.pointTangentMasses[index] = tangentDenominator > 0 ? 1 / tangentDenominator : 0;
        const normalVelocity = relativeVelocityAlong(
          bodies,
          firstBody,
          secondBody,
          firstWorldX,
          firstWorldY,
          secondWorldX,
          secondWorldY,
          normalX,
          normalY,
        );
        this.pointVelocityBias[index] = normalVelocity < -RESTITUTION_VELOCITY_THRESHOLD
          ? contacts.mixedRestitution[contact]! * normalVelocity
          : 0;
      }
    }
  }

  private warmStart(bodies: BodyStore2D, contacts: ContactCache2D): void {
    for (let island = 0; island < this.islandCount; island += 1) {
      for (
        let offset = this.islandContactOffsets[island]!;
        offset < this.islandContactOffsets[island + 1]!;
        offset += 1
      ) {
        const contact = this.islandContactIndices[offset]!;
        const normalX = contacts.normalX[contact]!;
        const normalY = contacts.normalY[contact]!;
        const tangentX = -normalY;
        const tangentY = normalX;
        const base = contact * POINTS_PER_CONTACT;
        for (let point = 0; point < contacts.pointCounts[contact]!; point += 1) {
          const index = base + point;
          this.applyPointImpulse(
            bodies,
            contacts,
            contact,
            index,
            normalX * contacts.pointNormalImpulses[index]! + tangentX * contacts.pointTangentImpulses[index]!,
            normalY * contacts.pointNormalImpulses[index]! + tangentY * contacts.pointTangentImpulses[index]!,
          );
        }
      }
    }
  }

  private solveVelocityConstraints(
    bodies: BodyStore2D,
    contacts: ContactCache2D,
  ): void {
    for (let island = 0; island < this.islandCount; island += 1) {
      for (
        let offset = this.islandContactOffsets[island]!;
        offset < this.islandContactOffsets[island + 1]!;
        offset += 1
      ) {
        const contact = this.islandContactIndices[offset]!;
        const firstBody = contacts.firstBodyIndices[contact]!;
        const secondBody = contacts.secondBodyIndices[contact]!;
        const normalX = contacts.normalX[contact]!;
        const normalY = contacts.normalY[contact]!;
        const tangentX = -normalY;
        const tangentY = normalX;
        const firstCosine = Math.cos(bodies.rotationRadians[firstBody]!);
        const firstSine = Math.sin(bodies.rotationRadians[firstBody]!);
        const secondCosine = Math.cos(bodies.rotationRadians[secondBody]!);
        const secondSine = Math.sin(bodies.rotationRadians[secondBody]!);
        const base = contact * POINTS_PER_CONTACT;
        for (let point = 0; point < contacts.pointCounts[contact]!; point += 1) {
          const index = base + point;
          const firstX = firstCosine * this.pointFirstLocalX[index]! - firstSine * this.pointFirstLocalY[index]!;
          const firstY = firstSine * this.pointFirstLocalX[index]! + firstCosine * this.pointFirstLocalY[index]!;
          const secondX = secondCosine * this.pointSecondLocalX[index]! - secondSine * this.pointSecondLocalY[index]!;
          const secondY = secondSine * this.pointSecondLocalX[index]! + secondCosine * this.pointSecondLocalY[index]!;
          const normalVelocity = relativeVelocityAlong(
            bodies, firstBody, secondBody, firstX, firstY, secondX, secondY, normalX, normalY,
          );
          const normalDelta = -this.pointNormalMasses[index]! *
            (normalVelocity + this.pointVelocityBias[index]!);
          const previousNormal = contacts.pointNormalImpulses[index]!;
          const accumulatedNormal = Math.max(0, previousNormal + normalDelta);
          contacts.pointNormalImpulses[index] = accumulatedNormal;
          const appliedNormal = accumulatedNormal - previousNormal;
          this.applyPointImpulse(
            bodies,
            contacts,
            contact,
            index,
            normalX * appliedNormal,
            normalY * appliedNormal,
          );

          const tangentVelocity = relativeVelocityAlong(
            bodies, firstBody, secondBody, firstX, firstY, secondX, secondY, tangentX, tangentY,
          );
          const tangentDelta = -this.pointTangentMasses[index]! * tangentVelocity;
          const previousTangent = contacts.pointTangentImpulses[index]!;
          const frictionLimit = contacts.mixedFriction[contact]! * accumulatedNormal;
          const accumulatedTangent = Math.max(
            -frictionLimit,
            Math.min(frictionLimit, previousTangent + tangentDelta),
          );
          contacts.pointTangentImpulses[index] = accumulatedTangent;
          const appliedTangent = accumulatedTangent - previousTangent;
          this.applyPointImpulse(
            bodies,
            contacts,
            contact,
            index,
            tangentX * appliedTangent,
            tangentY * appliedTangent,
          );
        }
      }
    }
  }

  private solvePositionConstraints(
    bodies: BodyStore2D,
    contacts: ContactCache2D,
  ): void {
    for (let island = 0; island < this.islandCount; island += 1) {
      for (
        let offset = this.islandContactOffsets[island]!;
        offset < this.islandContactOffsets[island + 1]!;
        offset += 1
      ) {
        const contact = this.islandContactIndices[offset]!;
        const firstBody = contacts.firstBodyIndices[contact]!;
        const secondBody = contacts.secondBodyIndices[contact]!;
        const normalX = contacts.normalX[contact]!;
        const normalY = contacts.normalY[contact]!;
        const base = contact * POINTS_PER_CONTACT;
        for (let point = 0; point < contacts.pointCounts[contact]!; point += 1) {
          const index = base + point;
          const firstAngle = bodies.rotationRadians[firstBody]!;
          const secondAngle = bodies.rotationRadians[secondBody]!;
          const firstCosine = Math.cos(firstAngle);
          const firstSine = Math.sin(firstAngle);
          const secondCosine = Math.cos(secondAngle);
          const secondSine = Math.sin(secondAngle);
          const firstX = firstCosine * this.pointFirstLocalX[index]! - firstSine * this.pointFirstLocalY[index]!;
          const firstY = firstSine * this.pointFirstLocalX[index]! + firstCosine * this.pointFirstLocalY[index]!;
          const secondX = secondCosine * this.pointSecondLocalX[index]! - secondSine * this.pointSecondLocalY[index]!;
          const secondY = secondSine * this.pointSecondLocalX[index]! + secondCosine * this.pointSecondLocalY[index]!;
          const separation =
            (bodies.positionX[firstBody]! + firstX - bodies.positionX[secondBody]! - secondX) * normalX +
            (bodies.positionY[firstBody]! + firstY - bodies.positionY[secondBody]! - secondY) * normalY;
          const correction = Math.min(
            MAX_POSITION_CORRECTION,
            Math.max(0, -(separation + CONTACT_SLOP)),
          );
          if (correction === 0) continue;
          const firstCross = cross(firstX, firstY, normalX, normalY);
          const secondCross = cross(secondX, secondY, normalX, normalY);
          const denominator =
            bodies.inverseMass[firstBody]! + bodies.inverseMass[secondBody]! +
            bodies.inverseInertia[firstBody]! * firstCross * firstCross +
            bodies.inverseInertia[secondBody]! * secondCross * secondCross;
          if (denominator <= 0) continue;
          const impulse = correction / denominator;
          bodies.positionX[firstBody] += normalX * impulse * bodies.inverseMass[firstBody]!;
          bodies.positionY[firstBody] += normalY * impulse * bodies.inverseMass[firstBody]!;
          bodies.rotationRadians[firstBody] += firstCross * impulse * bodies.inverseInertia[firstBody]!;
          bodies.positionX[secondBody] -= normalX * impulse * bodies.inverseMass[secondBody]!;
          bodies.positionY[secondBody] -= normalY * impulse * bodies.inverseMass[secondBody]!;
          bodies.rotationRadians[secondBody] -= secondCross * impulse * bodies.inverseInertia[secondBody]!;
        }
      }
    }
  }

  private applyPointImpulse(
    bodies: BodyStore2D,
    contacts: ContactCache2D,
    contact: number,
    pointIndex: number,
    impulseX: number,
    impulseY: number,
  ): void {
    const firstBody = contacts.firstBodyIndices[contact]!;
    const secondBody = contacts.secondBodyIndices[contact]!;
    const firstAngle = bodies.rotationRadians[firstBody]!;
    const secondAngle = bodies.rotationRadians[secondBody]!;
    const firstCosine = Math.cos(firstAngle);
    const firstSine = Math.sin(firstAngle);
    const secondCosine = Math.cos(secondAngle);
    const secondSine = Math.sin(secondAngle);
    const firstX = firstCosine * this.pointFirstLocalX[pointIndex]! - firstSine * this.pointFirstLocalY[pointIndex]!;
    const firstY = firstSine * this.pointFirstLocalX[pointIndex]! + firstCosine * this.pointFirstLocalY[pointIndex]!;
    const secondX = secondCosine * this.pointSecondLocalX[pointIndex]! - secondSine * this.pointSecondLocalY[pointIndex]!;
    const secondY = secondSine * this.pointSecondLocalX[pointIndex]! + secondCosine * this.pointSecondLocalY[pointIndex]!;
    bodies.linearVelocityX[firstBody] += impulseX * bodies.inverseMass[firstBody]!;
    bodies.linearVelocityY[firstBody] += impulseY * bodies.inverseMass[firstBody]!;
    bodies.angularVelocity[firstBody] += cross(firstX, firstY, impulseX, impulseY) * bodies.inverseInertia[firstBody]!;
    bodies.linearVelocityX[secondBody] -= impulseX * bodies.inverseMass[secondBody]!;
    bodies.linearVelocityY[secondBody] -= impulseY * bodies.inverseMass[secondBody]!;
    bodies.angularVelocity[secondBody] -= cross(secondX, secondY, impulseX, impulseY) * bodies.inverseInertia[secondBody]!;
  }

  private dynamicIndex(body: number): number {
    return body >= 0 && body < this.bodyToDynamic.length
      ? this.bodyToDynamic[body]!
      : NO_INDEX;
  }

  private findRoot(dynamic: number): number {
    let root = dynamic;
    while (this.dynamicParents[root] !== root) root = this.dynamicParents[root]!;
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
    if (this.sortedBodyIndices[firstRoot]! <= this.sortedBodyIndices[secondRoot]!) {
      this.dynamicParents[secondRoot] = firstRoot;
    } else {
      this.dynamicParents[firstRoot] = secondRoot;
    }
  }

  private ensureBodyCapacity(required: number): void {
    if (required <= this.sortedBodyIndices.length) return;
    let capacity = this.sortedBodyIndices.length;
    while (capacity < required) capacity *= 2;
    this.islandBodyIndices = growInt32(this.islandBodyIndices, capacity);
    this.islandBodyOffsets = growInt32(this.islandBodyOffsets, capacity + 1);
    this.islandContactOffsets = growInt32(this.islandContactOffsets, capacity + 1);
    this.sortedBodyIndices = growInt32(this.sortedBodyIndices, capacity);
    this.bodyToDynamic = growInt32(this.bodyToDynamic, capacity, NO_INDEX);
    this.dynamicParents = growInt32(this.dynamicParents, capacity);
    this.dynamicIslandIndices = growInt32(this.dynamicIslandIndices, capacity);
    this.islandBodyCounts = growInt32(this.islandBodyCounts, capacity);
    this.islandContactCounts = growInt32(this.islandContactCounts, capacity);
    this.islandBodyWrites = growInt32(this.islandBodyWrites, capacity);
    this.islandContactWrites = growInt32(this.islandContactWrites, capacity);
  }

  private ensureContactCapacity(required: number): void {
    if (required <= this.constraintContactIndices.length) return;
    let capacity = this.constraintContactIndices.length;
    while (capacity < required) capacity *= 2;
    this.islandContactIndices = growInt32(this.islandContactIndices, capacity);
    this.constraintContactIndices = growInt32(this.constraintContactIndices, capacity);
    const pointCapacity = capacity * POINTS_PER_CONTACT;
    this.pointNormalMasses = growFloat64(this.pointNormalMasses, pointCapacity);
    this.pointTangentMasses = growFloat64(this.pointTangentMasses, pointCapacity);
    this.pointFirstLocalX = growFloat64(this.pointFirstLocalX, pointCapacity);
    this.pointFirstLocalY = growFloat64(this.pointFirstLocalY, pointCapacity);
    this.pointSecondLocalX = growFloat64(this.pointSecondLocalX, pointCapacity);
    this.pointSecondLocalY = growFloat64(this.pointSecondLocalY, pointCapacity);
    this.pointVelocityBias = growFloat64(this.pointVelocityBias, pointCapacity);
  }
}

function isDynamic(bodies: BodyStore2D, body: number): boolean {
  return (
    body >= 0 &&
    body < bodies.capacity &&
    (bodies.flags[body]! & BODY_TYPE_DYNAMIC_2D) !== 0 &&
    bodies.inverseMass[body]! > 0
  );
}

function relativeVelocityAlong(
  bodies: BodyStore2D,
  firstBody: number,
  secondBody: number,
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
  axisX: number,
  axisY: number,
): number {
  const firstAngular = bodies.angularVelocity[firstBody]!;
  const secondAngular = bodies.angularVelocity[secondBody]!;
  const relativeX =
    bodies.linearVelocityX[firstBody]! - firstAngular * firstY -
    bodies.linearVelocityX[secondBody]! + secondAngular * secondY;
  const relativeY =
    bodies.linearVelocityY[firstBody]! + firstAngular * firstX -
    bodies.linearVelocityY[secondBody]! - secondAngular * secondX;
  return relativeX * axisX + relativeY * axisY;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function normalizedCapacity(initialCapacity: number): number {
  if (!Number.isInteger(initialCapacity) || initialCapacity < 1) {
    throw new RangeError("initialCapacity must be a positive integer.");
  }
  let capacity = 1;
  while (capacity < initialCapacity) capacity *= 2;
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
