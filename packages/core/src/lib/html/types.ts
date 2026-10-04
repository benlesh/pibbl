import type { GStyle } from '../components/g.js';
import type { HtmlFocusRegion } from '../focus/html-focus-region.js';
import type { CRCClippingStackEntry, CRCInstance, CRCInteractionLayer } from '../types.js';
import type { LayoutBox } from '../layout/types.js';

export type HtmlUpdateFunction<Props> = (props: Props) => void;
export type HtmlMountCallback<Props> = (element: HTMLDivElement, initialProps: Props, signal: AbortSignal) => HtmlUpdateFunction<Props>;
export interface HtmlBoxFocusState { readonly isFocusWithin: boolean; readonly isFocusVisible: boolean; }
export interface HtmlBoxProps<Props> {
  data: Props;
  mount: HtmlMountCallback<Props>;
  pointerEvents?: 'auto' | 'none';
  onFocusChange?: (state: Readonly<HtmlBoxFocusState>) => void;
}
export interface HtmlBoxStyle extends GStyle { opacity?: number; }
export interface HtmlBridge {
  beginRender(instance: CRCInstance): void;
  suspend(instance: CRCInstance): void;
  recordLayer(parent: CRCInstance, child: CRCInstance, bridge: CRCInteractionLayer, opacity: number, composite: GlobalCompositeOperation): void;
  dispose(): void;
}
export interface HtmlBoxRegistration {
  slot: HtmlBoxSlot;
  data: unknown;
  matrix: DOMMatrix;
  clips: readonly CRCClippingStackEntry[];
  border: Readonly<LayoutBox>;
  content: Readonly<LayoutBox>;
  opacity: number;
  interactive: boolean;
  overflow: 'visible' | 'clip';
  onFocusChange?: (state: Readonly<HtmlBoxFocusState>) => void;
}
export interface HtmlBoxSlot {
  readonly owner: CRCInstance;
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
