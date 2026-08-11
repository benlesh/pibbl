import { afterEach, describe, expect, it, vi } from 'vitest';
import { Teardowns } from './teardowns';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Teardowns', () => {
  it('releases a stable snapshot once and isolates teardown errors', () => {
    const error = new Error('teardown failed');
    const reportError = vi
      .spyOn(globalThis, 'reportError')
      .mockImplementation(() => {});
    const calls: string[] = [];
    const teardowns = new Teardowns();
    const second = () => calls.push('second');

    teardowns.add(() => {
      calls.push('first');
      teardowns.remove(second);
      throw error;
    });
    teardowns.add(second);

    teardowns.execute();
    teardowns.execute();

    expect(calls).toEqual(['first', 'second']);
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('immediately and safely releases resources added after closure', () => {
    const error = new Error('late teardown failed');
    const reportError = vi
      .spyOn(globalThis, 'reportError')
      .mockImplementation(() => {});
    const teardown = vi.fn(() => {
      throw error;
    });
    const teardowns = new Teardowns();

    teardowns.execute();
    teardowns.add(teardown);

    expect(teardown).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('closes a follower exactly once with its parent', () => {
    const release = vi.fn();
    const parent = new Teardowns();
    const child = new Teardowns();
    child.follow(parent);
    child.add(release);

    parent.execute();
    parent.execute();
    child.execute();

    expect(release).toHaveBeenCalledOnce();
    expect(parent.closed).toBe(true);
    expect(child.closed).toBe(true);
  });
});
