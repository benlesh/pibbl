import type { TexturePaint } from '../lib/textures/texture-protocol.js';
import { GLOBAL_STATE } from '../lib/global-state.js';
import { getOptionalService } from '../lib/optional-services.js';
import { enterPrimitivePresentation } from '../lib/primitive-presentation.js';
import { renderFilterBoundary } from '../lib/filter/render-filter-boundary.js';
import type { FilterWindows, PixelBounds } from '../lib/filter/filter-region.js';
import type { PibblFilterBoundaryExecutor, PreparedPibblFilter } from '../lib/style/filter-types.js';
import type { PibblInstance } from '../lib/types.js';
import { compileNativeFilters, type NativePreparedFilter } from './native-operations.js';
import { assertNativeCanvasFilter } from './native-canvas-filter.js';

/** An operation-owned pass. The shared executor knows nothing about its inputs. */
export interface CustomPreparedFilter extends PreparedPibblFilter {
  readonly reverseInfluence: (output: Readonly<PixelBounds>, density: number) => PixelBounds;
  /** Private fusion capability; no concrete GPU implementation enters this module. */
  readonly textureWarp?: Readonly<{ map: TexturePaint; strength: number; region: Readonly<{x:number;y:number;width:number;height:number}> }>;
  readonly fuseWithPrevious?: (previous: CustomPreparedFilter) => CustomPreparedFilter | undefined;
  readonly process?: (source: OffscreenCanvas, windows: FilterWindows) => ImageBitmap;
}
type Operation = NativePreparedFilter | CustomPreparedFilter;
const SCRATCH = Symbol('pibbl.filter-pass-scratch');
class PassScratch {
  private readonly surfaces: OffscreenCanvas[] = [];
  used = false;
  private committed = false;
  constructor(private readonly instance: PibblInstance) {}
  beginRender(): void { this.used = false; }
  endRender(success: boolean): void {
    if (success && this.used) { this.committed = true; return; }
    if (success || !this.committed) this.dispose();
  }
  target(index: number, width: number, height: number): OffscreenCanvasRenderingContext2D {
    const canvas = this.surfaces[index] ??= new OffscreenCanvas(width, height);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Filter passes require an OffscreenCanvas 2D scratch target.');
    context.reset();
    return context;
  }
  dispose(): void {
    for (const canvas of this.surfaces) { canvas.width = 0; canvas.height = 0; }
    this.surfaces.length = 0;
    this.instance.optionalServices.delete(SCRATCH);
  }
}

export const filterBoundaryExecutor: PibblFilterBoundaryExecutor = {
  render(input) {
    const operations: Operation[] = [];
    for (const operation of input.filters as readonly Operation[]) {
      if (!('css' in operation) && !operation.process) continue;
      const previous = operations.at(-1);
      const fused = previous && !('css' in previous) && !('css' in operation)
        ? operation.fuseWithPrevious?.(previous) : undefined;
      if (fused) operations[operations.length - 1] = fused;
      else operations.push(operation);
    }
    if (!operations.length) {
      const release = enterPrimitivePresentation(input.presentation);
      try { input.renderSubtree(); } finally { release(); }
      return;
    }
    if (operations.every((operation): operation is NativePreparedFilter => 'css' in operation)) {
      renderFilterBoundary({ component: input.component, filters: operations, presentation: input.presentation }, input.renderSubtree);
      return;
    }
    const bounds = operations.map(operation => 'css' in operation ? operation : {
      executor: filterBoundaryExecutor, css: () => 'none', reverseInfluence: operation.reverseInfluence,
    });
    renderFilterBoundary({
      component: input.component, filters: bounds, presentation: input.presentation,
      process(source, result, windows) {
        const instance = GLOBAL_STATE.currentPibblInstance;
        if (!instance) throw new Error('Filter processing requires an active Pibbl instance.');
        const scratch = getOptionalService(instance, SCRATCH, () => new PassScratch(instance));
        scratch.used = true;
        let current = source, pass = 0;
        let native: NativePreparedFilter[] = [];
        const target = () => scratch.target(pass++ % 2, source.width, source.height);
        const applyNative = () => {
          if (!native.length) return;
          const context = target();
          assertNativeCanvasFilter(context, compileNativeFilters(native, windows.density), input.component, () => {
            for (const operation of native) if (operation.onRejected) {
              assertNativeCanvasFilter(context, operation.css(windows.density), input.component, operation.onRejected);
            }
          });
          context.drawImage(current, 0, 0);
          current = context.canvas;
          native = [];
        };
        for (const operation of operations) {
          if ('css' in operation) { native.push(operation); continue; }
          applyNative();
          const bitmap = operation.process!(current, windows);
          try {
            const context = target(); context.drawImage(bitmap, 0, 0); current = context.canvas;
          } finally { bitmap.close(); }
        }
        applyNative();
        result.drawImage(current, windows.sourceToOutputX, windows.sourceToOutputY);
      },
    }, input.renderSubtree);
  },
};
