import type { ComponentObservation, createSignalOwnershipObserver } from './signal-ownership';

type Components = ReturnType<ReturnType<typeof createSignalOwnershipObserver>['snapshot']>['components'];
type Change = Readonly<{ componentId: number; kind: 'added' | 'removed' | 'changed' | 'newly-observed' | 'unobserved'; fields: readonly string[] }>;

/** Only accepts the Pibbl-owned component facets supplied by the inspector. */
export function compareComponentFacts(before: Components, after: Components) {
  const changes: Change[] = [];
  const result = (status: 'ready' | 'unavailable') => Object.freeze({ status,
    completeness: status === 'unavailable' ? 'unavailable' as const : before.completeness === 'complete' && after.completeness === 'complete' ? 'complete' as const : 'partial' as const,
    limit: 128, changes: Object.freeze(changes) });
  if (before.completeness === 'unavailable' || after.completeness === 'unavailable') return result('unavailable');
  const previous = new Map(before.records.map(record => [record.componentId, record]));
  const current = new Map(after.records.map(record => [record.componentId, record]));
  const add = (componentId: number, kind: Change['kind'], fields: string[] = []) => changes.push(Object.freeze({ componentId, kind, fields: Object.freeze(fields) }));
  for (const [id, record] of previous) {
    const next = current.get(id);
    if (!next) { add(id, after.completeness === 'complete' ? 'removed' : 'unobserved'); continue; }
    const fields = changedFields(record, next);
    if (fields.length) add(id, 'changed', fields);
  }
  for (const id of current.keys()) if (!previous.has(id)) add(id, before.completeness === 'complete' ? 'added' : 'newly-observed');
  changes.sort((a, b) => a.componentId - b.componentId);
  return result('ready');
}

function changedFields(a: ComponentObservation, b: ComponentObservation): string[] {
  const fields: string[] = [];
  if (a.layout.status !== b.layout.status || ['allocation', 'percentageBasis'].some(key => {
    const left = a.layout[key as 'allocation' | 'percentageBasis'];
    const right = b.layout[key as 'allocation' | 'percentageBasis'];
    return left === null || right === null ? left !== right :
      left.x !== right.x || left.y !== right.y || left.width !== right.width || left.height !== right.height;
  })) fields.push('layout');
  for (const field of ['typeId', 'surfaceId', 'surfaceKind', 'hasSignalConsumer'] as const) if (a[field] !== b[field]) fields.push(field);
  for (const field of ['componentParent', 'surfaceHost'] as const) {
    if (a[field].status !== b[field].status || a[field].componentId !== b[field].componentId) fields.push(field);
  }
  if (a.label?.value !== b.label?.value || a.label?.uniqueness !== b.label?.uniqueness || a.label?.matchesInSnapshot !== b.label?.matchesInSnapshot) fields.push('label');
  const left = a.source; const right = b.source;
  if (left.status !== right.status || left.status === 'available' && right.status === 'available' &&
    (left.fileName !== right.fileName || left.lineNumber !== right.lineNumber || left.columnNumber !== right.columnNumber || left.provenance !== right.provenance || left.sourceMap !== right.sourceMap)) fields.push('source');
  return fields;
}
