import type { KeyboardNavigation, KeyboardNavigationProps } from './policy-components.js';
import type { PibblEventTargetRegistration } from "../events/registrations.js";
import type { LayoutBox } from "../layout/types.js";
import type { HtmlFocusRegion } from "./html-focus-region.js";

export type PibblFocusModality = "keyboard" | "pointer";

/**
 * Directional keyboard-navigation policy for a focus scope.
 *
 * @see {@link KeyboardNavigation}
 * @see {@link KeyboardNavigationProps}
 */
export interface PibblKeyboardNavigationOptions {
  /**
   * Selects the supported mapping, placement, or result policy. See
   * {@link PibblKeyboardNavigationOptions}.
   */
  readonly mode: "directional";
}

export interface PibblDirectionalBoundary {
  readonly candidates: readonly PibblNavigationCandidate[];
}

export interface PibblFocusCandidate {
  readonly target: PibblEventTargetRegistration;
  readonly sourceIndex: number;
  readonly directionalBoundary: PibblDirectionalBoundary | undefined;
  readonly rootBounds: Readonly<LayoutBox> | undefined;
}

/** @internal A native HtmlBox region participating in the same Pibbl order. */
export interface PibblHtmlFocusCandidate {
  readonly region: HtmlFocusRegion;
  readonly sourceIndex: number;
  readonly directionalBoundary: PibblDirectionalBoundary | undefined;
  readonly rootBounds: Readonly<LayoutBox> | undefined;
}

/** @internal Shared geometry/navigation representation; Canvas events stay Canvas-only. */
export type PibblNavigationCandidate = PibblFocusCandidate | PibblHtmlFocusCandidate;

export function isHtmlFocusCandidate(
  candidate: PibblNavigationCandidate,
): candidate is PibblHtmlFocusCandidate {
  return "region" in candidate;
}
