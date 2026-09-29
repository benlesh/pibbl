import { isSignal, recordPlainInputResolution, recordSignalInputResolution } from '../signals/graph.js';
import { getLayoutBox } from '../layout/context.js';
import { getElementSource } from '../element/metadata.js';
import type { CRCElement } from '../element/types.js';
import { layoutDiagnostic } from './diagnostics.js';

export interface QueryBasis { readonly width: number; readonly height: number }
export interface PreparedQuery { readonly basis: QueryBasis; readonly axes: number }
/** A single evaluation's selected style; never indexed by receiver identity. */
export class ResponsiveStylePreparation<T extends object = Readonly<Record<PropertyKey, unknown>>> {
  constructor(public style: T, readonly query: PreparedQuery) {}
}
export function preparedStyleValue<T extends object>(value: T | ResponsiveStylePreparation<T>): T {
  return value instanceof ResponsiveStylePreparation ? value.style : value;
}
export function preparedStyleQuery(value: object): PreparedQuery | undefined {
  return value instanceof ResponsiveStylePreparation ? value.query : undefined;
}
export type StyleMeasurementMode = 'standalone-root' | 'mounted-intrinsic' | 'recursive';
let measurementMode: StyleMeasurementMode | undefined;
export function getStyleMeasurementMode() { return measurementMode; }
export function withStyleMeasurement<T>(mode: StyleMeasurementMode, work: () => T): T {
  const previous = measurementMode;
  measurementMode = mode;
  try { return work(); } finally { measurementMode = previous; }
}
export class UnsupportedResponsiveMeasurement extends Error {}
export function rejectResponsiveMeasurement(element?: CRCElement<any>): never {
  throw new UnsupportedResponsiveMeasurement(queryDiagnostic(
    element, 'style.when', 'nonempty rule list', 'CRC_STYLE_QUERY_MEASUREMENT',
    'Give this item definite dimensions or a definite allocation, ' +
    'and put responsive styles inside that allocated component.',
  ).message);
}
function queryDiagnostic(
  element: CRCElement<any> | undefined,
  property: string,
  value: unknown,
  code: string,
  repair: string,
  preparation: 'render' | 'layout' = 'render',
) {
  const name = element?.type.name || 'Primitive';
  const location = element && getElementSource(element);
  return layoutDiagnostic({
    component: location ? `${name} (${location.fileName}:${location.lineNumber})` : name,
    algorithm: measurementMode ? 'measurement' : preparation,
    property, value, reason: `${code}: ${repair}`,
  });
}
const counters = { preparations: 0, rules: 0, patchFields: 0, mergeCopies: 0 };
export function responsiveStyleSnapshot() { return { ...counters }; }
const bounds = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const;

function failQuery(
  element: CRCElement<any> | undefined,
  preparation: 'render' | 'layout',
  code: string,
  property: string,
  value: unknown,
  repair: string,
): never {
  throw queryDiagnostic(element, property, value, code, repair, preparation);
}
function queryRecord(
  value: unknown,
  index: number,
  suffix: string,
  element: CRCElement<any> | undefined,
  preparation: 'render' | 'layout',
): Record<string, unknown> {
  if (isSignal(value)) failQuery(element, preparation, 'CRC_STYLE_QUERY_SIGNAL', `style.when[${index}]${suffix}`, 'Signal', 'Put the signal on the whole style or on a base/patch field.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    failQuery(element, preparation, 'CRC_STYLE_QUERY_SHAPE', `style.when[${index}]${suffix}`, value, 'Use a plain data record.');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    failQuery(element, preparation, 'CRC_STYLE_QUERY_SHAPE', `style.when[${index}]${suffix}`, value, 'Use a plain data record.');
  }
  return value as Record<string, unknown>;
}

/** Selects a closed local rule list; ordinary styles bypass this function. */
export function resolveResponsiveStyle(
  source: Readonly<Record<PropertyKey, unknown>>,
  element?: CRCElement<any>,
  suppliedBasis?: QueryBasis,
): Readonly<Record<PropertyKey, unknown>> | ResponsiveStylePreparation {
  const preparation = suppliedBasis ? 'layout' : 'render';
  const list = source.when;
  if (isSignal(list)) failQuery(element, preparation, 'CRC_STYLE_QUERY_SIGNAL', 'style.when', 'Signal', 'Put the signal on the whole style or on a base/patch field.');
  if (!Array.isArray(list)) failQuery(element, preparation, 'CRC_STYLE_QUERY_SHAPE', 'style.when', list, 'Use a readonly list of query/style records.');
  const rules = list as unknown[];
  let result: Record<PropertyKey, unknown> | undefined;
  let basis: QueryBasis | undefined;
  let axes = 0;
  const rejectedMode = measurementMode === 'mounted-intrinsic' || measurementMode === 'recursive';
  const checkEligibilityFirst = measurementMode === 'standalone-root' && suppliedBasis !== undefined &&
    (!Number.isFinite(suppliedBasis.width) || !Number.isFinite(suppliedBasis.height));
  let unavailable: { property: string; axis: 'Width' | 'Height' } | undefined;
  // Validate every envelope, even for unmatched rules. No unmatched patch walk.
  if (rules.length) counters.preparations++;
  for (let index = 0; index < rules.length; index++) {
    counters.rules++;
    const rule = queryRecord(rules[index], index, '', element, preparation);
    for (const key of Object.keys(rule)) {
      if (key !== 'query' && key !== 'style') failQuery(element, preparation, 'CRC_STYLE_QUERY_KEY', `style.when[${index}].${key}`, rule[key], 'Use only query and style in a rule.');
    }
    const query = queryRecord(rule.query, index, '.query', element, preparation);
    const patch = queryRecord(rule.style, index, '.style', element, preparation);
    if ('when' in patch) failQuery(element, preparation, 'CRC_STYLE_QUERY_NESTED', `style.when[${index}].style.when`, patch.when, "Flatten rules into the receiving style's when list.");
    let hasBound = false;
    for (const key of Object.keys(query)) {
      if (!(bounds as readonly string[]).includes(key)) failQuery(element, preparation, 'CRC_STYLE_QUERY_KEY', `style.when[${index}].query.${key}`, query[key], 'Use minWidth, maxWidth, minHeight, or maxHeight.');
      const value = query[key];
      if (value === undefined) continue;
      if (isSignal(value)) failQuery(element, preparation, 'CRC_STYLE_QUERY_SIGNAL', `style.when[${index}].query.${key}`, 'Signal', 'Put the signal on the whole style or on a base/patch field.');
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) failQuery(element, preparation, 'CRC_STYLE_QUERY_BOUND', `style.when[${index}].query.${key}`, value, 'Use a finite nonnegative bound.');
      hasBound = true;
    }
    if (!hasBound) failQuery(element, preparation, 'CRC_STYLE_QUERY_KEY', `style.when[${index}].query`, query, 'Supply at least one size bound.');
    const { minWidth, maxWidth, minHeight, maxHeight } = query as { [K in typeof bounds[number]]?: number };
    if (minWidth !== undefined && maxWidth !== undefined && minWidth > maxWidth) failQuery(element, preparation, 'CRC_STYLE_QUERY_RANGE', `style.when[${index}].query`, query, 'Set minWidth less than or equal to maxWidth.');
    if (minHeight !== undefined && maxHeight !== undefined && minHeight > maxHeight) failQuery(element, preparation, 'CRC_STYLE_QUERY_RANGE', `style.when[${index}].query`, query, 'Set minHeight less than or equal to maxHeight.');
    const ruleAxes = (minWidth !== undefined || maxWidth !== undefined ? 1 : 0) |
      (minHeight !== undefined || maxHeight !== undefined ? 2 : 0);
    axes |= ruleAxes;
    // Eligibility errors never hide a malformed later rule.
    if (rejectedMode) continue;
    basis ??= suppliedBasis ?? getLayoutBox();
    if ((ruleAxes & 1) && !Number.isFinite(basis.width)) unavailable ??= { property: `style.when[${index}].query.${minWidth !== undefined ? 'minWidth' : 'maxWidth'}`, axis: 'Width' };
    if ((ruleAxes & 2) && !Number.isFinite(basis.height)) unavailable ??= { property: `style.when[${index}].query.${minHeight !== undefined ? 'minHeight' : 'maxHeight'}`, axis: 'Height' };
    if (checkEligibilityFirst || unavailable) continue;
    result ??= copyBase(source);
    applyMatchingPatch(query as QueryBounds, patch, basis, result);
  }
  if (rules.length && rejectedMode) rejectResponsiveMeasurement(element);
  if (unavailable) {
    throw new UnsupportedResponsiveMeasurement(queryDiagnostic(
      element, unavailable.property, unavailable.axis === 'Width' ? basis!.width : basis!.height,
      'CRC_STYLE_QUERY_BASIS', `Supply a finite max${unavailable.axis} to standalone measureElement.`,
    ).message);
  }
  if (checkEligibilityFirst && rules.length) {
    // Only standalone measurement with an indefinite unqueried axis needs this
    // second scan. Validation and callbacks are never repeated.
    result = copyBase(source);
    for (const rule of rules as Array<{ query: QueryBounds; style: Record<string, unknown> }>) {
      applyMatchingPatch(rule.query, rule.style, basis!, result);
    }
  }
  const selected = result ?? copyBase(source);
  return basis ? new ResponsiveStylePreparation(selected, { basis, axes }) : selected;
}
function readField(key: string, value: unknown): unknown {
  if (key === 'custom') return value;
  if (isSignal(value)) { recordSignalInputResolution(); return value.get(); }
  recordPlainInputResolution();
  return value;
}
function copyBase(source: Readonly<Record<PropertyKey, unknown>>): Record<PropertyKey, unknown> {
  counters.mergeCopies++;
  const result: Record<PropertyKey, unknown> = {};
  for (const key of Object.keys(source)) if (key !== 'when') result[key] = readField(key, source[key]);
  return result;
}

type QueryBounds = { [K in typeof bounds[number]]?: number };
function applyMatchingPatch(
  query: QueryBounds,
  patch: Record<string, unknown>,
  basis: QueryBasis,
  result: Record<PropertyKey, unknown>,
): void {
  const { minWidth, maxWidth, minHeight, maxHeight } = query;
  if ((minWidth === undefined || basis.width >= minWidth) &&
    (maxWidth === undefined || basis.width <= maxWidth) &&
    (minHeight === undefined || basis.height >= minHeight) &&
    (maxHeight === undefined || basis.height <= maxHeight)) {
    for (const key of Object.keys(patch)) {
      counters.patchFields++;
      result[key] = readField(key, patch[key]);
    }
  }
}
