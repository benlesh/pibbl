/// <reference types="vite/client" />
import { bytes } from './bytes.js';
import { GLOBAL_STATE } from '../../global-state.js';
import { signalGraphSnapshot } from '../../signals/graph.js';
import type { PibblComponentRefs } from '../../types.js';

/** Internal build lane; deliberately no application engine selector. */
declare const __PIBBL_LAYOUT_WASM__: boolean;
const buildEnvironment = import.meta.env;
export const experimentalLayout =
  (typeof __PIBBL_LAYOUT_WASM__ !== 'undefined' && __PIBBL_LAYOUT_WASM__) ||
  buildEnvironment?.MODE === 'layout-wasm';
const counters = { lineFormations: 0, cachedMeasurements: 0, mainPlacements: 0, crossPlacements: 0, solves: 0, measuredLeaves: 0, nodeReuses: 0, nodeCreates: 0, activeNodes: 0, activeArenas: 0, frames: 0 };
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
  resize(count: number): number;
  solve(main: number, gap: number): number;
  solve_wrap(main: number, gap: number): number;
  place_wrap_main(main: number, gap: number, alignment: number): number;
  place_wrap_cross(size: number, gap: number, alignment: number): number;
  resize_cross(count: number): number;
  place_cross(size: number): number;
  place_main(main: number, gap: number, alignment: number): number;
  dispose(): void;
}
let module: WebAssembly.Module | undefined;
function instantiate(): Kernel {
  module ??= new WebAssembly.Module(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
  return new WebAssembly.Instance(module).exports as unknown as Kernel;
}
export interface NumericFlexItem {
  baseMain: number; minMain: number; maxMain: number; paddingMain: number;
  grow: number; shrink: number; targetMain: number; receiverToken: object; layoutToken?: object;
}
export interface NumericFlexCrossItem {
  preferredCross: number; paddingCross: number; minCross: number; maxCross: number;
  crossAuto: boolean; alignSelf: 'auto' | 'stretch' | 'flex-start' | 'flex-end' | 'center';
}
type CrossAlignment = Exclude<NumericFlexCrossItem['alignSelf'], 'auto'>;
const alignmentCodes: Record<CrossAlignment, number> = { stretch: 0, 'flex-start': 1, 'flex-end': 2, center: 3 };
export class LayoutRegion {
  private kernel: Kernel | undefined;
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
    counters.cachedMeasurements -= this.measurements.get(token)?.size ?? 0;
    this.measurements.delete(token);
  }

  solve(items: NumericFlexItem[], main: number, gap: number, wrap = false): void {
    if (!this.kernel) { this.kernel = instantiate(); counters.activeArenas++; }
    let changed = wrap !== this.wrap || main !== this.main || gap !== this.gap || items.length !== this.order.length;
    const pointer = this.kernel.resize(items.length);
    const view = new Float64Array(this.kernel.memory.buffer, pointer, items.length * 8);
    const alive = new Set<object>();
    for (const [i, item] of items.entries()) {
      const token = item.layoutToken ?? item.receiverToken;
      alive.add(token);
      const record = [item.baseMain, item.minMain, item.maxMain, item.paddingMain, item.grow, item.shrink];
      const previous = this.records.get(token);
      if (previous) counters.nodeReuses++;
      else { counters.nodeCreates++; counters.activeNodes++; }
      if (!previous || record.some((v, n) => v !== previous[n]) || this.order[i] !== token) {
        view.set(record, i * 8);
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
        const status = wrap ? this.kernel.solve_wrap(main, gap) : this.kernel.solve(main, gap);
        if (status !== 0) throw new Error(`Experimental Flex WASM allocation failed (${status}); numeric overflow or no progress.`);
        // Rust scratch allocations may grow memory while solving. Never retain
        // an input view across that boundary.
        const output = new Float64Array(this.kernel.memory.buffer, pointer, items.length * 8);
        this.results = items.map((_, i) => output[i * 8 + 6]);
      } catch (error) {
        // A failed revision must never become a cache hit on retry.
        this.dispose();
        throw error;
      }
      counters.solves++; this.allocationRevision++;
      if (wrap) counters.lineFormations++;
      this.wrap = wrap;
      this.main = main; this.gap = gap; this.order = items.map(i => i.layoutToken ?? i.receiverToken);
    }
    items.forEach((item, i) => { item.targetMain = this.results[i]; });
  }
  placeMain(main: number, gap: number, alignment: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'): readonly number[] {
    if (!this.kernel) throw new Error('Experimental Flex main placement requires a solved region.');
    const code = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'].indexOf(alignment);
    const key = `${this.allocationRevision}:${main}:${gap}:${code}`;
    if (key !== this.mainPlacementKey) {
      try {
        const pointer = this.kernel.resize(this.order.length);
        const status = this.wrap ? this.kernel.place_wrap_main(main, gap, code) : this.kernel.place_main(main, gap, code);
        if (status !== 0) throw new Error(`Experimental Flex WASM main placement failed (${status}); nonfinite geometry.`);
        const output = new Float64Array(this.kernel.memory.buffer, pointer, this.order.length * 8);
        this.mainOffsets = this.order.map((_, i) => output[i * 8 + 7]);
        this.mainPlacementKey = key; counters.mainPlacements++;
      } catch (error) { this.dispose(); throw error; }
    }
    return this.mainOffsets;
  }
  placeCross(items: readonly NumericFlexCrossItem[], size: number, alignment: CrossAlignment, wrap?: { gap: number; alignContent: string }) {
    if (!this.kernel) throw new Error('Experimental Flex cross placement requires a solved region.');
    const records = items.map(item => [item.preferredCross, item.paddingCross, item.minCross, item.maxCross,
      item.crossAuto ? 1 : 0, alignmentCodes[item.alignSelf === 'auto' ? alignment : item.alignSelf]]);
    const code = wrap ? ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch'].indexOf(wrap.alignContent) : -1;
    const modeKey = wrap ? `${this.allocationRevision}:${wrap.gap}:${code}` : "nowrap";
    const changed = modeKey !== this.crossModeKey || size !== this.crossSize || records.length !== this.crossRecords.length ||
      records.some((record, i) => record.some((value, j) => value !== this.crossRecords[i]?.[j]));
    if (changed) {
      try {
        const pointer = this.kernel.resize_cross(records.length);
        const input = new Float64Array(this.kernel.memory.buffer, pointer, records.length * 8);
        records.forEach((record, i) => input.set(record, i * 8));
        const status = wrap ? this.kernel.place_wrap_cross(size, wrap.gap, code) : this.kernel.place_cross(size);
        if (status !== 0) throw new Error(`Experimental Flex WASM cross placement failed (${status}); invalid or nonfinite geometry.`);
        const output = new Float64Array(this.kernel.memory.buffer, pointer, records.length * 8);
        this.crossResults = records.map((_, i) => ({ outerCross: output[i * 8 + 6], offset: output[i * 8 + 7] }));
        this.crossRecords = records; this.crossSize = size; this.crossModeKey = modeKey;
        counters.crossPlacements++;
      } catch (error) { this.dispose(); throw error; }
    }
    return this.crossResults;
  }
  dispose(): void {
    if (this.kernel) { this.kernel.dispose(); this.kernel = undefined; counters.activeArenas--; }
    counters.activeNodes -= this.records.size;
    for (const token of this.measurements.keys()) this.releaseMeasurements(token);
    this.records.clear(); this.identities.clear(); this.results = []; this.order = []; this.main = -1; this.gap = -1;
    this.mainPlacementKey = ""; this.mainOffsets = [];
    this.crossRecords = []; this.crossResults = []; this.crossSize = -1; this.crossModeKey = ""; this.wrap = false;
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
    region = new LayoutRegion(); regions.set(refs, region);
    refs.teardowns.add(() => { region!.dispose(); regions.delete(refs); });
  }
  return region;
}
export function recordWasmMeasurement(): void { counters.measuredLeaves++; }
