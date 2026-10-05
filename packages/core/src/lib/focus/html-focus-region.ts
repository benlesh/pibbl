import type { LayoutBox } from "../layout/types.js";
import type { CRCInstance } from "../types.js";

/**
 * The focus-facing part of one published HtmlBox.  The HTML service owns the
 * record and updates it only as part of a successful presentation generation.
 * It deliberately has no Canvas event target: native descendants remain the
 * browser's event and editing surface.
 *
 * @internal Shared with the root HTML service through the erased focus bridge.
 */
export interface HtmlFocusRegion {
  /** Stable component-owned identity, including across projection updates. */
  readonly identity: object;
  readonly owner: CRCInstance;
  /** The CRC-owned content DIV, assigned before a successful transaction finishes. */
  readonly content: HTMLElement | undefined;
  /** Root-logical border-box used for directional scoring. */
  readonly rootBounds: Readonly<LayoutBox> | undefined;
  /** False for inert, hidden, singular, or retired hosts. */
  readonly active: boolean;
  /** Receives deduplicated region-level state after native focus settles. */
  readonly onFocusSnapshot?: (snapshot: HtmlFocusRegionSnapshot) => void;
}

export interface HtmlFocusRegionSnapshot {
  readonly isFocusWithin: boolean;
  readonly isFocusVisible: boolean;
}
