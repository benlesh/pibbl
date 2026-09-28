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
    style: resolvePrimitiveStyleInput(getSpecifiedStyle(element)),
  };
}

export function resolvePrimitiveStyleInput(
  input: unknown,
): Readonly<Record<PropertyKey, unknown>> | undefined {
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
