import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('layout entry import inertness', () => {
  it('keeps both public entries inert when freshly imported', async () => {
    const fetch = vi.fn();
    const atob = vi.fn(globalThis.atob);
    const requestAnimationFrame = vi.fn();
    const compile = vi.fn(WebAssembly.compile.bind(WebAssembly));
    const Module = vi.fn(WebAssembly.Module);
    const Instance = vi.fn(WebAssembly.Instance);
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('atob', atob);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('WebAssembly', Object.assign(Object.create(WebAssembly), {
      compile, Module, Instance,
    }) as typeof WebAssembly);
    vi.resetModules();

    await import('../../../index.js');
    await import('../../../sync.js');

    expect(fetch).not.toHaveBeenCalled();
    expect(atob).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
    expect(Module).not.toHaveBeenCalled();
    expect(Instance).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

});
