import type { RenderingContext2D } from "../types.js";

declare const textureBrand: unique symbol;

export interface TexturePlacement {
  readonly mode?: "repeat" | "stretch";
  readonly tileWidth?: number;
  readonly tileHeight?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly rotation?: number;
}

/** Opaque paint value produced by a mounted texture owner. */
export interface TexturePaint {
  readonly [textureBrand]: true;
}

export interface BorrowedTextureRaster {
  readonly source: OffscreenCanvas;
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly resource: object;
  readonly placement: Readonly<TexturePlacement>;
}

interface TexturePaintCapability {
  validate(): void;
  resolvePaint(
    ctx: RenderingContext2D,
    bounds: { x: number; y: number; width: number; height: number },
  ): string | CanvasGradient | CanvasPattern;
  borrow<T>(callback: (raster: BorrowedTextureRaster) => T): T;
}

const capabilities = new WeakMap<object, TexturePaintCapability>();

/** @internal Registers a value-owned capability; there is no producer registry. */
export function registerTexturePaint(
  value: TexturePaint,
  capability: TexturePaintCapability,
): void {
  capabilities.set(value, capability);
}

/** @internal Borrows only committed pixels for one synchronous consumer action. */
export function validateTexturePaint(value: TexturePaint): void {
  const capability =
    typeof value === "object" && value !== null ? capabilities.get(value) : undefined;
  if (!capability) throw new TypeError("Expected a CRC texture paint value.");
  capability.validate();
}

export function borrowTextureRaster<T>(
  value: TexturePaint,
  callback: (raster: BorrowedTextureRaster) => T,
): T {
  const capability =
    typeof value === "object" && value !== null ? capabilities.get(value) : undefined;
  if (!capability) throw new TypeError("Expected a CRC texture paint value.");
  return capability.borrow(callback);
}

/** Internal paint resolution shared by Canvas built-ins. */
export function resolveTexturePaint(
  value: string | CanvasGradient | CanvasPattern | TexturePaint,
  ctx: RenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
): string | CanvasGradient | CanvasPattern {
  const capability =
    typeof value === "object" && value !== null ? capabilities.get(value) : undefined;
  return capability ? capability.resolvePaint(ctx, bounds) : value as string | CanvasGradient | CanvasPattern;
}
