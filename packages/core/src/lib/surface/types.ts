import type { pibbl } from '../pibbl.js';
/**
 * How a fixed logical viewport fits inside its displayed canvas surface.
 *
 * @see {@link PibblFixedViewportConfig}
 */
export type PibblFit =
  | 'contain'
  | 'cover'
  | 'fill'
  | 'none'
  | 'scale-down';

/**
 * Requested backing-store density, either explicit or derived from the device.
 *
 * @see {@link PibblFixedViewportConfig}
 * @see {@link PibblResponsiveViewportConfig}
 */
export type PibblPixelRatio = 'device' | number;

/**
 * Fixed logical viewport dimensions and fitting policy for a canvas mount.
 *
 * @see {@link PibblFit}
 * @see {@link PibblPixelRatio}
 * @see {@link PibblConfig}
 */
export interface PibblFixedViewportConfig {
  /**
   * Opt-in host for application-owned HTML regions associated with this canvas. See
   * {@link PibblFixedViewportConfig}.
   */
  htmlOverlay?: HTMLElement;
  /**
   * Abort signal governing the lifetime of this operation or mount. See
   * {@link PibblFixedViewportConfig}.
   */
  signal?: AbortSignal;
  /** Logical viewport dimensions and fitting configuration. See {@link PibblFixedViewportConfig}. */
  viewport?: Readonly<{
    /**
     * Horizontal extent in the units of the containing geometry or surface. See
     * {@link PibblFixedViewportConfig}.
     */
    width: number;
    /**
     * Vertical extent in the units of the containing geometry or surface. See
     * {@link PibblFixedViewportConfig}.
     */
    height: number;
  }>;
  /** Policy for fitting content within its available box. See {@link PibblFit}. */
  fit?: PibblFit;
  /** Requested backing-store pixel density. See {@link PibblPixelRatio}. */
  pixelRatio?: PibblPixelRatio;
}

/**
 * A viewport that follows the displayed canvas dimensions.
 *
 * @see {@link PibblPixelRatio}
 * @see {@link PibblConfig}
 */
export interface PibblResponsiveViewportConfig {
  /**
   * Opt-in host for application-owned HTML regions associated with this canvas. See
   * {@link PibblResponsiveViewportConfig}.
   */
  htmlOverlay?: HTMLElement;
  /**
   * Abort signal governing the lifetime of this operation or mount. See
   * {@link PibblResponsiveViewportConfig}.
   */
  signal?: AbortSignal;
  /**
   * Logical viewport dimensions and fitting configuration. See {@link PibblResponsiveViewportConfig}
   * .
   */
  viewport: 'responsive';
  /** Requested backing-store pixel density. See {@link PibblPixelRatio}. */
  pixelRatio?: PibblPixelRatio;
}

/**
 * Canvas surface sizing, pixel density, and viewport configuration for a Pibbl mount.
 *
 * @see {@link PibblFixedViewportConfig}
 * @see {@link PibblResponsiveViewportConfig}
 * @see {@link pibbl}
 */
export type PibblConfig =
  | PibblFixedViewportConfig
  | PibblResponsiveViewportConfig;

export type ResolvedSurfaceConfig =
  | {
    mode: 'fixed';
    width: number;
    height: number;
    fit: PibblFit;
    pixelRatio: PibblPixelRatio;
  }
  | {
    mode: 'responsive';
    pixelRatio: PibblPixelRatio;
  };

export interface SurfaceDisplaySize {
  width: number;
  height: number;
}

export interface PibblSurfaceSnapshot {
  mode: 'fixed' | 'responsive' | 'layer';
  fit: PibblFit;
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
  snapshot: PibblSurfaceSnapshot | undefined;
  ownedWidth: OwnedInlineSize | undefined;
  ownedHeight: OwnedInlineSize | undefined;
}

export interface LayerSurfaceState {
  kind: 'layer';
  managed: boolean;
  snapshot: PibblSurfaceSnapshot;
}

export type PibblSurfaceState = RootSurfaceState | LayerSurfaceState;

export interface OwnedInlineSize {
  previous: string;
  owned: string;
}
