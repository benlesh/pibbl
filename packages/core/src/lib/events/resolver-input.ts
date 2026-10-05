import type { PibblEventRoot } from "../types.js";
import type { PibblHitTestOutput } from "./paint-entry.js";

export type PibblResolverInputType =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel"
  | "wheel"
  | "contextmenu"
  | "click";

export interface PibblResolverInputWinner {
  readonly eventRoot: PibblEventRoot;
  deliver(
    type: PibblResolverInputType,
    point: Readonly<{ x: number; y: number }>,
    originalEvent: PointerEvent | WheelEvent | MouseEvent,
    state: unknown,
  ): void;
  /** @internal Keeps native terminal pointer delivery alive while captured. */
  onPointerCaptureChange?(): void;
}

const pointerCaptures = new WeakMap<
  PibblEventRoot,
  Map<number, PibblResolverInputWinner>
>();

export function dispatchResolvedInput(
  output: PibblHitTestOutput,
  type: PibblResolverInputType,
  point: Readonly<{ x: number; y: number }>,
  originalEvent: PointerEvent | WheelEvent | MouseEvent,
): void {
  output.winner?.deliver(type, point, originalEvent, output.winnerState);
}

export function getResolverPointerCapture(
  eventRoot: PibblEventRoot,
  pointerId: number,
): PibblResolverInputWinner | undefined {
  return pointerCaptures.get(eventRoot)?.get(pointerId);
}

export function hasResolverPointerCapture(
  winner: PibblResolverInputWinner,
): boolean {
  return Array.from(pointerCaptures.get(winner.eventRoot)?.values() ?? []).some(
    (owner) => owner === winner,
  );
}

export function dispatchCapturedResolverInput(
  winner: PibblResolverInputWinner,
  type: "pointermove" | "pointerup" | "pointercancel",
  point: Readonly<{ x: number; y: number }>,
  originalEvent: PointerEvent,
): void {
  try {
    winner.deliver(type, point, originalEvent, undefined);
  } finally {
    if (type === "pointerup" || type === "pointercancel") {
      releaseResolverPointerCapture(winner, originalEvent.pointerId);
    }
  }
}

export function setResolverPointerCapture(
  winner: PibblResolverInputWinner,
  pointerId: number,
): void {
  let captures = pointerCaptures.get(winner.eventRoot);
  if (!captures) {
    captures = new Map();
    pointerCaptures.set(winner.eventRoot, captures);
  }
  captures.set(pointerId, winner);
  winner.onPointerCaptureChange?.();
  try {
    winner.eventRoot.canvas?.setPointerCapture(pointerId);
  } catch {
    // Pibbl ownership is authoritative even when native capture is unavailable.
  }
}

export function releaseResolverPointerCapture(
  winner: PibblResolverInputWinner,
  pointerId: number,
): void {
  const captures = pointerCaptures.get(winner.eventRoot);
  if (captures?.get(pointerId) !== winner) return;
  captures.delete(pointerId);
  if (captures.size === 0) pointerCaptures.delete(winner.eventRoot);
  winner.onPointerCaptureChange?.();
  try {
    winner.eventRoot.canvas?.releasePointerCapture(pointerId);
  } catch {
    // Native capture is best-effort; Pibbl ownership has already been released.
  }
}

export function releaseResolverInputWinner(
  winner: PibblResolverInputWinner,
): void {
  const captures = pointerCaptures.get(winner.eventRoot);
  if (!captures) return;
  for (const [pointerId, owner] of captures) {
    if (owner === winner) releaseResolverPointerCapture(winner, pointerId);
  }
}
