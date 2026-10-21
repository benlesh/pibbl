import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareLayoutEngineSync } from './embedded.js';
import { bytes as embeddedBytes } from './bytes.js';
import { getPreparedLayoutModule, prepareLayoutEngine } from './loader.js';
import { resetPreparedLayoutModuleForTest } from './module-cache.js';

const minimalModule = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

function generatedKernel(): Uint8Array {
  return Uint8Array.from(atob(embeddedBytes), character => character.charCodeAt(0));
}

function response(bytes = generatedKernel()): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as Response;
}

beforeEach(() => {
  resetPreparedLayoutModuleForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetPreparedLayoutModuleForTest();
});

describe('layout WASM preparation', () => {
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

  it('keeps import inert and shares one external compile attempt', async () => {
    const fetch = vi.fn(async () => response());
    const compile = vi.spyOn(WebAssembly, 'compile');
    vi.stubGlobal('fetch', fetch);

    expect(() => getPreparedLayoutModule()).toThrow(/not been prepared/i);
    expect(fetch).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();

    const first = prepareLayoutEngine();
    const second = prepareLayoutEngine();
    await Promise.all([first, second]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(getPreparedLayoutModule()).toBeInstanceOf(WebAssembly.Module);
  });

  it('evicts a failed external attempt so the next caller retries', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetch);

    await expect(prepareLayoutEngine()).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'offline' }),
    });
    await expect(prepareLayoutEngine()).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects a valid but fingerprint-mismatched module before publishing it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(minimalModule)));
    const compile = vi.spyOn(WebAssembly, 'compile');

    await expect(prepareLayoutEngine()).rejects.toMatchObject({
      cause: expect.objectContaining({ message: expect.stringMatching(/fingerprint/i) }),
    });
    expect(compile).not.toHaveBeenCalled();
    expect(() => getPreparedLayoutModule()).toThrow(/not been prepared/i);
  });

  it('publishes synchronous preparation to pending async waiters', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(resolve => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetch);

    const pending = prepareLayoutEngine();
    prepareLayoutEngineSync();
    await expect(pending).resolves.toBeUndefined();
    const prepared = getPreparedLayoutModule();

    resolveFetch(response(minimalModule));
    await Promise.resolve();
    expect(getPreparedLayoutModule()).toBe(prepared);
  });
});
