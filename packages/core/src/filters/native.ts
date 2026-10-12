import { concreteColor } from './native-color.js';
import { isSignal } from '../lib/signals/graph.js';
import { filterBoundaryExecutor } from './filter-executor.js';
import { BLUR_EXTENT_FACTOR, type PixelBounds } from '../lib/filter/filter-region.js';
import { layoutDiagnostic } from '../lib/style/diagnostics.js';
import { PIBBL_FILTER_EXECUTOR, type PibblFilter, type PibblFilterExecutor, type PibblFilterBoundaryExecutor, type PreparedPibblFilter, type PibblBlurFilterOptions, type PibblBrightnessFilterOptions, type PibblContrastFilterOptions, type PibblDropShadowFilterOptions, type PibblGrayscaleFilterOptions, type PibblHueRotateFilterOptions, type PibblInvertFilterOptions, type PibblOpacityFilterOptions, type PibblSaturateFilterOptions, type PibblSepiaFilterOptions } from '../lib/style/filter-types.js';
import type { StyleResolutionContext } from '../lib/types.js';
import type { NativePreparedFilter } from './native-operations.js';

interface NativeOperation { prepare(executor: PibblFilterBoundaryExecutor, property: string, context: Readonly<StyleResolutionContext>): NativePreparedFilter; }
const operations = new WeakMap<PibblFilter, NativeOperation>();
export const nativeExecutor: PibblFilterExecutor = {
  prepare(value, property, context): PreparedPibblFilter {
    const operation = operations.get(value);
    if (!operation) throw new Error('A native filter value was created by an incompatible Pibbl runtime.');
    return operation.prepare(filterBoundaryExecutor, property, context);
  },
  render: filterBoundaryExecutor.render,
};
function filter(operation: NativeOperation): PibblFilter {
  const value = Object.freeze({ [PIBBL_FILTER_EXECUTOR]: nativeExecutor });
  operations.set(value, operation);
  return value;
}
function prepared(executor: PibblFilterBoundaryExecutor, css: (density: number) => string, reverseInfluence: (output: Readonly<PixelBounds>, density: number) => PixelBounds, onRejected?: () => void): NativePreparedFilter {
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
/**
 * Creates a blur filter descriptor for a primitive's style.filter list. Filtering changes pixels
 * without changing layout or hit geometry.
 *
 * @param options - Blur radius in logical units. See {@link PibblBlurFilterOptions}.
 * @returns A blur filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblBlurFilterOptions}
 * @see {@link PibblFilter}
 */
export function blur(options: PibblBlurFilterOptions): PibblFilter {
  const radiusInput = options.radius;
  return filter({ prepare(executor, property, context) { const radius = number(radiusInput, `${property}.radius`, context, true); return prepared(executor, density => `blur(${radius * density}px)`, (output, density) => blurInfluence(radius, output, density)); } });
}
function amountFilter(type: string, input: { readonly amount: unknown }, clamp: boolean): PibblFilter {
  const amountInput = input.amount;
  return filter({ prepare(executor, property, context) { const amount = clamp ? Math.min(1, number(amountInput, `${property}.amount`, context, true)) : number(amountInput, `${property}.amount`, context, true); return prepared(executor, () => `${type}(${amount})`, unchanged); } });
}
/**
 * Creates a brightness filter descriptor for a primitive's style.filter list. Filtering changes
 * pixels without changing layout or hit geometry.
 *
 * @param options - Brightness multiplier. See {@link PibblBrightnessFilterOptions}.
 * @returns A brightness filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblBrightnessFilterOptions}
 * @see {@link PibblFilter}
 */
export function brightness(options: PibblBrightnessFilterOptions): PibblFilter { return amountFilter('brightness', options, false); }
/**
 * Creates a contrast filter descriptor for a primitive's style.filter list. Filtering changes
 * pixels without changing layout or hit geometry.
 *
 * @param options - Contrast multiplier. See {@link PibblContrastFilterOptions}.
 * @returns A contrast filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblContrastFilterOptions}
 * @see {@link PibblFilter}
 */
export function contrast(options: PibblContrastFilterOptions): PibblFilter { return amountFilter('contrast', options, false); }
/**
 * Creates a grayscale filter descriptor for a primitive's style.filter list. Filtering changes
 * pixels without changing layout or hit geometry.
 *
 * @param options - Grayscale amount. See {@link PibblGrayscaleFilterOptions}.
 * @returns A grayscale filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblGrayscaleFilterOptions}
 * @see {@link PibblFilter}
 */
export function grayscale(options: PibblGrayscaleFilterOptions): PibblFilter { return amountFilter('grayscale', options, true); }
/**
 * Creates a invert filter descriptor for a primitive's style.filter list. Filtering changes pixels
 * without changing layout or hit geometry.
 *
 * @param options - Color inversion amount. See {@link PibblInvertFilterOptions}.
 * @returns An inversion filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblInvertFilterOptions}
 * @see {@link PibblFilter}
 */
export function invert(options: PibblInvertFilterOptions): PibblFilter { return amountFilter('invert', options, true); }
/**
 * Creates a opacity filter descriptor for a primitive's style.filter list. Filtering changes
 * pixels
 * without changing layout or hit geometry.
 *
 * @param options - Opacity multiplier. See {@link PibblOpacityFilterOptions}.
 * @returns An opacity filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblOpacityFilterOptions}
 * @see {@link PibblFilter}
 */
export function opacity(options: PibblOpacityFilterOptions): PibblFilter { return amountFilter('opacity', options, true); }
/**
 * Creates a saturate filter descriptor for a primitive's style.filter list. Filtering changes
 * pixels without changing layout or hit geometry.
 *
 * @param options - Saturation multiplier. See {@link PibblSaturateFilterOptions}.
 * @returns A saturation filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblSaturateFilterOptions}
 * @see {@link PibblFilter}
 */
export function saturate(options: PibblSaturateFilterOptions): PibblFilter { return amountFilter('saturate', options, false); }
/**
 * Creates a sepia filter descriptor for a primitive's style.filter list. Filtering changes pixels
 * without changing layout or hit geometry.
 *
 * @param options - Sepia amount. See {@link PibblSepiaFilterOptions}.
 * @returns A sepia filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblSepiaFilterOptions}
 * @see {@link PibblFilter}
 */
export function sepia(options: PibblSepiaFilterOptions): PibblFilter { return amountFilter('sepia', options, true); }
/**
 * Creates a hue rotate filter descriptor for a primitive's style.filter list. Filtering changes
 * pixels without changing layout or hit geometry.
 *
 * @param options - Hue rotation angle. See {@link PibblHueRotateFilterOptions}.
 * @returns A hue-rotation filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblHueRotateFilterOptions}
 * @see {@link PibblFilter}
 */
export function hueRotate(options: PibblHueRotateFilterOptions): PibblFilter { const degreesInput = options.degrees; return filter({ prepare(executor, property, context) { const degrees = number(degreesInput, `${property}.degrees`, context); return prepared(executor, () => `hue-rotate(${degrees}deg)`, unchanged); } }); }
/**
 * Creates a drop shadow filter descriptor for a primitive's style.filter list. Filtering changes
 * pixels without changing layout or hit geometry.
 *
 * @param options - Shadow offsets, blur, and color. See {@link PibblDropShadowFilterOptions}.
 * @returns A drop-shadow filter descriptor for style.filter. See {@link PibblFilter}.
 *
 * @see {@link PibblDropShadowFilterOptions}
 * @see {@link PibblFilter}
 */
export function dropShadow(options: PibblDropShadowFilterOptions): PibblFilter {
  const offsetXInput = options.offsetX; const offsetYInput = options.offsetY; const radiusInput = options.blurRadius === undefined ? 0 : options.blurRadius; const colorInput = options.color;
  return filter({ prepare(executor, property, context) {
    const offsetX = number(offsetXInput, `${property}.offsetX`, context); const offsetY = number(offsetYInput, `${property}.offsetY`, context); const radius = number(radiusInput, `${property}.blurRadius`, context, true); const color = concreteColor(isSignal(colorInput) ? colorInput.get() : colorInput, `${property}.color`, context);
    return prepared(executor, density => `drop-shadow(${offsetX * density}px ${offsetY * density}px ${radius * density}px ${color})`, (output, density) => { const extent = Math.ceil(radius * density * BLUR_EXTENT_FACTOR); const x = Math.min(output.x, Math.floor(output.x - offsetX * density - extent)); const y = Math.min(output.y, Math.floor(output.y - offsetY * density - extent)); const right = Math.max(output.x + output.width, Math.ceil(output.x + output.width - offsetX * density + extent)); const bottom = Math.max(output.y + output.height, Math.ceil(output.y + output.height - offsetY * density + extent)); return { x, y, width: right - x, height: bottom - y }; }, () => { throw layoutDiagnostic({ component: context.component, property: `${property}.color`, value: color, algorithm: 'filter-rendering', constraints: context.constraints, reason: 'was rejected by the native Canvas filter color parser' }); });
  } });
}
