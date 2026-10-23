import { resolveResponsiveStyle, preparedStyleValue, type ResponsiveStylePreparation, type QueryBasis } from '../style/responsive.js';
import {
  getPrimitiveProgramProps,
  getOpaquePrimitiveProps,
  getSpecifiedStyle,
  type PrimitiveDefinition,
} from './metadata.js';
import type { PibblElement } from './types.js';
import {
  isSignal,
  recordPlainInputResolution,
  recordShallowInputCopy,
  recordSignalInputResolution,
  withSignalDependencyRole,
} from '../signals/graph.js';

export interface ResolvedPrimitiveInputs {
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>> | undefined;
}

export function resolvePrimitiveInputs(
  element: PibblElement<any>,
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
    if (key === 'children' || preserve?.includes(key) || getOpaquePrimitiveProps(element.type)?.includes(key)) {
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
  element: PibblElement<any> | undefined,
  basis: QueryBasis | undefined,
  mode: 'value',
): Readonly<Record<PropertyKey, unknown>> | undefined;
export function resolvePrimitiveStyleInput(
  input: unknown,
  element?: PibblElement<any>,
  basis?: QueryBasis,
): Readonly<Record<PropertyKey, unknown>> | ResponsiveStylePreparation | undefined;
export function resolvePrimitiveStyleInput(
  input: unknown,
  element?: PibblElement<any>,
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
      resolved[key] = withSignalDependencyRole(
        styleInputRole(key),
        () => value.get(),
      );
    } else {
      recordPlainInputResolution();
    }
  }
  return resolved ?? source;
}

function styleInputRole(
  key: string,
): 'layout' | 'measurement' | 'paint' | 'interaction' | 'transform' | 'unknown' {
  if (key === 'fill' || key === 'stroke' || key === 'opacity' || key === 'filter') return 'paint';
  if (key === 'cursor' || key === 'pointerEvents') return 'interaction';
  if (key === 'font' || key === 'lineHeight' || key === 'wrap' || key === 'fit') return 'measurement';
  if (key === 'aspectRatio' || key === 'borderWidth' || key === 'boxSizing' || key === 'width' || key === 'height' || key === 'minWidth' || key === 'minHeight' || key === 'maxWidth' || key === 'maxHeight' || key === 'left' || key === 'top' || key === 'flexBasis' || key === 'flexGrow' || key === 'flexShrink' || key === 'layoutDirection' || key === 'flexDirection' || key === 'flexWrap' || key === 'justifyContent' || key === 'alignItems' || key === 'alignSelf' || key === 'alignContent' || key === 'gap' || key === 'rowGap' || key === 'columnGap' || key === 'padding' || key === 'paddingStart' || key === 'paddingEnd' || key === 'margin' || key === 'marginTop' || key === 'marginRight' || key === 'marginBottom' || key === 'marginLeft' || key === 'marginStart' || key === 'marginEnd') return 'layout';
  return 'unknown';
}
