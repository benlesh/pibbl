import { filterBoundaryExecutor, type CustomPreparedFilter } from '../../filters/filter-executor.js';
import { GLOBAL_STATE } from '../global-state.js';
import { getOptionalService } from '../optional-services.js';
import { PIBBL_FILTER_EXECUTOR, type PibblFilter, type PibblFilterExecutor } from '../style/filter-types.js';
import type { PibblInstance } from '../types.js';
import type { FilterWindows } from '../filter/filter-region.js';

const SCRATCH = Symbol('pibbl.transition.capture');
class TransitionSurfaces {
  private surfaces: OffscreenCanvas[] = [];
  used = false;
  private committed = false;
  constructor(private readonly instance: PibblInstance) {}
  beginRender(): void { this.used = false; }
  endRender(success: boolean): void {
    if (success && this.used) { this.committed = true; return; }
    if (success || !this.committed) this.dispose();
  }
  context(index: number, width: number, height: number): OffscreenCanvasRenderingContext2D {
    const canvas = this.surfaces[index] ??= new OffscreenCanvas(width, height);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Transitions require Canvas 2D.');
    context.reset(); return context;
  }
  dispose(): void {
    for (const surface of this.surfaces) { surface.width = 0; surface.height = 0; }
    this.surfaces = []; this.instance.optionalServices.delete(SCRATCH);
  }
}
export interface CaptureFrame {
  readonly context: OffscreenCanvasRenderingContext2D;
  readonly windows: FilterWindows;
  readonly source: OffscreenCanvas;
  /** Draw in local coordinates, including any caller-applied transform. */
  drawSource(): void;
  drawTint(color: string): void;
}
export function captureTransition(draw: (frame: CaptureFrame) => void): PibblFilter {
  const executor: PibblFilterExecutor = {
    render: filterBoundaryExecutor.render,
    prepare(): CustomPreparedFilter {
      return { executor: filterBoundaryExecutor, reverseInfluence: output => ({ ...output }), process(source, windows) {
        const instance = GLOBAL_STATE.currentPibblInstance;
        if (!instance) throw new Error('Transition rendering requires an active Pibbl instance.');
        const scratch = getOptionalService(instance, SCRATCH, () => new TransitionSurfaces(instance)); scratch.used = true;
        const context = scratch.context(0, source.width, source.height);
        context.setTransform(windows.source.renderTransform);
        const bounds = windows.source.logicalBounds;
        const drawImage = (image: OffscreenCanvas) => context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
        draw({ context, windows, source, drawSource: () => drawImage(source), drawTint(color) {
          const tint = scratch.context(1, source.width, source.height);
          tint.drawImage(source, 0, 0); tint.globalCompositeOperation = 'source-in';
          tint.fillStyle = color; tint.fillRect(0, 0, source.width, source.height); drawImage(tint.canvas);
        } });
        return context.canvas.transferToImageBitmap();
      } };
    },
  };
  return Object.freeze({ [PIBBL_FILTER_EXECUTOR]: executor });
}
export interface TransitionRegion { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export function regionSnapshot(value: TransitionRegion): Readonly<TransitionRegion> {
  const region = Object.freeze({ ...value });
  for (const key of ['x', 'y', 'width', 'height'] as const) finite(region[key], `region.${key}`);
  if (region.width <= 0 || region.height <= 0) throw new RangeError('Transition region must have positive width and height.');
  return region;
}
export function finite(value: number, name: string, minimum = -Infinity): number {
  if (!Number.isFinite(value) || value < minimum) throw new RangeError(`${name} must be finite and at least ${minimum}.`);
  return value;
}
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const seededNoise = (seed: number) => (n: number) => { const v = Math.sin(n * 127.1 + seed * 31.7) * 43758.5453; return v - Math.floor(v); };
