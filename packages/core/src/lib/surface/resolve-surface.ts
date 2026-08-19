import type {
  CRCConfig,
  CRCFit,
  CRCSurfaceSnapshot,
  ResolvedSurfaceConfig,
  SurfaceDisplaySize,
} from './types.js';

const FITS = new Set<CRCFit>([
  'contain',
  'cover',
  'fill',
  'none',
  'scale-down',
]);

export function validateSurfaceConfig(
  canvas: HTMLCanvasElement,
  config?: CRCConfig,
): ResolvedSurfaceConfig {
  const pixelRatio = config?.pixelRatio ?? 'device';
  validatePixelRatio(pixelRatio);

  if (config?.viewport === 'responsive') {
    if ('fit' in config) {
      throw new Error('CRC responsive viewport does not support fit.');
    }
    return { mode: 'responsive', pixelRatio };
  }

  const width = config?.viewport?.width ?? canvas.width;
  const height = config?.viewport?.height ?? canvas.height;
  validatePositiveFinite(width, 'viewport width');
  validatePositiveFinite(height, 'viewport height');
  const fit = config?.fit ?? 'contain';
  if (!FITS.has(fit)) {
    throw new Error(`Invalid CRC fit: ${String(fit)}.`);
  }
  return { mode: 'fixed', width, height, fit, pixelRatio };
}

export function resolveSurface(
  config: ResolvedSurfaceConfig,
  display: SurfaceDisplaySize,
  pixelRatio: number,
): CRCSurfaceSnapshot | undefined {
  validatePositiveFinite(pixelRatio, 'pixelRatio');
  if (!(display.width > 0) || !(display.height > 0)) {
    return undefined;
  }

  const backingWidth = Math.max(1, Math.round(display.width * pixelRatio));
  const backingHeight = Math.max(1, Math.round(display.height * pixelRatio));
  const backingPixelsPerCssPixelX = backingWidth / display.width;
  const backingPixelsPerCssPixelY = backingHeight / display.height;

  if (config.mode === 'responsive') {
    return createSnapshot({
      mode: 'responsive',
      fit: 'fill',
      logicalWidth: display.width,
      logicalHeight: display.height,
      display,
      backingWidth,
      backingHeight,
      backingPixelsPerCssPixelX,
      backingPixelsPerCssPixelY,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    });
  }

  const projection = resolveProjection(
    config.fit,
    config.width,
    config.height,
    display.width,
    display.height,
  );
  return createSnapshot({
    mode: 'fixed',
    fit: config.fit,
    logicalWidth: config.width,
    logicalHeight: config.height,
    display,
    backingWidth,
    backingHeight,
    backingPixelsPerCssPixelX,
    backingPixelsPerCssPixelY,
    ...projection,
  });
}

export function createLayerSurface(
  width: number,
  height: number,
  densityX: number,
  densityY: number,
): CRCSurfaceSnapshot {
  validatePositiveFinite(width, 'layer width');
  validatePositiveFinite(height, 'layer height');
  validatePositiveFinite(densityX, 'layer densityX');
  validatePositiveFinite(densityY, 'layer densityY');
  const backingWidth = Math.max(1, Math.round(width * densityX));
  const backingHeight = Math.max(1, Math.round(height * densityY));
  const effectiveX = backingWidth / width;
  const effectiveY = backingHeight / height;
  return createSnapshot({
    mode: 'layer',
    fit: 'fill',
    logicalWidth: width,
    logicalHeight: height,
    display: { width, height },
    backingWidth,
    backingHeight,
    backingPixelsPerCssPixelX: effectiveX,
    backingPixelsPerCssPixelY: effectiveY,
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
  });
}

function resolveProjection(
  fit: CRCFit,
  logicalWidth: number,
  logicalHeight: number,
  displayWidth: number,
  displayHeight: number,
) {
  const widthScale = displayWidth / logicalWidth;
  const heightScale = displayHeight / logicalHeight;
  let scaleX: number;
  let scaleY: number;
  switch (fit) {
    case 'contain':
      scaleX = scaleY = Math.min(widthScale, heightScale);
      break;
    case 'cover':
      scaleX = scaleY = Math.max(widthScale, heightScale);
      break;
    case 'fill':
      scaleX = widthScale;
      scaleY = heightScale;
      break;
    case 'none':
      scaleX = scaleY = 1;
      break;
    case 'scale-down':
      scaleX = scaleY = Math.min(1, widthScale, heightScale);
      break;
  }
  return {
    scaleX,
    scaleY,
    offsetX: (displayWidth - logicalWidth * scaleX) / 2,
    offsetY: (displayHeight - logicalHeight * scaleY) / 2,
  };
}

function createSnapshot({
  mode,
  fit,
  logicalWidth,
  logicalHeight,
  display,
  backingWidth,
  backingHeight,
  backingPixelsPerCssPixelX,
  backingPixelsPerCssPixelY,
  scaleX,
  scaleY,
  offsetX,
  offsetY,
}: {
  mode: CRCSurfaceSnapshot['mode'];
  fit: CRCFit;
  logicalWidth: number;
  logicalHeight: number;
  display: SurfaceDisplaySize;
  backingWidth: number;
  backingHeight: number;
  backingPixelsPerCssPixelX: number;
  backingPixelsPerCssPixelY: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}): CRCSurfaceSnapshot {
  const renderTransform = new DOMMatrix()
    .scale(backingPixelsPerCssPixelX, backingPixelsPerCssPixelY)
    .translate(offsetX, offsetY)
    .scale(scaleX, scaleY);
  return Object.freeze({
    mode,
    fit,
    logicalWidth,
    logicalHeight,
    displayWidth: display.width,
    displayHeight: display.height,
    backingWidth,
    backingHeight,
    backingPixelsPerCssPixelX,
    backingPixelsPerCssPixelY,
    backingPixelsPerLogicalUnitX: backingPixelsPerCssPixelX * scaleX,
    backingPixelsPerLogicalUnitY: backingPixelsPerCssPixelY * scaleY,
    renderTransform,
    inverseRenderTransform: renderTransform.inverse(),
  });
}

function validatePixelRatio(pixelRatio: 'device' | number): void {
  if (pixelRatio !== 'device') {
    validatePositiveFinite(pixelRatio, 'pixelRatio');
  }
}

function validatePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`CRC ${name} must be a finite number greater than zero.`);
  }
}
