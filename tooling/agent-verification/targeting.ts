import type { CRCInstance, CRCClippingStackEntry } from '../../packages/core/src/lib/types.js';
/** Repository-local source-mode prototype. Not a supported @crc/core entry.
 * Reads only CRC-owned fields; never walks element props, signals or user objects.
 * Native geometry probes are explicit, separate from passive snapshots.
 */
import type { CRCEventTarget } from '@crc/core';
import { CRCFocusManager } from '../../packages/core/src/lib/focus/focus-manager.js';
import { GLOBAL_STATE } from '../../packages/core/src/lib/global-state.js';
import { CRCPaintEntryKind, type CRCPaintEntry, type CRCPathPaintEntry } from '../../packages/core/src/lib/events/paint-entry.js';
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
  readonly surfacePath: readonly number[];
  readonly clipCount: number;
  readonly clips: readonly TargetingExclusion[];
  readonly fill: boolean | null;
  /** Hit-test band width; does not describe painted stroke width or paint bounds. */
  readonly strokeInteractionWidth: number | null;
  readonly transform: readonly number[];
}
export interface PointerCaptureObservation {
  readonly scope: 'canvas-logical-owners';
  readonly completeness: 'complete' | 'truncated' | 'unavailable';
  readonly nativeActivation: 'unavailable';
  readonly externalRendererCapture: 'unavailable';
  readonly records: readonly Readonly<{ pointerId: number; targetId: number; live: boolean }>[];
}
export interface FocusObservation {
  readonly boundsSemantics: Readonly<{
    coordinateSpace: 'root-logical';
    representation: 'axis-aligned-envelope';
    source: 'navigation-metadata';
    paintedGeometryRelation: 'unknown';
    hitGeometryRelation: 'unknown';
  }>;
  readonly status: 'ready' | 'unconfigured' | 'unavailable';
  readonly nativeFocus: 'canvas' | 'other' | 'none';
  readonly nativeScope: 'owner-document';
  readonly targetId: number | null;
  readonly visible: boolean | null;
  readonly completeness: 'complete' | 'truncated' | 'unavailable';
  readonly records: readonly Readonly<{ targetId: number; sourceIndex: number; bounds: Readonly<{ x: number; y: number; width: number; height: number }> | null }>[];
}
export interface SurfaceObservation {
  readonly status: 'available' | 'unavailable';
  readonly scope: 'committed-root-surface';
  readonly hostGeometry: 'unavailable';
  readonly geometry: Readonly<{
    configuredPixelRatio: 'device' | number | null;
    mode: 'fixed' | 'responsive' | 'layer';
    fit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
    logical: Readonly<{ width: number; height: number }>;
    cssContent: Readonly<{ width: number; height: number }>;
    backing: Readonly<{ width: number; height: number }>;
    backingPerCss: Readonly<{ x: number; y: number }>;
    backingPerLogical: Readonly<{ x: number; y: number }>;
    logicalToBacking: readonly number[];
    backingToLogical: readonly number[];
  }> | null;
}
export interface CoordinateConversion {
  readonly status: 'mapped' | 'invalid' | 'unsupported' | 'unavailable' | 'stale';
  readonly generation: TargetingGeneration | null;
  readonly value: Readonly<{ x: number; y: number }> | null;
  readonly pendingRealmWork: boolean;
  readonly reason: string | null;
}
export interface TargetingSnapshot {
  readonly surface: SurfaceObservation;
  readonly focus: FocusObservation;
  readonly pointerCapture: PointerCaptureObservation;
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
/** Identifies tested committed geometry, not the source component that declared it. */
export interface TargetingExclusion {
  readonly kind: 'clip' | 'surface-bounds';
  readonly entryOrder: number;
  readonly stackIndex: number | null;
  readonly transform: readonly number[];
  readonly fillRule: CanvasFillRule;
  /** Surface where this constraint was captured, identified by ancestor entries. */
  readonly surfacePath: readonly number[];
  readonly coordinateSpace: 'clip-local-to-root-logical';
  readonly localToSurface: readonly number[];
  readonly geometry: 'opaque-path';
}
interface ObservedClip extends CRCClippingStackEntry {
  readonly evidence: TargetingExclusion;
}
export interface TargetingCandidate {
  readonly order: number;
  readonly targetId: number;
  readonly exclusion: TargetingExclusion | null;
  /** Unclipped hit geometry at this point, not painted visibility or path bounds. */
  readonly geometry: 'hit' | 'miss' | 'not-tested';
  readonly outcome: 'hit' | 'geometry-miss' | 'clip-excluded' | 'inactive' | 'unsupported';
}
export interface TargetingProbe {
  readonly routing: 'geometry-only';
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
const CLIP_REFERENCE_LIMIT = 128;
let nextSession = 0;

/** Ephemeral traversal: all records and native-call budgets include descendants. */
function collectEntries(root: CRCInstance) {
  const entries: { entry: CRCPaintEntry; transform: DOMMatrix; clips: readonly ObservedClip[]; surfacePath: readonly number[] }[] = [];
  let truncated = false;
  let clipReferences = 0;
  let pending = false;
  const walk = (owner: CRCInstance, parent: DOMMatrix, inherited: readonly ObservedClip[], surfacePath: readonly number[]) => {
    if (owner.mainTeardowns.closed) return;
    if (owner.requestedRenderRevision !== owner.completedRenderRevision) pending = true;
    for (const entry of owner.paintEntries) {
      if (entries.length >= RECORD_LIMIT || surfacePath.length > 16) { truncated = true; return; }
      const clipCount = inherited.length + entry.clippingStack.length;
      if (clipReferences + clipCount > CLIP_REFERENCE_LIMIT) { truncated = true; return; }
      clipReferences += clipCount;
      const transform = parent.multiply(entry.transform);
      const order = entries.length;
      const describe = (kind: TargetingExclusion['kind'], matrix: DOMMatrix, local: DOMMatrix, fillRule: CanvasFillRule, stackIndex: number | null): TargetingExclusion => Object.freeze({
        kind, entryOrder: order, stackIndex, fillRule,
        surfacePath: Object.freeze([...surfacePath]), coordinateSpace: 'clip-local-to-root-logical', geometry: 'opaque-path',
        localToSurface: Object.freeze([local.a, local.b, local.c, local.d, local.e, local.f]),
        transform: Object.freeze([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]),
      });
      const clips = [...inherited, ...entry.clippingStack.map((clip, index) => {
        const clipTransform = parent.multiply(clip.transform);
        return { ...clip, transform: clipTransform, evidence: describe('clip', clipTransform, clip.transform, clip.fillRule, index) };
      })];
      entries.push({ entry, transform, clips, surfacePath });
      if (entry.paintKind === CRCPaintEntryKind.NestedInstance) {
        walk(entry.instance, transform, [...clips, { path: entry.bounds, transform, fillRule: 'nonzero', evidence: describe('surface-bounds', transform, entry.transform, 'nonzero', null) }], [...surfacePath, order]);
        if (truncated) return;
      }
    }
  };
  walk(root, new DOMMatrix(), [], []);
  return { entries, truncated, pending };
}

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
    let status: TargetingSnapshot['status'] = disposed ? 'disposed' : !root || !host ? 'unavailable' :
      root.mainTeardowns.closed || GLOBAL_STATE.crcInstances.get(host) !== root ? 'stale-root' :
      !root.surface.snapshot || root.renderGeneration === 0 ? 'unavailable' :
      scheduler.phase !== 'idle' || root.requestedRenderRevision !== root.completedRenderRevision ? 'pending' : 'ready';
    const collected = status === 'ready' ? collectEntries(root!) : null;
    if (collected?.pending) status = 'pending';
    const generation = root && status !== 'disposed' && status !== 'stale-root' ? Object.freeze({
      session, render: root.renderGeneration,
      requested: root.requestedRenderRevision, completed: root.completedRenderRevision,
    }) : null;
    const records: TargetingRecord[] = [];
    const totalRecords = status === 'ready' && !collected!.truncated ? collected!.entries.length : null;
    if (status === 'ready') {
      for (const { entry, transform, clips, surfacePath } of collected!.entries) {
        const path = entry.paintKind === CRCPaintEntryKind.Path;
        records.push(Object.freeze({
          order: records.length,
          kind: path ? 'path' : entry.paintKind === CRCPaintEntryKind.NestedInstance ? 'nested-surface' : 'resolver',
          targetId: path ? identifyTarget(entry.target.publicTarget) : null,
          surfacePath: Object.freeze([...surfacePath]),
          clipCount: clips.length,
          clips: Object.freeze(clips.map(clip => clip.evidence)),
          fill: path ? entry.fill : null,
          strokeInteractionWidth: path ? entry.lineInteractionWidth : null,
          transform: Object.freeze([transform.a, transform.b, transform.c, transform.d, transform.e, transform.f]),
        }));
      }
    }
    const captureRecords: { pointerId: number; targetId: number; live: boolean }[] = [];
    if (status === 'ready') {
      for (const [pointerId, owner] of root!.eventRoot.pointerCaptures) {
        if (captureRecords.length >= 32) break;
        captureRecords.push(Object.freeze({ pointerId, targetId: identifyTarget(owner.publicTarget),
          live: owner.live && !owner.owner.mainTeardowns.closed && owner.owner.eventRoot === root!.eventRoot }));
      }
    }
    const pointerCapture: PointerCaptureObservation = Object.freeze({
      scope: 'canvas-logical-owners', nativeActivation: 'unavailable', externalRendererCapture: 'unavailable',
      completeness: status !== 'ready' ? 'unavailable' : root!.eventRoot.pointerCaptures.size > 32 ? 'truncated' : 'complete',
      records: Object.freeze(captureRecords),
    });
    const policy = root?.eventRoot.focusPolicy;
    const manager = status === 'ready' && policy instanceof CRCFocusManager && !policy.isDestroyed && !policy.ownerWasReleased ? policy : undefined;
    const focused = host?.ownerDocument.activeElement;
    const focusRecords = manager ? manager.candidates.slice(0, 64).map(candidate => Object.freeze({
      targetId: identifyTarget(candidate.target.publicTarget), sourceIndex: candidate.sourceIndex,
      bounds: candidate.rootBounds ? Object.freeze({ x: candidate.rootBounds.x, y: candidate.rootBounds.y, width: candidate.rootBounds.width, height: candidate.rootBounds.height }) : null,
    })) : [];
    const focus: FocusObservation = Object.freeze({
      boundsSemantics: Object.freeze({ coordinateSpace: 'root-logical', representation: 'axis-aligned-envelope', source: 'navigation-metadata', paintedGeometryRelation: 'unknown', hitGeometryRelation: 'unknown' }),
      status: manager ? 'ready' : status === 'ready' && !policy ? 'unconfigured' : 'unavailable',
      nativeFocus: focused === host ? 'canvas' : focused ? 'other' : 'none', nativeScope: 'owner-document',
      targetId: manager?.logicalFocusTarget ? identifyTarget(manager.logicalFocusTarget.publicTarget) : null,
      visible: manager ? manager.logicalFocusVisible : null,
      completeness: manager ? manager.candidates.length > 64 ? 'truncated' : 'complete' : !policy && status === 'ready' ? 'complete' : 'unavailable',
      records: Object.freeze(focusRecords),
    });
    const committed = status === 'ready' ? root!.surface.snapshot : undefined;
    const matrix = (value: DOMMatrix) => Object.freeze([value.a, value.b, value.c, value.d, value.e, value.f].map(number => number === 0 ? 0 : number));
    const surface: SurfaceObservation = Object.freeze({
      status: committed ? 'available' : 'unavailable', scope: 'committed-root-surface', hostGeometry: 'unavailable',
      geometry: committed ? Object.freeze({
        configuredPixelRatio: root!.surface.kind === 'root' ? root!.surface.config.pixelRatio : null,
        mode: committed.mode, fit: committed.fit,
        logical: Object.freeze({ width: committed.logicalWidth, height: committed.logicalHeight }),
        cssContent: Object.freeze({ width: committed.displayWidth, height: committed.displayHeight }),
        backing: Object.freeze({ width: committed.backingWidth, height: committed.backingHeight }),
        backingPerCss: Object.freeze({ x: committed.backingPixelsPerCssPixelX, y: committed.backingPixelsPerCssPixelY }),
        backingPerLogical: Object.freeze({ x: committed.backingPixelsPerLogicalUnitX, y: committed.backingPixelsPerLogicalUnitY }),
        logicalToBacking: matrix(committed.renderTransform), backingToLogical: matrix(committed.inverseRenderTransform),
      }) : null,
    });
    return Object.freeze({
      surface,
      focus,
      pointerCapture,
      schema: 'crc-targeting-prototype/1', status, generation,
      completeness: status !== 'ready' ? 'unavailable' : collected!.truncated ? 'truncated' : 'complete',
      totalRecords, records: Object.freeze(records), visibility: 'unavailable',
      coordinateSpace: 'root-logical', recordLimit: RECORD_LIMIT,
      pendingRealmWork: scheduler.pendingHostFrames > 0,
    });
  }

  function convert(expected: TargetingGeneration, from: string, to: string, value: Readonly<{ x: number; y: number }>, kind: 'point' | 'vector' = 'point', entryOrder?: number): CoordinateConversion {
    const current = snapshot();
    const result = (status: CoordinateConversion['status'], mapped: CoordinateConversion['value'] = null, reason: string | null = null): CoordinateConversion => Object.freeze({
      status, generation: current.generation, value: mapped, reason, pendingRealmWork: current.pendingRealmWork,
    });
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return result('invalid', null, 'Coordinates must be finite.');
    const supported = ['root-logical', 'backing', 'css-content', 'entry-local'];
    if (!supported.includes(from) || !supported.includes(to) || (kind !== 'point' && kind !== 'vector')) return result('unsupported', null, 'Only entry-local, root-logical, backing and CSS-content points/vectors are supported.');
    const geometry = current.surface.geometry;
    if (current.status !== 'ready' || !geometry) return result('unavailable', null, current.status);
    const actual = current.generation!;
    if (expected.session !== actual.session || expected.render !== actual.render || expected.requested !== actual.requested || expected.completed !== actual.completed) return result('stale', null, 'The mount or render generation changed; capture a new snapshot.');
    let local: readonly number[] | undefined;
    if (from === 'entry-local' || to === 'entry-local') {
      if (current.completeness !== 'complete') return result('unavailable', null, 'Entry geometry is truncated.');
      if (!Number.isInteger(entryOrder) || entryOrder! < 0) return result('invalid', null, 'Entry-local conversion requires an observed entry order.');
      const record = current.records[entryOrder!];
      if (!record) return result('invalid', null, 'Entry order is outside the observed generation.');
      if (record.kind === 'resolver') return result('unsupported', null, 'External renderer subtarget coordinates are unavailable.');
      local = record.transform;
    }
    const apply = (matrix: readonly number[], x: number, y: number) => ({
      x: matrix[0] * x + matrix[2] * y + (kind === 'point' ? matrix[4] : 0),
      y: matrix[1] * x + matrix[3] * y + (kind === 'point' ? matrix[5] : 0),
    });
    let mapped = { x: value.x, y: value.y };
    if (from !== to) {
      if (from === 'entry-local') mapped = apply(local!, mapped.x, mapped.y);
      else if (from !== 'root-logical') {
        if (from === 'css-content') mapped = { x: mapped.x * geometry.backingPerCss.x, y: mapped.y * geometry.backingPerCss.y };
        mapped = apply(geometry.backingToLogical, mapped.x, mapped.y);
      }
      if (to === 'entry-local') {
        const [a, b, c, d, e, f] = local!;
        const determinant = a * d - b * c;
        if (determinant === 0 || !Number.isFinite(determinant)) return result('unsupported', null, 'Entry transform is singular or cannot be inverted with finite arithmetic.');
        mapped = apply([d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant], mapped.x, mapped.y);
      } else if (to !== 'root-logical') {
        mapped = apply(geometry.logicalToBacking, mapped.x, mapped.y);
        if (to === 'css-content') mapped = { x: mapped.x / geometry.backingPerCss.x, y: mapped.y / geometry.backingPerCss.y };
      }
    }
    if (!Number.isFinite(mapped.x) || !Number.isFinite(mapped.y)) return result('invalid', null, 'Coordinate conversion overflowed.');
    return result('mapped', Object.freeze({ x: mapped.x === 0 ? 0 : mapped.x, y: mapped.y === 0 ? 0 : mapped.y }));
  }

  function probe(expected: TargetingGeneration, x: number, y: number): TargetingProbe {
    const current = snapshot();
    let nativeCalls = 0;
    const candidates: TargetingCandidate[] = [];
    const result = (status: TargetingProbe['status'], targetId: number | null = null, reason: string | null = null): TargetingProbe => Object.freeze({
      routing: 'geometry-only', status, generation: current.generation, targetId,
      candidates: Object.freeze(candidates), captureMode: 'active-native-geometry', nativeCalls, reason, pendingRealmWork: current.pendingRealmWork,
    });
    if (!Number.isFinite(x) || !Number.isFinite(y)) return result('invalid', null, 'Point must be finite root-logical coordinates.');
    if (current.status !== 'ready') return result('unavailable', null, current.status);
    const actual = current.generation!;
    if (expected.session !== actual.session || expected.render !== actual.render ||
        expected.requested !== actual.requested || expected.completed !== actual.completed) {
      return result('stale', null, 'The mount or render generation changed; capture a new snapshot.');
    }
    if (current.completeness === 'truncated') return result('truncated', null, 'Scene exceeds the 64-record, 16-surface-depth or 128-clip-reference query budget.');
    const root = rootRef!.deref()!;
    const host = canvasRef.deref()!;
    // Reject opaque boundaries before executing any geometry. Never call resolveLocal.
    const paths: { entry: CRCPathPaintEntry; order: number; clips: readonly ObservedClip[] }[] = [];
    let maximumCalls = 0;
    for (const [order, item] of collectEntries(root).entries.entries()) {
      const { entry, transform, clips } = item;
      if (entry.paintKind === CRCPaintEntryKind.NestedInstance) continue;
      if (entry.paintKind !== CRCPaintEntryKind.Path || getLegacyHitGeometry(entry.target)) {
        return result('unsupported', null, 'Renderer resolvers and legacy geometry are outside this prototype.');
      }
      maximumCalls += clips.length + Number(entry.fill) + Number(entry.lineInteractionWidth > 0);
      if (maximumCalls > NATIVE_CALL_LIMIT) return result('truncated', null, 'Query exceeds the 128-native-call budget.');
      paths.push({ order, clips, entry: { ...entry, transform, clippingStack: clips } });
    }
    // crc already owns this context; this does not allocate a scratch surface.
    const context = host.getContext('2d');
    if (!context) return result('unavailable', null, 'No existing Canvas 2D context.');
    let winner: number | null = null;
    context.save();
    try {
      for (let index = paths.length - 1; index >= 0; index--) {
        const { entry, order, clips } = paths[index]!;
        let exclusion: TargetingExclusion | null = null;
        const target = entry.target;
        const targetId = identifyTarget(target.publicTarget);
        let outcome: TargetingCandidate['outcome'] = 'geometry-miss';
        let geometry: TargetingCandidate['geometry'] = 'not-tested';
        if (!target.live || target.owner.mainTeardowns.closed || !root.eventRoot.targets.has(target)) {
          outcome = 'inactive';
        } else {
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
          geometry = hit ? 'hit' : 'miss';
          let clipped = false;
          for (const clip of clips) {
            context.setTransform(clip.transform);
            nativeCalls++;
            if (!context.isPointInPath(clip.path, x, y, clip.fillRule)) { clipped = true; exclusion = clip.evidence; break; }
          }
          if (clipped) outcome = 'clip-excluded';
          else if (hit) { outcome = 'hit'; winner ??= targetId; }
        }
        candidates.push(Object.freeze({ order, targetId, outcome, exclusion, geometry }));
      }
    } catch {
      return result('unavailable', null, 'Native geometry probe failed.');
    } finally {
      context.restore();
    }
    return result(winner === null ? 'miss' : 'target', winner);
  }

  return Object.freeze({
    snapshot, probe, convert, identifyTarget,
    dispose() { disposed = true; targetIds = new WeakMap(); },
  });
}
