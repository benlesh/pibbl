import type { CRCEventRoot } from "../types.js";
import type { CRCHitTestOutput } from "./paint-entry.js";

export type CRCResolverInputType =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel"
  | "wheel"
  | "contextmenu"
  | "click";

export interface CRCResolverInputWinner {
  readonly eventRoot: CRCEventRoot;
  deliver(
    type: CRCResolverInputType,
    point: Readonly<{ x: number; y: number }>,
    originalEvent: PointerEvent | WheelEvent | MouseEvent,
    state: unknown,
  ): void;
}

const pointerCaptures = new WeakMap<
  CRCEventRoot,
  Map<number, CRCResolverInputWinner>
>();

export function dispatchResolvedInput(
  output: CRCHitTestOutput,
  type: CRCResolverInputType,
  point: Readonly<{ x: number; y: number }>,
  originalEvent: PointerEvent | WheelEvent | MouseEvent,
): void {
  output.winner?.deliver(type, point, originalEvent, output.winnerState);
}

export function getResolverPointerCapture(
  eventRoot: CRCEventRoot,
  pointerId: number,
): CRCResolverInputWinner | undefined {
  return pointerCaptures.get(eventRoot)?.get(pointerId);
}

export function dispatchCapturedResolverInput(
  winner: CRCResolverInputWinner,
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
  winner: CRCResolverInputWinner,
  pointerId: number,
): void {
  let captures = pointerCaptures.get(winner.eventRoot);
  if (!captures) {
    captures = new Map();
    pointerCaptures.set(winner.eventRoot, captures);
  }
  captures.set(pointerId, winner);
  try {
    winner.eventRoot.canvas?.setPointerCapture(pointerId);
  } catch {
    // CRC ownership is authoritative even when native capture is unavailable.
  }
}

export function releaseResolverPointerCapture(
  winner: CRCResolverInputWinner,
  pointerId: number,
): void {
  const captures = pointerCaptures.get(winner.eventRoot);
  if (captures?.get(pointerId) !== winner) return;
  captures.delete(pointerId);
  if (captures.size === 0) pointerCaptures.delete(winner.eventRoot);
  try {
    winner.eventRoot.canvas?.releasePointerCapture(pointerId);
  } catch {
    // Native capture is best-effort; CRC ownership has already been released.
  }
}

export function releaseResolverInputWinner(
  winner: CRCResolverInputWinner,
): void {
  const captures = pointerCaptures.get(winner.eventRoot);
  if (!captures) return;
  for (const [pointerId, owner] of captures) {
    if (owner === winner) releaseResolverPointerCapture(winner, pointerId);
  }
}
