import { rasterizeField } from "./wasm/memory.js";
/** Borrowed sources are valid only during the synchronous renderer callback. */
export interface TextureRenderFrame {
  readonly source: OffscreenCanvas;
  /** White with texture intensity as alpha, allocated lazily on first access. */
  readonly mask: OffscreenCanvas;
  readonly width: number;
  readonly height: number;
  readonly textureWidth: number;
  readonly textureHeight: number;
}
export type TextureRenderer = (
  context: OffscreenCanvasRenderingContext2D,
  texture: Readonly<TextureRenderFrame>,
) => void;

export class TextureRaster {
  readonly surface: OffscreenCanvas;
  readonly context: OffscreenCanvasRenderingContext2D;
  private maskRaster?: () => ImageData;
  private maskSurface?: OffscreenCanvas;
  private maskContext?: OffscreenCanvasRenderingContext2D;
  private maskDirty = true;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.surface = new OffscreenCanvas(width, height);
    const context = this.surface.getContext("2d");
    if (!context) {
      this.surface.width = this.surface.height = 0;
      throw new Error("Textures require offscreen Canvas 2D.");
    }
    this.context = context;
  }
  update(field: Float32Array, lut: Uint8ClampedArray, gain = 1) {
    const raster = rasterizeField(field, lut, gain);
    this.maskRaster = raster.mask;
    this.context.putImageData(raster.image, 0, 0);
    this.maskDirty = true;
  }
  private getMask(): OffscreenCanvas {
    if (!this.maskSurface) {
      this.maskSurface = new OffscreenCanvas(this.width, this.height);
      this.maskContext = this.maskSurface.getContext("2d") ?? undefined;
      if (!this.maskContext)
        throw new Error("Textures require offscreen Canvas 2D.");
    }
    if (this.maskDirty) {
      if (!this.maskRaster)
        throw new Error("Texture mask requires a live WASM raster.");
      this.maskContext!.putImageData(this.maskRaster(), 0, 0);
      this.maskDirty = false;
    }
    return this.maskSurface;
  }
  draw(
    ctx: OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    backingWidth: number,
    backingHeight: number,
    render?: TextureRenderer,
  ) {
    ctx.save();
    try {
      ctx.resetTransform();
      ctx.clearRect(0, 0, backingWidth, backingHeight);
      if (width <= 0 || height <= 0) return;
      ctx.scale(backingWidth / width, backingHeight / height);
      if (render) {
        const raster = this;
        const result: unknown = render(
          ctx,
          Object.freeze({
            source: this.surface,
            get mask() {
              return raster.getMask();
            },
            width,
            height,
            textureWidth: this.width,
            textureHeight: this.height,
          }),
        );
        if (result && typeof (result as { then?: unknown }).then === "function")
          throw new TypeError("Texture render callbacks must be synchronous.");
      } else ctx.drawImage(this.surface, 0, 0, width, height);
    } finally {
      ctx.restore();
    }
  }
  dispose() {
    this.surface.width = this.surface.height = 0;
    if (this.maskSurface) this.maskSurface.width = this.maskSurface.height = 0;
    this.maskSurface = undefined;
    this.maskContext = undefined;

    this.maskRaster = undefined;
  }
}
