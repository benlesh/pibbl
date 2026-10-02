import { borrowTextureRaster, type TexturePaint } from '../lib/textures/texture-protocol.js';
import { GLOBAL_STATE, getCRCInstance } from '../lib/global-state.js';
import { getOptionalService } from '../lib/optional-services.js';
import type { CRCInstance } from '../lib/types.js';
import type { FilterWindows } from '../lib/filter/filter-region.js';
import { DisplacementGpu } from './displacement-gpu.js';

const GPU_BORROWER = Symbol('crc.displacement-borrower');
const rootServices = new WeakMap<CRCInstance, RootGpuService>();

class RootGpuService {
  readonly gpu = new DisplacementGpu();
  readonly borrowers = new Set<GpuBorrower>();
  pruneMaps(): void {
    const resources = new Set<object>();
    for (const borrower of this.borrowers) for (const resource of borrower.resources) resources.add(resource);
    this.gpu.retainMaps(resources);
  }
  dispose(): void {
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
  private readonly root: CRCInstance;
  constructor(private readonly instance: CRCInstance) {
    let root = instance;
    while (root.parent) root = getCRCInstance(root.parent);
    this.root = root;
    let shared = rootServices.get(root);
    if (!shared) { shared = new RootGpuService(); rootServices.set(root, shared); }
    this.shared = shared;
    shared.borrowers.add(this);
  }
  beginRender(): void { this.used = false; this.candidates.clear(); }
  useMap(resource: object): void { this.candidates.add(resource); }
  endRender(success: boolean): void {
    if (success && this.used) {
      this.committed = true;
      this.resources = new Set(this.candidates);
      this.shared.pruneMaps();
      return;
    }
    if (success || !this.committed) this.dispose();
    else this.shared.pruneMaps();
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

export function processDisplacement(source: OffscreenCanvas, windows: FilterWindows, paint: TexturePaint, strength: number, region: Readonly<{ x: number; y: number; width: number; height: number }>): ImageBitmap {
  const instance = GLOBAL_STATE.currentCRCInstance;
  if (!instance) throw new Error('Displacement requires an active CRC instance.');
  const borrower = getOptionalService(instance, GPU_BORROWER, () => new GpuBorrower(instance));
  borrower.used = true;
  return borrowTextureRaster(paint, map => {
    borrower.useMap(map.resource);
    return borrower.shared.gpu.apply(source, map, strength * windows.density, map.placement, {
      originX: windows.source.backingX / windows.density,
      originY: windows.source.backingY / windows.density,
      density: windows.density, region,
    });
  });
}
