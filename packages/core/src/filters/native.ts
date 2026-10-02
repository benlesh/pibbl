import { concreteColor } from './native-color.js';
import { isSignal } from '../lib/signals/graph.js';
import { renderFilterBoundary } from '../lib/filter/render-filter-boundary.js';
import { BLUR_EXTENT_FACTOR, type PixelBounds } from '../lib/filter/filter-region.js';
import { layoutDiagnostic } from '../lib/style/diagnostics.js';
import { CRC_FILTER_EXECUTOR, type CRCFilter, type CRCFilterExecutor, type CRCFilterRenderInput, type PreparedCRCFilter, type CRCBlurFilterOptions, type CRCBrightnessFilterOptions, type CRCContrastFilterOptions, type CRCDropShadowFilterOptions, type CRCGrayscaleFilterOptions, type CRCHueRotateFilterOptions, type CRCInvertFilterOptions, type CRCOpacityFilterOptions, type CRCSaturateFilterOptions, type CRCSepiaFilterOptions } from '../lib/style/filter-types.js';
import type { StyleResolutionContext } from '../lib/types.js';
import type { NativePreparedFilter } from './native-operations.js';

interface NativeOperation { prepare(executor: CRCFilterExecutor, property: string, context: Readonly<StyleResolutionContext>): NativePreparedFilter; }
const operations = new WeakMap<CRCFilter, NativeOperation>();
export const nativeExecutor: CRCFilterExecutor = {
  prepare(value, property, context): PreparedCRCFilter {
    const operation = operations.get(value);
    if (!operation) throw new Error('A native filter value was created by an incompatible CRC runtime.');
    return operation.prepare(nativeExecutor, property, context);
  },
  render(input: Readonly<CRCFilterRenderInput>): void {
    renderFilterBoundary({ component: input.component, filters: input.filters as readonly NativePreparedFilter[], presentation: input.presentation }, input.renderSubtree);
  },
};
function filter(operation: NativeOperation): CRCFilter {
  const value = Object.freeze({ [CRC_FILTER_EXECUTOR]: nativeExecutor });
  operations.set(value, operation);
  return value;
}
function prepared(executor: CRCFilterExecutor, css: (density: number) => string, reverseInfluence: (output: Readonly<PixelBounds>, density: number) => PixelBounds, onRejected?: () => void): NativePreparedFilter {
  return Object.freeze({ executor, css, reverseInfluence, onRejected });
}
const unchanged = (output: Readonly<PixelBounds>): PixelBounds => ({ ...output });
function number(value: unknown, property: string, context: Readonly<StyleResolutionContext>, nonnegative = false): number {
  const resolved = isSignal(value) ? value.get() : value;
  if (typeof resolved !== 'number' || !Number.isFinite(resolved)) throw invalid(property, resolved, 'must be a finite number', context);
  if (nonnegative && resolved < 0) throw invalid(property, resolved, 'must be nonnegative', context);
  return resolved;
}
function invalid(property: string, value: unknown, reason: string, context: Readonly<StyleResolutionContext>): Error { return layoutDiagnostic({ component: context.component, property, value, algorithm: context.algorithm, constraints: context.constraints, reason }); }
function blurInfluence(radius: number, output: Readonly<PixelBounds>, density: number): PixelBounds {
  const extent = Math.ceil(radius * density * BLUR_EXTENT_FACTOR);
  return { x: output.x - extent, y: output.y - extent, width: output.width + 2 * extent, height: output.height + 2 * extent };
}
export function blur(options: CRCBlurFilterOptions): CRCFilter {
  const radiusInput = options.radius;
  return filter({ prepare(executor, property, context) { const radius = number(radiusInput, `${property}.radius`, context, true); return prepared(executor, density => `blur(${radius * density}px)`, (output, density) => blurInfluence(radius, output, density)); } });
}
function amountFilter(type: string, input: { readonly amount: unknown }, clamp: boolean): CRCFilter {
  const amountInput = input.amount;
  return filter({ prepare(executor, property, context) { const amount = clamp ? Math.min(1, number(amountInput, `${property}.amount`, context, true)) : number(amountInput, `${property}.amount`, context, true); return prepared(executor, () => `${type}(${amount})`, unchanged); } });
}
export function brightness(options: CRCBrightnessFilterOptions): CRCFilter { return amountFilter('brightness', options, false); }
export function contrast(options: CRCContrastFilterOptions): CRCFilter { return amountFilter('contrast', options, false); }
export function grayscale(options: CRCGrayscaleFilterOptions): CRCFilter { return amountFilter('grayscale', options, true); }
export function invert(options: CRCInvertFilterOptions): CRCFilter { return amountFilter('invert', options, true); }
export function opacity(options: CRCOpacityFilterOptions): CRCFilter { return amountFilter('opacity', options, true); }
export function saturate(options: CRCSaturateFilterOptions): CRCFilter { return amountFilter('saturate', options, false); }
export function sepia(options: CRCSepiaFilterOptions): CRCFilter { return amountFilter('sepia', options, true); }
export function hueRotate(options: CRCHueRotateFilterOptions): CRCFilter { const degreesInput = options.degrees; return filter({ prepare(executor, property, context) { const degrees = number(degreesInput, `${property}.degrees`, context); return prepared(executor, () => `hue-rotate(${degrees}deg)`, unchanged); } }); }
export function dropShadow(options: CRCDropShadowFilterOptions): CRCFilter {
  const offsetXInput = options.offsetX; const offsetYInput = options.offsetY; const radiusInput = options.blurRadius === undefined ? 0 : options.blurRadius; const colorInput = options.color;
  return filter({ prepare(executor, property, context) {
    const offsetX = number(offsetXInput, `${property}.offsetX`, context); const offsetY = number(offsetYInput, `${property}.offsetY`, context); const radius = number(radiusInput, `${property}.blurRadius`, context, true); const color = concreteColor(isSignal(colorInput) ? colorInput.get() : colorInput, `${property}.color`, context);
    return prepared(executor, density => `drop-shadow(${offsetX * density}px ${offsetY * density}px ${radius * density}px ${color})`, (output, density) => { const extent = Math.ceil(radius * density * BLUR_EXTENT_FACTOR); const x = Math.min(output.x, Math.floor(output.x - offsetX * density - extent)); const y = Math.min(output.y, Math.floor(output.y - offsetY * density - extent)); const right = Math.max(output.x + output.width, Math.ceil(output.x + output.width - offsetX * density + extent)); const bottom = Math.max(output.y + output.height, Math.ceil(output.y + output.height - offsetY * density + extent)); return { x, y, width: right - x, height: bottom - y }; }, () => { throw layoutDiagnostic({ component: context.component, property: `${property}.color`, value: color, algorithm: 'filter-rendering', constraints: context.constraints, reason: 'was rejected by the native Canvas filter color parser' }); });
  } });
}
