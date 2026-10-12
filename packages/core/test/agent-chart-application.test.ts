import { signal } from '@pibbl/core';
import { expect, it } from 'vitest';
import { replaceReading } from '../../../tooling/agent-verification/chart-application';

it('publishes a new chart dataset and leaves the previous reading intact', () => {
  const previous = [{ id: 'start', x: 0, y: 10 }, { id: 'middle', x: 5, y: 20 }, { id: 'end', x: 10, y: 30 }];
  const data = signal(previous);
  replaceReading(data, { value: 30 });
  expect(data.get()).not.toBe(previous);
  expect(previous[1].y).toBe(20);
  expect(data.get()[1]).toEqual({ id: 'middle', x: 5, y: 30 });
});
