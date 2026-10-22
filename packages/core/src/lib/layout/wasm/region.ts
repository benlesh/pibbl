/// <reference types="vite/client" />
import type { FlexAllocationCache } from '../flex-allocation-cache.js';
import { readyLayoutModule } from './module.js';
import { GLOBAL_STATE } from '../../global-state.js';
import { signalGraphSnapshot } from '../../signals/graph.js';
import type { PibblComponentRefs, PibblInstance } from '../../types.js';

/** Internal build lane; deliberately no application engine selector. */
declare const __PIBBL_LAYOUT_WASM__: boolean;
const buildEnvironment = import.meta.env;
export const experimentalLayout =
  (typeof __PIBBL_LAYOUT_WASM__ !== 'undefined' && __PIBBL_LAYOUT_WASM__) ||
  buildEnvironment?.MODE === 'layout-wasm';
const counters = { lineFormations: 0, cachedMeasurements: 0, mainPlacements: 0, crossPlacements: 0, solves: 0, measuredLeaves: 0, nodeReuses: 0, nodeCreates: 0, activeNodes: 0, activeArenas: 0, activeWasmInstances: 0, wasmInstanceCreates: 0, frames: 0, allocationPasses: 0, allocationItemVisits: 0, allocationCacheHits: 0 };
export function snapshotWasmLayoutDiagnostics() {
  const signals = signalGraphSnapshot();
  return {
    ...counters,
    structureInputInvalidations: signals.structureInputInvalidations,
    layoutInputInvalidations: signals.layoutInputInvalidations,
    measurementInputInvalidations: signals.measurementInputInvalidations,
    paintInputInvalidations: signals.paintInputInvalidations,
    transformInputInvalidations: signals.transformInputInvalidations,
    interactionInputInvalidations: signals.interactionInputInvalidations,
    unknownInputInvalidations: signals.unknownInputInvalidations,
  };
}
if (experimentalLayout) {
  // Dev inspector only. Not a supported package export or signal dependency.
  Object.defineProperty(globalThis, '__PIBBL_LAYOUT_DIAGNOSTICS__', {
    configurable: true, value: snapshotWasmLayoutDiagnostics,
  });
}
interface Kernel {
  memory: WebAssembly.Memory;
  arena_create(): number;
  arena_generation(handle: number): number;
  arena_dispose(handle: number, generation: number): number;
  resize(handle: number, generation: number, count: number): number;
  solve(handle: number, generation: number, main: number, gap: number): number;
  solve_wrap(handle: number, generation: number, main: number, gap: number): number;
  place_wrap_main(handle: number, generation: number, main: number, gap: number, alignment: number, reverse: number): number;
  place_wrap_cross(handle: number, generation: number, size: number, gap: number, alignment: number, reverse: number): number;
  resize_cross(handle: number, generation: number, count: number): number;
  place_cross(handle: number, generation: number, size: number): number;
  place_main(handle: number, generation: number, main: number, gap: number, alignment: number, reverse: number): number;
  dispose(): void;
}
const rootOwners = new WeakMap<PibblInstance, RootLayoutOwner>();
class RootLayoutOwner {
  private exports: Kernel | undefined;
  private handles = new Map<number, number>();
  private teardown: (() => void) | undefined;
  constructor(private readonly mount?: PibblInstance) {
    if (mount?.mainTeardowns.closed) throw new Error('Cannot allocate layout for a disposed root.');
    this.exports = new WebAssembly.Instance(readyLayoutModule()).exports as unknown as Kernel;
    counters.activeWasmInstances++; counters.wasmInstanceCreates++;
    if (mount) {
      this.teardown = () => this.dispose();
      mount.mainTeardowns.add(this.teardown);
    }
  }
  get kernel(): Kernel {
    if (!this.exports) throw new Error('The root layout instance is disposed.');
    return this.exports;
  }
  has(handle: number, generation: number): boolean { return this.handles.get(handle) === generation && generation !== 0; }
  create(): { handle: number; generation: number } {
    const handle = this.kernel.arena_create();
    const generation = handle ? this.kernel.arena_generation(handle) : 0;
    if (!handle || !generation) throw new Error('Layout region handle allocation failed.');
    this.handles.set(handle, generation); counters.activeArenas++;
    return { handle, generation };
  }
  release(handle: number, generation: number): void {
    if (!this.has(handle, generation)) return;
    try {
      if (this.kernel.arena_dispose(handle, generation) !== 0) throw new Error('Layout region generation is stale.');
    } catch (error) {
      this.dispose(error instanceof WebAssembly.RuntimeError);
      throw error;
    } finally {
      if (this.has(handle, generation)) { this.handles.delete(handle); counters.activeArenas--; }
    }
  }
  dispose(trapped = false): void {
    const kernel = this.exports;
    if (!kernel) return;
    this.exports = undefined;
    counters.activeArenas -= this.handles.size; this.handles.clear();
    counters.activeWasmInstances--;
    if (this.mount) {
      if (rootOwners.get(this.mount) === this) rootOwners.delete(this.mount);
      if (this.teardown) this.mount.mainTeardowns.remove(this.teardown);
      this.teardown = undefined;
    }
    // A trap can leave Rust RefCell borrows locked; do not re-enter that instance.
    if (!trapped) kernel.dispose();
  }
}
function acquireRootOwner(mount?: PibblInstance): RootLayoutOwner {
  if (!mount) return new RootLayoutOwner();
  let owner = rootOwners.get(mount);
  if (!owner) { owner = new RootLayoutOwner(mount); rootOwners.set(mount, owner); }
  return owner;
}
export interface NumericFlexItem {
  baseMain: number; minMain: number; maxMain: number; paddingMain: number;
  marginMainBefore?: number; marginMainAfter?: number;
  grow: number; shrink: number; targetMain: number; receiverToken: object; layoutToken?: object;
}
export interface NumericFlexCrossItem {
  preferredCross: number; paddingCross: number; minCross: number; maxCross: number;
  marginCrossBefore?: number; marginCrossAfter?: number;
  crossAuto: boolean; alignSelf: 'auto' | 'stretch' | 'flex-start' | 'flex-end' | 'center';
}
type CrossAlignment = Exclude<NumericFlexCrossItem['alignSelf'], 'auto'>;
const alignmentCodes: Record<CrossAlignment, number> = { stretch: 0, 'flex-start': 1, 'flex-end': 2, center: 3 };
export class LayoutRegion {
  private cachedAllocation: FlexAllocationCache | undefined;
  private layoutOwner: RootLayoutOwner | undefined;
  private handle = 0;
  private generation = 0;
  constructor(private readonly mountOwner?: PibblInstance) {}
  get allocationCache(): FlexAllocationCache | undefined {
    return this.layoutOwner && !this.layoutOwner.has(this.handle, this.generation) ? undefined : this.cachedAllocation;
  }
  set allocationCache(value: FlexAllocationCache | undefined) { this.cachedAllocation = value; }
  private ensureOwner(): Kernel {
    if (this.layoutOwner && !this.layoutOwner.has(this.handle, this.generation)) this.dispose();
    if (!this.layoutOwner) {
      this.layoutOwner = acquireRootOwner(this.mountOwner);
      const region = this.layoutOwner.create();
      this.handle = region.handle; this.generation = region.generation;
    }
    return this.layoutOwner.kernel;
  }
  private fail(error: unknown): never {
    if (error instanceof WebAssembly.RuntimeError) this.layoutOwner?.dispose(true);
    this.dispose();
    throw error;
  }
  private records = new Map<object, readonly number[]>();
  private identities = new Map<object, Map<string, object>>();
  identity(type: object, key: string): object {
    let entries = this.identities.get(type);
    if (!entries) { entries = new Map(); this.identities.set(type, entries); }
    let token = entries.get(key);
    if (!token) { token = {}; entries.set(key, token); }
    return token;
  }
  private results: number[] = [];
  private main = -1;
  private wrap = false;
  private crossModeKey = "";
  private gap = -1;
  private order: object[] = [];
  private mainPlacementKey = "";
  private mainOffsets: number[] = [];
  private allocationRevision = 0;
  private crossSize = -1;
  private crossRecords: readonly (readonly number[])[] = [];
  private crossResults: readonly { outerCross: number; offset: number }[] = [];
  private readonly measurements = new Map<object, Map<string, { width: number; height: number }>>();

  private textMaximums: Map<object, { content: string; font: string; width: number }> | undefined;
  readTextMaximum(token: object, content: string, font: string): number | undefined {
    const entry = this.textMaximums?.get(token);
    return entry?.content === content && entry.font === font ? entry.width : undefined;
  }
  writeTextMaximum(token: object, content: string, font: string, width: number): void {
    const entries = this.textMaximums ??= new Map();
    if (!entries.has(token)) counters.cachedMeasurements++;
    entries.set(token, { content, font, width });
  }
  readMeasurement(token: object, key: string) {
    const entries = this.measurements.get(token), result = entries?.get(key);
    if (entries && result) { entries.delete(key); entries.set(key, result); }
    return result;
  }
  writeMeasurement(token: object, key: string, size: { width: number; height: number }): void {
    let entries = this.measurements.get(token);
    if (!entries) { entries = new Map(); this.measurements.set(token, entries); }
    if (entries.has(key)) { entries.delete(key); counters.cachedMeasurements--; }
    else if (entries.size >= 2) { entries.delete(entries.keys().next().value!); counters.cachedMeasurements--; }
    entries.set(key, { ...size }); counters.cachedMeasurements++;
  }
  private releaseMeasurements(token: object): void {
    if (this.textMaximums?.delete(token)) counters.cachedMeasurements--;
    counters.cachedMeasurements -= this.measurements.get(token)?.size ?? 0;
    this.measurements.delete(token);
  }

  solve(items: NumericFlexItem[], main: number, gap: number, wrap = false): void {
    try { this.solveRegion(items, main, gap, wrap); } catch (error) { this.fail(error); }
  }
  private solveRegion(items: NumericFlexItem[], main: number, gap: number, wrap: boolean): void {
    const kernel = this.ensureOwner();
    let changed = wrap !== this.wrap || main !== this.main || gap !== this.gap || items.length !== this.order.length;
    const pointer = kernel.resize(this.handle, this.generation, items.length);
    const view = new Float64Array(kernel.memory.buffer, pointer, items.length * 10);
    const alive = new Set<object>();
    for (const [i, item] of items.entries()) {
      const token = item.layoutToken ?? item.receiverToken;
      alive.add(token);
      const record = [item.baseMain, item.minMain, item.maxMain, item.paddingMain, item.grow, item.shrink, 0, 0, item.marginMainBefore ?? 0, item.marginMainAfter ?? 0];
      const previous = this.records.get(token);
      if (previous) counters.nodeReuses++;
      else { counters.nodeCreates++; counters.activeNodes++; }
      if (!previous || record.some((v, n) => v !== previous[n]) || this.order[i] !== token) {
        view.set(record, i * 10);
        this.records.set(token, record);
        changed = true;
      }
    }
    for (const token of this.records.keys()) if (!alive.has(token)) {
      this.records.delete(token); this.releaseMeasurements(token); counters.activeNodes--;
    }
    for (const [type, entries] of this.identities) {
      for (const [key, token] of entries) if (!alive.has(token)) entries.delete(key);
      if (entries.size === 0) this.identities.delete(type);
    }
    if (changed) {
      try {
        const status = wrap ? kernel.solve_wrap(this.handle, this.generation, main, gap) : kernel.solve(this.handle, this.generation, main, gap);
        if (status !== 0) throw new Error(`Experimental Flex WASM allocation failed (${status}); numeric overflow or no progress.`);
        // Rust scratch allocations may grow memory while solving. Never retain
        // an input view across that boundary.
        const output = new Float64Array(kernel.memory.buffer, pointer, items.length * 10);
        this.results = items.map((_, i) => output[i * 10 + 6]);
      } catch (error) { this.fail(error); }
      counters.solves++; this.allocationRevision++;
      if (wrap) counters.lineFormations++;
      this.wrap = wrap;
      this.main = main; this.gap = gap; this.order = items.map(i => i.layoutToken ?? i.receiverToken);
    }
    items.forEach((item, i) => { item.targetMain = this.results[i]; });
  }
  placeMain(main: number, gap: number, alignment: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly', reverse = false): readonly number[] {
    if (!this.layoutOwner?.has(this.handle, this.generation)) throw new Error('Experimental Flex main placement requires a solved region.');
    const kernel = this.layoutOwner.kernel;
    const code = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'].indexOf(alignment);
    const key = `${this.allocationRevision}:${main}:${gap}:${code}:${reverse ? 1 : 0}`;
    if (key !== this.mainPlacementKey) {
      try {
        const pointer = kernel.resize(this.handle, this.generation, this.order.length);
        const status = this.wrap ? kernel.place_wrap_main(this.handle, this.generation, main, gap, code, reverse ? 1 : 0) : kernel.place_main(this.handle, this.generation, main, gap, code, reverse ? 1 : 0);
        if (status !== 0) throw new Error(`Experimental Flex WASM main placement failed (${status}); nonfinite geometry.`);
        const output = new Float64Array(kernel.memory.buffer, pointer, this.order.length * 10);
        this.mainOffsets = this.order.map((_, i) => output[i * 10 + 7]);
        this.mainPlacementKey = key; counters.mainPlacements++;
      } catch (error) { this.fail(error); }
    }
    return this.mainOffsets;
  }
  placeCross(items: readonly NumericFlexCrossItem[], size: number, alignment: CrossAlignment, wrap?: { gap: number; alignContent: string; reverse?: boolean }) {
    if (!this.layoutOwner?.has(this.handle, this.generation)) throw new Error('Experimental Flex cross placement requires a solved region.');
    const kernel = this.layoutOwner.kernel;
    const records = items.map(item => [item.preferredCross, item.paddingCross, item.minCross, item.maxCross,
      item.crossAuto ? 1 : 0, alignmentCodes[item.alignSelf === 'auto' ? alignment : item.alignSelf], 0, 0, item.marginCrossBefore ?? 0, item.marginCrossAfter ?? 0]);
    const code = wrap ? ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch'].indexOf(wrap.alignContent) : -1;
    const modeKey = wrap ? `${this.allocationRevision}:${wrap.gap}:${code}:${wrap.reverse ? 1 : 0}` : "nowrap";
    const changed = modeKey !== this.crossModeKey || size !== this.crossSize || records.length !== this.crossRecords.length ||
      records.some((record, i) => record.some((value, j) => value !== this.crossRecords[i]?.[j]));
    if (changed) {
      try {
        const pointer = kernel.resize_cross(this.handle, this.generation, records.length);
        const input = new Float64Array(kernel.memory.buffer, pointer, records.length * 10);
        records.forEach((record, i) => input.set(record, i * 10));
        const status = wrap ? kernel.place_wrap_cross(this.handle, this.generation, size, wrap.gap, code, wrap.reverse ? 1 : 0) : kernel.place_cross(this.handle, this.generation, size);
        if (status !== 0) throw new Error(`Experimental Flex WASM cross placement failed (${status}); invalid or nonfinite geometry.`);
        const output = new Float64Array(kernel.memory.buffer, pointer, records.length * 10);
        this.crossResults = records.map((_, i) => ({ outerCross: output[i * 10 + 6], offset: output[i * 10 + 7] }));
        this.crossRecords = records; this.crossSize = size; this.crossModeKey = modeKey;
        counters.crossPlacements++;
      } catch (error) { this.fail(error); }
    }
    return this.crossResults;
  }
  dispose(): void {
    this.allocationCache = undefined;
    const owner = this.layoutOwner, handle = this.handle, generation = this.generation;
    this.layoutOwner = undefined; this.handle = 0; this.generation = 0;
    counters.activeNodes -= this.records.size;
    for (const token of this.measurements.keys()) this.releaseMeasurements(token);
    if (this.textMaximums) for (const token of this.textMaximums.keys()) this.releaseMeasurements(token);
    this.textMaximums = undefined;
    this.records.clear(); this.identities.clear(); this.results = []; this.order = []; this.main = -1; this.gap = -1;
    this.mainPlacementKey = ""; this.mainOffsets = [];
    this.crossRecords = []; this.crossResults = []; this.crossSize = -1; this.crossModeKey = ""; this.wrap = false;
    if (owner) { try { owner.release(handle, generation); } finally { if (!this.mountOwner) owner.dispose(); } }
  }
}
const regions = new WeakMap<PibblComponentRefs<any>, LayoutRegion>();
const lastFrames = new WeakMap<object, object>();
export function mountedLayoutRegion(): LayoutRegion | undefined {
  const refs = GLOBAL_STATE.componentRefs;
  if (!refs) return undefined;
  const owner = GLOBAL_STATE.currentPibblInstance;
  const frame = GLOBAL_STATE.frameSnapshot;
  if (owner && frame && lastFrames.get(owner) !== frame) { lastFrames.set(owner, frame); counters.frames++; }
  let region = regions.get(refs);
  if (!region) {
    region = new LayoutRegion(owner?.interactionRoot ?? owner); regions.set(refs, region);
    refs.teardowns.add(() => { region!.dispose(); regions.delete(refs); });
  }
  return region;
}
export function recordWasmMeasurement(): void { counters.measuredLeaves++; }

export function recordWasmAllocationPass(): void { counters.allocationPasses++; }
export function recordWasmAllocationItem(): void { counters.allocationItemVisits++; }
export function recordWasmAllocationCacheHit(): void { counters.allocationCacheHits++; }
