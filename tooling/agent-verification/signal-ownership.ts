/** Bounded source-mode correlation, without evaluating components or callbacks. */
import { getElementSource } from '../../packages/core/src/lib/element/metadata';
import type { CRCElement } from '../../packages/core/src/lib/element/types';
import { GLOBAL_STATE } from '../../packages/core/src/lib/global-state';
import { CRCPaintEntryKind } from '../../packages/core/src/lib/events/paint-entry';
import { signalRenderConsumerIdentity } from '../../packages/core/src/lib/signals/render-consumer';
import type { CRCComponentRefs, CRCInstance } from '../../packages/core/src/lib/types';

export interface SignalConsumerOwner {
  readonly componentId: number;
  readonly runtimePath: string;
  readonly runtimePathTruncated: boolean;
  readonly debugName: string;
  readonly surfaceId: number;
  readonly surfaceKind: 'root' | 'layer';
  readonly renderGeneration: number;
  readonly requestedRevision: number;
  readonly completedRevision: number;
}
interface ComponentRelation { readonly status: 'none' | 'observed' | 'outside-snapshot'; readonly componentId: number | null; }
type SourceObservation = Readonly<
  | { status: 'available'; fileName: string; lineNumber: number; columnNumber: number; provenance: 'jsx-development-callsite'; sourceMap: 'unverified' }
  | { status: 'missing' | 'not-captured' | 'invalid' | 'unreadable' | 'limit' | 'disposed' | 'stale' }
>;
export interface ComponentObservation {
  readonly layout: Readonly<{
    status: 'entry-context' | 'unavailable';
    allocation: Readonly<{ x: number; y: number; width: number; height: number }> | null;
    percentageBasis: Readonly<{ x: number; y: number; width: number; height: number }> | null;
  }>;
  readonly label: Readonly<{ value: string; matchesInSnapshot: number; uniqueness: 'unique' | 'duplicate' | 'unknown' }> | null;
  readonly source: SourceObservation;
  readonly componentParent: Readonly<ComponentRelation>;
  readonly surfaceHost: Readonly<ComponentRelation>;
  readonly componentId: number;
  readonly typeId: number;
  readonly surfaceId: number;
  readonly surfaceKind: 'root' | 'layer';
  readonly runtimePath: string;
  readonly runtimePathTruncated: boolean;
  readonly renderGeneration: number;
  readonly hasSignalConsumer: boolean;
}
const componentRecordLimit = 64;
const limits = Object.freeze({ surfaces: 64, components: 256, paintEntries: 256 });

export function createSignalOwnershipObserver(canvas?: HTMLCanvasElement) {
  const host = canvas ? new WeakRef(canvas) : undefined;
  const root = canvas ? GLOBAL_STATE.crcInstances.get(canvas) : undefined;
  const rootRef = root ? new WeakRef(root) : undefined;
  let ids = new WeakMap<CRCInstance, number>();
  let nextId = 0;
  let componentIds = new WeakMap<object, number>();
  let nextComponentId = 0;
  let disposed = false;
  let labels = new WeakMap<object, string>();
  let labeledLifetimes = new WeakSet<object>();
  let labelCount = 0;
  const handles = new Map<number, { refs: WeakRef<CRCComponentRefs<any>>; surface: WeakRef<CRCInstance> }>();
  let typeIds = new WeakMap<object, number>(); let nextTypeId = 0;
  function identifyType(value: unknown): number | null {
    if (disposed || typeof value !== 'function') return null;
    let id = typeIds.get(value);
    if (id === undefined) typeIds.set(value, id = ++nextTypeId);
    return id;
  }
  const removalRecords: Readonly<{ componentId: number; reason: 'component-disposed' }>[] = [];
  let droppedRemovals = 0;
  const removalSnapshot = () => Object.freeze({ scope: 'previous-snapshot-handles' as const, limit: 64,
    dropped: droppedRemovals, records: Object.freeze([...removalRecords]) });
  let sources = new WeakMap<object, SourceObservation>();
  let sourceCaptures = 0;
  const sourceStatus = (status: Exclude<SourceObservation['status'], 'available'>): SourceObservation => Object.freeze({ status });
  function observeSource(element: CRCElement<any>): SourceObservation {
    const source = getElementSource(element);
    return source === undefined ? sourceStatus('missing') : sources.get(source) ?? sourceStatus('not-captured');
  }
  // Explicit acquisition may run source accessors. Passive snapshots never do.
  function captureSource(element: CRCElement<any>): SourceObservation {
    if (disposed) return sourceStatus('disposed');
    const source = getElementSource(element);
    if (source === undefined) return sourceStatus('missing');
    if (!source || typeof source !== 'object') return sourceStatus('invalid');
    const cached = sources.get(source);
    if (cached) return cached;
    if (sourceCaptures >= 64) return sourceStatus('limit');
    sourceCaptures++;
    // Reserve before reading to bound reentrant acquisition too.
    sources.set(source, sourceStatus('unreadable'));
    let result: SourceObservation;
    try {
      const { fileName, lineNumber, columnNumber } = source;
      result = typeof fileName === 'string' && fileName.length > 0 && fileName.length <= 1024 &&
        Number.isSafeInteger(lineNumber) && lineNumber > 0 && Number.isSafeInteger(columnNumber) && columnNumber > 0 ?
        Object.freeze({ status: 'available', fileName, lineNumber, columnNumber, provenance: 'jsx-development-callsite', sourceMap: 'unverified' }) : sourceStatus('invalid');
    } catch { result = sourceStatus('unreadable'); }
    if (disposed) return sourceStatus('disposed');
    sources.set(source, result);
    return result;
  }
  function resolveComponent(componentId: number, renderGeneration: number) {
    const handle = handles.get(componentId);
    const refs = handle?.refs.deref(); const surface = handle?.surface.deref();
    const instance = rootRef?.deref(); const canvas = host?.deref();
    return !disposed && refs && surface && instance && canvas && !instance.mainTeardowns.closed &&
      GLOBAL_STATE.crcInstances.get(canvas) === instance && !surface.mainTeardowns.closed &&
      !refs.teardowns.closed && surface.refs.get(refs.id) === refs && refs.renderGeneration === renderGeneration ? refs : undefined;
  }
  return {
    identifyType,
    labelComponent(componentId: number, renderGeneration: number, label: string | null) {
      if (disposed) return Object.freeze({ status: 'disposed' as const });
      if (label !== null && (typeof label !== 'string' || label.length === 0 || label.length > 128)) return Object.freeze({ status: 'invalid' as const });
      const refs = resolveComponent(componentId, renderGeneration);
      if (!refs) return Object.freeze({ status: 'stale' as const });
      if (label === null) { labels.delete(refs); return Object.freeze({ status: 'cleared' as const }); }
      if (!labeledLifetimes.has(refs)) {
        if (labelCount === 64) return Object.freeze({ status: 'limit' as const });
        labeledLifetimes.add(refs); labelCount++;
      }
      labels.set(refs, label);
      return Object.freeze({ status: 'labeled' as const });
    },
    captureSource,
    captureComponentSource(componentId: number, renderGeneration: number): SourceObservation {
      if (disposed) return sourceStatus('disposed');
      const refs = resolveComponent(componentId, renderGeneration);
      if (!refs) return sourceStatus('stale');
      const descriptor = refs.element;
      const result = captureSource(descriptor);
      if (disposed) return sourceStatus('disposed');
      return resolveComponent(componentId, renderGeneration) === refs && refs.element === descriptor ? result : sourceStatus('stale');
    },
    snapshot() {
      const previousHandles = [...handles];
      handles.clear();
      const componentRecords: Readonly<ComponentObservation>[] = [];
      const relations: { parent: object | undefined; host: object | undefined }[] = [];
      const included = new Set<object>();
      const none: Readonly<ComponentRelation> = Object.freeze({ status: 'none', componentId: null });
      let componentsTruncated = false;
      const records = new Map<object, Readonly<SignalConsumerOwner>>();
      const visited = { surfaces: 0, components: 0, paintEntries: 0 };
      const instance = rootRef?.deref(); const element = host?.deref();
      let completeness: 'complete' | 'truncated' | 'unavailable' = 'complete';
      if (disposed || !instance || !element || instance.mainTeardowns.closed || GLOBAL_STATE.crcInstances.get(element) !== instance) {
        return { records, completeness: 'unavailable' as const, limits, visited: Object.freeze(visited), components: Object.freeze({ completeness: 'unavailable' as const, limit: componentRecordLimit, removals: removalSnapshot(), records: Object.freeze(componentRecords) }) };
      }
      // Only positive teardown evidence creates a tombstone. Missing, collected,
      // out-of-budget and out-of-snapshot handles do not prove removal.
      for (const [componentId, handle] of previousHandles) {
        const refs = handle.refs.deref();
        if (!refs?.teardowns.closed) continue;
        if (removalRecords.length === 64) { removalRecords.shift(); droppedRemovals++; }
        removalRecords.push(Object.freeze({ componentId, reason: 'component-disposed' }));
      }
      const queue = [instance]; const seen = new Set<CRCInstance>();
      for (let index = 0; index < queue.length; index++) {
        const surface = queue[index];
        if (seen.has(surface)) continue;
        if (seen.size >= limits.surfaces) { completeness = 'truncated'; break; }
        seen.add(surface);
        visited.surfaces++;
        if (surface.mainTeardowns.closed) continue;
        let surfaceId = ids.get(surface);
        if (surfaceId === undefined) ids.set(surface, surfaceId = ++nextId);
        for (const refs of surface.refs.values()) {
          if (visited.components >= limits.components) { completeness = 'truncated'; break; }
          visited.components++;
          if (refs.teardowns.closed) continue;
          let componentId = componentIds.get(refs);
          if (componentId === undefined) componentIds.set(refs, componentId = ++nextComponentId);
          if (componentRecords.length < componentRecordLimit) {
            included.add(refs);
            handles.set(componentId, { refs: new WeakRef(refs), surface: new WeakRef(surface) });
            relations.push({ parent: refs.parent, host: surface === instance ? undefined : surface.eventParent });
            componentRecords.push(Object.freeze({ label: labels.has(refs) ? Object.freeze({ value: labels.get(refs)!, matchesInSnapshot: 0, uniqueness: 'unknown' as const }) : null, source: observeSource(refs.element), componentParent: none, surfaceHost: none, componentId, typeId: identifyType(refs.element.type)!, surfaceId,
              surfaceKind: surface === instance ? 'root' : 'layer', runtimePath: refs.id.slice(0, 256),
              runtimePathTruncated: refs.id.length > 256, renderGeneration: refs.renderGeneration,
              hasSignalConsumer: !!refs.signalConsumer,
              layout: Object.freeze({ status: refs.layoutEntry ? 'entry-context' : 'unavailable', allocation: refs.layoutEntry?.allocation ?? null, percentageBasis: refs.layoutEntry?.percentageBasis ?? null }) }));
          } else componentsTruncated = true;
          if (!refs.signalConsumer) continue;
          const identity = signalRenderConsumerIdentity(refs.signalConsumer);
          if (!identity) continue;
          records.set(identity, Object.freeze({ componentId, runtimePath: refs.id.slice(0, 256), runtimePathTruncated: refs.id.length > 256,
            debugName: refs.signalConsumer.debugName.slice(0, 256), surfaceId,
            surfaceKind: surface === instance ? 'root' : 'layer',
            renderGeneration: surface.renderGeneration, requestedRevision: surface.requestedRenderRevision,
            completedRevision: surface.completedRenderRevision }));
        }
        for (const entry of surface.paintEntries) {
          if (visited.paintEntries >= limits.paintEntries) { completeness = 'truncated'; break; }
          visited.paintEntries++;
          if (entry.paintKind === CRCPaintEntryKind.NestedInstance) queue.push(entry.instance);
        }
      }
      const relation = (target: object | undefined): Readonly<ComponentRelation> => target === undefined ? none :
        Object.freeze(included.has(target) ? { status: 'observed', componentId: componentIds.get(target)! } :
          { status: 'outside-snapshot', componentId: null });
      const labelCounts = new Map<string, number>();
      for (const record of componentRecords) if (record.label) labelCounts.set(record.label.value, (labelCounts.get(record.label.value) ?? 0) + 1);
      const labelObservation = (label: ComponentObservation['label']): ComponentObservation['label'] => {
        if (!label) return null;
        const count = labelCounts.get(label.value)!;
        return Object.freeze({ value: label.value, matchesInSnapshot: count,
          uniqueness: count > 1 ? 'duplicate' : componentsTruncated || completeness !== 'complete' ? 'unknown' : 'unique' });
      };
      const relatedRecords = componentRecords.map((record, index) => Object.freeze({ ...record, label: labelObservation(record.label),
        componentParent: relation(relations[index].parent), surfaceHost: relation(relations[index].host) }));
      return { records, completeness, limits, visited: Object.freeze(visited), components: Object.freeze({ completeness: componentsTruncated || completeness === 'truncated' ? 'truncated' as const : 'complete' as const, limit: componentRecordLimit, removals: removalSnapshot(), records: Object.freeze(relatedRecords) }) };
    },
    dispose() { disposed = true; labels = new WeakMap(); labeledLifetimes = new WeakSet(); handles.clear(); removalRecords.length = 0; droppedRemovals = 0; ids = new WeakMap(); componentIds = new WeakMap(); typeIds = new WeakMap(); sources = new WeakMap(); },
  };
}
