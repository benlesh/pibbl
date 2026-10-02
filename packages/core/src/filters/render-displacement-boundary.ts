import { borrowTextureRaster } from '../lib/textures/texture-protocol.js';
import { renderFilterBoundary } from '../lib/filter/render-filter-boundary.js';
import type { CRCFilterRenderInput, PreparedCRCFilter } from '../lib/style/filter-types.js';
import type { TexturePaint } from '../lib/textures/texture-protocol.js';
import { DisplacementGpu } from './displacement-gpu.js';
import { compileNativeFilters, type NativePreparedFilter } from './native-operations.js';
import { assertNativeCanvasFilter } from './native-canvas-filter.js';

export interface PreparedDisplacement extends PreparedCRCFilter { readonly map: TexturePaint; readonly strength: number; readonly region: Readonly<{x:number;y:number;width:number;height:number}>; }
let gpu: DisplacementGpu | undefined;
export function renderDisplacementBoundary(input: Readonly<CRCFilterRenderInput>, filters: readonly PreparedDisplacement[]): void {
  const index=filters.findIndex(filter => 'map' in filter);
  const effect=filters[index]!;
  if (effect.strength === 0) { input.renderSubtree(); return; }
  renderFilterBoundary({ component: input.component, filters: [{ reverseInfluence: (output: any) => output } as any], presentation: input.presentation, process(source: OffscreenCanvas, result: OffscreenCanvasRenderingContext2D, windows: any) {
    const before=filters.slice(0,index) as unknown as readonly NativePreparedFilter[];
    const after=filters.slice(index+1) as unknown as readonly NativePreparedFilter[];
    borrowTextureRaster(effect.map, map => {
      let gpuSource=source;
      if (before.length) {
        const canvas=new OffscreenCanvas(source.width,source.height); const context=canvas.getContext('2d')!;
        assertNativeCanvasFilter(context,compileNativeFilters(before,windows.density),input.component);
        context.drawImage(source,0,0); gpuSource=canvas;
      }
      gpu ??= new DisplacementGpu(); const bitmap=gpu.apply(gpuSource,map,effect.strength*windows.density);
      try { if(after.length) assertNativeCanvasFilter(result,compileNativeFilters(after,windows.density),input.component); result.drawImage(bitmap,windows.sourceToOutputX,windows.sourceToOutputY); } finally { bitmap.close(); }
    });
  } } as any, input.renderSubtree);
}
