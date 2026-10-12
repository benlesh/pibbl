import type { FlowFieldKernel2D } from "./field.js";
const CHUNK = 256;
const NO_SLOT = 0xffffffff;
const MAX_STEP_MILLISECONDS = 1000 / 60;

/** Persistent particle positions, independent of Canvas and physics bodies.
 * RK2 integration samples a shared field in bounded chunks. Birth identities
 * let recycled ledger slots initialize without allocating particle objects.
 */
export class FlowParticlePopulation2D {
  readonly positions: Float32Array;
  private readonly retired: Uint8Array;
  private readonly identities: Float64Array;
  private readonly times: Float64Array;
  private readonly birthTimes: Float64Array;
  private readonly slots = new Uint32Array(CHUNK);
  private readonly points = new Float32Array(CHUNK * 2);
  private readonly midpoints = new Float32Array(CHUNK * 2);
  private readonly velocities = new Float32Array(CHUNK * 2);
  private readonly durations = new Float64Array(CHUNK);
  constructor(readonly capacity: number) {
    this.positions = new Float32Array(capacity * 2);
    this.retired = new Uint8Array(capacity);
    this.identities = new Float64Array(capacity).fill(-1);
    this.times = new Float64Array(capacity);
    this.birthTimes = new Float64Array(capacity);
  }
  copyFrom(other: FlowParticlePopulation2D): void {
    this.positions.set(other.positions);
    this.retired.set(other.retired);
    this.identities.set(other.identities);
    this.times.set(other.times);
    this.birthTimes.set(other.birthTimes);
  }
  clear(): void { this.identities.fill(-1); this.retired.fill(0); }
  isRetired(slot: number): boolean { return this.retired[slot] === 1; }
  hasBirth(slot: number, identity: number, birthTime: number): boolean {
    return this.identities[slot] === identity && this.birthTimes[slot] === birthTime;
  }
  birth(slot: number, identity: number, time: number, x: number, y: number): void {
    this.retired[slot] = 0;
    this.identities[slot] = identity;
    this.birthTimes[slot] = this.times[slot] = time;
    this.positions[slot * 2] = x;
    this.positions[slot * 2 + 1] = y;
  }
  advance(field: FlowFieldKernel2D, firstSlot: number, ageOrder: Uint32Array, liveCount: number, time: number): void {
    let slot = firstSlot, visited = 0;
    while (slot !== NO_SLOT && visited < liveCount) {
      let count = 0;
      while (slot !== NO_SLOT && visited < liveCount && count < CHUNK) {
        if (this.retired[slot] || field.isSolid(this.positions[slot * 2]!, this.positions[slot * 2 + 1]!)) {
          this.retired[slot] = 1;
          this.times[slot] = time;
          slot = ageOrder[slot]!;
          visited++;
          continue;
        }
        this.slots[count] = slot;
        this.points[count * 2] = this.positions[slot * 2]!;
        this.points[count * 2 + 1] = this.positions[slot * 2 + 1]!;
        this.durations[count] = Math.min(MAX_STEP_MILLISECONDS * 4, Math.max(0, time - this.times[slot]!));
        this.times[slot] = time;
        slot = ageOrder[slot]!;
        visited++;
        count++;
      }
      // A fixed upper bound of four substeps, including fractional birth ages.
      for (let step = 0; step < 4; step++) {
        let active = false;
        for (let i = 0; i < count; i++) if (this.durations[i]! > 0) { active = true; break; }
        if (!active) break;
        field.sampleBatch(this.points, this.velocities, count);
        for (let i = 0; i < count; i++) {
          const seconds = Math.min(MAX_STEP_MILLISECONDS, this.durations[i]!) / 1000;
          this.velocities[i * 2] *= seconds;
          this.velocities[i * 2 + 1] *= seconds;
        }
        this.midpoints.set(this.points);
        field.moveBatch(this.midpoints, this.velocities, count, 0.5);
        field.sampleBatch(this.midpoints, this.velocities, count);
        for (let i = 0; i < count; i++) {
          const milliseconds = Math.min(MAX_STEP_MILLISECONDS, this.durations[i]!);
          this.durations[i] -= milliseconds;
          this.velocities[i * 2] *= milliseconds / 1000;
          this.velocities[i * 2 + 1] *= milliseconds / 1000;
        }
        field.moveBatch(this.points, this.velocities, count, 1);
      }
      for (let i = 0; i < count; i++) {
        const target = this.slots[i]! * 2;
        this.positions[target] = this.points[i * 2]!;
        this.positions[target + 1] = this.points[i * 2 + 1]!;
      }
    }
  }
}
