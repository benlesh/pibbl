import type { StyleResolutionContext, SystemStyle } from '../types.js';
import { layoutDiagnostic } from './diagnostics.js';
import {
  PIBBL_FILTER_EXECUTOR,
  type PibblFilter,
  type PreparedPibblFilter,
} from './filter-types.js';

export interface ResolvedFilterList {
  readonly values: readonly PreparedPibblFilter[];
}

export function resolveFilterList(
  value: PibblFilter | readonly PibblFilter[] | undefined,
  context: Readonly<StyleResolutionContext>,
): ResolvedFilterList | undefined {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : [value];
  if (list.length === 0) return undefined;
  const values = list.map((candidate, index) => prepareFilter(
    candidate,
    Array.isArray(value) ? `filter[${index}]` : 'filter',
    context,
  ));
  if (values.some(value => value.executor !== values[0]!.executor)) {
    throw invalidFilter('filter', value, 'contains incompatible boundary executors', context);
  }
  return Object.freeze({ values: Object.freeze(values) });
}

export function getResolvedFilterList(style: Readonly<SystemStyle>): ResolvedFilterList | undefined {
  const { filter } = style;
  if (!Array.isArray(filter) || filter.length === 0) return undefined;
  return Object.freeze({ values: filter as readonly PreparedPibblFilter[] });
}

function prepareFilter(value: unknown, property: string, context: Readonly<StyleResolutionContext>): PreparedPibblFilter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidFilter(property, value, 'must be a value returned by an imported filter factory', context);
  }
  const executor = (value as Partial<PibblFilter>)[PIBBL_FILTER_EXECUTOR];
  if (!executor || typeof executor.prepare !== 'function' || typeof executor.render !== 'function') {
    const legacy = value as { type?: unknown };
    const reason = legacy.type === undefined ?
      'must be a value returned by an imported filter factory' :
      'uses the removed descriptor form; import the matching factory from @pibbl/core/filters';
    throw invalidFilter(property, value, reason, context);
  }
  return executor.prepare(value as PibblFilter, property, context);
}

function invalidFilter(property: string, value: unknown, reason: string, context: Readonly<StyleResolutionContext>) {
  return layoutDiagnostic({
    component: context.component,
    property,
    value,
    algorithm: context.algorithm,
    constraints: context.constraints,
    reason,
  });
}
