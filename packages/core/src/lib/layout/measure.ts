import { bindCanvasMeasurementService, sameCanvasMeasurementService } from './canvas-measurement.js';
import { allocationMeasurement, declineUnrecordedAllocationMeasurement } from './allocation-checkpoint.js';
import { allocationOwner, setAllocationOwner } from './allocation-revision.js';
import { isFitContent } from '../style/sizing-length.js';
import { observeReceiverInputReads, captureReceiverInputProvision, replayReceiverInputProvision, withReceiverInputProvision, type ReceiverInputProvisionReceipt } from '../signals/input-provision.js';
import type { BoxStyle } from '../style/types.js';
import { hasPercentageBoxPadding } from './box-insets.js';
import { contentBoxStyle } from './box-sizing.js';
import { isLayoutComponent, placedLayoutComponentRoot } from './define-layout-component.js';
import { getStyleMeasurementMode, withStyleMeasurement, rejectResponsiveMeasurement, UnsupportedResponsiveMeasurement, type PreparedQuery } from '../style/responsive.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { GLOBAL_STATE } from '../global-state.js';
import { withMeasurementLayoutOwner } from './wasm/region.js';
import { EMPTY_STYLE } from '../style/empty-style.js';
import {
  takePreNormalizedStyle,
  peekPreNormalizedStyle,
  withoutSystemFilter,
} from '../style/resolve-dispatch.js';
import {
  createPrimitiveReceiverToken,
  getPrimitiveDefinition,
  getPrimitiveProgramProps,
  getPrimitiveReceiverToken,
  getElementMetadata,
} from '../element/metadata.js';
import { resolvePrimitiveInputs } from '../element/resolve-primitive-inputs.js';
import { recordLayoutMeasurement } from './diagnostics.js';
import type {
  CanvasMeasurementService,
  MeasureResult,
  IntrinsicSizesResult,
  BaselinesResult,
  BaselineMeasureInput,
  SystemStyle,
} from '../types.js';
import type { PibblElement } from '../element/types.js';
import { prepareElementPolicies } from '../element/children.js';
import type { Constraints, LayoutBox } from './types.js';
import { isSignal, trackSignalDependency, withSignalTracking, type SignalNode, withSignalDependencyRole, untracked, withSignalWriteForbidden } from '../signals/graph.js';

export type {
  CanvasMeasurementService,
  MeasureInput,
  MeasureResult,
} from '../types.js';

/**
 * Measures an element against logical size constraints using the supplied Canvas measurement service.
 *
 * @param element - Element whose declared measurement capability is used. See {@link PibblElement}.
 * @param constraints - Available size constraints in logical units. See {@link Constraints}.
 * @param service - Canvas text measurement service. See {@link CanvasMeasurementService}.
 * @returns Measured dimensions, or an unsupported result with its reason. See
 * {@link MeasureResult} .
 *
 * @see {@link PibblElement}
 * @see {@link Constraints}
 * @see {@link CanvasMeasurementService}
 * @see {@link MeasureResult}
 */
export function measureElement(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService): MeasureResult {
  const resolveService = bindCanvasMeasurementService(service);
  return allocationMeasurement(element, current => measureElementUncached(current, constraints, resolveService()));
}

function measureElementUncached(
  element: PibblElement<any>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
): MeasureResult {
  const context: MeasurementContext = {
    active: new Set(),
    stack: [],
  };
  const mode = getStyleMeasurementMode() ? 'recursive' :
    GLOBAL_STATE.componentRefs ? 'mounted-intrinsic' : 'standalone-root';
  const owner = GLOBAL_STATE.currentPibblInstance?.interactionRoot ?? GLOBAL_STATE.currentPibblInstance;
  const evaluate = () => withSignalWriteForbidden('Signal writes are forbidden during Pibbl measurement', () =>
    withMeasurementLayoutOwner(owner, () => withStyleMeasurement(mode, () => withIsolatedRenderState(() =>
      measureElementInternal(element, constraints, service, context),
    ))),
  );
  const receiver = getPrimitiveReceiverToken(element);
  return receiver ? withReceiverInputProvision(GLOBAL_STATE.renderTransaction, receiver, () => withSignalDependencyRole('measurement', evaluate)) : evaluate();
}

/** @internal Passive snapshot owned and released by one layout region. */
export interface PrimitiveMeasurementEntry {
  readonly props: object;
  readonly key: string;
  readonly result: IntrinsicSizesResult | MeasureResult | BaselinesResult;
  readonly mode: 'intrinsic' | 'finite' | 'baseline';
  readonly dependencies: readonly SignalNode<unknown>[];
  readonly receiverDependencies?: readonly SignalNode<unknown>[];
  readonly dependencyVersions?: readonly number[];
  readonly inputSnapshot: readonly unknown[] | undefined;
  readonly receiverReceipts?: readonly ConstrainedMeasurementReceipt[];
}
function measurementDependenciesUnchanged(entry: Pick<PrimitiveMeasurementEntry, 'dependencies' | 'dependencyVersions'>): boolean {
  const versions = entry.dependencyVersions;
  if (!versions || versions.length !== entry.dependencies.length) return false;
  for (let index = 0; index < versions.length; index++) {
    const node = entry.dependencies[index]!;
    node.validate?.();
    if (node.version !== versions[index]) return false;
  }
  return true;
}
function measurementDependencyVersions(dependencies: readonly SignalNode<unknown>[]): number[] {
  const versions: number[] = [];
  for (let index = 0; index < dependencies.length; index++) versions.push(dependencies[index]!.version);
  return versions;
}
interface PrimitiveMeasurementCache {
  readPrimitiveMeasurement(token: object, key: string): PrimitiveMeasurementEntry | undefined;
  writePrimitiveMeasurement(token: object, entry: PrimitiveMeasurementEntry): void;
}
const intrinsicTransactions = new WeakMap<object, WeakMap<object, Map<string, PrimitiveMeasurementEntry>>>();

// Conservative admission: mutable nested props or custom style records always
// remeasure. Scalar snapshots also detect production-mode in-place scalar writes.
function intrinsicInputSnapshot(element: PibblElement<any>): unknown[] | undefined {
  const props = getPrimitiveProgramProps<Record<string, unknown>>(element);
  const style = peekPreNormalizedStyle(element)?.style as Readonly<Record<string, unknown>> | undefined;
  const snapshot: unknown[] = [];
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (value !== null && (typeof value === 'object' && !isSignal(value) || typeof value === 'function')) return;
    snapshot.push(key, value);
  }
  if (style) for (const key of Object.keys(style)) {
    const value = style[key];
    // This module-branded sizing record is immutable; snapshot its semantic limit
    // rather than its per-render identity. Other object-valued styles stay conservative.
    if (isFitContent(value) && Object.isFrozen(value)) {
      snapshot.push(key, isFitContent, value.limit);
      continue;
    }
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) return;
    snapshot.push(key, value);
  }
  return snapshot;
}
function sameIntrinsicInputs(left: readonly unknown[] | undefined, right: readonly unknown[] | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  for (let index=0; index<left.length; index++) if (!Object.is(left[index], right[index])) return false;
  return true;
}

interface PrimitiveMeasurementOptions {
  cache: PrimitiveMeasurementCache;
  token: object;
  key: string;
  recordMeasurement: () => void;
}
/** @internal Paired content contributions through the existing pure receiver transaction. */
export function measureIntrinsicElement(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, options?: PrimitiveMeasurementOptions): IntrinsicSizesResult {
  const resolveService = bindCanvasMeasurementService(service);
  return allocationMeasurement(element, current => measurePrimitiveInput(current, constraints, resolveService(), true, options));
}
/** @internal Finite custom measurement through the same receiver transaction and cache. */
export function measureConstrainedIntrinsicElement(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, options?: PrimitiveMeasurementOptions): MeasureResult {
  const resolveService = bindCanvasMeasurementService(service);
  return allocationMeasurement(element, current => measurePrimitiveInput(current, constraints, resolveService(), false, options));
}
/** @internal Parent-owned prepared row result with fresh receiver paths per query. */
export function measurePreparedLayoutElement(
  element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService,
  options: PrimitiveMeasurementOptions, snapshot: readonly unknown[], receivers: readonly object[],
): MeasureResult {
  declineUnrecordedAllocationMeasurement();
  return measurePrimitiveInput(element, constraints, service, false, options, { snapshot, receivers });
}
interface PreparedMeasurementInput {
  readonly snapshot: readonly unknown[];
  readonly receivers: readonly object[];
}


interface PreparedBaselineOwner {
  readonly transaction: object;
  readonly receiver: object;
  readonly query: PreparedQuery;
  readonly width: number;
  readonly height: number;
}
const preparedBaselineOwners = new WeakMap<PibblElement<any>, PreparedBaselineOwner>();
/** @internal One-shot proof of a direct child's current finite Flex selection. */
export function setPreparedBaselineOwner(element: PibblElement<any>, owner: Readonly<LayoutBox>): void {
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiver = getPrimitiveReceiverToken(element);
  const query = peekPreNormalizedStyle(element)?.query;
  if (!transaction || !receiver || !query || !Number.isFinite(owner.width) || !Number.isFinite(owner.height) ||
      query.basis.width !== owner.width || query.basis.height !== owner.height) return;
  preparedBaselineOwners.set(element, { transaction, receiver, query, width: owner.width, height: owner.height });
}

/** @internal Cache identity for a transparent, currently prepared primitive root. */
export interface BaselineMeasurementOptions extends PrimitiveMeasurementOptions {
  source?: PibblElement<any>;
}

/** @internal Pure first/last baseline query at one final content allocation. */
export function measureBaselineElement(element: PibblElement<any>, allocation: Readonly<LayoutBox>, service: CanvasMeasurementService, options?: BaselineMeasurementOptions): BaselinesResult {
  const resolveService = bindCanvasMeasurementService(service);
  const owner = preparedBaselineOwners.get(element);
  const ownerValid = owner && owner.transaction === GLOBAL_STATE.renderTransaction &&
    owner.receiver === getPrimitiveReceiverToken(element) && owner.query === peekPreNormalizedStyle(element)?.query;
  const ownerBox = ownerValid ? { x: 0, y: 0, width: owner.width, height: owner.height } : undefined;
  return allocationMeasurement(element, current => {
    if (ownerBox) setPreparedBaselineOwner(current, ownerBox);
    return measureBaselineElementUncached(current, allocation, resolveService(), options);
  }, true);
}

function measureBaselineElementUncached(
  element: PibblElement<any>,
  allocation: Readonly<LayoutBox>,
  service: CanvasMeasurementService,
  options?: BaselineMeasurementOptions,
): BaselinesResult {
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiver = getPrimitiveReceiverToken(element);
  const mode = getStyleMeasurementMode() ? 'recursive' : GLOBAL_STATE.componentRefs ? 'mounted-intrinsic' : 'standalone-root';
  const key = `baseline:${options?.key ?? ''}`;
  const constraints = {
    minWidth: allocation.width, maxWidth: allocation.width,
    minHeight: allocation.height, maxHeight: allocation.height,
  };
  return withSignalWriteForbidden('Signal writes are forbidden during Pibbl measurement', () => withReceiverInputProvision(transaction, receiver, () => withSignalDependencyRole('measurement', () => {
    const source = options?.source ?? element;
    let inputSnapshot = intrinsicInputSnapshot(element);
    if (source !== element) {
      const sourceSnapshot = intrinsicInputSnapshot(source);
      if (!sourceSnapshot || !inputSnapshot) inputSnapshot = undefined;
      else {
        // The source props retain one wrapper occurrence; the complete scalar
        // root snapshot permits fresh JSX descriptions without retaining roots.
        sourceSnapshot.push(source.type, source.key, element.type, element.key, inputSnapshot.length);
        for (let index = 0; index < inputSnapshot.length; index++) sourceSnapshot.push(inputSnapshot[index]);
        inputSnapshot = sourceSnapshot;
      }
    }
    let receivers = transaction && intrinsicTransactions.get(transaction);
    let entries = options && receivers?.get(options.token);
    let entry = options && (entries?.get(key) ?? options.cache.readPrimitiveMeasurement(options.token, key));
    if (!entry || !measurementDependenciesUnchanged(entry) || entry.mode !== 'baseline' || entry.props !== source.props || !sameIntrinsicInputs(entry.inputSnapshot, inputSnapshot)) {
      options?.recordMeasurement();
      const dependencies: SignalNode<unknown>[] = [];
      const addDependency = (node: SignalNode<unknown>) => { if (!dependencies.includes(node)) dependencies.push(node); };
      const result = observeReceiverInputReads(addDependency, () => withSignalTracking({ addDependency }, () =>
        withStyleMeasurement(mode, () => withIsolatedRenderState(() =>
          measureBaselineInput(element, allocation, constraints, service),
        ))));
      entry = { props: source.props, key, result, mode: 'baseline', dependencies, dependencyVersions: measurementDependencyVersions(dependencies), inputSnapshot };
      if (options && transaction && inputSnapshot && result.status === 'measured') {
        if (!receivers) { receivers = new WeakMap(); intrinsicTransactions.set(transaction, receivers); }
        if (!entries) { entries = new Map(); receivers.set(options.token, entries); }
        entries.set(key, entry);
        const snapshot = entry;
        transaction.onFinish(success => { if (success) options.cache.writePrimitiveMeasurement(options.token, snapshot); });
      }
    }
    for (const node of entry.dependencies) trackSignalDependency(node, 'measurement');
    return entry.result as BaselinesResult;
  })));
}

function measureBaselineInput(
  original: PibblElement<any>,
  allocation: Readonly<LayoutBox>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
): BaselinesResult {
  const element = prepareElementPolicies(original, 'measureBaselines');
  recordLayoutMeasurement();
  const definition = getPrimitiveDefinition(element.type);
  const component = element.type.name || 'Anonymous';
  if (isLayoutComponent(element.type)) {
    return { status: 'unsupported', reason: 'baseline providers currently require a direct custom primitive' };
  }
  if (!definition?.measureBaselines) {
    return { status: 'unsupported', reason: `${component} does not provide baseline measurement` };
  }
  const preNormalized = takePreNormalizedStyle(element);
  const preparedOwner = preparedBaselineOwners.get(element);
  preparedBaselineOwners.delete(element);
  if (preNormalized?.query && getStyleMeasurementMode() !== 'standalone-root') {
    // Only the direct Flex owner's already-selected style may cross this pure
    // boundary. Never evaluate responsive rules against the provider allocation.
    const query = preNormalized.query;
    if (getStyleMeasurementMode() !== 'mounted-intrinsic' || !preparedOwner ||
        preparedOwner.transaction !== GLOBAL_STATE.renderTransaction ||
        preparedOwner.receiver !== getPrimitiveReceiverToken(element) || preparedOwner.query !== query ||
        preparedOwner.width !== query.basis.width || preparedOwner.height !== query.basis.height) {
      rejectResponsiveMeasurement(element);
    }
  }
  const inputs = resolvePrimitiveInputs(element, definition, preNormalized, {
    width: allocation.width, height: allocation.height,
  });
  const specifiedStyle = withoutSystemFilter(preNormalized?.style ?? inputs.style ?? EMPTY_STYLE);
  let normalized = preNormalized ? specifiedStyle : definition.normalizeStyle ?
    definition.normalizeStyle(specifiedStyle) : specifiedStyle;
  if (hasPercentageBoxPadding(normalized as Readonly<BoxStyle>)) {
    return { status: 'unsupported', reason: 'percentage padding requires an actual finite Flex owner allocation' };
  }
  if ('boxSizing' in normalized && normalized.boxSizing !== undefined) {
    normalized = contentBoxStyle(normalized as Readonly<BoxStyle>, {
      width: allocation.width, height: allocation.height,
      context: { component, algorithm: 'baseline measurement', constraints },
    });
  }
  const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
  GLOBAL_STATE.primitiveReceiverToken = getPrimitiveReceiverToken(element) ?? createPrimitiveReceiverToken();
  try {
    const result = definition.measureBaselines({
      props: inputs.props,
      style: normalized,
      allocation: { x: 0, y: 0, width: allocation.width, height: allocation.height },
      service,
    } as BaselineMeasureInput<Record<PropertyKey, unknown>, SystemStyle>);
    if (result.status === 'unsupported') return result;
    if (result.status !== 'measured' || !Number.isFinite(result.first) || !Number.isFinite(result.last) || result.first > result.last) {
      throw layoutDiagnostic({
        component, property: 'measureBaselines', value: result,
        algorithm: 'baseline measurement', constraints,
        reason: 'first and last baselines must be finite with first not after last',
      });
    }
    return { status: 'measured', first: result.first, last: result.last };
  } catch (error) {
    if (error instanceof UnsupportedResponsiveMeasurement) return { status: 'unsupported', reason: error.message };
    throw error;
  } finally {
    GLOBAL_STATE.primitiveReceiverToken = previousReceiverToken;
  }
}
function measurePrimitiveInput(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, intrinsic: true, options?: PrimitiveMeasurementOptions): IntrinsicSizesResult;
function measurePrimitiveInput(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, intrinsic: false, options?: PrimitiveMeasurementOptions, prepared?: PreparedMeasurementInput): MeasureResult;
function measurePrimitiveInput(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, intrinsic: boolean, options?: PrimitiveMeasurementOptions, prepared?: PreparedMeasurementInput): IntrinsicSizesResult | MeasureResult {
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiver = getPrimitiveReceiverToken(element);
  const context: MeasurementContext = { active: new Set(), stack: [] };
  const mode = getStyleMeasurementMode() ? 'recursive' : GLOBAL_STATE.componentRefs ? 'mounted-intrinsic' : 'standalone-root';
  const key = `${intrinsic ? 'intrinsic' : 'finite'}:${options?.key ?? ''}`;
  const owner = GLOBAL_STATE.currentPibblInstance?.interactionRoot ?? GLOBAL_STATE.currentPibblInstance;
  return withSignalWriteForbidden('Signal writes are forbidden during Pibbl measurement', () => withMeasurementLayoutOwner(owner, () => withReceiverInputProvision(transaction, receiver, () => withSignalDependencyRole('measurement', () => {
    const inputSnapshot = prepared?.snapshot ?? intrinsicInputSnapshot(element);
    let receivers = transaction && intrinsicTransactions.get(transaction);
    let entries = options && receivers?.get(options.token);
    let entry = options && (entries?.get(key) ?? options.cache.readPrimitiveMeasurement(options.token, key));
    const entryMode = intrinsic ? 'intrinsic' : 'finite';
    if (!entry || !measurementDependenciesUnchanged(entry) || entry.mode !== entryMode || entry.props !== element.props || !sameIntrinsicInputs(entry.inputSnapshot, inputSnapshot) || prepared && entry.receiverReceipts === undefined) {
      options?.recordMeasurement();
      const dependencies: SignalNode<unknown>[] = [];
      const receiverDependencies: SignalNode<unknown>[] = [];
      let untracedReceiverReads = false;
      const trace: ConstrainedMeasurementTrace | undefined = prepared ? {
        cacheable: true, receipts: [], receivers: prepared.receivers,
      } : undefined;
      const evaluate = () => withStyleMeasurement(mode, () => withIsolatedRenderState(() => intrinsic ?
        measureElementInternal(element, constraints, service, context, true) :
        measureElementInternal(element, constraints, service, context, false, true),
      ));
      const addDependency = (node: SignalNode<unknown>) => {
        if (!dependencies.includes(node)) dependencies.push(node);
        if (!receiverDependencies.includes(node)) receiverDependencies.push(node);
      };
      const result = observeReceiverInputReads((node, _roles, inputReceiver) => {
        if (!dependencies.includes(node)) dependencies.push(node);
        if (inputReceiver === receiver && !receiverDependencies.includes(node)) receiverDependencies.push(node);
        if (inputReceiver !== receiver && !trace) untracedReceiverReads = true;
      }, () => withSignalTracking({ addDependency }, () =>
        trace ? withConstrainedMeasurementTrace(trace, evaluate) : evaluate()));
      entry = { props: element.props, key, result, mode: entryMode, dependencies, receiverDependencies, dependencyVersions: measurementDependencyVersions(dependencies), inputSnapshot,
        ...(trace?.cacheable ? { receiverReceipts: trace.receipts } : {}) };
      if (options && transaction && inputSnapshot && result.status === 'measured' && !untracedReceiverReads && (!trace || trace.cacheable)) {
        if (!receivers) { receivers = new WeakMap(); intrinsicTransactions.set(transaction, receivers); }
        if (!entries) { entries = new Map(); receivers.set(options.token, entries); }
        entries.set(key, entry);
        const snapshot = entry;
        transaction.onFinish(success => { if (success) options.cache.writePrimitiveMeasurement(options.token, snapshot); });
      }
    }
    if (prepared && entry.receiverReceipts) {
      for (let index = 0; index < entry.receiverReceipts.length; index++) {
        const captured = entry.receiverReceipts[index];
        replayReceiverInputProvision(transaction, prepared.receivers[captured.childIndex], captured.receipt);
      }
    }
    for (const node of entry.receiverDependencies ?? entry.dependencies) trackSignalDependency(node, 'measurement');
    return entry.result as IntrinsicSizesResult | MeasureResult;
  }))));
}

interface MeasurementContext {
  active: Set<PibblElement<any>>;
  stack: PibblElement<any>[];
}

// Present only while a primitive measurement callback is evaluating. Flex uses this
// continuation for its explicitly admitted paired structural child, so the child
// shares the caller's cycle stack and receives provider inputs with measurement
// dependency tracking. Ordinary `input.measureElement` remains unchanged.
let constrainedChildContext: MeasurementContext | undefined;
let constrainedChildService: CanvasMeasurementService | undefined;
interface ConstrainedMeasurementReceipt {
  readonly childIndex: number;
  readonly receipt: ReceiverInputProvisionReceipt;
}
export interface ConstrainedMeasurementTrace {
  cacheable: boolean;
  readonly receipts: ConstrainedMeasurementReceipt[];
  readonly receivers: readonly object[];
}
let constrainedMeasurementTrace: ConstrainedMeasurementTrace | undefined;
/** @internal Binds one direct known-row provider trace without retaining receiver tokens. */
export function withConstrainedMeasurementTrace<T>(trace: ConstrainedMeasurementTrace, work: () => T): T {
  const previous = constrainedMeasurementTrace;
  constrainedMeasurementTrace = trace;
  try { return work(); }
  finally { constrainedMeasurementTrace = previous; }
}
interface ConstrainedLeafDemand {
  readonly type: Function;
  readonly service: CanvasMeasurementService;
  readonly key: readonly unknown[];
  readonly inputs: readonly unknown[];
  readonly receipt: ReceiverInputProvisionReceipt;
  readonly dependencies: readonly SignalNode<unknown>[];
  readonly dependencyVersions: readonly number[];
  readonly result: MeasureResult;
}
const constrainedLeafDemands = new WeakMap<object, WeakMap<object, ConstrainedLeafDemand>>();

export function measureConstrainedLayoutChild(
  element: PibblElement<any>,
  constraints: Readonly<Constraints>,
  childIndex?: number,
): MeasureResult {
  const context = constrainedChildContext, service = constrainedChildService;
  if (!context || !service) throw new Error('Constrained structural measurement requires an active provider measurement.');
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiver = getPrimitiveReceiverToken(element);
  const trace = constrainedMeasurementTrace;
  const run = () => withSignalDependencyRole('measurement', () =>
    measureElementInternal(element, constraints, service, context, false, true));
  // A changed contribution may fail an allocation equality barrier and then be
  // demanded again by its allocator. Reuse only this transaction's exact direct
  // leaf query, preserving its receiver receipt instead of calling the provider twice.
  if (transaction && receiver && childIndex === undefined && !Object.hasOwn(element.props, 'children') && !isLayoutComponent(element.type)) {
    // This narrow native continuation always supplies normalized input. A bare
    // receiver token cannot prove authored style, nor renew a consumed marker.
    const inputs = peekPreNormalizedStyle(element) ? intrinsicInputSnapshot(element) : undefined;
    const key = [getStyleMeasurementMode(), constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight];
    const demands = constrainedLeafDemands.get(transaction);
    const prior = demands?.get(receiver);
    const metadata = getElementMetadata(element);
    const source = metadata?.policyPreparationSource ?? metadata?.layoutDescriptionSource ?? peekPreNormalizedStyle(element)?.source ?? element;
    if (!context.active.has(source) && inputs && prior && prior.type === element.type && sameCanvasMeasurementService(prior.service, service) && sameIntrinsicInputs(prior.key, key) &&
        sameIntrinsicInputs(prior.inputs, inputs) && measurementDependenciesUnchanged(prior)) {
      if (trace) trace.cacheable = false;
      takePreNormalizedStyle(element);
      replayReceiverInputProvision(transaction, receiver, prior.receipt);
      return prior.result;
    }
    let direct = true;
    const captured = observeReceiverInputReads((_node, _roles, owner) => { if (owner !== receiver) direct = false; },
      () => captureReceiverInputProvision(transaction, receiver, run));
    if (inputs && direct && captured.receipt && captured.value.status === 'measured') {
      let current = demands;
      if (!current) {
        current = new WeakMap(); constrainedLeafDemands.set(transaction, current);
        transaction.onFinish(() => constrainedLeafDemands.delete(transaction));
      }
      const dependencies = captured.receipt.map(entry => entry.node);
      current.set(receiver, { type: element.type, service, key, inputs, receipt: captured.receipt, dependencies,
        dependencyVersions: measurementDependencyVersions(dependencies), result: captured.value });
    }
    if (trace) trace.cacheable = false;
    return captured.value;
  }
  if (!trace) return withReceiverInputProvision(transaction, receiver, run);
  if (childIndex === undefined || trace.receivers[childIndex] !== receiver) {
    trace.cacheable = false;
    return withReceiverInputProvision(transaction, receiver, run);
  }
  const captured = captureReceiverInputProvision(transaction, receiver, run);
  if (captured.receipt === undefined) trace.cacheable = false;
  else trace.receipts.push({ childIndex, receipt: captured.receipt });
  return captured.value;
}

function measureElementInternal(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, context: MeasurementContext, intrinsic: true): IntrinsicSizesResult;
function measureElementInternal(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, context: MeasurementContext, intrinsic?: false, providerInputs?: boolean): MeasureResult;
function measureElementInternal(
  element: PibblElement<any>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
  context: MeasurementContext,
  intrinsic = false,
  providerInputs = false,
): MeasureResult | IntrinsicSizesResult {
  element = prepareElementPolicies(element, 'measureElement');
  recordLayoutMeasurement();
  const type = element.type;
  const definition = getPrimitiveDefinition(type);
  const component = type.name || 'Anonymous';
  const preNormalized = takePreNormalizedStyle(element);
  const metadata = getElementMetadata(element);
  const source = metadata?.policyPreparationSource ?? metadata?.layoutDescriptionSource ??
    preNormalized?.source ??
    element;
  if (context.active.has(source)) {
    throw layoutDiagnostic({
      component,
      property: 'measurement',
      value: context.stack.map(item => item.type.name || 'Anonymous'),
      algorithm: 'measurement',
      constraints,
      reason: 'cyclic measurement dependency is not supported',
    });
  }
  if (isLayoutComponent(type)) {
    context.active.add(source);
    context.stack.push(element);
    try {
      // A declared layout description is the existing pure boundary. Preserve the
      // caller's measurement mode so a paired primitive root can contribute its
      // intrinsic result or receive provider inputs under the same transaction.
      const root = placedLayoutComponentRoot(element, preNormalized);
      return withReceiverInputProvision(GLOBAL_STATE.renderTransaction, getPrimitiveReceiverToken(root), () => intrinsic ?
        measureElementInternal(root, constraints, service, context, true) :
        measureElementInternal(root, constraints, service, context, false, providerInputs));
    } finally {
      context.stack.pop();
      context.active.delete(source);
    }
  }
  if (intrinsic ? !definition?.measureIntrinsic : !definition?.measure) {
    return {
      status: 'unsupported',
      reason: `${component} does not provide ${intrinsic ? 'intrinsic measurement' : 'measurement'}`,
    };
  }

  context.active.add(source);
  context.stack.push(element);
  try {
    if (preNormalized?.query && getStyleMeasurementMode() !== 'standalone-root') {
      rejectResponsiveMeasurement(element);
    }
    const readInputs = () => resolvePrimitiveInputs(element, definition!, preNormalized, {
      width: constraints.maxWidth, height: constraints.maxHeight,
    });
    const inputs = intrinsic || providerInputs ? readInputs() : untracked(readInputs);
    const specifiedStyle = withoutSystemFilter(
      preNormalized?.style ?? inputs.style ?? EMPTY_STYLE,
    );
    let normalized = preNormalized ?
        specifiedStyle :
      definition!.normalizeStyle ?
          definition!.normalizeStyle!(specifiedStyle) :
          specifiedStyle;
    if (hasPercentageBoxPadding(normalized as Readonly<BoxStyle>)) return { status: 'unsupported', reason: 'percentage padding requires an actual finite Flex owner allocation' };
    if ('boxSizing' in normalized && normalized.boxSizing !== undefined) normalized = contentBoxStyle(normalized as Readonly<BoxStyle>, { width: constraints.maxWidth, height: constraints.maxHeight, context: { component, algorithm: 'measurement', constraints } });
    const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
    GLOBAL_STATE.primitiveReceiverToken =
      getPrimitiveReceiverToken(element) ?? createPrimitiveReceiverToken();
    let result: MeasureResult | IntrinsicSizesResult;
    const previousConstrainedChildContext = constrainedChildContext;
    const previousConstrainedChildService = constrainedChildService;
    if (!intrinsic) { constrainedChildContext = context; constrainedChildService = service; }
    try {
      result = withStyleMeasurement('recursive', () => intrinsic ? definition!.measureIntrinsic!({
        props: inputs.props, style: normalized, service,
        constraints: {
          width: Number.isFinite(constraints.maxWidth) ? { kind: 'bounded', min: constraints.minWidth, max: constraints.maxWidth } : { kind: 'unbounded', min: constraints.minWidth },
          height: Number.isFinite(constraints.maxHeight) ? { kind: 'bounded', min: constraints.minHeight, max: constraints.maxHeight } : { kind: 'unbounded', min: constraints.minHeight },
        },
      }) : definition!.measure!({
        props: inputs.props,
        style: normalized,
        constraints,
        service,
        measureElement: (child, childConstraints) => {
          // Public recursive queries have no direct-child receipt path. Preserve
          // their ordinary measurement behavior without caching this aggregate.
          if (constrainedMeasurementTrace) constrainedMeasurementTrace.cacheable = false;
          const receiver = getPrimitiveReceiverToken(child);
          return receiver ? withReceiverInputProvision(GLOBAL_STATE.renderTransaction, receiver, () => withSignalDependencyRole('measurement', () =>
            measureElementInternal(child, childConstraints, service, context))) : measureElementInternal(child, childConstraints, service, context);
        },
      }));
    } finally {
      constrainedChildContext = previousConstrainedChildContext;
      constrainedChildService = previousConstrainedChildService;
      GLOBAL_STATE.primitiveReceiverToken = previousReceiverToken;
    }
    if (result.status === 'unsupported') return result;
    if ('minContent' in result) {
      validateMeasuredSize(result.minContent.width, 'minContent.width', component, constraints);
      validateMeasuredSize(result.minContent.height, 'minContent.height', component, constraints);
      validateMeasuredSize(result.maxContent.width, 'maxContent.width', component, constraints);
      validateMeasuredSize(result.maxContent.height, 'maxContent.height', component, constraints);
      if (result.minContent.width > result.maxContent.width) throw layoutDiagnostic({ component, property: 'measureIntrinsic', value: result, algorithm: 'measurement', constraints, reason: 'min-content width must not exceed max-content width' });
      return result;
    }
    validateMeasuredSize(result.size.width, 'width', component, constraints);
    validateMeasuredSize(result.size.height, 'height', component, constraints);
    return result;
  } catch (error) {
    if (error instanceof UnsupportedResponsiveMeasurement) {
      return { status: 'unsupported', reason: error.message };
    }
    throw error;
  } finally {
    context.stack.pop();
    context.active.delete(source);
  }
}

/** @internal Shared pure measurement preparation; never lends a mounted render context. */
export function withIsolatedRenderState<T>(work: () => T): T {
  const previousAllocationOwner = setAllocationOwner(allocationOwner());
  const snapshot = {
    currentPibblInstance: GLOBAL_STATE.currentPibblInstance,
    componentRefs: GLOBAL_STATE.componentRefs,
    canvas: GLOBAL_STATE.canvas,
    componentIsMounting: GLOBAL_STATE.componentIsMounting,
    componentHookIndex: GLOBAL_STATE.componentHookIndex,
    renderContext: GLOBAL_STATE.renderContext,
    primitiveReceiverToken: GLOBAL_STATE.primitiveReceiverToken,
    seenIds: GLOBAL_STATE.seenIds,
    seenKeys: GLOBAL_STATE.seenKeys,
    clippingStack: GLOBAL_STATE.clippingStack,
    layoutStack: GLOBAL_STATE.layoutStack,
  };
  GLOBAL_STATE.currentPibblInstance = undefined;
  GLOBAL_STATE.componentRefs = undefined;
  GLOBAL_STATE.canvas = undefined;
  GLOBAL_STATE.componentIsMounting = false;
  GLOBAL_STATE.componentHookIndex = 0;
  GLOBAL_STATE.renderContext = undefined;
  GLOBAL_STATE.primitiveReceiverToken = undefined;
  GLOBAL_STATE.seenIds = undefined;
  GLOBAL_STATE.seenKeys = undefined;
  GLOBAL_STATE.clippingStack = [];
  GLOBAL_STATE.layoutStack = undefined;
  try {
    return work();
  } finally {
    Object.assign(GLOBAL_STATE, snapshot);
    setAllocationOwner(previousAllocationOwner);
  }
}

function validateMeasuredSize(
  value: number,
  property: string,
  component: string,
  constraints: Readonly<Constraints>,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw layoutDiagnostic({
      component,
      property,
      value,
      algorithm: 'measurement',
      constraints,
      reason: 'measured dimensions must be finite and nonnegative',
    });
  }
}
