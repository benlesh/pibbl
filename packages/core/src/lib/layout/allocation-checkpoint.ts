import { allocationExplicitRevision } from './allocation-revision.js';
import { checkpointGeneration, registerCheckpointDisposal, disposeAllocationCheckpoint } from './allocation-checkpoint-owner.js';
export { disposeAllocationCheckpoint, mountedAllocationCheckpointOwner } from './allocation-checkpoint-owner.js';
import { GLOBAL_STATE } from '../global-state.js';
import { clonePibblElement, isPibblElement } from '../element/create-element.js';
import { getChildPrimitiveReceiverToken, getPrimitiveReceiverToken, primitiveReceiverPath, primitiveReceiverAtPath } from '../element/metadata.js';
import type { PibblElement } from '../element/types.js';
import { isSignal, untracked, type SignalNode } from '../signals/graph.js';
import { replayReceiverInputProvision, observeReceiverInputReads, type ReceiverInputProvisionReceipt } from '../signals/input-provision.js';
import { peekPreNormalizedStyle, setPreNormalizedStyle } from '../style/resolve-dispatch.js';
import { preparedStyleValue, preparedStyleQuery, type PreparedQuery } from '../style/responsive.js';
import type { SystemStyle, PibblRenderTransaction } from '../types.js';
import { styleInputRole } from '../element/resolve-primitive-inputs.js';
import type { takePreparedChildStyle as TakePreparedStyle, stagePreparedChildStyle as StagePreparedStyle } from './prepared-root.js';
import type { prepareDirectChildStyle as PrepareStyle, childWithUsedSize as PlaceStyle } from './absolute.js';
let prepareDirectChildStyle: typeof PrepareStyle;
let childWithUsedSize: typeof PlaceStyle;
let takePreparedStyle: typeof TakePreparedStyle;
let stagePreparedStyle: typeof StagePreparedStyle;
let isDescription: (type: Function) => boolean;
let isStructural: (type: Function) => boolean;
let prepareDescription: (element: PibblElement<any>, options?: { receiverToken?: object }) => PibblElement<any>;
/** Installed lazily by the existing direct-style boundary to avoid module cycles. */
export function configureAllocationCheckpointAdapter(prepare: typeof PrepareStyle, place: typeof PlaceStyle, takePrepared: typeof TakePreparedStyle, stagePrepared: typeof StagePreparedStyle, described: (type: Function) => boolean, structural: (type: Function) => boolean, describe: typeof prepareDescription): void {
  prepareDirectChildStyle = prepare; childWithUsedSize = place; takePreparedStyle = takePrepared; stagePreparedStyle = stagePrepared; isDescription = described; isStructural = structural; prepareDescription = describe;
}
import { AllocationDependency, stageAllocationDependency } from './allocation-dependencies.js';
import { getLayoutDirection, getLogicalContainingBox } from './context.js';
import type { LayoutBox } from './types.js';

type Snapshot = readonly unknown[];
type PreparedStyle = ReturnType<typeof prepareDirectChildStyle>;
type Placement = { box: LayoutBox; element: PibblElement<any> };
interface Input {
  type: Function;
  key: string | undefined;
  raw: Snapshot;
  normalized: Snapshot;
  prepared: PreparedStyle;
  receipt: ReceiverInputProvisionReceipt;
  dependency: AllocationDependency;
  dirty: number;
  revision: number;
}
interface QueryRead {
  path: readonly number[];
  receipt: ReceiverInputProvisionReceipt;
  dependency?: AllocationDependency;
}
interface Query {
  volatile: boolean;
  index: number;
  style: Readonly<SystemStyle>;
  props: Snapshot | undefined;
  result: Snapshot;
  execute: (element: PibblElement<any>) => unknown;
  reads: QueryRead[];
}
interface Checkpoint {
  key: Snapshot;
  continuation?: Snapshot;
  programs?: Array<Snapshot | undefined>;
  inputs: Input[];
  queries: Query[];
  placements: ({ placement: Omit<Placement, 'element'>; width: number; height: number; style: Readonly<SystemStyle>; pending?: undefined } | { pending: { style: Readonly<SystemStyle>; data: unknown } })[];
}
interface Trace {
  receivers: Map<object, number>;
  inputs: Array<{ prepared?: PreparedStyle; receipt?: ReceiverInputProvisionReceipt }>;
  queries: Query[];
  valid: boolean;
}
const checkpoints = new WeakMap<object, Checkpoint>();
const styleReceipts = new WeakMap<object, ReceiverInputProvisionReceipt>();
let trace: Trace | undefined;
let measuringTrace: Trace | undefined;
// Public recursive queries do not prove the nested descriptor's normalized inputs.
// A nested refusal must reach every enclosing numeric query capture.
let untracedQueryRevision = 0;
let volatileQueryRevision = 0;
export function markVolatileAllocationQuery(): void { volatileQueryRevision++; }
export function allocationQueryVolatilityRevision(): number { return volatileQueryRevision; }
export function declineUntracedAllocationQuery(): void { untracedQueryRevision++; }
export function allocationQueryReplayRevision(): number { return untracedQueryRevision; }
const OPAQUE_PAINT = Symbol('opaque paint input');
const RESPONSIVE_INPUT = Symbol('responsive input');
const SIGNAL_STYLE_INPUT = Symbol('signal style input');
const NO_RECEIPT: ReceiverInputProvisionReceipt = Object.freeze([]);
function presentationOrMeasurement(key: string): boolean {
  const role = styleInputRole(key);
  return role === 'paint' || role === 'measurement' || role === 'interaction' || role === 'transform';
}

// Snapshot only the declared style schema and direct program values. Unknown
// prototype-bearing records/accessors decline reuse instead of invoking getters
// or trusting identity for mutable application records.
function snapshot(value: unknown, style = false, geometry = false): Snapshot | undefined {
  const result: unknown[] = [];
  const visiting = new Set<object>();
  function append(value: unknown, opaquePaint = false): boolean {
    if (style && isSignal(value)) { result.push(SIGNAL_STYLE_INPUT, value); return true; }
    if (value === null || typeof value !== 'object') { result.push(value); return true; }
    if (isSignal(value)) { result.push(value); return true; }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      if (!opaquePaint) return false;
      result.push(OPAQUE_PAINT, value); return true;
    }
    if (visiting.has(value)) return false;
    visiting.add(value);
    const keys = Reflect.ownKeys(value);
    result.push(Array.isArray(value) ? Array : Object);
    for (const key of keys) {
      if (geometry && typeof key === 'string' && presentationOrMeasurement(key)) continue;
      const field = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in field)) return false;
      result.push(key);
      // Responsive selection is reevaluated on every hit; do not read inactive patch signals.
      if (style && key === 'when') { result.push(RESPONSIVE_INPUT, field.value); continue; }
      if (!append(field.value, opaquePaint || style && typeof key === 'string' && styleInputRole(key) === 'paint')) return false;
    }
    result.push(null); visiting.delete(value); return true;
  }
  return untracked(() => append(value) ? result : undefined);
}
function same(left: Snapshot | undefined, right: Snapshot | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) if (!Object.is(left[index], right[index])) return false;
  return true;
}
function programSnapshot(element: PibblElement<any>, receiver?: object, visiting = new Set<object>()): Snapshot | undefined {
  if (visiting.has(element)) return;
  visiting.add(element);
  const result: unknown[] = [];
  const props = element.props as Record<string, unknown>;
  function children(value: unknown): boolean {
    if (Array.isArray(value)) {
      if (visiting.has(value)) return false;
      visiting.add(value); result.push(Array, value.length);
      for (let index = 0; index < value.length; index++) if (!children(value[index])) return false;
      visiting.delete(value); return true;
    }
    if (isPibblElement(value)) {
      const style = snapshot(value.props.style, true), program = programSnapshot(value, undefined, visiting);
      if (!style || !program) return false;
      result.push(value.type, value.key, style.length, ...style, program.length, ...program); return true;
    }
    if (value !== null && typeof value === 'object' && !isSignal(value) || typeof value === 'function') return false;
    result.push(value); return true;
  }
  for (const key of Object.keys(props)) {
    if (key === 'style') continue;
    const field = Object.getOwnPropertyDescriptor(props, key)!;
    if (!('value' in field)) return;
    const value = field.value;
    result.push(key);
    if (key === 'children' && isStructural(element.type)) { if (!children(value)) return; }
    else {
      if (value !== null && typeof value === 'object' && !isSignal(value)) return;
      result.push(value);
    }
  }
  if (isDescription(element.type)) {
    if (!receiver) return;
    const root = prepareDescription(element, { receiverToken: receiver });
    const rootStyle = snapshot(root.props.style, true), rootProgram = programSnapshot(root, getPrimitiveReceiverToken(root), visiting);
    if (!rootStyle || !rootProgram) return;
    result.push(root.type, root.key, rootStyle.length, ...rootStyle, rootProgram.length, ...rootProgram);
  }
  visiting.delete(element); return result;
}

/** Called at the existing normalization boundary; never sizes or places an item. */
export function recordAllocationStyle(receiver: object | undefined, prepared: PreparedStyle, receipt?: ReceiverInputProvisionReceipt): void {
  if (receipt) styleReceipts.set(prepared, receipt);
  if (!trace || !receiver || trace === measuringTrace) return;
  const index = trace.receivers.get(receiver);
  if (index !== undefined) { trace.inputs[index].prepared = prepared; trace.inputs[index].receipt = receipt ?? styleReceipts.get(prepared); }
}

/** Records actual demanded pure queries, including their selected constraints. */
export function allocationMeasurement<T>(element: PibblElement<any>, execute: (element: PibblElement<any>) => T, allowResponsive = false): T {
  const active = trace;
  if (!active || active === measuringTrace) return execute(element);
  const index = active.receivers.get(getPrimitiveReceiverToken(element)!);
  const normalized = peekPreNormalizedStyle(element);
  if (index === undefined || !normalized || normalized.query && !allowResponsive) { active.valid = false; return execute(element); }
  const props = programSnapshot(element, getPrimitiveReceiverToken(element));
  const previousMeasuring = measuringTrace;
  measuringTrace = active;
  let collected: { result: T; reads: QueryRead[] | undefined; volatile: boolean };
  try { collected = collectQueryReads(getPrimitiveReceiverToken(element)!, () => execute(element)); } finally { measuringTrace = previousMeasuring; }
  const result = collected.result;
  const numeric = snapshot(result);
  if (!numeric || !collected.reads) active.valid = false;
  else active.queries.push({ volatile: collected.volatile, index, style: normalized.style, props, result: numeric, execute, reads: collected.reads });
  return result;
}

function collectQueryReads<T>(root: object, run: () => T): { result: T; reads: QueryRead[] | undefined; volatile: boolean } {
  const revision = untracedQueryRevision, volatility = volatileQueryRevision;
  const captured = new Map<object, { path: readonly number[]; receipt: { node: SignalNode<unknown>; roles: number }[] }>();
  let valid = true;
  const result = observeReceiverInputReads((node, roles, receiver) => {
    let target = captured.get(receiver);
    if (!target) {
      const path = primitiveReceiverPath(receiver, root);
      if (!path) { valid = false; return; }
      target = { path, receipt: [] }; captured.set(receiver, target);
    }
    for (const entry of target.receipt) if (entry.node === node) { entry.roles |= roles; return; }
    target.receipt.push({ node, roles });
  }, run);
  return { result, reads: valid && revision === untracedQueryRevision ? Array.from(captured.values()) : undefined, volatile: volatility !== volatileQueryRevision };
}
function bindQueryReads(reads: QueryRead[], input: Input, transaction: PibblRenderTransaction, root: object): void {
  for (const read of reads) {
    const receiver = primitiveReceiverAtPath(transaction, root, read.path);
    if (read.path.length) {
      read.dependency ??= new AllocationDependency(roles => { input.dirty |= roles; input.revision++; });
      stageAllocationDependency(transaction, receiver, read.dependency);
    }
    replayReceiverInputProvision(transaction, receiver, read.receipt);
  }
}
function disposeQueryReads(reads: readonly QueryRead[]): void { for (const read of reads) read.dependency?.dispose(); }
function disposeCheckpoint(checkpoint: Checkpoint): void {
  for (const input of checkpoint.inputs) input.dependency.dispose();
  for (const query of checkpoint.queries) disposeQueryReads(query.reads);
}

/** A query without a replayable receiver/constraint record stays on the normal path. */
export function declineUnrecordedAllocationMeasurement(): void {
  if (trace && trace !== measuringTrace) trace.valid = false;
}

export interface AllocationCheckpointOptions<P extends Placement> {
  children: readonly PibblElement<any>[];
  content: Readonly<LayoutBox>;
  settings: unknown;
  flexMargins?: boolean;
  /** Numeric output of a current prerequisite phase, never its receiver leases. */
  continuation?: unknown;
  receiverTokens?: readonly object[];
  pending?: {
    read(index: number): { style: Readonly<SystemStyle>; data: unknown } | undefined;
    replay(index: number, style: Readonly<SystemStyle>, receiver: object, query: PreparedQuery | undefined, data: unknown): P;
  };
  calculate(): P[];
  onHit?(): void;
}

function receiverFor<P extends Placement>(options: AllocationCheckpointOptions<P>, transaction: PibblRenderTransaction, index: number): object {
  return options.receiverTokens?.[index] ?? getChildPrimitiveReceiverToken(transaction, GLOBAL_STATE.primitiveReceiverToken, index);
}

/**
 * A numeric-region checkpoint. It bypasses the actual family allocator, leaving
 * its work counters at their original call sites. Mutable input verification is
 * deliberately separate from sizing/measurement/placement visits.
 */
export function withAllocationCheckpoint<P extends Placement>(owner: object | undefined, options: AllocationCheckpointOptions<P>): P[] {
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!owner || !transaction || !GLOBAL_STATE.primitiveReceiverToken) return options.calculate();
  const { children, content } = options;
  const containing = GLOBAL_STATE.layoutStack?.length ? getLogicalContainingBox() : content;
  const key = snapshot({ content, settings: options.settings, containing, explicitRevision: allocationExplicitRevision(), direction: getLayoutDirection() }, true, true);
  if (!key) { retireOnSuccess(owner, transaction); return options.calculate(); }
  const receivers = new Map<object, number>();
  for (let index = 0; index < children.length; index++) receivers.set(receiverFor(options, transaction, index), index);
  const continuation = options.continuation === undefined ? undefined : snapshot(options.continuation);
  if (options.continuation !== undefined && !continuation) { retireOnSuccess(owner, transaction); return options.calculate(); }
  const previous = checkpoints.get(owner);
  if (previous && same(previous.key, key) && previous.inputs.length === children.length) {
    const attempted: PreparedInputAttempt[] = [];
    const placements = reuse(owner, previous, options, transaction, receivers, attempted);
    if (placements) { options.onHit?.(); return placements; }
    // A numeric miss must consume the current preparation, not resolve its
    // signals again. Existing handoffs are scoped by transaction/receiver/box.
    for (const input of attempted) {
      replayReceiverInputProvision(transaction, input.receiver, input.receipt);
      stagePreparedStyle(children[input.index], input.receiver, content, input.prepared);
    }
  }
  const active: Trace = { receivers, inputs: children.map(() => ({})), queries: [], valid: true };
  const outer = trace; trace = active;
  let placements: P[];
  try { placements = options.calculate(); } finally { trace = outer; }
  if (!active.valid || placements.length !== children.length) { retireOnSuccess(owner, transaction); return placements; }
  const inputs: Input[] = [];
  for (const [receiver, index] of receivers) {
    const prepared = active.inputs[index].prepared;
    const raw = snapshot(children[index].props.style, true);
    const normalized = prepared && snapshot(preparedStyleValue(prepared), false, true);
    if (!prepared || !raw || !normalized || !options.pending?.read(index) && !peekPreNormalizedStyle(placements[index].element)) {
      for (const input of inputs) input.dependency.dispose();
      retireOnSuccess(owner, transaction);
      return placements;
    }
    const input: Input = { type: children[index].type, key: children[index].key, raw, normalized, prepared, receipt: active.inputs[index].receipt ?? NO_RECEIPT,
      dirty: 0, revision: 0, dependency: undefined! };
    input.dependency = new AllocationDependency(roles => { input.dirty |= roles; input.revision++; });
    inputs.push(input);
    stageAllocationDependency(transaction, receiver, input.dependency);
  }
  for (const query of active.queries) bindQueryReads(query.reads, inputs[query.index], transaction, receiverFor(options, transaction, query.index));
  const generation = checkpointGeneration(owner);
  const numericPlacements = placements.map((value, index) => {
    const pending = options.pending?.read(index);
    if (pending) return { pending: { style: { ...pending.style }, data: pending.data } };
    const { element, ...placement } = value;
    const allocated = peekPreNormalizedStyle(element)!.style as { width: number; height: number };
    return { placement: { ...placement, box: { ...placement.box } }, width: allocated.width, height: allocated.height, style: { ...peekPreNormalizedStyle(element)!.style } };
  });
  const programs = continuation && children.map((child, index) => programSnapshot(child, receiverFor(options, transaction, index)));
  const next: Checkpoint = { key, inputs, queries: active.queries, placements: numericPlacements, continuation, programs };
  transaction.onFinish(success => {
    if (!success || (checkpointGeneration(owner)) !== generation) { disposeCheckpoint(next); return; }
    const old = checkpoints.get(owner);
    if (old) disposeCheckpoint(old);
    checkpoints.set(owner, next);
    registerCheckpointDisposal(owner, () => { disposeCheckpoint(next); if (checkpoints.get(owner) === next) checkpoints.delete(owner); });
  });
  return placements;
}

function retireOnSuccess(owner: object, transaction: PibblRenderTransaction): void {
  const previous = checkpoints.get(owner);
  if (!previous) return;
  transaction.onFinish(success => { if (success && checkpoints.get(owner) === previous) disposeAllocationCheckpoint(owner); });
}

interface PreparedInputAttempt { index: number; receiver: object; prepared: PreparedStyle; receipt: ReceiverInputProvisionReceipt; }

function reuse<P extends Placement>(owner: object, checkpoint: Checkpoint, options: AllocationCheckpointOptions<P>, transaction: PibblRenderTransaction, receivers: Map<object, number>, attempted: PreparedInputAttempt[]): P[] | undefined {
  const continuation = options.continuation === undefined ? undefined : snapshot(options.continuation);
  if (continuation && !same(continuation, checkpoint.continuation)) return;
  // An absent stage means the upstream contribution was not demanded this time.
  // Reuse only while its original input program and dependencies remain clean.
  if (checkpoint.continuation && !continuation) {
    for (const [receiver, index] of receivers) {
      const program = programSnapshot(options.children[index], receiver);
      if (checkpoint.inputs[index].dirty || program?.includes(SIGNAL_STYLE_INPUT) || !same(program, checkpoint.programs?.[index])) return;
    }
  }
  const prepared: PreparedStyle[] = [];
  const rawSnapshots: Snapshot[] = [];
  const styleReads: ReceiverInputProvisionReceipt[] = [];
  const revisions: number[] = [];
  const changed = new Set<number>();
  for (const [receiver, index] of receivers) {
    const child = options.children[index], input = checkpoint.inputs[index];
    if (child.type !== input.type || child.key !== input.key) return;
    const raw = snapshot(child.props.style, true);
    if (!raw) return;
    const staged = takePreparedStyle(child, receiver, options.content);
    let current = staged ?? input.prepared;
    let geometryChanged = false;
    if (staged || raw.includes(OPAQUE_PAINT) || raw.includes(RESPONSIVE_INPUT) || raw.includes(SIGNAL_STYLE_INPUT) || preparedStyleQuery(input.prepared) || isDescription(child.type) || !same(raw, input.raw) || (input.dirty & (1 | 2 | 64))) {
      current = staged ?? prepareDirectChildStyle(child, receiver, options.content, options.flexMargins);
      geometryChanged = !same(snapshot(preparedStyleValue(current), false, true), input.normalized);
      if (!same(snapshot(preparedStyleValue(current)), snapshot(preparedStyleValue(input.prepared))) || !same(snapshot(preparedStyleQuery(current)), snapshot(preparedStyleQuery(input.prepared)))) changed.add(index);
    }
    attempted.push({ index, receiver, prepared: current, receipt: styleReceipts.get(current) ?? input.receipt });
    if (geometryChanged) return;
    prepared.push(current); rawSnapshots.push(raw); revisions.push(input.revision);
    styleReads.push(styleReceipts.get(current) ?? input.receipt);
  }
  // Query order is the allocator's original demand order. A changed contribution
  // aborts reuse immediately, so width-dependent later queries run only after a
  // new allocation has selected their new constraints.
  const nextResults: Snapshot[] = [];
  const queryProps: Array<Snapshot | undefined> = [];
  const queryReads: QueryRead[][] = [];
  const queryVolatility: boolean[] = [];
  for (const query of checkpoint.queries) {
    const input = checkpoint.inputs[query.index], child = options.children[query.index];
    const props = programSnapshot(child, receiverFor(options, transaction, query.index));
    queryProps.push(props);
    // Unknown model/getter/cyclic props cannot prove unchanged input. Execute
    // the current pure provider on every admitted render and compare its output.
    if (query.volatile || !props || props.includes(OPAQUE_PAINT) || props.includes(RESPONSIVE_INPUT) || props.includes(SIGNAL_STYLE_INPUT) || !query.props || input.dirty || changed.has(query.index) || !same(props, query.props)) {
      const element = clonePibblElement(child);
      const style = { ...query.style } as Record<string, unknown>;
      const currentStyle = preparedStyleValue(prepared[query.index]) as Record<string, unknown>;
      for (const field of Object.keys(style)) if (presentationOrMeasurement(field) && !(field in currentStyle)) delete style[field];
      for (const field of Object.keys(currentStyle)) if (presentationOrMeasurement(field)) style[field] = currentStyle[field];
      setPreNormalizedStyle(element, style, child, receiverFor(options, transaction, query.index), preparedStyleQuery(prepared[query.index]));
      const previousTrace = trace; trace = undefined;
      let collected: { result: unknown; reads: QueryRead[] | undefined; volatile: boolean };
      try { collected = collectQueryReads(getPrimitiveReceiverToken(element)!, () => query.execute(element)); } finally { trace = previousTrace; }
      const numeric = snapshot(collected.result);
      if (!collected.reads || !same(numeric, query.result)) return;
      nextResults.push(numeric!); queryReads.push(collected.reads); queryVolatility.push(collected.volatile);
    } else {
      nextResults.push(query.result); queryReads.push(query.reads); queryVolatility.push(query.volatile);
    }
  }
  for (let index = 0; index < checkpoint.queries.length; index++) {
    const query = checkpoint.queries[index];
    bindQueryReads(queryReads[index], checkpoint.inputs[query.index], transaction, receiverFor(options, transaction, query.index));
  }
  const result: P[] = [];
  for (const [receiver, index] of receivers) {
    const input = checkpoint.inputs[index], previous = checkpoint.placements[index];
    replayReceiverInputProvision(transaction, receiver, styleReads[index]);
    stageAllocationDependency(transaction, receiver, input.dependency);
    // Keep allocation-owned canonical padding/box-sizing/derived-axis markers,
    // while taking presentation and measurement fields from current normalization.
    const style = { ...(previous.pending ? previous.pending.style : previous.style) } as Record<string, unknown>;
    const current = preparedStyleValue(prepared[index]) as Record<string, unknown>;
    for (const field of Object.keys(style)) if (presentationOrMeasurement(field) && !(field in current)) delete style[field];
    for (const field of Object.keys(current)) if (presentationOrMeasurement(field)) style[field] = current[field];
    if (previous.pending) {
      if (!options.pending) return;
      result.push(options.pending.replay(index, style, receiver, preparedStyleQuery(prepared[index]), previous.pending.data));
      continue;
    }
    result.push({ ...previous.placement, element: childWithUsedSize(options.children[index], style, previous.width, previous.height, receiver, preparedStyleQuery(prepared[index])) } as P);
  }
  const nextPrograms = continuation && options.children.map((child, index) => programSnapshot(child, receiverFor(options, transaction, index)));
  transaction.onFinish(success => {
    if (!success || checkpoints.get(owner) !== checkpoint) {
      for (let index = 0; index < queryReads.length; index++) if (queryReads[index] !== checkpoint.queries[index].reads) disposeQueryReads(queryReads[index]);
      return;
    }
    if (nextPrograms) checkpoint.programs = nextPrograms;
    for (let index = 0; index < checkpoint.inputs.length; index++) {
      const input = checkpoint.inputs[index];
      input.prepared = prepared[index];
      input.raw = rawSnapshots[index];
      input.receipt = styleReads[index];
      if (input.revision === revisions[index]) input.dirty = 0;
    }
    for (let index = 0; index < checkpoint.queries.length; index++) {
      const query = checkpoint.queries[index];
      if (query.reads !== queryReads[index]) disposeQueryReads(query.reads);
      query.result = nextResults[index]; query.props = queryProps[index]; query.reads = queryReads[index]; query.volatile = queryVolatility[index];
    }
  });
  return result;
}
