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
  const effects=filters as readonly (PreparedDisplacement | NativePreparedFilter)[];
  renderFilterBoundary({ component: input.component, filters: [{ reverseInfluence: (output: any) => output } as any], presentation: input.presentation, process(source: OffscreenCanvas, result: OffscreenCanvasRenderingContext2D, windows: any) {
    let current=source; let native: NativePreparedFilter[]=[];
    const applyNative=() => { if(!native.length) return; const canvas=new OffscreenCanvas(current.width,current.height); const context=canvas.getContext('2d')!; assertNativeCanvasFilter(context,compileNativeFilters(native,windows.density),input.component); context.drawImage(current,0,0); current=canvas; native=[]; };
    for(const effect of effects) {
      if(!('map' in effect)) { native.push(effect); continue; }
      applyNative(); if(effect.strength===0) continue;
      borrowTextureRaster(effect.map,map=>{ gpu ??= new DisplacementGpu(); const bitmap=gpu.apply(current,map,effect.strength*windows.density); const canvas=new OffscreenCanvas(current.width,current.height); canvas.getContext('2d')!.drawImage(bitmap,0,0); bitmap.close(); current=canvas; });
    }
    applyNative(); result.drawImage(current,windows.sourceToOutputX,windows.sourceToOutputY);
  } } as any, input.renderSubtree);
}
