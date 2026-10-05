/** One character-owned boost; it needs no timer or additional scheduler. */
export interface BoostState { boostUntil: number; jumpVelocity?: number }
/** Launch a timed trampoline ascent. */
export function launchBoost(state: BoostState, now: number): void {
  state.boostUntil = now + 950;
  state.jumpVelocity = -1500;
}
/** Stone absorbs the launch; a later frame cannot revive it. */
export function stopBoost(state: BoostState): void {
  state.boostUntil = 0;
  state.jumpVelocity = 0;
}
/** Restore upward speed after breakable-brick contacts during the launch. */
export function boostVelocity(state: BoostState, now: number, velocity: number): number {
  if (state.boostUntil > now) return -1500;
  if (state.boostUntil) { state.boostUntil = 0; return Math.max(velocity, -560); }
  return velocity;
}

/** Finds a spring crossed by descending feet, even if overlap began during ascent. */
export function landedTrampoline<T extends { x: number; y: number }>(springs: readonly T[], previous: readonly [number, number], position: readonly [number, number]): T | undefined {
  if (position[1] <= previous[1]) return;
  return springs.find(spring => position[0] + 24 > spring.x && position[0] < spring.x + 40 && previous[1] + 40 <= spring.y + 2 && position[1] + 40 >= spring.y);
}
