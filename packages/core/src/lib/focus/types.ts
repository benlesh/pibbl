import type { KeyboardNavigation, KeyboardNavigationProps } from './policy-components.js';
import type { CRCEventTargetRegistration } from "../events/registrations.js";
import type { LayoutBox } from "../layout/types.js";
import type { HtmlFocusRegion } from "./html-focus-region.js";

export type CRCFocusModality = "keyboard" | "pointer";

/**
 * Directional keyboard-navigation policy for a focus scope.
 *
 * @see {@link KeyboardNavigation}
 * @see {@link KeyboardNavigationProps}
 */
export interface CRCKeyboardNavigationOptions {
  /**
   * Selects the supported mapping, placement, or result policy. See
   * {@link CRCKeyboardNavigationOptions}.
   */
  readonly mode: "directional";
}

export interface CRCDirectionalBoundary {
  readonly candidates: readonly CRCNavigationCandidate[];
}

export interface CRCFocusCandidate {
  readonly target: CRCEventTargetRegistration;
  readonly sourceIndex: number;
  readonly directionalBoundary: CRCDirectionalBoundary | undefined;
  readonly rootBounds: Readonly<LayoutBox> | undefined;
}

/** @internal A native HtmlBox region participating in the same CRC order. */
export interface CRCHtmlFocusCandidate {
  readonly region: HtmlFocusRegion;
  readonly sourceIndex: number;
  readonly directionalBoundary: CRCDirectionalBoundary | undefined;
  readonly rootBounds: Readonly<LayoutBox> | undefined;
}

/** @internal Shared geometry/navigation representation; Canvas events stay Canvas-only. */
export type CRCNavigationCandidate = CRCFocusCandidate | CRCHtmlFocusCandidate;

export function isHtmlFocusCandidate(
  candidate: CRCNavigationCandidate,
): candidate is CRCHtmlFocusCandidate {
  return "region" in candidate;
}
