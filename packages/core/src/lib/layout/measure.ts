import { layoutDiagnostic } from '../style/diagnostics.js';
import { GLOBAL_STATE } from '../global-state.js';
import { takePreNormalizedStyle } from '../style/resolve-dispatch.js';
import { getLegacyProgramProps } from '../element/metadata.js';
import { recordLayoutMeasurement } from './diagnostics.js';
import type {
  CanvasMeasurementService,
  CompEl,
  MeasureResult,
} from '../types.js';
import type { Constraints } from './types.js';

export type {
  CanvasMeasurementService,
  MeasureInput,
  MeasureResult,
} from '../types.js';

export function measureElement(
  element: CompEl<any, any, any, any>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
): MeasureResult {
  const context: MeasurementContext = {
    active: new Set(),
    stack: [],
  };
  return withIsolatedRenderState(() =>
    measureElementInternal(element, constraints, service, context),
  );
}

interface MeasurementContext {
  active: Set<CompEl<any, any, any, any>>;
  stack: CompEl<any, any, any, any>[];
}

function measureElementInternal(
  element: CompEl<any, any, any, any>,
  constraints: Readonly<Constraints>,
  service: CanvasMeasurementService,
  context: MeasurementContext,
): MeasureResult {
  recordLayoutMeasurement();
  const type = element.type;
  const component = type.name || 'Anonymous';
  const preNormalized = takePreNormalizedStyle(element);
  const source = preNormalized?.source ?? element;
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
  if (!type.measure) {
    return {
      status: 'unsupported',
      reason: `${component} does not provide measurement`,
    };
  }

  context.active.add(source);
  context.stack.push(element);
  try {
    const normalized = preNormalized?.style ?? (type.normalizeStyle ?
        type.normalizeStyle(element.style) :
        element.style);
    const result = type.measure({
      props: getLegacyProgramProps(element) ?? element.props,
      style: normalized,
      constraints,
      service,
      measureElement: (child, childConstraints) =>
        measureElementInternal(child, childConstraints, service, context),
    });
    if (result.status === 'unsupported') return result;
    validateMeasuredSize(result.size.width, 'width', component, constraints);
    validateMeasuredSize(result.size.height, 'height', component, constraints);
    return result;
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
    unseenIds: GLOBAL_STATE.unseenIds,
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
  GLOBAL_STATE.unseenIds = undefined;
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
