import { resolveResponsiveStyle, preparedStyleValue, type ResponsiveStylePreparation, type QueryBasis } from '../style/responsive.js';
import {
  getPrimitiveProgramProps,
  getSpecifiedStyle,
  type PrimitiveDefinition,
} from './metadata.js';
import type { CRCElement } from './types.js';
import {
  isSignal,
  recordPlainInputResolution,
  recordShallowInputCopy,
  recordSignalInputResolution,
} from '../signals/graph.js';

export interface ResolvedPrimitiveInputs {
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>> | undefined;
}

export function resolvePrimitiveInputs(
  element: CRCElement<any>,
  definition: PrimitiveDefinition,
  prepared?: { style: Readonly<Record<PropertyKey, unknown>> },
  basis?: QueryBasis,
): ResolvedPrimitiveInputs {
  const rawProps = getPrimitiveProgramProps(element) as Readonly<
    Record<PropertyKey, unknown>
  >;
  const preserve = definition.preserveSignalProps as
    readonly PropertyKey[] | undefined;
  let programProps: Record<PropertyKey, unknown> | undefined;

  for (const key in rawProps) {
    const value = rawProps[key];
    if (key === 'children' || preserve?.includes(key)) {
      if (programProps !== undefined) programProps[key] = value;
      continue;
    }
    if (isSignal(value)) {
      recordSignalInputResolution();
      if (programProps === undefined) {
        programProps = { ...rawProps };
        recordShallowInputCopy();
      }
      programProps[key] = value.get();
    } else {
      recordPlainInputResolution();
      if (programProps !== undefined) programProps[key] = value;
    }
  }

  return {
    props: programProps ?? rawProps,
    style: prepared ? prepared.style : resolvePrimitiveStyleInput(
      getSpecifiedStyle(element), element, basis, 'value',
    ),
  };
}

export function resolvePrimitiveStyleInput(
  input: unknown,
  element: CRCElement<any> | undefined,
  basis: QueryBasis | undefined,
  mode: 'value',
): Readonly<Record<PropertyKey, unknown>> | undefined;
export function resolvePrimitiveStyleInput(
  input: unknown,
  element?: CRCElement<any>,
  basis?: QueryBasis,
): Readonly<Record<PropertyKey, unknown>> | ResponsiveStylePreparation | undefined;
export function resolvePrimitiveStyleInput(
  input: unknown,
  element?: CRCElement<any>,
  basis?: QueryBasis,
  mode: 'value' | 'preparation' = 'preparation',
): Readonly<Record<PropertyKey, unknown>> | ResponsiveStylePreparation | undefined {
  let style = input;
  if (isSignal(style)) {
    recordSignalInputResolution();
    style = style.get();
  } else if (style !== undefined) {
    recordPlainInputResolution();
  }
  if (style === undefined) return undefined;
  if (style === null || typeof style !== 'object') {
    return style as Readonly<Record<PropertyKey, unknown>>;
  }

  const source = style as Readonly<Record<PropertyKey, unknown>>;
  if (source.when !== undefined) {
    const prepared = resolveResponsiveStyle(source, element, basis);
    return mode === 'value' ? preparedStyleValue(prepared) : prepared;
  }
  let resolved: Record<PropertyKey, unknown> | undefined;
  for (const key in source) {
    if (key === 'custom') continue;
    const value = source[key];
    if (isSignal(value)) {
      recordSignalInputResolution();
      if (resolved === undefined) {
        resolved = { ...source };
        recordShallowInputCopy();
      }
      resolved[key] = value.get();
    } else {
      recordPlainInputResolution();
    }
  }
  return resolved ?? source;
}
