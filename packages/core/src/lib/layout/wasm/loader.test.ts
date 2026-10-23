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

it.each([0, 1, 2, 3, 4, 5])('rejects an older layout ABI before publishing compiled code (version=%s)', async version => {
  vi.resetModules();
  const { publishLayoutModule, hasReadyLayoutModule } = await import('./module.js');
  const legacyExports: WebAssembly.ModuleExportDescriptor[] = [
    { name: 'memory', kind: 'memory' }, { name: 'solve', kind: 'function' }, { name: 'dispose', kind: 'function' },
  ];
  if (version >= 1) legacyExports.push({ name: 'arena_create', kind: 'function' }, { name: 'arena_generation', kind: 'function' }, { name: 'arena_dispose', kind: 'function' });
  if (version >= 2) legacyExports.push({ name: 'resize_grid', kind: 'function' }, { name: 'resolve_grid_tracks', kind: 'function' });
  if (version >= 3) legacyExports.push({ name: 'resize_grid_cells', kind: 'function' }, { name: 'place_grid_cells', kind: 'function' });
  if (version >= 4) legacyExports.push({ name: 'resize_flow', kind: 'function' }, { name: 'place_flow', kind: 'function' }, { name: 'place_cross', kind: 'function' });
  if (version >= 5) legacyExports.push({ name: 'layout_abi_v1', kind: 'function' });
  vi.spyOn(WebAssembly.Module, 'exports').mockReturnValue(legacyExports);
  expect(() => publishLayoutModule({} as WebAssembly.Module)).toThrow('ABI is incompatible');
  expect(hasReadyLayoutModule()).toBe(false);
});
