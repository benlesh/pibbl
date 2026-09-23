import { describe, expect, it, vi } from 'vitest';
import {
  acquireInternalWebGLTexture,
  createInternalWebGLTexture,
  getInternalWebGLTextureData,
} from './texture.js';

describe('decoded WebGL textures', () => {
  it('snapshots one decoded image with an immutable normalized sampler', () => {
    const bitmap = {
      width: 3,
      height: 5,
      close: vi.fn(),
    } as unknown as ImageBitmap;

    const producer = createInternalWebGLTexture(bitmap, {
      wrapS: 'mirrored-repeat',
      minFilter: 'linear-mipmap-linear',
    });
    const data = getInternalWebGLTextureData(producer.texture);

    expect(data).toMatchObject({
      width: 3,
      height: 5,
      bitmap,
      sampler: {
        wrapS: 'mirrored-repeat',
        wrapT: 'repeat',
        minFilter: 'linear-mipmap-linear',
        magFilter: 'linear',
      },
    });
    expect(Object.isFrozen(producer.texture)).toBe(true);
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.sampler)).toBe(true);
  });

  it('closes the decoded bitmap when its producer releases the final lease', () => {
    const close = vi.fn();
    const bitmap = { width: 2, height: 2, close } as unknown as ImageBitmap;
    const producer = createInternalWebGLTexture(bitmap);

    producer.release();
    producer.release();

    expect(close).toHaveBeenCalledOnce();
    expect(() => getInternalWebGLTextureData(producer.texture))
      .toThrow('WebGL texture descriptor is invalid or released.');
  });

  it('keeps shared decoded data alive until every dependency lease releases', () => {
    const close = vi.fn();
    const bitmap = { width: 2, height: 2, close } as unknown as ImageBitmap;
    const producer = createInternalWebGLTexture(bitmap);
    const releaseFirst = acquireInternalWebGLTexture(producer.texture);
    const releaseSecond = acquireInternalWebGLTexture(producer.texture);
    producer.release();
    releaseFirst();
    releaseFirst();

    expect(close).not.toHaveBeenCalled();
    expect(getInternalWebGLTextureData(producer.texture).bitmap).toBe(bitmap);

    releaseSecond();
    expect(close).toHaveBeenCalledOnce();
  });
});
