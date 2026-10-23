import { withReceiverInputProvision } from '../signals/input-provision.js';
import type { BoxStyle } from '../style/types.js';
import { hasPercentageBoxPadding } from './box-insets.js';
import { contentBoxStyle } from './box-sizing.js';
import { isLayoutComponent, placedLayoutComponentRoot } from './define-layout-component.js';
import { getStyleMeasurementMode, withStyleMeasurement, rejectResponsiveMeasurement, UnsupportedResponsiveMeasurement } from '../style/responsive.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { GLOBAL_STATE } from '../global-state.js';
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
} from '../types.js';
import type { PibblElement } from '../element/types.js';
import { prepareElementPolicies } from '../element/children.js';
import type { Constraints } from './types.js';
import { isSignal, trackSignalDependency, withSignalTracking, type SignalNode, withSignalDependencyRole, untracked, withSignalWriteForbidden } from '../signals/graph.js';

export type {
  CanvasMeasurementService,
  MeasureInput,
  MeasureResult,
} from '../types.js';

/**
 * Measures an element against finite constraints using the supplied Canvas measurement service.
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
export function measureElement(
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
  return withSignalWriteForbidden('Signal writes are forbidden during Pibbl measurement', () =>
    withStyleMeasurement(mode, () => withIsolatedRenderState(() =>
      measureElementInternal(element, constraints, service, context),
    )),
  );
}

/** @internal Passive snapshot owned and released by one layout region. */
export interface IntrinsicMeasurementEntry {
  readonly props: object;
  readonly key: string;
  readonly result: IntrinsicSizesResult;
  readonly dependencies: readonly SignalNode<unknown>[];
  readonly inputSnapshot: readonly unknown[] | undefined;
}
interface IntrinsicCache {
  readIntrinsic(token: object): IntrinsicMeasurementEntry | undefined;
  writeIntrinsic(token: object, entry: IntrinsicMeasurementEntry): void;
}
const intrinsicTransactions = new WeakMap<object, WeakMap<object, IntrinsicMeasurementEntry>>();

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

/** @internal Runs the same pure receiver transaction for a custom intrinsic leaf. */
export function measureIntrinsicElement(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, options?: { cache: IntrinsicCache; token: object; key: string; recordMeasurement: () => void }): IntrinsicSizesResult {
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiver = getPrimitiveReceiverToken(element);
  const context: MeasurementContext = { active: new Set(), stack: [] };
  const mode = getStyleMeasurementMode() ? 'recursive' : GLOBAL_STATE.componentRefs ? 'mounted-intrinsic' : 'standalone-root';
  return withReceiverInputProvision(transaction, receiver, () => withSignalDependencyRole('measurement', () => {
    const inputSnapshot = intrinsicInputSnapshot(element);
    let entries = transaction && intrinsicTransactions.get(transaction);
    let entry = options && (entries?.get(options.token) ?? options.cache.readIntrinsic(options.token));
    if (!entry || entry.key !== options?.key || entry.props !== element.props || !sameIntrinsicInputs(entry.inputSnapshot, inputSnapshot)) {
      options?.recordMeasurement();
      const dependencies: SignalNode<unknown>[] = [];
      const result = withSignalTracking({ addDependency(node) { if (!dependencies.includes(node)) dependencies.push(node); } }, () =>
        withSignalWriteForbidden('Signal writes are forbidden during Pibbl measurement', () =>
          withStyleMeasurement(mode, () => withIsolatedRenderState(() =>
            measureElementInternal(element, constraints, service, context, true),
          )),
        ));
      entry = { props: element.props, key: options?.key ?? '', result, dependencies, inputSnapshot };
      if (options && transaction && inputSnapshot && result.status === 'measured') {
        if (!entries) { entries = new WeakMap(); intrinsicTransactions.set(transaction, entries); }
        entries.set(options.token, entry);
        const snapshot = entry;
        transaction.onFinish(success => { if (success) options.cache.writeIntrinsic(options.token, snapshot); });
      }
    }
    for (const node of entry.dependencies) trackSignalDependency(node, 'measurement');
    return entry.result;
  }));
}

interface MeasurementContext {
  active: Set<PibblElement<any>>;
  stack: PibblElement<any>[];
}

function measureElementInternal(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, context: MeasurementContext, intrinsic: true): IntrinsicSizesResult;
function measureElementInternal(element: PibblElement<any>, constraints: Readonly<Constraints>, service: CanvasMeasurementService, context: MeasurementContext, intrinsic?: false): MeasureResult;
function measureElementInternal(
  element: PibblElement<any>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
  context: MeasurementContext,
  intrinsic = false,
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
  if (intrinsic && isLayoutComponent(type)) return { status: 'unsupported', reason: 'intrinsic providers currently require a direct custom primitive' };
  if (isLayoutComponent(type)) {
    context.active.add(source);
    context.stack.push(element);
    try {
      return measureElementInternal(placedLayoutComponentRoot(element, preNormalized), constraints, service, context);
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
    const inputs = intrinsic ? readInputs() : untracked(readInputs);
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
        measureElement: (child, childConstraints) =>
          measureElementInternal(child, childConstraints, service, context),
      }));
    } finally {
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
