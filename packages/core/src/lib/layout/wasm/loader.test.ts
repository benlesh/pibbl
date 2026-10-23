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

it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('rejects older or incomplete layout ABI exports before publishing compiled code (generation=%s)', async version => {
  vi.resetModules();
  const { publishLayoutModule, hasReadyLayoutModule } = await import('./module.js');
  const legacyExports: WebAssembly.ModuleExportDescriptor[] = [
    { name: 'memory', kind: 'memory' }, { name: 'solve', kind: 'function' }, { name: 'dispose', kind: 'function' },
  ];
  if (version >= 1) legacyExports.push({ name: 'arena_create', kind: 'function' }, { name: 'arena_generation', kind: 'function' }, { name: 'arena_dispose', kind: 'function' });
  if (version >= 2) legacyExports.push({ name: 'resize_grid', kind: 'function' }, { name: 'resolve_grid_tracks', kind: 'function' });
  if (version >= 3) legacyExports.push({ name: 'resize_grid_cells', kind: 'function' }, { name: 'place_grid_cells', kind: 'function' });
  if (version >= 4) legacyExports.push({ name: 'resize_flow', kind: 'function' }, { name: 'place_flow', kind: 'function' }, { name: 'place_cross', kind: 'function' });
  if (version === 5) legacyExports.push({ name: 'layout_abi_v1', kind: 'function' });
  if (version >= 6) legacyExports.push({ name: version === 10 ? 'layout_abi_v5' : version === 6 ? 'layout_abi_v2' : version === 9 ? 'layout_abi_v4' : 'layout_abi_v3', kind: 'function' }, { name: 'resize_main_auto', kind: 'function' }, { name: 'place_main_auto', kind: 'function' });
  if (version >= 8) legacyExports.push({ name: 'place_wrap_main_auto', kind: 'function' });
  vi.spyOn(WebAssembly.Module, 'exports').mockReturnValue(legacyExports);
  expect(() => publishLayoutModule({} as WebAssembly.Module)).toThrow('ABI is incompatible');
  expect(hasReadyLayoutModule()).toBe(false);
});


it('rejects ABI v6 when the baseline placement export is absent', async () => {
  vi.resetModules();
  const { publishLayoutModule, hasReadyLayoutModule } = await import('./module.js');
  const exports: WebAssembly.ModuleExportDescriptor[] = [
    { name: 'memory', kind: 'memory' }, { name: 'solve', kind: 'function' }, { name: 'dispose', kind: 'function' },
    { name: 'arena_create', kind: 'function' }, { name: 'arena_generation', kind: 'function' }, { name: 'arena_dispose', kind: 'function' },
    { name: 'resize_grid', kind: 'function' }, { name: 'resolve_grid_tracks', kind: 'function' },
    { name: 'resize_grid_cells', kind: 'function' }, { name: 'place_grid_cells', kind: 'function' },
    { name: 'resize_flow', kind: 'function' }, { name: 'place_flow', kind: 'function' }, { name: 'place_cross', kind: 'function' },
    { name: 'resize_main_auto', kind: 'function' }, { name: 'place_main_auto', kind: 'function' }, { name: 'place_wrap_main_auto', kind: 'function' },
    { name: 'layout_abi_v6', kind: 'function' },
  ];
  vi.spyOn(WebAssembly.Module, 'exports').mockReturnValue(exports);
  expect(() => publishLayoutModule({} as WebAssembly.Module)).toThrow('ABI is incompatible');
  expect(hasReadyLayoutModule()).toBe(false);
});
