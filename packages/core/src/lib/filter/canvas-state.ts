import type { RenderingContext2D } from '../types.js';

export function copyFilterSourceState(
  parent: RenderingContext2D,
  source: RenderingContext2D,
): void {
  source.direction = parent.direction;
  source.fillStyle = parent.fillStyle;
  source.font = parent.font;
  copyIfPresent(parent, source, 'fontKerning');
  copyIfPresent(parent, source, 'fontStretch');
  copyIfPresent(parent, source, 'fontVariantCaps');
  source.imageSmoothingEnabled = parent.imageSmoothingEnabled;
  source.imageSmoothingQuality = parent.imageSmoothingQuality;
  copyIfPresent(parent, source, 'letterSpacing');
  source.lineCap = parent.lineCap;
  source.setLineDash(parent.getLineDash());
  source.lineDashOffset = parent.lineDashOffset;
  source.lineJoin = parent.lineJoin;
  source.lineWidth = parent.lineWidth;
  source.miterLimit = parent.miterLimit;
  source.strokeStyle = parent.strokeStyle;
  source.textAlign = parent.textAlign;
  source.textBaseline = parent.textBaseline;
  copyIfPresent(parent, source, 'textRendering');
  copyIfPresent(parent, source, 'wordSpacing');
}

function copyIfPresent(
  parent: RenderingContext2D,
  source: RenderingContext2D,
  property: string,
): void {
  if (property in parent && property in source) {
    (source as unknown as Record<string, unknown>)[property] =
      (parent as unknown as Record<string, unknown>)[property];
  }
}
