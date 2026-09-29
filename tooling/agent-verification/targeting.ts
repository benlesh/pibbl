/** Repository-local source-mode prototype. Not a supported @crc/core entry.
 * Reads only CRC-owned fields; never walks element props, signals or user objects.
 * Native geometry probes are explicit, separate from passive snapshots.
 */
import type { CRCEventTarget } from '@crc/core';
import { GLOBAL_STATE } from '../../packages/core/src/lib/global-state.js';
import { CRCPaintEntryKind, type CRCPathPaintEntry } from '../../packages/core/src/lib/events/paint-entry.js';
import { getLegacyHitGeometry } from '../../packages/core/src/lib/events/registrations.js';
import { snapshotRealmScheduler } from '../../packages/core/src/lib/scheduler/realm-scheduler.js';

export interface TargetingGeneration {
  readonly session: number;
  readonly render: number;
  readonly requested: number;
  readonly completed: number;
}
export interface TargetingRecord {
  readonly order: number;
  readonly kind: 'path' | 'nested-surface' | 'resolver';
  readonly targetId: number | null;
  readonly clipCount: number;
  readonly fill: boolean | null;
  readonly strokeWidth: number | null;
  readonly transform: readonly number[];
}
export interface TargetingSnapshot {
  readonly schema: 'crc-targeting-prototype/1';
  readonly status: 'ready' | 'pending' | 'unavailable' | 'disposed' | 'stale-root';
  readonly generation: TargetingGeneration | null;
  readonly completeness: 'complete' | 'truncated' | 'unavailable';
  readonly totalRecords: number | null;
  readonly records: readonly TargetingRecord[];
  readonly pendingRealmWork: boolean;
  readonly visibility: 'unavailable';
  readonly coordinateSpace: 'root-logical';
  readonly recordLimit: number;
}
export interface TargetingCandidate {
  readonly order: number;
  readonly targetId: number;
  readonly outcome: 'hit' | 'geometry-miss' | 'clip-excluded' | 'inactive' | 'unsupported';
}
export interface TargetingProbe {
  readonly status: 'target' | 'miss' | 'stale' | 'unavailable' | 'unsupported' | 'truncated' | 'invalid';
  readonly generation: TargetingGeneration | null;
  readonly targetId: number | null;
  readonly candidates: readonly TargetingCandidate[];
  readonly captureMode: 'active-native-geometry';
  readonly nativeCalls: number;
  readonly pendingRealmWork: boolean;
  readonly reason: string | null;
}

const RECORD_LIMIT = 64;
const NATIVE_CALL_LIMIT = 128;
let nextSession = 0;

/** No listener, scheduler, signal-consumer, surface or callback is installed. */
export function createTargetingInspector(canvas: HTMLCanvasElement) {
  const session = ++nextSession;
  const instance = GLOBAL_STATE.crcInstances.get(canvas);
  // Retaining an inspector must not keep a removed CRC mount or Canvas alive.
  const rootRef = instance ? new WeakRef(instance) : undefined;
  const canvasRef = new WeakRef(canvas);
  let targetIds = new WeakMap<CRCEventTarget, number>();
  let nextTarget = 0;
  let disposed = false;

  function identifyTarget(target: CRCEventTarget): number {
    if (disposed) return 0;
    let id = targetIds.get(target);
    if (id === undefined) targetIds.set(target, id = ++nextTarget);
    return id;
  }

  function snapshot(): TargetingSnapshot {
    const root = rootRef?.deref();
    const host = canvasRef.deref();
    const scheduler = snapshotRealmScheduler();
    const status = disposed ? 'disposed' : !root || !host ? 'unavailable' :
      root.mainTeardowns.closed || GLOBAL_STATE.crcInstances.get(host) !== root ? 'stale-root' :
      !root.surface.snapshot || root.renderGeneration === 0 ? 'unavailable' :
      scheduler.phase !== 'idle' || root.requestedRenderRevision !== root.completedRenderRevision ? 'pending' : 'ready';
    const generation = root && status !== 'disposed' && status !== 'stale-root' ? Object.freeze({
      session, render: root.renderGeneration,
      requested: root.requestedRenderRevision, completed: root.completedRenderRevision,
    }) : null;
    const records: TargetingRecord[] = [];
    // Pending frames can contain partially updated facts: never publish these as a snapshot.
    const totalRecords = status === 'ready' ? root!.paintEntries.size : null;
    if (status === 'ready') {
      for (const entry of root!.paintEntries) {
        if (records.length === RECORD_LIMIT) break;
        const path = entry.paintKind === CRCPaintEntryKind.Path;
        const transform = entry.transform;
        records.push(Object.freeze({
          order: records.length,
          kind: path ? 'path' : entry.paintKind === CRCPaintEntryKind.NestedInstance ? 'nested-surface' : 'resolver',
          targetId: path ? identifyTarget(entry.target.publicTarget) : null,
          clipCount: entry.clippingStack.length,
          fill: path ? entry.fill : null,
          strokeWidth: path ? entry.lineInteractionWidth : null,
          transform: Object.freeze([transform.a, transform.b, transform.c, transform.d, transform.e, transform.f]),
        }));
      }
    }
    return Object.freeze({
      schema: 'crc-targeting-prototype/1', status, generation,
      completeness: totalRecords === null ? 'unavailable' : totalRecords > RECORD_LIMIT ? 'truncated' : 'complete',
      totalRecords, records: Object.freeze(records), visibility: 'unavailable',
      coordinateSpace: 'root-logical', recordLimit: RECORD_LIMIT,
      pendingRealmWork: scheduler.pendingHostFrames > 0,
    });
  }

  function probe(expected: TargetingGeneration, x: number, y: number): TargetingProbe {
    const current = snapshot();
    let nativeCalls = 0;
    const candidates: TargetingCandidate[] = [];
    const result = (status: TargetingProbe['status'], targetId: number | null = null, reason: string | null = null): TargetingProbe => Object.freeze({
      status, generation: current.generation, targetId,
      candidates: Object.freeze(candidates), captureMode: 'active-native-geometry', nativeCalls, reason, pendingRealmWork: current.pendingRealmWork,
    });
    if (!Number.isFinite(x) || !Number.isFinite(y)) return result('invalid', null, 'Point must be finite root-logical coordinates.');
    if (current.status !== 'ready') return result('unavailable', null, current.status);
    const actual = current.generation!;
    if (expected.session !== actual.session || expected.render !== actual.render ||
        expected.requested !== actual.requested || expected.completed !== actual.completed) {
      return result('stale', null, 'The mount or render generation changed; capture a new snapshot.');
    }
    if (current.completeness === 'truncated') return result('truncated', null, 'Root exceeds the 64-record query budget.');
    const root = rootRef!.deref()!;
    const host = canvasRef.deref()!;
    // Reject opaque boundaries before executing any geometry. Never call resolveLocal.
    const paths: CRCPathPaintEntry[] = [];
    let maximumCalls = 0;
    for (const entry of root.paintEntries) {
      if (entry.paintKind !== CRCPaintEntryKind.Path || getLegacyHitGeometry(entry.target)) {
        return result('unsupported', null, 'Nested surfaces, renderer resolvers and legacy geometry are outside this prototype.');
      }
      maximumCalls += entry.clippingStack.length + Number(entry.fill) + Number(entry.lineInteractionWidth > 0);
      if (maximumCalls > NATIVE_CALL_LIMIT) return result('truncated', null, 'Query exceeds the 128-native-call budget.');
      paths.push(entry);
    }
    // crc already owns this context; this does not allocate a scratch surface.
    const context = host.getContext('2d');
    if (!context) return result('unavailable', null, 'No existing Canvas 2D context.');
    let winner: number | null = null;
    context.save();
    try {
      for (let order = paths.length - 1; order >= 0; order--) {
        const entry = paths[order]!;
        const target = entry.target;
        const targetId = identifyTarget(target.publicTarget);
        let outcome: TargetingCandidate['outcome'] = 'geometry-miss';
        if (!target.live || target.owner.mainTeardowns.closed || !root.eventRoot.targets.has(target)) {
          outcome = 'inactive';
        } else {
          let clipped = false;
          for (const clip of entry.clippingStack) {
            context.setTransform(clip.transform);
            nativeCalls++;
            if (!context.isPointInPath(clip.path, x, y, clip.fillRule)) { clipped = true; break; }
          }
          if (clipped) outcome = 'clip-excluded';
          else {
            context.setTransform(entry.transform);
            let hit = false;
            if (entry.fill) {
              nativeCalls++;
              hit = context.isPointInPath(entry.path, x, y);
            }
            if (!hit && entry.lineInteractionWidth > 0) {
              context.lineWidth = entry.lineInteractionWidth;
              nativeCalls++;
              hit = context.isPointInStroke(entry.path, x, y);
            }
            if (hit) { outcome = 'hit'; winner ??= targetId; }
          }
        }
        candidates.push(Object.freeze({ order, targetId, outcome }));
      }
    } catch {
      return result('unavailable', null, 'Native geometry probe failed.');
    } finally {
      context.restore();
    }
    return result(winner === null ? 'miss' : 'target', winner);
  }

  return Object.freeze({
    snapshot, probe, identifyTarget,
    dispose() { disposed = true; targetIds = new WeakMap(); },
  });
}
