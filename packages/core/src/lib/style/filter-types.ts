import type { SystemStyle } from '../types.js';
import type { blur, brightness, contrast, dropShadow, grayscale, hueRotate, invert, opacity, saturate, sepia } from '../../filters/native.js';
import type { displacement } from '../../filters/displacement.js';
import type { reflectedLight } from '../../filters/reflected-light.js';
import type { PrimitivePresentation } from '../primitive-presentation.js';
import type { StyleResolutionContext } from '../types.js';
import type { SignalValue } from '../signals/types.js';
import type { TexturePaint } from '../textures/texture-protocol.js';

/**
 * Opaque, imported appearance effect accepted by `style.filter`.
 *
 * @see {@link SystemStyle}
 * @see {@link blur}
 * @see {@link brightness}
 */
export interface CRCFilter {
  readonly [CRC_FILTER_EXECUTOR]: CRCFilterExecutor;
}

/** @internal Stable protocol key shared by the base renderer and optional entries. */
export const CRC_FILTER_EXECUTOR = Symbol('crc.filter.executor');

/** @internal A value prepared for one receiving primitive generation. */
export interface PreparedCRCFilter {
  readonly executor: CRCFilterBoundaryExecutor;
}

/** @internal Optional filter implementations own validation and pixel processing. */
export interface CRCFilterBoundaryExecutor {
  render(input: Readonly<CRCFilterRenderInput>): void;
}

export interface CRCFilterExecutor extends CRCFilterBoundaryExecutor {
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

/**
 * Parameters for the blur filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link blur}
 */
export interface CRCBlurFilterOptions {
  /** Radius in the coordinate system of this geometry or effect. See {@link SignalValue}. */
  readonly radius: SignalValue<number>;
}
/**
 * Parameters for the brightness filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link brightness}
 */
export interface CRCBrightnessFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the contrast filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link contrast}
 */
export interface CRCContrastFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the drop shadow filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link dropShadow}
 */
export interface CRCDropShadowFilterOptions {
  /** Horizontal offset applied to the texture or shadow. See {@link SignalValue}. */
  readonly offsetX: SignalValue<number>;
  /** Vertical offset applied to the texture or shadow. See {@link SignalValue}. */
  readonly offsetY: SignalValue<number>;
  /** Radius of the shadow's blur. See {@link SignalValue}. */
  readonly blurRadius?: SignalValue<number>;
  /** Color used by the mark or effect. See {@link SignalValue}. */
  readonly color: SignalValue<string>;
}
/**
 * Parameters for the grayscale filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link grayscale}
 */
export interface CRCGrayscaleFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the hue rotate filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link hueRotate}
 */
export interface CRCHueRotateFilterOptions {
  /** Hue rotation in degrees. See {@link SignalValue}. */
  readonly degrees: SignalValue<number>;
}
/**
 * Parameters for the invert filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link invert}
 */
export interface CRCInvertFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the opacity filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link opacity}
 */
export interface CRCOpacityFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the saturate filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link saturate}
 */
export interface CRCSaturateFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the sepia filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link sepia}
 */
export interface CRCSepiaFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the displacement filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link TexturePaint}
 * @see {@link displacement}
 */
export interface CRCDisplacementFilterOptions {
  /**
   * Optional local blur support radius. Blue × alpha scales it; zero preserves displacement-only
   * behavior.
   */
  readonly blurRadius?: SignalValue<number>;
  /** Texture or image supplying displacement samples. See {@link SignalValue}, {@link TexturePaint}. */
  readonly map: SignalValue<TexturePaint>;
  /** Magnitude of the displacement or brush effect. See {@link SignalValue}. */
  readonly strength: SignalValue<number>;
  /**
   * Logical region over which the effect is evaluated. See {@link CRCDisplacementFilterOptions}.
   */
  readonly region: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link CRCDisplacementFilterOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link CRCDisplacementFilterOptions}.
     */
    y: number;
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link CRCDisplacementFilterOptions}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link CRCDisplacementFilterOptions}.
     */
    height: number;
  }>;
}

/**
 * Surface-light source. Images are caller-owned and must already be decoded.
 *
 * @see {@link TexturePaint}
 * @see {@link CRCReflectedLightFilterOptions}
 */
export type CRCReflectedLightSource = string | TexturePaint | HTMLImageElement | ImageBitmap;
/**
 * Parameters for the reflected light filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link TexturePaint}
 * @see {@link CRCReflectedLightSource}
 * @see {@link reflectedLight}
 */
export interface CRCReflectedLightFilterOptions {
  /** Texture or image supplying the surface-height samples. See {@link SignalValue}, {@link TexturePaint}. */
  readonly map: SignalValue<TexturePaint>;
  /**
   * Logical region over which the effect is evaluated. See {@link CRCReflectedLightFilterOptions}
   * .
   */
  readonly region: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link CRCReflectedLightFilterOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link CRCReflectedLightFilterOptions}.
     */
    y: number;
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link CRCReflectedLightFilterOptions}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link CRCReflectedLightFilterOptions}.
     */
    height: number;
  }>;
  /** Light-source position or direction used for the reflection. See {@link SignalValue}, {@link CRCReflectedLightSource}. */
  readonly source?: SignalValue<CRCReflectedLightSource>;
  /** Opacity of the painted result. See {@link SignalValue}. */
  readonly opacity?: SignalValue<number>;
  /** Intensity threshold used to select reflected-light contributions. See {@link SignalValue}. */
  readonly threshold?: SignalValue<number>;
  /** Softness of the reflected-light threshold boundary. See {@link SignalValue}. */
  readonly softness?: SignalValue<number>;
  /** Direction in which this operation proceeds. See {@link CRCReflectedLightFilterOptions}. */
  readonly direction?: readonly [number, number];
}
