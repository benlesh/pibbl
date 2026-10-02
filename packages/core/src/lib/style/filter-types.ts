import type { PrimitivePresentation } from '../primitive-presentation.js';
import type { StyleResolutionContext } from '../types.js';
import type { SignalValue } from '../signals/types.js';

/** Opaque, imported appearance effect accepted by `style.filter`. */
export interface CRCFilter {
  readonly [CRC_FILTER_EXECUTOR]: CRCFilterExecutor;
}

/** @internal Stable protocol key shared by the base renderer and optional entries. */
export const CRC_FILTER_EXECUTOR = Symbol('crc.filter.executor');

/** @internal A value prepared for one receiving primitive generation. */
export interface PreparedCRCFilter {
  readonly executor: CRCFilterExecutor;
}

/** @internal Optional filter implementations own validation and pixel processing. */
export interface CRCFilterExecutor {
  prepare(value: CRCFilter, property: string, context: Readonly<StyleResolutionContext>): PreparedCRCFilter;
  render(input: Readonly<CRCFilterRenderInput>): void;
}

/** @internal Generic call boundary that keeps capture implementation out of core. */
export interface CRCFilterRenderInput {
  readonly component: string;
  readonly filters: readonly PreparedCRCFilter[];
  readonly presentation?: Readonly<PrimitivePresentation>;
  readonly renderSubtree: () => void;
}

export interface CRCBlurFilterOptions { readonly radius: SignalValue<number>; }
export interface CRCBrightnessFilterOptions { readonly amount: SignalValue<number>; }
export interface CRCContrastFilterOptions { readonly amount: SignalValue<number>; }
export interface CRCDropShadowFilterOptions { readonly offsetX: SignalValue<number>; readonly offsetY: SignalValue<number>; readonly blurRadius?: SignalValue<number>; readonly color: SignalValue<string>; }
export interface CRCGrayscaleFilterOptions { readonly amount: SignalValue<number>; }
export interface CRCHueRotateFilterOptions { readonly degrees: SignalValue<number>; }
export interface CRCInvertFilterOptions { readonly amount: SignalValue<number>; }
export interface CRCOpacityFilterOptions { readonly amount: SignalValue<number>; }
export interface CRCSaturateFilterOptions { readonly amount: SignalValue<number>; }
export interface CRCSepiaFilterOptions { readonly amount: SignalValue<number>; }
