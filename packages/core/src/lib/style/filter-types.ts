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
export interface PibblFilter {
  readonly [PIBBL_FILTER_EXECUTOR]: PibblFilterExecutor;
}

/** @internal Stable protocol key shared by the base renderer and optional entries. */
export const PIBBL_FILTER_EXECUTOR = Symbol('pibbl.filter.executor');

/** @internal A value prepared for one receiving primitive generation. */
export interface PreparedPibblFilter {
  readonly executor: PibblFilterBoundaryExecutor;
}

/** @internal Optional filter implementations own validation and pixel processing. */
export interface PibblFilterBoundaryExecutor {
  render(input: Readonly<PibblFilterRenderInput>): void;
}

export interface PibblFilterExecutor extends PibblFilterBoundaryExecutor {
  prepare(value: PibblFilter, property: string, context: Readonly<StyleResolutionContext>): PreparedPibblFilter;
  render(input: Readonly<PibblFilterRenderInput>): void;
}

/** @internal Generic call boundary that keeps capture implementation out of core. */
export interface PibblFilterRenderInput {
  readonly component: string;
  readonly filters: readonly PreparedPibblFilter[];
  readonly presentation?: Readonly<PrimitivePresentation>;
  readonly renderSubtree: () => void;
}

/**
 * Parameters for the blur filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link blur}
 */
export interface PibblBlurFilterOptions {
  /** Radius in the coordinate system of this geometry or effect. See {@link SignalValue}. */
  readonly radius: SignalValue<number>;
}
/**
 * Parameters for the brightness filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link brightness}
 */
export interface PibblBrightnessFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the contrast filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link contrast}
 */
export interface PibblContrastFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the drop shadow filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link dropShadow}
 */
export interface PibblDropShadowFilterOptions {
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
export interface PibblGrayscaleFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the hue rotate filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link hueRotate}
 */
export interface PibblHueRotateFilterOptions {
  /** Hue rotation in degrees. See {@link SignalValue}. */
  readonly degrees: SignalValue<number>;
}
/**
 * Parameters for the invert filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link invert}
 */
export interface PibblInvertFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the opacity filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link opacity}
 */
export interface PibblOpacityFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the saturate filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link saturate}
 */
export interface PibblSaturateFilterOptions {
  /** Magnitude of the filter or motion adjustment. See {@link SignalValue}. */
  readonly amount: SignalValue<number>;
}
/**
 * Parameters for the sepia filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link sepia}
 */
export interface PibblSepiaFilterOptions {
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
export interface PibblDisplacementFilterOptions {
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
   * Logical region over which the effect is evaluated. See {@link PibblDisplacementFilterOptions}.
   */
  readonly region: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link PibblDisplacementFilterOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link PibblDisplacementFilterOptions}.
     */
    y: number;
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link PibblDisplacementFilterOptions}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link PibblDisplacementFilterOptions}.
     */
    height: number;
  }>;
}

/**
 * Surface-light source. Images are caller-owned and must already be decoded.
 *
 * @see {@link TexturePaint}
 * @see {@link PibblReflectedLightFilterOptions}
 */
export type PibblReflectedLightSource = string | TexturePaint | HTMLImageElement | ImageBitmap;
/**
 * Parameters for the reflected light filter, including signal-capable inputs where declared.
 *
 * @see {@link SignalValue}
 * @see {@link TexturePaint}
 * @see {@link PibblReflectedLightSource}
 * @see {@link reflectedLight}
 */
export interface PibblReflectedLightFilterOptions {
  /** Texture or image supplying the surface-height samples. See {@link SignalValue}, {@link TexturePaint}. */
  readonly map: SignalValue<TexturePaint>;
  /**
   * Logical region over which the effect is evaluated. See {@link PibblReflectedLightFilterOptions}
   * .
   */
  readonly region: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link PibblReflectedLightFilterOptions}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link PibblReflectedLightFilterOptions}.
     */
    y: number;
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link PibblReflectedLightFilterOptions}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link PibblReflectedLightFilterOptions}.
     */
    height: number;
  }>;
  /** Light-source position or direction used for the reflection. See {@link SignalValue}, {@link PibblReflectedLightSource}. */
  readonly source?: SignalValue<PibblReflectedLightSource>;
  /** Opacity of the painted result. See {@link SignalValue}. */
  readonly opacity?: SignalValue<number>;
  /** Intensity threshold used to select reflected-light contributions. See {@link SignalValue}. */
  readonly threshold?: SignalValue<number>;
  /** Softness of the reflected-light threshold boundary. See {@link SignalValue}. */
  readonly softness?: SignalValue<number>;
  /** Direction in which this operation proceeds. See {@link PibblReflectedLightFilterOptions}. */
  readonly direction?: readonly [number, number];
}
