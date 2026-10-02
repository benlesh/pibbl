import { borrowTextureRaster, type TexturePaint } from '../lib/textures/texture-protocol.js';
import { renderFilterBoundary } from '../lib/filter/render-filter-boundary.js';
import { GLOBAL_STATE, getCRCInstance } from '../lib/global-state.js';
import { getOptionalService } from '../lib/optional-services.js';
import { enterPrimitivePresentation } from '../lib/primitive-presentation.js';
import type { CRCInstance } from '../lib/types.js';
import type { CRCFilterRenderInput, PreparedCRCFilter } from '../lib/style/filter-types.js';
import { DisplacementGpu } from './displacement-gpu.js';
import { compileNativeFilters, type NativePreparedFilter } from './native-operations.js';
import { assertNativeCanvasFilter } from './native-canvas-filter.js';
import { expandDisplacementInput } from './displacement-math.js';

export interface PreparedDisplacement extends PreparedCRCFilter {
  readonly map: TexturePaint;
  readonly strength: number;
  readonly region: Readonly<{ x: number; y: number; width: number; height: number }>;
}
type Effect = PreparedDisplacement | NativePreparedFilter;
const GPU_BORROWER = Symbol('crc.displacement-borrower');
const rootServices = new WeakMap<CRCInstance, RootGpuService>();

class RootGpuService {
  readonly gpu = new DisplacementGpu();
  readonly scratch: OffscreenCanvas[] = [];
  borrowers = 0;
  target(index: number, width: number, height: number): OffscreenCanvasRenderingContext2D {
    const canvas = this.scratch[index] ??= new OffscreenCanvas(width, height);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Displacement requires an OffscreenCanvas 2D scratch target.');
    context.reset();
    return context;
  }
  dispose(): void {
    this.gpu.dispose();
    for (const canvas of this.scratch) { canvas.width = 0; canvas.height = 0; }
    this.scratch.length = 0;
  }
}

class GpuBorrower {
  used = false;
  private committed = false;
  private disposed = false;
  readonly shared: RootGpuService;
  private readonly root: CRCInstance;
  constructor(private readonly instance: CRCInstance) {
    let root = instance;
    while (root.parent) root = getCRCInstance(root.parent);
    this.root = root;
    let shared = rootServices.get(root);
    if (!shared) { shared = new RootGpuService(); rootServices.set(root, shared); }
    this.shared = shared;
    shared.borrowers++;
  }
  beginRender(): void { this.used = false; }
  endRender(success: boolean): void {
    if (success && this.used) { this.committed = true; return; }
    if (success || !this.committed) this.dispose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.instance.optionalServices.delete(GPU_BORROWER);
    if (--this.shared.borrowers === 0) {
      rootServices.delete(this.root);
      this.shared.dispose();
    }
  }
}

export function renderDisplacementBoundary(input: Readonly<CRCFilterRenderInput>, filters: readonly PreparedDisplacement[]): void {
  const effects = (filters as readonly Effect[]).filter(effect => !('map' in effect) || effect.strength !== 0);
  if (!effects.some(effect => 'map' in effect)) {
    if (effects.length) {
      renderFilterBoundary({ component: input.component, filters: effects as readonly NativePreparedFilter[], presentation: input.presentation }, input.renderSubtree);
    } else {
      const release = enterPrimitivePresentation(input.presentation);
      try { input.renderSubtree(); } finally { release(); }
    }
    return;
  }
  const bounds = effects.map(effect => 'map' in effect ? {
    executor: effect.executor,
    css: () => 'none',
    reverseInfluence: (output, density) => expandDisplacementInput(output, effect.strength, density),
  } satisfies NativePreparedFilter : effect);
  renderFilterBoundary({
    component: input.component,
    filters: bounds,
    presentation: input.presentation,
    process(source, result, windows) {
      const instance = GLOBAL_STATE.currentCRCInstance;
      if (!instance) throw new Error('Displacement requires an active CRC instance.');
      const borrower = getOptionalService(instance, GPU_BORROWER, () => new GpuBorrower(instance));
      borrower.used = true;
      const shared = borrower.shared;
      let current = source;
      let pass = 0;
      let native: NativePreparedFilter[] = [];
      const target = () => shared.target(pass++ % 2, source.width, source.height);
      const applyNative = () => {
        if (!native.length) return;
        const context = target();
        assertNativeCanvasFilter(context, compileNativeFilters(native, windows.density), input.component);
        context.drawImage(current, 0, 0);
        current = context.canvas;
        native = [];
      };
      for (const effect of effects) {
        if (!('map' in effect)) { native.push(effect); continue; }
        applyNative();
        borrowTextureRaster(effect.map, map => {
          const bitmap = shared.gpu.apply(current, map, effect.strength * windows.density, map.placement, {
            originX: windows.source.backingX / windows.density,
            originY: windows.source.backingY / windows.density,
            density: windows.density,
            region: effect.region,
          });
          try {
            const context = target();
            context.drawImage(bitmap, 0, 0);
            current = context.canvas;
          } finally { bitmap.close(); }
        });
      }
      applyNative();
      result.drawImage(current, windows.sourceToOutputX, windows.sourceToOutputY);
    },
  }, input.renderSubtree);
}
