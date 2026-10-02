import { getStyleMeasurementMode, withStyleMeasurement, rejectResponsiveMeasurement, UnsupportedResponsiveMeasurement } from '../style/responsive.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { GLOBAL_STATE } from '../global-state.js';
import { EMPTY_STYLE } from '../style/empty-style.js';
import {
  takePreNormalizedStyle,
  withoutSystemFilter,
} from '../style/resolve-dispatch.js';
import {
  createPrimitiveReceiverToken,
  getPrimitiveDefinition,
  getPrimitiveReceiverToken,
  getPolicyPreparationSource,
} from '../element/metadata.js';
import { resolvePrimitiveInputs } from '../element/resolve-primitive-inputs.js';
import { recordLayoutMeasurement } from './diagnostics.js';
import type {
  CanvasMeasurementService,
  MeasureResult,
} from '../types.js';
import type { CRCElement } from '../element/types.js';
import { prepareElementPolicies } from '../element/children.js';
import type { Constraints } from './types.js';
import { untracked, withSignalWriteForbidden } from '../signals/graph.js';

export type {
  CanvasMeasurementService,
  MeasureInput,
  MeasureResult,
} from '../types.js';

export function measureElement(
  element: CRCElement<any>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
): MeasureResult {
  const context: MeasurementContext = {
    active: new Set(),
    stack: [],
  };
  const mode = getStyleMeasurementMode() ? 'recursive' :
    GLOBAL_STATE.componentRefs ? 'mounted-intrinsic' : 'standalone-root';
  return withSignalWriteForbidden('Signal writes are forbidden during CRC measurement', () =>
    withStyleMeasurement(mode, () => withIsolatedRenderState(() =>
      measureElementInternal(element, constraints, service, context),
    )),
  );
}

interface MeasurementContext {
  active: Set<CRCElement<any>>;
  stack: CRCElement<any>[];
}

function measureElementInternal(
  element: CRCElement<any>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
  context: MeasurementContext,
): MeasureResult {
  element = prepareElementPolicies(element, 'measureElement');
  recordLayoutMeasurement();
  const type = element.type;
  const definition = getPrimitiveDefinition(type);
  const component = type.name || 'Anonymous';
  const preNormalized = takePreNormalizedStyle(element);
  const source = getPolicyPreparationSource(element) ??
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
  if (!definition?.measure) {
    return {
      status: 'unsupported',
      reason: `${component} does not provide measurement`,
    };
  }

  context.active.add(source);
  context.stack.push(element);
  try {
    if (preNormalized?.query && getStyleMeasurementMode() !== 'standalone-root') {
      rejectResponsiveMeasurement(element);
    }
    const inputs = untracked(() => resolvePrimitiveInputs(element, definition, preNormalized, {
      width: constraints.maxWidth, height: constraints.maxHeight,
    }));
    const specifiedStyle = withoutSystemFilter(
      preNormalized?.style ?? inputs.style ?? EMPTY_STYLE,
    );
    const normalized = preNormalized ?
        specifiedStyle :
      definition.normalizeStyle ?
          definition.normalizeStyle(specifiedStyle) :
          specifiedStyle;
    const previousReceiverToken = GLOBAL_STATE.primitiveReceiverToken;
    GLOBAL_STATE.primitiveReceiverToken =
      getPrimitiveReceiverToken(element) ?? createPrimitiveReceiverToken();
    let result: MeasureResult;
    try {
      result = withStyleMeasurement('recursive', () => definition.measure!({
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

function withIsolatedRenderState<T>(work: () => T): T {
  const snapshot = {
    currentCRCInstance: GLOBAL_STATE.currentCRCInstance,
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
  GLOBAL_STATE.currentCRCInstance = undefined;
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
  property: 'width' | 'height',
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
