import { describe, expect, it } from 'vitest';
import { signal, getSignalNode } from '../signals/graph';
import {
  allocationInputState,
  invalidateAllocationInputs,
} from './allocation-revision';
import { FlexAllocationCache } from './flex-allocation-cache';

const box = Object.freeze({ x: 0, y: 0, width: 100, height: 20 });
const settings = Object.freeze({
  layoutDirection: 'ltr' as const,
  flexDirection: 'row',
  flexWrap: 'nowrap',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  alignContent: 'stretch',
  rowGap: 0,
  columnGap: 0,
});
const placements = Object.freeze([{ box, layoutY: 0, usedWidth: 10, usedHeight: 10 }]);

describe('FlexAllocationCache', () => {
  it('retains a sibling frozen allocation across an unrelated metric signal change', () => {
    const input = Object.freeze({});
    const ownMetric = signal(10);
    const siblingMetric = signal(20);
    const cache = new FlexAllocationCache();
    cache.store(input, allocationInputState(), box, settings, placements, [getSignalNode(ownMetric)]);

    siblingMetric.set(21);
    invalidateAllocationInputs(undefined, 'metric');
    expect(cache.read(input, allocationInputState(), box, settings)).toBe(placements);

    ownMetric.set(11);
    invalidateAllocationInputs(undefined, 'metric');
    expect(cache.read(input, allocationInputState(), box, settings)).toBeUndefined();
  });

  it('never reuses a frozen allocation after structural invalidation', () => {
    const input = Object.freeze({});
    const ownMetric = signal(10);
    const cache = new FlexAllocationCache();
    cache.store(input, allocationInputState(), box, settings, placements, [getSignalNode(ownMetric)]);

    invalidateAllocationInputs();
    expect(cache.read(input, allocationInputState(), box, settings)).toBeUndefined();
  });
});
