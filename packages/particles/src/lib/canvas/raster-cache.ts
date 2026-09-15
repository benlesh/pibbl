export interface CanvasOwnedRaster {
  close?(): void;
}

export interface CanvasRasterCache {
  get<T extends CanvasOwnedRaster>(
    source: object,
    key: string | number,
    create: () => T,
  ): T;
  find<T extends CanvasOwnedRaster>(
    source: object,
    key: string | number,
  ): T | undefined;
  insert<T extends CanvasOwnedRaster>(
    source: object,
    key: string | number,
    raster: T,
  ): T;
  sizeFor(source: object): number;
  readonly totalSize: number;
  dispose(): void;
}

interface CacheEntry {
  readonly raster: CanvasOwnedRaster;
  lastUsed: number;
}

interface SourceCache {
  readonly entries: Map<string | number, CacheEntry>;
}

/** A renderer-owned, deterministic LRU cache with an independent source budget. */
export function createCanvasRasterCache(
  maximumEntriesPerSource = 16,
): CanvasRasterCache {
  if (
    !Number.isInteger(maximumEntriesPerSource) ||
    maximumEntriesPerSource < 1
  ) {
    throw new RangeError(
      "CRC Canvas particle raster cache size must be a positive integer.",
    );
  }

  let clock = 0;
  let disposed = false;
  let totalSize = 0;
  const sources = new WeakMap<object, SourceCache>();
  const ownedCaches = new Set<SourceCache>();

  function requireCache(source: object): SourceCache {
    let cache = sources.get(source);
    if (cache === undefined) {
      cache = { entries: new Map() };
      sources.set(source, cache);
      ownedCaches.add(cache);
    }
    return cache;
  }

  function close(raster: CanvasOwnedRaster): void {
    raster.close?.();
  }

  function find<T extends CanvasOwnedRaster>(
    source: object,
    key: string | number,
  ): T | undefined {
    if (disposed) {
      throw new Error("CRC Canvas particle raster cache is disposed.");
    }
    const present = sources.get(source)?.entries.get(key);
    if (present === undefined) return undefined;
    present.lastUsed = ++clock;
    return present.raster as T;
  }

  function insert<T extends CanvasOwnedRaster>(
    source: object,
    key: string | number,
    raster: T,
  ): T {
    if (disposed) {
      throw new Error("CRC Canvas particle raster cache is disposed.");
    }
    const cache = requireCache(source);
    const present = cache.entries.get(key);
    if (present !== undefined) {
      present.lastUsed = ++clock;
      close(raster);
      return present.raster as T;
    }
    cache.entries.set(key, { raster, lastUsed: ++clock });
    totalSize += 1;

    if (cache.entries.size > maximumEntriesPerSource) {
      let oldestKey: string | number | undefined;
      let oldestUse = Number.POSITIVE_INFINITY;
      for (const [candidateKey, candidate] of cache.entries) {
        if (candidate.lastUsed < oldestUse) {
          oldestKey = candidateKey;
          oldestUse = candidate.lastUsed;
        }
      }
      if (oldestKey !== undefined) {
        const evicted = cache.entries.get(oldestKey)!;
        cache.entries.delete(oldestKey);
        totalSize -= 1;
        close(evicted.raster);
      }
    }
    return raster;
  }

  return {
    get<T extends CanvasOwnedRaster>(
      source: object,
      key: string | number,
      create: () => T,
    ): T {
      return find<T>(source, key) ?? insert(source, key, create());
    },

    find,

    insert,

    sizeFor(source: object): number {
      return sources.get(source)?.entries.size ?? 0;
    },

    get totalSize(): number {
      return totalSize;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const cache of ownedCaches) {
        for (const entry of cache.entries.values()) close(entry.raster);
        cache.entries.clear();
      }
      ownedCaches.clear();
      totalSize = 0;
    },
  };
}
