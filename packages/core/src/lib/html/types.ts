import type { HtmlBox } from '../components/html-box.js';
import type { GStyle } from '../components/g.js';
import type { HtmlFocusRegion } from '../focus/html-focus-region.js';
import type { PibblClippingStackEntry, PibblInstance, PibblInteractionLayer } from '../types.js';
import type { LayoutBox } from '../layout/types.js';

/**
 * Updates mounted application HTML when the owning HtmlBox receives new props.
 *
 * @param props - Latest props for the mounted HTML content.
 *
 * @see {@link HtmlMountCallback}
 */
export type HtmlUpdateFunction<Props> = (props: Props) => void;
/**
 * Mounts application HTML into the supplied host and returns its prop-update callback; the abort
 * signal marks teardown.
 *
 * @param element - Pibbl-owned host div into which application content may be mounted.
 * @param initialProps - Props from the initial mount.
 * @param signal - Lifetime signal aborted when the host is disposed.
 * @returns An update callback for subsequent props; release application resources when the signal
 * aborts. See {@link HtmlUpdateFunction} .
 *
 * @see {@link HtmlUpdateFunction}
 * @see {@link HtmlBoxProps}
 * @see {@link HtmlBox}
 */
export type HtmlMountCallback<Props> = (element: HTMLDivElement, initialProps: Props, signal: AbortSignal) => HtmlUpdateFunction<Props>;
/**
 * Focus state shared between an HTML host and Pibbl's logical focus management.
 *
 * @see {@link HtmlBoxProps}
 */
export interface HtmlBoxFocusState {
  /**
   * Whether an element inside the hosted HTML region currently has focus. See
   * {@link HtmlBoxFocusState}.
   */
  readonly isFocusWithin: boolean;
  /** Whether focus should be presented as keyboard-visible. See {@link HtmlBoxFocusState}. */
  readonly isFocusVisible: boolean;
}
/**
 * Props for a DOM-hosting region, including mount ownership, updates, and focus behavior.
 *
 * @see {@link HtmlMountCallback}
 * @see {@link HtmlBoxFocusState}
 * @see {@link HtmlBox}
 */
export interface HtmlBoxProps<Props> {
  /**
   * Application data supplied to the component or reported by the event. See {@link HtmlBoxProps}
   * .
   */
  data: Props;
  /** Creates mounted content and its owned lifecycle controls. See {@link HtmlMountCallback}. */
  mount: HtmlMountCallback<Props>;
  /** Whether this content participates in pointer targeting. See {@link HtmlBoxProps}. */
  pointerEvents?: 'auto' | 'none';
  /**
   * Receives changes to focus within the hosted HTML region. See {@link HtmlBoxFocusState}.
   * @param state - Current DOM and Pibbl focus ownership for the HTML region. See
   * {@link HtmlBoxFocusState} .
   */
  onFocusChange?: (state: Readonly<HtmlBoxFocusState>) => void;
}
/**
 * Layout and presentation of an application-owned HTML region anchored to Canvas geometry.
 *
 * @see {@link GStyle}
 * @see {@link HtmlBox}
 */
export interface HtmlBoxStyle extends GStyle {
  /** Opacity of the painted result. See {@link HtmlBoxStyle}. */
  opacity?: number;
}
export interface HtmlBridge {
  beginRender(instance: PibblInstance): void;
  suspend(instance: PibblInstance): void;
  recordLayer(parent: PibblInstance, child: PibblInstance, bridge: PibblInteractionLayer, opacity: number, composite: GlobalCompositeOperation): void;
  dispose(): void;
}
export interface HtmlBoxRegistration {
  slot: HtmlBoxSlot;
  data: unknown;
  matrix: DOMMatrix;
  clips: readonly PibblClippingStackEntry[];
  border: Readonly<LayoutBox>;
  content: Readonly<LayoutBox>;
  opacity: number;
  interactive: boolean;
  overflow: 'visible' | 'clip';
  onFocusChange?: (state: Readonly<HtmlBoxFocusState>) => void;
}
export interface HtmlBoxSlot {
  readonly owner: PibblInstance;
  readonly mount: HtmlMountCallback<unknown>;
  region: HtmlFocusRegion & { content: HTMLDivElement | undefined; rootBounds: Readonly<LayoutBox> | undefined; active: boolean };
  shell?: HTMLDivElement;
  content?: HTMLDivElement;
  clipping?: SVGClipPathElement[];
  abort?: AbortController;
  update?: HtmlUpdateFunction<unknown>;
  disposed: boolean;
  callback?: (state: Readonly<HtmlBoxFocusState>) => void;
}
