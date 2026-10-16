import { GLOBAL_STATE } from "../lib/global-state.js";
import { getOptionalService } from "../lib/optional-services.js";
import { update } from "../lib/update.js";
import type { PibblInstance } from "../lib/types.js";
import type { FilterWindows } from "../lib/filter/filter-region.js";
import type { FilterBackdrop } from "./filter-executor.js";
import type { BorrowedTextureRaster } from "../lib/textures/texture-protocol.js";
import { BackdropContrastGpu } from "./backdrop-contrast-gpu.js";

const SERVICE = Symbol("pibbl.backdrop-contrast");
class BackdropContrastService {
  readonly gpu: BackdropContrastGpu;
  private readonly backdrop = new OffscreenCanvas(1, 1);
  private readonly palette = new OffscreenCanvas(2, 1);
  private revision = 0;
  private paletteRevision = 0;
  private colors = "";
  private committed = false;
  private disposed = false;
  used = false;
  constructor(private readonly instance: PibblInstance) {
    this.gpu = new BackdropContrastGpu({
      onContextRestored: () => {
        if (!this.disposed && !instance.mainTeardowns.closed)
          update(instance.canvas, undefined, true);
      },
    });
  }
  beginRender(): void {
    this.used = false;
  }
  endRender(success: boolean): void {
    if (success && this.used) {
      this.committed = true;
      return;
    }
    if (success || !this.committed) this.dispose();
  }
  apply(
    source: OffscreenCanvas,
    windows: FilterWindows,
    input: FilterBackdrop,
    colors: Readonly<{ light: string; dark: string }>,
  ): ImageBitmap {
    this.used = true;
    if (this.backdrop.width !== source.width)
      this.backdrop.width = source.width;
    if (this.backdrop.height !== source.height)
      this.backdrop.height = source.height;
    const context = this.backdrop.getContext("2d");
    if (!context)
      throw new Error("backdropContrast requires OffscreenCanvas 2D.");
    context.reset();
    context.setTransform(input.transform);
    context.drawImage(input.canvas, 0, 0);
    const colorKey = JSON.stringify([colors.light, colors.dark]);
    if (this.colors !== colorKey) {
      const palette = this.palette.getContext("2d");
      if (!palette)
        throw new Error("backdropContrast colors require OffscreenCanvas 2D.");
      palette.reset();
      palette.fillStyle = colors.light;
      palette.fillRect(0, 0, 1, 1);
      palette.fillStyle = colors.dark;
      palette.fillRect(1, 0, 1, 1);
      this.colors = colorKey;
      this.paletteRevision++;
    }
    const raster = (
      canvas: OffscreenCanvas,
      revision: number,
    ): BorrowedTextureRaster => ({
      source: canvas,
      width: canvas.width,
      height: canvas.height,
      resource: canvas,
      revision,
      placement: { mode: "stretch" },
    });
    const region = windows.source.logicalBounds;
    return this.gpu.apply(
      source,
      raster(this.backdrop, ++this.revision),
      { raster: raster(this.palette, this.paletteRevision) },
      { opacity: 1, threshold: 0, softness: 1, direction: [0, 1] },
      {
        originX: region.x,
        originY: region.y,
        density: windows.density,
        region,
      },
    );
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gpu.dispose();
    this.backdrop.width =
      this.backdrop.height =
      this.palette.width =
      this.palette.height =
        0;
    this.instance.optionalServices.delete(SERVICE);
  }
}
/** @internal Read-only ownership evidence; never creates resources. */
export function peekBackdropContrastService(
  instance: PibblInstance,
): BackdropContrastService | undefined {
  return instance.optionalServices.get(SERVICE) as
    BackdropContrastService | undefined;
}
export function processBackdropContrast(
  source: OffscreenCanvas,
  windows: FilterWindows,
  backdrop: FilterBackdrop,
  colors: Readonly<{ light: string; dark: string }>,
): ImageBitmap {
  const instance = GLOBAL_STATE.currentPibblInstance;
  if (!instance)
    throw new Error("backdropContrast requires an active Pibbl instance.");
  const service = getOptionalService(
    instance,
    SERVICE,
    () => new BackdropContrastService(instance),
  );
  try {
    return service.apply(source, windows, backdrop, colors);
  } catch (error) {
    throw new Error(
      `backdropContrast processing failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
