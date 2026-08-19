export type CRCFit =
  | 'contain'
  | 'cover'
  | 'fill'
  | 'none'
  | 'scale-down';

export type CRCPixelRatio = 'device' | number;

export interface CRCFixedViewportConfig {
  signal?: AbortSignal;
  viewport?: Readonly<{
    width: number;
    height: number;
  }>;
  fit?: CRCFit;
  pixelRatio?: CRCPixelRatio;
}

export interface CRCResponsiveViewportConfig {
  signal?: AbortSignal;
  viewport: 'responsive';
  pixelRatio?: CRCPixelRatio;
}

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
