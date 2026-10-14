/** Declared from recipe intent before execution, never inferred from completed records. */
export function requiredReplayChecks(kind) {
  const checks = [];
  const add = (actionId, subjects) => {
    for (const subject of subjects) checks.push(Object.freeze({ checkId: `${actionId}.${subject}`, actionId }));
  };
  if (kind === 'targeting') {
    for (const action of ['seed', 'repair', 'intentional-block']) add(action, [
      'pixels', 'input-provenance', 'selected-entity', 'selection-count', 'delivery-generation', 'delivery-target', 'selection-intent',
    ]);
  } else if (kind === 'viz') {
    for (const action of ['interpolation-initial', 'interpolation-updated', 'interpolation-missing']) {
      for (const series of action === 'interpolation-missing' ? ['adjusted'] : ['monthly', 'adjusted']) {
        add(action, ['interpolated-x', 'interpolated-y', 'interpolated-anchor-x', 'interpolated-anchor-y'].map(name => `${series}.${name}`));
      }
    }
    for (const action of ['duplicate-first', 'duplicate-last', 'duplicate-reordered']) {
      for (const x of [5, 2.5]) add(action, [
        'duplicate-policy-x', 'duplicate-policy-y', 'duplicate-policy-anchor-x', 'duplicate-policy-anchor-y', 'secondary-series-interpolation',
      ].map(name => `x-${x}.${name}`));
    }
    for (const x of [5, 2.5, 7.5]) for (const y of [0.1, 0.9]) {
      add('nearest-unsorted', ['nearest-anchor-x', 'nearest-anchor-y'].map(name => `x-${x}.y-${y}.${name}`));
    }
    for (const distance of [30, 40]) add('closest-point-native', [`distance-${distance}.closest-point-distance`]);
    for (const action of ['async-loading-old', 'async-loading-new', 'async-current-success', 'async-stale-success', 'async-second-old', 'async-second-new', 'async-stale-error', 'async-current-error', 'async-retry-loading', 'async-retry-success']) add(action, ['request-policy', 'rendered-generation', 'hover-value', 'hover-anchor']);
    for (const action of ['weighted-data-bug', 'weighted-data']) add(action, [
      'aggregation-pipeline', 'aggregation-inspection-x', 'aggregate-interpolation', 'aggregate-anchor-x', 'aggregate-anchor-y',
    ]);
    add('zero-missing-invalid', ['policy', 'counts', 'categories', 'generation', 'zero', 'interpolated', ...[2.5, 3, 4, 5, 6, 7, 7.5].map(x => `gap-${x}`)]);
  } else throw new RangeError('Unknown replay kind.');
  return Object.freeze(checks);
}
