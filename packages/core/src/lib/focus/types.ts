import type { CRCEventTargetRegistration } from "../events/registrations.js";
import type { LayoutBox } from "../layout/types.js";
import type { HtmlFocusRegion } from "./html-focus-region.js";

export type CRCFocusModality = "keyboard" | "pointer";

export interface CRCKeyboardNavigationOptions {
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
