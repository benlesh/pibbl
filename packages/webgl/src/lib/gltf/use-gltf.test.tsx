import { crc, type CRCController } from '@crc/core';
import {
  crcInternalCurrentRenderOwner,
  crcInternalRequestRendererWork,
  type CRCInternalRenderOwner,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGLTF, type CRCWebGLAssetLoadResult } from '../../gltf.js';
import { getInternalWebGLAssetData } from '../assets/asset.js';
import { makeGLB, staticTriangleFixture } from './test-fixtures.js';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('useGLTF', () => {
  it('starts URL work only after a successful render and publishes ready through scheduling', async () => {
    const frames = new ManualFrames();
    const response = deferred<Response>();
    const fetch = vi.fn<
      (input: string | URL, init?: RequestInit) => Promise<Response>
    >(() => response.promise);
    vi.stubGlobal('fetch', fetch);
    const bitmap = fakeBitmap();
    const createImageBitmap = vi.fn<
      (image: Blob, options?: ImageBitmapOptions) => Promise<ImageBitmap>
    >(async () => bitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    const results: CRCWebGLAssetLoadResult[] = [];
    function Probe(): void {
      results.push(useGLTF('/model.glb'));
    }

    const controller = crc(createCanvas(), <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    expect(fetch).not.toHaveBeenCalled();
    frames.flush(1);
    expect(results).toEqual([{ status: 'loading' }]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![0]).toBe('/model.glb');
    expect(fetch.mock.calls[0]![1]).toMatchObject({ mode: 'cors' });
    expect(fetch.mock.calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);

    response.resolve(new Response(validGLB()));
    await waitForFrame(frames);
    expect(results).toHaveLength(1);
    frames.flush(2);
    expect(results[1]?.status).toBe('ready');
    const ready = results[1];
    if (ready?.status !== 'ready') throw new Error('Expected ready result.');
    expect(getInternalWebGLAssetData(ready.asset).primitives).toHaveLength(4);
    expect(createImageBitmap).toHaveBeenCalledOnce();
    const [blob, options] = createImageBitmap.mock.calls[0]!;
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe('image/png');
    expect(options).toEqual({
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
    });
    expect(frames.pendingCount).toBe(0);

    controller.dispose();
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(() => getInternalWebGLAssetData(ready.asset)).toThrow(
      'WebGL asset descriptor is invalid or released.',
    );
  });

  it('does not start a provisional generation when the render transaction fails', () => {
    const frames = new ManualFrames();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    function Probe(): void {
      useGLTF('/never.glb');
    }
    function Broken(): never {
      throw new Error('expected sibling failure');
    }

    const controller = crc(createCanvas(), <><Probe /><Broken /></>, {
      pixelRatio: 1,
    });
    controllers.add(controller);
    expect(() => frames.flush(1)).toThrow('expected sibling failure');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps one same-source generation and reports actionable load errors as values', async () => {
    const frames = new ManualFrames();
    const failure = new TypeError('network unavailable');
    const fetch = vi.fn(async () => {
      throw failure;
    });
    vi.stubGlobal('fetch', fetch);
    const results: CRCWebGLAssetLoadResult[] = [];
    const canvas = createCanvas();
    function Probe(): void {
      results.push(useGLTF(new URL('https://assets.example/broken.glb')));
    }
    const controller = crc(canvas, <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    await waitForFrame(frames);
    frames.flush(2);

    expect(results[1]?.status).toBe('error');
    if (results[1]?.status !== 'error') throw new Error('Expected error result.');
    expect(results[1].error.message).toMatch(/broken\.glb.*network unavailable/iu);
    expect(results[1].error.cause).toBe(failure);

    crc(canvas, <Probe />);
    frames.flush(3);
    expect(results[2]).toBe(results[1]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects an advertised GLB over the decode ceiling before consuming its body', async () => {
    const frames = new ManualFrames();
    const reader = trackedReader([]);
    vi.stubGlobal('fetch', vi.fn(async () => responseWithReader(reader, {
      'content-length': String(256 * 1024 * 1024 + 1),
    })));
    const results: CRCWebGLAssetLoadResult[] = [];
    function Probe(): void {
      results.push(useGLTF('/too-large.glb'));
    }

    const controller = crc(createCanvas(), <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    await waitForFrame(frames);
    frames.flush(2);

    expect(results[1]?.status).toBe('error');
    if (results[1]?.status !== 'error') throw new Error('Expected error result.');
    expect(results[1].error.message).toMatch(/GLB byteLength .* exceeds limit/iu);
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('cancels and releases a chunked body when it crosses the decode ceiling', async () => {
    const frames = new ManualFrames();
    const reader = trackedReader([
      oversizedChunk(256 * 1024 * 1024 + 1),
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => responseWithReader(reader)));
    const results: CRCWebGLAssetLoadResult[] = [];
    function Probe(): void {
      results.push(useGLTF('/chunked-too-large.glb'));
    }

    const controller = crc(createCanvas(), <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    await waitForFrame(frames);
    frames.flush(2);

    expect(results[1]?.status).toBe('error');
    if (results[1]?.status !== 'error') throw new Error('Expected error result.');
    expect(results[1].error.message).toMatch(/GLB byteLength .* exceeds limit/iu);
    expect(reader.cancel).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it('allows a content-length exactly at the decode ceiling to proceed to normal GLB validation', async () => {
    const frames = new ManualFrames();
    const reader = trackedReader([new Uint8Array(12)]);
    vi.stubGlobal('fetch', vi.fn(async () => responseWithReader(reader, {
      'content-length': String(256 * 1024 * 1024),
    })));
    const results: CRCWebGLAssetLoadResult[] = [];
    function Probe(): void {
      results.push(useGLTF('/ceiling.glb'));
    }

    const controller = crc(createCanvas(), <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    await waitForFrame(frames);
    frames.flush(2);

    expect(results[1]?.status).toBe('error');
    if (results[1]?.status !== 'error') throw new Error('Expected error result.');
    expect(results[1].error.message).toMatch(/GLB header byte 0 has invalid magic/iu);
    expect(reader.read).toHaveBeenCalled();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it('cancels and releases an in-flight body reader when its source becomes stale', async () => {
    const frames = new ManualFrames();
    const pendingRead = deferred<ReadableStreamReadResult<Uint8Array>>();
    const reader = {
      read: vi.fn(() => pendingRead.promise),
      cancel: vi.fn(async () => {
        pendingRead.resolve({ done: true, value: undefined });
      }),
      releaseLock: vi.fn(),
    } as unknown as ReadableStreamDefaultReader<Uint8Array> & {
      readonly read: ReturnType<typeof vi.fn>;
      readonly cancel: ReturnType<typeof vi.fn>;
      readonly releaseLock: ReturnType<typeof vi.fn>;
    };
    let request = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      request += 1;
      return request === 1 ? responseWithReader(reader) : new Response(validGLB());
    }));
    vi.stubGlobal('createImageBitmap', vi.fn(async () => fakeBitmap()));
    let source = '/first.glb';
    const results: CRCWebGLAssetLoadResult[] = [];
    function Probe(): void {
      results.push(useGLTF(source));
    }

    const canvas = createCanvas();
    const controller = crc(canvas, <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    await waitFor(() => expect(reader.read).toHaveBeenCalledOnce());

    source = '/second.glb';
    crc(canvas, <Probe />);
    frames.flush(2);
    await waitFor(() => expect(reader.releaseLock).toHaveBeenCalledOnce());
    await waitForFrame(frames);
    frames.flush(3);

    expect(reader.cancel).toHaveBeenCalledOnce();
    expect(results.at(-1)?.status).toBe('ready');
  });

  it('copies ArrayBuffer bytes before async decode and compares buffers by identity', async () => {
    const frames = new ManualFrames();
    const first = validGLB();
    const second = first.slice(0);
    const image = deferred<ImageBitmap>();
    const decodeImage = vi.fn(() => image.promise);
    vi.stubGlobal('createImageBitmap', decodeImage);
    let source = first;
    const results: CRCWebGLAssetLoadResult[] = [];
    const canvas = createCanvas();
    function Probe(): void {
      results.push(useGLTF(source));
    }
    const controller = crc(canvas, <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    new Uint8Array(first).fill(0);
    const firstBitmap = fakeBitmap();
    image.resolve(firstBitmap as unknown as ImageBitmap);
    await waitForFrame(frames);
    frames.flush(2);
    expect(results[1]?.status).toBe('ready');

    crc(canvas, <Probe />);
    frames.flush(3);
    expect(results[2]).toBe(results[1]);

    source = second;
    const secondBitmap = fakeBitmap();
    decodeImage.mockResolvedValueOnce(
      secondBitmap as unknown as ImageBitmap,
    );
    crc(canvas, <Probe />);
    frames.flush(4);
    expect(results[3]).toEqual({ status: 'loading' });
    expect(firstBitmap.close).toHaveBeenCalledOnce();
    await waitForFrame(frames);
    frames.flush(5);
    expect(results[4]?.status).toBe('ready');
  });

  it('aborts retired URL fetches and releases a stale decoded candidate exactly once', async () => {
    const frames = new ManualFrames();
    const firstFetch = deferred<Response>();
    const secondFetch = deferred<Response>();
    const requests: Array<{ url: string; signal: AbortSignal }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string | URL, init?: RequestInit) => {
      requests.push({ url: String(url), signal: init!.signal as AbortSignal });
      return requests.length === 1 ? firstFetch.promise : secondFetch.promise;
    }));
    const firstImage = deferred<ImageBitmap>();
    const secondImage = deferred<ImageBitmap>();
    vi.stubGlobal('createImageBitmap', vi.fn()
      .mockImplementationOnce(() => firstImage.promise)
      .mockImplementationOnce(() => secondImage.promise));
    let source = '/first.glb';
    const results: CRCWebGLAssetLoadResult[] = [];
    const canvas = createCanvas();
    function Probe(): void {
      results.push(useGLTF(source));
    }
    const controller = crc(canvas, <Probe />, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    firstFetch.resolve(new Response(validGLB()));
    await waitFor(() => expect(createImageBitmap).toHaveBeenCalledTimes(1));

    source = '/second.glb';
    crc(canvas, <Probe />);
    frames.flush(2);
    expect(results[1]).toEqual({ status: 'loading' });
    expect(requests[0]!.signal.aborted).toBe(true);
    secondFetch.resolve(new Response(validGLB()));
    await waitFor(() => expect(createImageBitmap).toHaveBeenCalledTimes(2));
    const secondBitmap = fakeBitmap();
    secondImage.resolve(secondBitmap as unknown as ImageBitmap);
    await waitForFrame(frames);
    frames.flush(3);
    expect(results[2]?.status).toBe('ready');

    const firstBitmap = fakeBitmap();
    firstImage.resolve(firstBitmap as unknown as ImageBitmap);
    await settlePromises();
    expect(frames.pendingCount).toBe(0);
    expect(firstBitmap.close).toHaveBeenCalledOnce();
    expect(secondBitmap.close).not.toHaveBeenCalled();

    controller.dispose();
    expect(firstBitmap.close).toHaveBeenCalledOnce();
    expect(secondBitmap.close).toHaveBeenCalledOnce();
  });

  it('cancels pending work on removal and gives two hook instances independent loads', async () => {
    const frames = new ManualFrames();
    const responses = [deferred<Response>(), deferred<Response>()];
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string | URL, init?: RequestInit) => {
      signals.push(init!.signal as AbortSignal);
      return responses[signals.length - 1]!.promise;
    }));
    function Probe(): void {
      useGLTF('/shared.glb');
    }
    const canvas = createCanvas();
    const controller = crc(canvas, <><Probe /><Probe /></>, { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);

    crc(canvas, undefined);
    frames.flush(2);
    expect(signals.map(signal => signal.aborted)).toEqual([true, true]);
    responses[0]!.reject(new DOMException('aborted', 'AbortError'));
    responses[1]!.reject(new DOMException('aborted', 'AbortError'));
    await settlePromises();
    expect(frames.pendingCount).toBe(0);
  });

  it('does not commit a source replacement from a failed update render', async () => {
    const frames = new ManualFrames();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(validGLB())));
    vi.stubGlobal('createImageBitmap', vi.fn(async () => fakeBitmap()));
    let source = '/first.glb';
    let failComposition = false;
    let owner!: CRCInternalRenderOwner;
    const workKey = {};
    const results: CRCWebGLAssetLoadResult[] = [];
    function Probe(): void {
      results.push(useGLTF(source));
    }
    function LaterSibling(): void {
      owner ??= crcInternalCurrentRenderOwner();
    }
    const scene = () => <><Probe /><LaterSibling /></>;
    const canvas = createCanvas();
    const controller = crc(canvas, scene(), { pixelRatio: 1 });
    controllers.add(controller);
    frames.flush(1);
    await waitForFrame(frames);
    frames.flush(2);
    expect(results[1]?.status).toBe('ready');
    crcInternalRequestRendererWork(owner, {
      key: workKey,
      kind: 'compose',
      run: () => {
        if (failComposition) throw new Error('expected composition failure');
      },
    });

    source = '/second.glb';
    failComposition = true;
    crc(canvas, scene());
    expect(() => frames.flush(3)).toThrow('expected composition failure');
    expect(results[2]).toEqual({ status: 'loading' });
    expect(fetch).toHaveBeenCalledOnce();

    source = '/first.glb';
    failComposition = false;
    crc(canvas, scene());
    frames.flush(4);
    expect(results[3]).toBe(results[1]);
    expect(fetch).toHaveBeenCalledOnce();
  });
});

function validGLB(): ArrayBuffer {
  const fixture = staticTriangleFixture();
  return makeGLB(fixture.document, fixture.binary);
}

function fakeBitmap(): ImageBitmap & { close: ReturnType<typeof vi.fn> } {
  return {
    width: 2,
    height: 3,
    close: vi.fn(),
  } as unknown as ImageBitmap & { close: ReturnType<typeof vi.fn> };
}

function trackedReader(chunks: readonly Uint8Array[]): ReadableStreamDefaultReader<Uint8Array> & {
  readonly read: ReturnType<typeof vi.fn>;
  readonly cancel: ReturnType<typeof vi.fn>;
  readonly releaseLock: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  const reader = {
    read: vi.fn(async () => {
      const value = chunks[index++];
      return value === undefined ? { done: true, value: undefined } : { done: false, value };
    }),
    cancel: vi.fn(async () => undefined),
    releaseLock: vi.fn(),
  };
  return reader as unknown as ReadableStreamDefaultReader<Uint8Array> & typeof reader;
}

function responseWithReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(headers),
    body: { getReader: () => reader },
  } as unknown as Response;
}

function oversizedChunk(byteLength: number): Uint8Array {
  const chunk = new Uint8Array(1);
  Object.defineProperty(chunk, 'byteLength', { value: byteLength });
  return chunk;
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(assertion: () => void): Promise<void> {
  await vi.waitFor(assertion, { timeout: 1_000, interval: 1 });
}

async function waitForFrame(frames: ManualFrames): Promise<void> {
  await waitFor(() => expect(frames.pendingCount).toBe(1));
}

async function settlePromises(): Promise<void> {
  for (let count = 0; count < 8; count += 1) await Promise.resolve();
}

class ManualFrames {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 1;

  constructor() {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => {
      this.callbacks.delete(id);
    });
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }

  flush(timestamp: number): void {
    const entry = this.callbacks.entries().next().value;
    if (!entry) throw new Error('No pending CRC frame.');
    const [id, callback] = entry;
    this.callbacks.delete(id);
    callback(timestamp);
  }
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  return canvas;
}
