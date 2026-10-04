/** Sheet coordinates and trim placement are deliberately independent. */
export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  sourceWidth: number;
  sourceHeight: number;
  /** Normalized contact point in the untrimmed logical frame. */
  anchorX?: number;
  anchorY?: number;
}
export function framePlacement(
  f: SpriteFrame,
  x: number,
  y: number,
  width: number,
  height: number,
  anchorX = f.anchorX ?? 0.5,
  anchorY = f.anchorY ?? 1,
) {
  return {
    x: x - width * anchorX + (f.offsetX * width) / f.sourceWidth,
    y: y - height * anchorY + (f.offsetY * height) / f.sourceHeight,
    width: (f.width * width) / f.sourceWidth,
    height: (f.height * height) / f.sourceHeight,
  };
}
