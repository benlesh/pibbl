import { borrowTextureRaster, type TexturePaint } from '../lib/textures/texture-protocol.js';
import { GLOBAL_STATE, getPibblInstance } from '../lib/global-state.js';
import { getOptionalService } from '../lib/optional-services.js';
import { update } from '../lib/update.js';
import type { PibblInstance } from '../lib/types.js';
import type { FilterWindows } from '../lib/filter/filter-region.js';
import { ReflectionGpu, type ReflectionLight, type ReflectionSettings } from './reflection-gpu.js';
import type { PibblReflectedLightSource } from '../lib/style/filter-types.js';
import type { CustomPreparedFilter } from './filter-executor.js';

const GPU_BORROWER = Symbol('pibbl.reflection-borrower');
const rootServices = new WeakMap<PibblInstance, RootGpuService>();

class RootGpuService {
  readonly gpu: ReflectionGpu;
  readonly borrowers = new Set<GpuBorrower>();
  private disposed = false;
  private recoveryRequested = false;
  constructor(private readonly root: PibblInstance) {
    this.gpu = new ReflectionGpu({
      onContextRestored: () => {
        if (this.disposed || this.recoveryRequested || this.root.mainTeardowns.closed) return;
        this.recoveryRequested = true;
        for (const borrower of this.borrowers) update(borrower.instance.canvas, undefined, true);
      },
    });
  }
  beginRender(): void { this.recoveryRequested = false; }
  pruneMaps(): void {
    const resources = new Set<object>();
    for (const borrower of this.borrowers) for (const resource of borrower.resources) resources.add(resource);
    this.gpu.retainMaps(resources);
  }
  dispose(): void {
    this.disposed = true;
    this.gpu.dispose();
  }
}

class GpuBorrower {
  used = false;
  resources = new Set<object>();
  private candidates = new Set<object>();
  private committed = false;
  private disposed = false;
  readonly shared: RootGpuService;
  private readonly root: PibblInstance;
  constructor(readonly instance: PibblInstance) {
    let root = instance;
    while (root.parent) root = getPibblInstance(root.parent);
    this.root = root;
    let shared = rootServices.get(root);
    if (!shared) { shared = new RootGpuService(root); rootServices.set(root, shared); }
    this.shared = shared;
    shared.borrowers.add(this);
  }
  beginRender(): void { this.shared.beginRender(); this.used = false; this.candidates.clear(); }
  useMap(resource: object): void { this.candidates.add(resource); }
  endRender(success: boolean): void {
    if (success && this.used) {
      this.committed = true;
      this.resources = new Set(this.candidates);
      this.shared.pruneMaps();
      return;
    }
    if (success || !this.committed) {
      this.dispose();
      return;
    }
    if (!this.shared.gpu.isContextLost) this.shared.pruneMaps();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.instance.optionalServices.delete(GPU_BORROWER);
    this.shared.borrowers.delete(this);
    if (this.shared.borrowers.size === 0) {
      rootServices.delete(this.root);
      this.shared.dispose();
    } else this.shared.pruneMaps();
  }
}

/** @internal Test-only read-only access; it never creates a GPU service. */
export function peekReflectionGpu(instance: PibblInstance): ReflectionGpu | undefined {
  let root = instance;
  while (root.parent) root = getPibblInstance(root.parent);
  return rootServices.get(root)?.gpu;
}

export function isReflectionImage(value: PibblReflectedLightSource): value is HTMLImageElement | ImageBitmap {
  return (typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement) ||
    (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap);
}
export function processReflection(source: OffscreenCanvas, windows: FilterWindows, paint: TexturePaint,
  light: PibblReflectedLightSource, settings: ReflectionSettings,
  region: Readonly<{x:number;y:number;width:number;height:number}>, warp?: CustomPreparedFilter['textureWarp']): ImageBitmap {
  const instance=GLOBAL_STATE.currentPibblInstance;
  if(!instance) throw new Error('Reflection requires an active Pibbl instance.');
  const borrower=getOptionalService(instance,GPU_BORROWER,()=>new GpuBorrower(instance)); borrower.used=true;
  return borrowTextureRaster(paint,map=>{
    borrower.useMap(map.resource);
    const render=(input:ReflectionLight)=>{
      const coordinates={originX:windows.source.backingX/windows.density,originY:windows.source.backingY/windows.density,density:windows.density,region};
      if(warp) return borrowTextureRaster(warp.map,raster=>{
        borrower.useMap(raster.resource);
        return borrower.shared.gpu.apply(source,map,input,settings,coordinates,{map:raster,strength:warp.strength,region:warp.region});
      });
      return borrower.shared.gpu.apply(source,map,input,settings,coordinates);
    };
    if(typeof light==='string') return render({color:light});
    if(isReflectionImage(light)) return render({image:light});
    return borrowTextureRaster(light,raster=>{borrower.useMap(raster.resource);return render({raster});});
  });
}
