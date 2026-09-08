import { describe, expect, it } from 'vitest';
import {
  finiteNumber,
  integerAtLeast,
  nonnegativeNumber,
  pathRangeError,
  validateCoordinates,
} from './validation';

describe('geometry validation', () => {
  it('formats canonical numeric range errors with the property path and received value', () => {
    expect(pathRangeError('coords[1][0]', Number.NaN, 'must be finite'))
      .toMatchObject({
        name: 'RangeError',
        message: 'coords[1][0] must be finite; received NaN',
      });
  });

  it('rejects non-finite numeric values through the supplied error factory', () => {
    const error = new Error('contextual finite diagnostic');
    const factory = () => error;

    expect(() => finiteNumber(Number.POSITIVE_INFINITY, 'radius', factory))
      .toThrow(error);
  });

  it('requires nonnegative finite values', () => {
    expect(() => nonnegativeNumber(-1, 'radius'))
      .toThrowError(/radius.*nonnegative/);
  });

  it('requires integral values at the configured minimum', () => {
    expect(() => integerAtLeast(1.5, 1, 'segments'))
      .toThrowError(/segments.*integer/);
    expect(() => integerAtLeast(0, 1, 'segments'))
      .toThrowError(/segments.*at least 1/);
  });

  it('reports exact coordinate paths for non-finite x and y values', () => {
    expect(() => validateCoordinates([[0, 0], [Number.NaN, 1]]))
      .toThrowError(/coords\[1\]\[0\].*finite/);
    expect(() => validateCoordinates([[0, 0], [1, Number.POSITIVE_INFINITY]]))
      .toThrowError(/coords\[1\]\[1\].*finite/);
  });
});
