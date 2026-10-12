import { dispatchToLogicalTarget } from "../events/dispatch.js";
import type { PibblEventTargetRegistration } from "../events/registrations.js";
import type { PibblKeyboardEvent } from "../events/types.js";
import type { PibblFocusManager } from "./focus-manager.js";
import {
  findNearestDirectionalCandidate,
  type PibblDirection,
} from "./directional-navigation.js";

export type PibblTabMoveResult = "moved" | "exit";

export function moveTab(
  manager: PibblFocusManager,
  backwards: boolean,
): PibblTabMoveResult {
  const candidates = manager.navigationCandidates;
  if (candidates.length === 0) return "exit";

  const current = manager.focusedNavigationCandidate;
  if (!current) {
    const ordered = backwards ? [...candidates].reverse() : candidates;
    for (const candidate of ordered) {
      if (manager.focusNavigationCandidate(candidate, "keyboard", backwards)) {
        return "moved";
      }
    }
    return "exit";
  }

  const currentIndex = candidates.indexOf(current);
  for (
    let nextIndex = currentIndex + (backwards ? -1 : 1);
    nextIndex >= 0 && nextIndex < candidates.length;
    nextIndex += backwards ? -1 : 1
  ) {
    if (
      manager.focusNavigationCandidate(
        candidates[nextIndex],
        "keyboard",
        backwards,
      )
    )
      return "moved";
  }
  return "exit";
}

export function applyTabDefault(
  manager: PibblFocusManager,
  event: PibblKeyboardEvent,
): void {
  if (
    event.type !== "keydown" ||
    event.key !== "Tab" ||
    event.defaultPrevented
  ) {
    return;
  }
  if (moveTab(manager, event.shiftKey) === "moved") event.preventDefault();
}

export function applyKeyboardActivationDefault(
  manager: PibblFocusManager,
  event: PibblKeyboardEvent,
): void {
  if (event.key === "Enter") {
    if (event.type === "keydown" && !event.repeat && !event.defaultPrevented) {
      activateClick(manager.resolveKeyboardTarget(), event.originalEvent);
    }
    return;
  }

  if (event.key !== " " && event.key !== "Spacebar") return;
  const target = manager.resolveKeyboardTarget();
  if (event.type === "keydown") {
    if (event.repeat) {
      if (manager.hasPendingSpaceActivation(target)) event.preventDefault();
      return;
    }
    manager.cancelSpaceActivation();
    if (event.defaultPrevented || !target?.handlers.click) return;
    manager.beginSpaceActivation(target);
    event.preventDefault();
    return;
  }

  if (event.type !== "keyup") return;
  const pending = manager.consumeSpaceActivation();
  if (!pending || event.defaultPrevented || pending !== target) {
    return;
  }
  activateClick(pending, event.originalEvent);
}

export function applyDirectionalNavigationDefault(
  manager: PibblFocusManager,
  event: PibblKeyboardEvent,
): void {
  if (event.type !== "keydown" || event.defaultPrevented) return;
  const direction = directionForKey(event.key);
  if (!direction) return;

  const current = manager.focusedNavigationCandidate;
  if (!current) return;

  // The nearest boundary owns the key completely. A miss is terminal and must
  // never be retried against an ancestor boundary.
  const winner = findNearestDirectionalCandidate(
    current,
    direction,
    (candidate) => manager.isNavigationCandidateFocusable(candidate),
  );
  if (manager.focusNavigationCandidate(winner, "keyboard"))
    event.preventDefault();
}

function activateClick(
  target: PibblEventTargetRegistration | undefined,
  sourceEvent: KeyboardEvent,
): void {
  if (!target?.live || !target.handlers.click) return;
  dispatchToLogicalTarget(
    "click",
    target,
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 0,
    }),
    null,
    sourceEvent,
  );
}

function directionForKey(key: string): PibblDirection | undefined {
  switch (key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    default:
      return undefined;
  }
}
