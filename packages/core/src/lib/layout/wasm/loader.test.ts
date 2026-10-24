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

it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])('rejects older or incomplete layout ABI exports before publishing compiled code (generation=%s)', async version => {
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
  if (version >= 11) legacyExports.push({ name: 'layout_abi_v6', kind: 'function' });
  vi.spyOn(WebAssembly.Module, 'exports').mockReturnValue(legacyExports);
  expect(() => publishLayoutModule({} as WebAssembly.Module)).toThrow('ABI is incompatible');
  expect(hasReadyLayoutModule()).toBe(false);
});


const abiV9Exports: WebAssembly.ModuleExportDescriptor[] = [
  { name: 'memory', kind: 'memory' }, { name: 'solve', kind: 'function' }, { name: 'dispose', kind: 'function' },
  { name: 'arena_create', kind: 'function' }, { name: 'arena_generation', kind: 'function' }, { name: 'arena_dispose', kind: 'function' },
  { name: 'resize_grid', kind: 'function' }, { name: 'resolve_grid_tracks', kind: 'function' },
  { name: 'resize_grid_cells', kind: 'function' }, { name: 'place_grid_cells', kind: 'function' },
  { name: 'resize_flow', kind: 'function' }, { name: 'place_flow', kind: 'function' }, { name: 'place_cross', kind: 'function' },
  { name: 'resize_main_auto', kind: 'function' }, { name: 'place_main_auto', kind: 'function' }, { name: 'place_wrap_main_auto', kind: 'function' },
  { name: 'prepare_intrinsic_main_queries', kind: 'function' },
  { name: 'resize_intrinsic_main', kind: 'function' }, { name: 'resolve_intrinsic_main', kind: 'function' }, { name: 'intrinsic_main_result', kind: 'function' }, { name: 'intrinsic_main_contribution', kind: 'function' },
  { name: 'place_first_baseline', kind: 'function' }, { name: 'layout_abi_v9', kind: 'function' },
];

it.each(['prepare_intrinsic_main_queries', 'resize_intrinsic_main', 'resolve_intrinsic_main', 'intrinsic_main_result', 'intrinsic_main_contribution'])(
  'rejects ABI v9 when %s is absent',
  async absent => {
    vi.resetModules();
    const { publishLayoutModule, hasReadyLayoutModule } = await import('./module.js');
    vi.spyOn(WebAssembly.Module, 'exports').mockReturnValue(abiV9Exports.filter(entry => entry.name !== absent));
    expect(() => publishLayoutModule({} as WebAssembly.Module)).toThrow('ABI is incompatible');
    expect(hasReadyLayoutModule()).toBe(false);
  },
);


it('rejects the complete previous ABI before accepting main contribution results', async () => {
  vi.resetModules();
  const { publishLayoutModule, hasReadyLayoutModule } = await import('./module.js');
  const prior = abiV9Exports.filter(entry => entry.name !== 'prepare_intrinsic_main_queries')
    .map(entry => entry.name === 'layout_abi_v9' ? { ...entry, name: 'layout_abi_v8' } : entry);
  vi.spyOn(WebAssembly.Module, 'exports').mockReturnValue(prior);
  expect(() => publishLayoutModule({} as WebAssembly.Module)).toThrow('ABI is incompatible');
  expect(hasReadyLayoutModule()).toBe(false);
});
