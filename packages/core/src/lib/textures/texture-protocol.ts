import type { FillStyle, StrokeStyle } from '../types.js';
import type { Texture, TextureDefinition } from './texture.js';
import type { RenderingContext2D } from "../types.js";

declare const textureBrand: unique symbol;

/**
 * How a texture raster is positioned and scaled when used as paint.
 *
 * @see {@link Texture}
 * @see {@link TextureDefinition}
 */
export interface TexturePlacement {
  /** Selects the supported mapping, placement, or result policy. See {@link TexturePlacement}. */
  readonly mode?: "repeat" | "stretch";
  /** Width of one texture tile in logical paint coordinates. See {@link TexturePlacement}. */
  readonly tileWidth?: number;
  /** Height of one texture tile in logical paint coordinates. See {@link TexturePlacement}. */
  readonly tileHeight?: number;
  /** Horizontal offset applied to the texture or shadow. See {@link TexturePlacement}. */
  readonly offsetX?: number;
  /** Vertical offset applied to the texture or shadow. See {@link TexturePlacement}. */
  readonly offsetY?: number;
  /** Rotation applied to the containing geometry. See {@link TexturePlacement}. */
  readonly rotation?: number;
}

/**
 * Opaque paint value produced by a mounted texture owner.
 *
 * @see {@link FillStyle}
 * @see {@link StrokeStyle}
 * @see {@link Texture}
 */
export interface TexturePaint {
  readonly [textureBrand]: true;
}

/**
 * A temporary raster view valid only during the borrowing callback.
 *
 * @see {@link TexturePlacement}
 * @see {@link borrowTextureRaster}
 */
export interface BorrowedTextureRaster {
  /** Borrowed raster image; valid only within the borrowing callback. See {@link BorrowedTextureRaster}. */
  readonly source: OffscreenCanvas;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link BorrowedTextureRaster}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link BorrowedTextureRaster}.
   */
  readonly height: number;
  /**
   * Revision used to detect changes to the underlying state or geometry. See
   * {@link BorrowedTextureRaster}.
   */
  readonly revision: number;
  /** Resource identity underlying the borrowed raster. See {@link BorrowedTextureRaster}. */
  readonly resource: object;
  /**
   * Preferred placement relative to the anchor or containing geometry. See
   * {@link TexturePlacement}.
   */
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

/**
 * @internal Borrows only committed pixels for one synchronous consumer action.
 *
 * @param value - Texture paint descriptor to validate. See {@link TexturePaint}.
 *
 * @see {@link TexturePaint}
 */
export function validateTexturePaint(value: TexturePaint): void {
  const capability =
    typeof value === "object" && value !== null ? capabilities.get(value) : undefined;
  if (!capability) throw new TypeError("Expected a CRC texture paint value.");
  capability.validate();
}

/**
 * Borrows a texture raster for synchronous use without transferring ownership to the caller.
 *
 * @param value - Texture paint whose raster is borrowed. See {@link TexturePaint}.
 * @param callback - Synchronous callback using the raster while its lease is active. See
 * {@link BorrowedTextureRaster} .
 * @returns The callback's return value; the raster lease ends when the callback returns.
 *
 * @see {@link TexturePaint}
 * @see {@link BorrowedTextureRaster}
 */
export function borrowTextureRaster<T>(
  value: TexturePaint,
  callback: (raster: BorrowedTextureRaster) => T,
): T {
  const capability =
    typeof value === "object" && value !== null ? capabilities.get(value) : undefined;
  if (!capability) throw new TypeError("Expected a CRC texture paint value.");
  return capability.borrow(callback);
}

/**
 * Internal paint resolution shared by Canvas built-ins.
 *
 * @param value - Native Canvas paint or CRC texture placement. See {@link TexturePaint}.
 * @param ctx - Canvas context that will consume the resolved paint. See {@link RenderingContext2D}
 * .
 * @param bounds - Destination bounds in local logical coordinates.
 * @returns Native Canvas paint ready to assign to the drawing context.
 *
 * @see {@link TexturePaint}
 * @see {@link RenderingContext2D}
 */
export function resolveTexturePaint(
  value: string | CanvasGradient | CanvasPattern | TexturePaint,
  ctx: RenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
): string | CanvasGradient | CanvasPattern {
  const capability =
    typeof value === "object" && value !== null ? capabilities.get(value) : undefined;
  return capability ? capability.resolvePaint(ctx, bounds) : value as string | CanvasGradient | CanvasPattern;
}

/** Internal Rectangle-only fast path for the exact simple stretch-fill case. */
export function drawSimpleStretchedTexture(
  value: string | CanvasGradient | CanvasPattern | TexturePaint | undefined,
  ctx: RenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
): boolean {
  const capability = typeof value === "object" && value !== null ? capabilities.get(value) : undefined;
  if (!capability || ctx.globalCompositeOperation !== "source-over" || ctx.filter !== "none" ||
    ctx.shadowBlur !== 0 || ctx.shadowOffsetX !== 0 || ctx.shadowOffsetY !== 0 ||
    ctx.shadowColor !== "rgba(0, 0, 0, 0)") return false;
  // CanvasPattern and drawImage use different sampling rules when either is
  // scaled, especially around transparent source pixels. Keep the
  // allocation-free path to the exact 1:1, pixel-aligned case only.
  const transform = ctx.getTransform();
  if (!Number.isInteger(bounds.x) || !Number.isInteger(bounds.y) ||
    !Number.isInteger(bounds.width) || !Number.isInteger(bounds.height) ||
    bounds.width <= 0 || bounds.height <= 0 || transform.b !== 0 || transform.c !== 0 ||
    transform.a !== 1 || transform.d !== 1 ||
    !Number.isInteger(transform.e) || !Number.isInteger(transform.f)) return false;
  capability.validate();
  return capability.borrow(raster => {
    const placement = raster.placement;
    if (placement.mode !== "stretch" || placement.offsetX || placement.offsetY || placement.rotation) return false;
    if (raster.width !== bounds.width || raster.height !== bounds.height) return false;
    ctx.drawImage(raster.source, bounds.x, bounds.y, bounds.width, bounds.height);
    return true;
  });
}
