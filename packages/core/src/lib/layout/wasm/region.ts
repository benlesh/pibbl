/// <reference types="vite/client" />
import type { PrimitiveMeasurementEntry } from '../measure.js';
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
const counters = { flowPlacements: 0, gridCellPlacements: 0, gridTrackResolutions: 0, lineFormations: 0, cachedMeasurements: 0, mainPlacements: 0, crossPlacements: 0, solves: 0, measuredLeaves: 0, nodeReuses: 0, nodeCreates: 0, activeNodes: 0, activeArenas: 0, activeWasmInstances: 0, wasmInstanceCreates: 0, frames: 0, allocationPasses: 0, allocationItemVisits: 0, allocationCacheHits: 0 };
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
  place_wrap_main_auto(handle: number, generation: number, main: number, gap: number, alignment: number, reverse: number): number;
  place_wrap_cross(handle: number, generation: number, size: number, gap: number, alignment: number, reverse: number): number;
  resize_grid(handle: number, generation: number, count: number, axis: number): number;
  resolve_grid_tracks(handle: number, generation: number, bound: number, gap: number, axis: number): number;
  resize_flow(handle: number, generation: number, count: number): number;
  place_flow(handle: number, generation: number, bound: number, gap: number, lineGap: number, wrap: number): number;
  resize_grid_cells(handle: number, generation: number, count: number): number;
  place_grid_cells(handle: number, generation: number): number;
  resize_cross(handle: number, generation: number, count: number): number;
  place_cross(handle: number, generation: number, size: number, reverse: number): number;
  resize_main_auto(handle: number, generation: number, count: number): number;
  place_main_auto(handle: number, generation: number, main: number, gap: number, alignment: number, reverse: number): number;
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
  autoMainBefore?: boolean; autoMainAfter?: boolean;
  grow: number; shrink: number; targetMain: number; receiverToken: object; layoutToken?: object;
}
export interface NumericFlexCrossItem {
  preferredCross: number; paddingCross: number; minCross: number; maxCross: number;
  marginCrossBefore?: number; marginCrossAfter?: number;
  crossAuto: boolean; alignSelf: 'auto' | 'stretch' | 'flex-start' | 'flex-end' | 'center';
}
type CrossAlignment = Exclude<NumericFlexCrossItem['alignSelf'], 'auto'>;
const alignmentCodes: Record<CrossAlignment, number> = { stretch: 0, 'flex-start': 1, 'flex-end': 2, center: 3 };
export interface NumericFlowItem { width: number; height: number; alignment: 'start' | 'center' | 'end' | 'stretch'; }
interface FlowOptions { horizontal: boolean; mainBound: number; gap: number; lineGap: number; wrap: boolean; }
interface FlowCache { options: FlowOptions; items: readonly NumericFlowItem[]; boxes: { x: number; y: number; width: number; height: number }[]; }
const flowAlignmentCodes = { start: 0, center: 1, end: 2, stretch: 3 };
export interface NumericGridCell { columnStart: number; columnSpan: number; rowStart: number; rowSpan: number; }
interface GridCellCache { revision: number; cells: readonly NumericGridCell[]; boxes: { x: number; y: number; width: number; height: number }[]; }
export type NumericGridTrack = Readonly<{ kind: 'fixed'; value: number }> | Readonly<{ kind: 'percentage' | 'fraction'; factor: number }>;
interface GridTrackCache { tracks: readonly NumericGridTrack[]; bound: number; gap: number; values: number[]; }
function sameGridTracks(a: readonly NumericGridTrack[], b: readonly NumericGridTrack[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    const left = a[index], right = b[index];
    if (left.kind !== right.kind || (left.kind === 'fixed' ? left.value : left.factor) !== (right.kind === 'fixed' ? right.value : right.factor)) return false;
  }
  return true;
}
export class LayoutRegion {
  private flowCache: FlowCache | undefined;
  placeFlow(items: readonly NumericFlowItem[], options: FlowOptions): readonly { x: number; y: number; width: number; height: number }[] {
    const kernel = this.ensureOwner(); const cached = this.flowCache, prior = cached?.options;
    let equal = prior?.horizontal === options.horizontal && prior.mainBound === options.mainBound && prior.gap === options.gap && prior.lineGap === options.lineGap && prior.wrap === options.wrap && cached!.items.length === items.length;
    if (equal) for (let index = 0; index < items.length; index++) {
      const a = cached!.items[index], b = items[index];
      if (a.width !== b.width || a.height !== b.height || a.alignment !== b.alignment) { equal = false; break; }
    }
    if (equal) return cached!.boxes;
    try {
      const pointer = kernel.resize_flow(this.handle,this.generation,items.length);
      if (!pointer && items.length) throw new Error('Flow storage allocation failed.');
      const records = new Float64Array(kernel.memory.buffer,pointer,items.length*8);
      const inputs = new Array<NumericFlowItem>(items.length);
      for (let index = 0; index < items.length; index++) {
        const item = items[index], offset = index*8;
        inputs[index] = { width: item.width, height: item.height, alignment: item.alignment };
        records[offset] = options.horizontal ? item.width : item.height;
        records[offset+1] = options.horizontal ? item.height : item.width;
        records[offset+2] = flowAlignmentCodes[item.alignment];
      }
      if (kernel.place_flow(this.handle,this.generation,options.mainBound,options.gap,options.lineGap,options.wrap ? 1 : 0) !== 0) throw new RangeError('Native Flow placement produced invalid geometry.');
      const resolved = new Float64Array(kernel.memory.buffer,pointer,items.length*8);
      const boxes = new Array<{ x: number; y: number; width: number; height: number }>(items.length);
      for (let index = 0; index < items.length; index++) {
        const offset = index*8;
        boxes[index] = options.horizontal ? { x: resolved[offset+3], y: resolved[offset+4], width: resolved[offset], height: resolved[offset+5] } : { x: resolved[offset+4], y: resolved[offset+3], width: resolved[offset+5], height: resolved[offset] };
      }
      this.flowCache = { options: { ...options }, items: inputs, boxes }; counters.flowPlacements++; return boxes;
    } catch (error) { return this.fail(error); }
  }
  private gridRevision = 0;
  private gridCells: GridCellCache | undefined;
  private gridColumns: GridTrackCache | undefined;
  private gridRows: GridTrackCache | undefined;
  resolveGridTracks(tracks: readonly NumericGridTrack[], options: { bound: number; gap: number; axis: 'columns' | 'rows' }): number[] {
    const kernel = this.ensureOwner();
    const cached = options.axis === 'columns' ? this.gridColumns : this.gridRows;
    if (cached && cached.bound === options.bound && cached.gap === options.gap && sameGridTracks(cached.tracks, tracks)) return cached.values;
    try {
      const pointer = kernel.resize_grid(this.handle, this.generation, tracks.length, options.axis === 'columns' ? 0 : 1);
      if (!pointer && tracks.length) throw new Error('Grid track storage allocation failed.');
      const records = new Float64Array(kernel.memory.buffer, pointer, tracks.length * 3);
      for (let index = 0; index < tracks.length; index++) {
        const track = tracks[index];
        records[index * 3] = track.kind === 'fixed' ? 0 : track.kind === 'percentage' ? 1 : 2;
        records[index * 3 + 1] = track.kind === 'fixed' ? track.value : track.factor;
      }
      if (kernel.resolve_grid_tracks(this.handle, this.generation, options.bound, options.gap, options.axis === 'columns' ? 0 : 1) !== 0) throw new RangeError('Grid native track resolution produced invalid geometry.');
      const resolved = new Float64Array(kernel.memory.buffer, pointer, tracks.length * 3);
      const values = new Array<number>(tracks.length);
      for (let index = 0; index < tracks.length; index++) values[index] = resolved[index * 3 + 2];
      const entry = { tracks, bound: options.bound, gap: options.gap, values };
      if (options.axis === 'columns') this.gridColumns = entry; else this.gridRows = entry;
      this.gridRevision++; counters.gridTrackResolutions++;
      return values;
    } catch (error) { return this.fail(error); }
  }
  placeGridCells(cells: readonly NumericGridCell[]): readonly { x: number; y: number; width: number; height: number }[] {
    const kernel = this.ensureOwner();
    const cached = this.gridCells;
    let equal = cached?.revision === this.gridRevision && cached.cells.length === cells.length;
    if (equal) for (let index = 0; index < cells.length; index++) {
      const a = cached!.cells[index], b = cells[index];
      if (a.columnStart !== b.columnStart || a.columnSpan !== b.columnSpan || a.rowStart !== b.rowStart || a.rowSpan !== b.rowSpan) { equal = false; break; }
    }
    if (equal) return cached!.boxes;
    try {
      if (!this.gridColumns || !this.gridRows) throw new Error('Native Grid placement requires both resolved axes.');
      const pointer = kernel.resize_grid_cells(this.handle, this.generation, cells.length);
      if (!pointer && cells.length) throw new Error('Grid cell storage allocation failed.');
      const records = new Float64Array(kernel.memory.buffer, pointer, cells.length * 8);
      const inputs = new Array<NumericGridCell>(cells.length);
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index], offset = index * 8;
        inputs[index] = { columnStart: cell.columnStart, columnSpan: cell.columnSpan, rowStart: cell.rowStart, rowSpan: cell.rowSpan };
        records[offset] = cell.columnStart - 1; records[offset+1] = cell.columnSpan;
        records[offset+2] = cell.rowStart - 1; records[offset+3] = cell.rowSpan;
      }
      if (kernel.place_grid_cells(this.handle, this.generation) !== 0) throw new RangeError('Grid native cell placement produced invalid geometry.');
      const boxes = new Array<{ x: number; y: number; width: number; height: number }>(cells.length);
      for (let index = 0; index < cells.length; index++) {
        const offset = index * 8;
        boxes[index] = { x: records[offset+4], y: records[offset+5], width: records[offset+6], height: records[offset+7] };
      }
      this.gridCells = { revision: this.gridRevision, cells: inputs, boxes }; counters.gridCellPlacements++;
      return boxes;
    } catch (error) { return this.fail(error); }
  }
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
  private readonly intrinsicMeasurements = new Map<object, Map<string, PrimitiveMeasurementEntry>>();
  readPrimitiveMeasurement(token: object, key: string): PrimitiveMeasurementEntry | undefined {
    const entries = this.intrinsicMeasurements.get(token), entry = entries?.get(key);
    if (entry) { entries!.delete(key); entries!.set(key, entry); }
    return entry;
  }
  writePrimitiveMeasurement(token: object, entry: PrimitiveMeasurementEntry): void {
    if (!this.layoutOwner?.has(this.handle, this.generation)) return;
    let entries = this.intrinsicMeasurements.get(token);
    if (!entries) { entries = new Map(); this.intrinsicMeasurements.set(token, entries); }
    if (entries.has(entry.key)) { entries.delete(entry.key); counters.cachedMeasurements--; }
    else if (entries.size >= 3) { entries.delete(entries.keys().next().value!); counters.cachedMeasurements--; }
    entries.set(entry.key, entry); counters.cachedMeasurements++;
  }
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
    counters.cachedMeasurements -= this.intrinsicMeasurements.get(token)?.size ?? 0;
    this.intrinsicMeasurements.delete(token);
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
  private mainAutoFlags: boolean[] | undefined;
  private mainAutoRevision = 0;
  placeMain(main: number, gap: number, alignment: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly', reverse = false, autoMargins?: readonly NumericFlexItem[]): readonly number[] {
    if (!this.layoutOwner?.has(this.handle, this.generation)) throw new Error('Experimental Flex main placement requires a solved region.');
    const kernel = this.layoutOwner.kernel;
    const code = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'].indexOf(alignment);
    if (autoMargins) {
      const flags = this.mainAutoFlags ??= [];
      let changed = flags.length !== autoMargins.length * 2;
      for (let index = 0; index < autoMargins.length; index++) {
        const before = autoMargins[index].autoMainBefore === true;
        const after = autoMargins[index].autoMainAfter === true;
        if (flags[index * 2] !== before || flags[index * 2 + 1] !== after) changed = true;
        flags[index * 2] = before; flags[index * 2 + 1] = after;
      }
      flags.length = autoMargins.length * 2;
      if (changed) this.mainAutoRevision++;
    } else if (this.mainAutoFlags?.length) {
      this.mainAutoFlags.length = 0; this.mainAutoRevision++;
    }
    const key = `${this.allocationRevision}:${main}:${gap}:${code}:${reverse ? 1 : 0}:${this.mainAutoRevision}`;
    if (key !== this.mainPlacementKey) {
      try {
        if (autoMargins) {
          if (autoMargins.length !== this.order.length) throw new Error('Auto margin placement requires a matching allocation.');
          const autoPointer = kernel.resize_main_auto(this.handle, this.generation, this.order.length);
          const flags = new Float64Array(kernel.memory.buffer, autoPointer, this.order.length * 2);
          for (let index = 0; index < autoMargins.length; index++) {
            flags[index * 2] = autoMargins[index].autoMainBefore ? 1 : 0;
            flags[index * 2 + 1] = autoMargins[index].autoMainAfter ? 1 : 0;
          }
        }
        const pointer = kernel.resize(this.handle, this.generation, this.order.length);
        let status: number;
        if (autoMargins) {
          status = this.wrap ? kernel.place_wrap_main_auto(this.handle, this.generation, main, gap, code, reverse ? 1 : 0) : kernel.place_main_auto(this.handle, this.generation, main, gap, code, reverse ? 1 : 0);
        } else {
          status = this.wrap ? kernel.place_wrap_main(this.handle, this.generation, main, gap, code, reverse ? 1 : 0) : kernel.place_main(this.handle, this.generation, main, gap, code, reverse ? 1 : 0);
        }
        if (status !== 0) throw new Error(`Experimental Flex WASM main placement failed (${status}); nonfinite geometry.`);
        const output = new Float64Array(kernel.memory.buffer, pointer, this.order.length * 10);
        this.mainOffsets = this.order.map((_, i) => output[i * 10 + 7]);
        this.mainPlacementKey = key; counters.mainPlacements++;
      } catch (error) { this.fail(error); }
    }
    return this.mainOffsets;
  }
  placeCross(items: readonly NumericFlexCrossItem[], size: number, alignment: CrossAlignment, options?: { reverse?: boolean; wrap?: { gap: number; alignContent: string } }) {
    const wrap = options?.wrap;
    const reverse = options?.reverse === true;
    if (!this.layoutOwner?.has(this.handle, this.generation)) throw new Error('Experimental Flex cross placement requires a solved region.');
    const kernel = this.layoutOwner.kernel;
    const records = items.map(item => [item.preferredCross, item.paddingCross, item.minCross, item.maxCross,
      item.crossAuto ? 1 : 0, alignmentCodes[item.alignSelf === 'auto' ? alignment : item.alignSelf], 0, 0, item.marginCrossBefore ?? 0, item.marginCrossAfter ?? 0]);
    const code = wrap ? ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch'].indexOf(wrap.alignContent) : -1;
    const modeKey = wrap ? `${this.allocationRevision}:${wrap.gap}:${code}:${reverse ? 1 : 0}` : `nowrap:${reverse ? 1 : 0}`;
    const changed = modeKey !== this.crossModeKey || size !== this.crossSize || records.length !== this.crossRecords.length ||
      records.some((record, i) => record.some((value, j) => value !== this.crossRecords[i]?.[j]));
    if (changed) {
      try {
        const pointer = kernel.resize_cross(this.handle, this.generation, records.length);
        const input = new Float64Array(kernel.memory.buffer, pointer, records.length * 10);
        records.forEach((record, i) => input.set(record, i * 10));
        const status = wrap ? kernel.place_wrap_cross(this.handle, this.generation, size, wrap.gap, code, reverse ? 1 : 0) : kernel.place_cross(this.handle, this.generation, size, reverse ? 1 : 0);
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
    this.flowCache = undefined;
    this.allocationCache = undefined; this.gridColumns = undefined; this.gridRows = undefined; this.gridCells = undefined; this.gridRevision = 0;
    const owner = this.layoutOwner, handle = this.handle, generation = this.generation;
    this.layoutOwner = undefined; this.handle = 0; this.generation = 0;
    counters.activeNodes -= this.records.size;
    for (const token of this.measurements.keys()) this.releaseMeasurements(token);
    for (const token of this.intrinsicMeasurements.keys()) this.releaseMeasurements(token);
    if (this.textMaximums) for (const token of this.textMaximums.keys()) this.releaseMeasurements(token);
    this.textMaximums = undefined;
    this.records.clear(); this.identities.clear(); this.results = []; this.order = []; this.main = -1; this.gap = -1;
    this.mainPlacementKey = ""; this.mainOffsets = []; this.mainAutoFlags = undefined; this.mainAutoRevision = 0;
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
/** Adopts a preflighted region without creating a second mutable owner. */
export function adoptMountedLayoutRegion(region: LayoutRegion, release: () => void): void {
  const refs = GLOBAL_STATE.componentRefs;
  if (!refs) throw new Error('Prepared layout adoption requires a mounted component.');
  const previous = regions.get(refs);
  if (previous === region) return;
  previous?.dispose();
  regions.set(refs, region);
  refs.teardowns.add(() => {
    if (regions.get(refs) !== region) return;
    regions.delete(refs); region.dispose(); release();
  });
}

export function recordWasmMeasurement(): void { counters.measuredLeaves++; }

export function recordWasmAllocationPass(): void { counters.allocationPasses++; }
export function recordWasmAllocationItem(): void { counters.allocationItemVisits++; }
export function recordWasmAllocationCacheHit(): void { counters.allocationCacheHits++; }
