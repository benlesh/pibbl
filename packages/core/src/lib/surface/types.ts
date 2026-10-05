import type { crc } from '../crc.js';
/**
 * How a fixed logical viewport fits inside its displayed canvas surface.
 *
 * @see {@link CRCFixedViewportConfig}
 */
export type CRCFit =
  | 'contain'
  | 'cover'
  | 'fill'
  | 'none'
  | 'scale-down';

/**
 * Requested backing-store density, either explicit or derived from the device.
 *
 * @see {@link CRCFixedViewportConfig}
 * @see {@link CRCResponsiveViewportConfig}
 */
export type CRCPixelRatio = 'device' | number;

/**
 * Fixed logical viewport dimensions and fitting policy for a canvas mount.
 *
 * @see {@link CRCFit}
 * @see {@link CRCPixelRatio}
 * @see {@link CRCConfig}
 */
export interface CRCFixedViewportConfig {
  /**
   * Opt-in host for application-owned HTML regions associated with this canvas. See
   * {@link CRCFixedViewportConfig}.
   */
  htmlOverlay?: HTMLElement;
  /**
   * Abort signal governing the lifetime of this operation or mount. See
   * {@link CRCFixedViewportConfig}.
   */
  signal?: AbortSignal;
  /** Logical viewport dimensions and fitting configuration. See {@link CRCFixedViewportConfig}. */
  viewport?: Readonly<{
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link CRCFixedViewportConfig}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link CRCFixedViewportConfig}.
     */
    height: number;
  }>;
  /** Policy for fitting content within its available box. See {@link CRCFit}. */
  fit?: CRCFit;
  /** Requested backing-store pixel density. See {@link CRCPixelRatio}. */
  pixelRatio?: CRCPixelRatio;
}

/**
 * A viewport that follows the displayed canvas dimensions.
 *
 * @see {@link CRCPixelRatio}
 * @see {@link CRCConfig}
 */
export interface CRCResponsiveViewportConfig {
  /**
   * Opt-in host for application-owned HTML regions associated with this canvas. See
   * {@link CRCResponsiveViewportConfig}.
   */
  htmlOverlay?: HTMLElement;
  /**
   * Abort signal governing the lifetime of this operation or mount. See
   * {@link CRCResponsiveViewportConfig}.
   */
  signal?: AbortSignal;
  /**
   * Logical viewport dimensions and fitting configuration. See {@link CRCResponsiveViewportConfig}
   * .
   */
  viewport: 'responsive';
  /** Requested backing-store pixel density. See {@link CRCPixelRatio}. */
  pixelRatio?: CRCPixelRatio;
}

/**
 * Canvas surface sizing, pixel density, and viewport configuration for a CRC mount.
 *
 * @see {@link CRCFixedViewportConfig}
 * @see {@link CRCResponsiveViewportConfig}
 * @see {@link crc}
 */
export type CRCConfig =
  | CRCFixedViewportConfig
  | CRCResponsiveViewportConfig;

export type ResolvedSurfaceConfig =
  | {
    mode: 'fixed';
    width: number;
    height: number;
    fit: CRCFit;
    pixelRatio: CRCPixelRatio;
  }
  | {
    mode: 'responsive';
    pixelRatio: CRCPixelRatio;
  };

export interface SurfaceDisplaySize {
  width: number;
  height: number;
}

export interface CRCSurfaceSnapshot {
  mode: 'fixed' | 'responsive' | 'layer';
  fit: CRCFit;
  logicalWidth: number;
  logicalHeight: number;
  displayWidth: number;
  displayHeight: number;
  backingWidth: number;
  backingHeight: number;
  backingPixelsPerCssPixelX: number;
  backingPixelsPerCssPixelY: number;
  backingPixelsPerLogicalUnitX: number;
  backingPixelsPerLogicalUnitY: number;
  renderTransform: DOMMatrix;
  inverseRenderTransform: DOMMatrix;
}

export interface RootSurfaceState {
  kind: 'root';
  config: ResolvedSurfaceConfig;
  display: SurfaceDisplaySize;
  pixelRatio: number;
  snapshot: CRCSurfaceSnapshot | undefined;
  ownedWidth: OwnedInlineSize | undefined;
  ownedHeight: OwnedInlineSize | undefined;
}

export interface LayerSurfaceState {
  kind: 'layer';
  managed: boolean;
  snapshot: CRCSurfaceSnapshot;
}

export type CRCSurfaceState = RootSurfaceState | LayerSurfaceState;

export interface OwnedInlineSize {
  previous: string;
  owned: string;
}
