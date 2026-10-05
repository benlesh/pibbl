import { defineSpriteAnimation, makeFrame, type SpriteFrame, type SpriteFrameData, type SpriteSheetFormat } from './model.js';
import type { PibblAnimationDefinition } from '../../lib/animation/types.js';
/** Shared decoded atlas and immutable frames/clips. Dispose after all consumers unmount. See {@link SpriteFrame}. */
export interface SpriteSheet {
  /** Frames indexed by atlas name or numeric grid index. */ readonly frames: Readonly<Record<string | number, SpriteFrame>>;
  /** Named, seekable animation definitions from the atlas. */ readonly animations: Readonly<Record<string, PibblAnimationDefinition<SpriteFrame>>>;
  /** Release decoded images; unmount every consumer before calling. */ readonly dispose: () => void;
}
/** Dimensions of a regular grid, in image pixels. See {@link SpriteFrame}. */
export interface SpriteGrid { /** Positive cell width in pixels. */ readonly frameWidth: number; /** Positive cell height in pixels. */ readonly frameHeight: number; /** Outer border width in pixels; defaults to zero. */ readonly margin?: number; /** Gap between cells in pixels; defaults to zero. */ readonly spacing?: number }
/** Load a grid image or metadata through an explicitly supplied import adapter. See {@link SpriteFrame}. 
 * @param url - Grid image URL or atlas metadata URL.
 * @param options - Grid dimensions or an explicit metadata format adapter.
 * @returns A decoded sprite sheet with explicit disposal ownership.
 */
export async function loadSpriteSheet(url: string, options: { readonly grid: SpriteGrid } | { readonly format: SpriteSheetFormat }): Promise<SpriteSheet> {
  const owner = { disposed: false };
  const images: HTMLImageElement[] = [];
  const dispose = () => { if (owner.disposed) return; owner.disposed = true; for (const image of images) image.removeAttribute('src'); };
  const load = async (source: string) => {
    const image = new globalThis.Image(); images.push(image); image.src = source; await image.decode(); return image;
  };
  try {
    let specs: readonly SpriteFrameData[];
    let clips: Readonly<Record<string, readonly { frame: string; duration: number }[]>> = {};
    if ('grid' in options) {
      const { frameWidth: w, frameHeight: h, margin = 0, spacing = 0 } = options.grid;
      if (![w, h, margin, spacing].every(Number.isInteger) || w <= 0 || h <= 0 || margin < 0 || spacing < 0) throw new RangeError('Invalid sprite grid dimensions.');
      const image = await load(url); const frames: SpriteFrameData[] = [];
      for (let y = margin; y + h <= image.naturalHeight - margin; y += h + spacing)
        for (let x = margin; x + w <= image.naturalWidth - margin; x += w + spacing)
          frames.push({ name: String(frames.length), rect: { x, y, width: w, height: h } });
      if (!frames.length) throw new RangeError('Sprite grid contains no complete frames.');
      specs = frames;
    } else {
      const response = await fetch(url); if (!response.ok) throw new Error(`Sprite metadata failed: ${response.status}`);
      const data = options.format.parse(await response.json());
      for (const path of data.images) await load(new URL(path, new URL(url, document.baseURI)).href);
      specs = data.frames; clips = data.animations ?? {};
    }
    const frames: Record<string, SpriteFrame> = Object.create(null);
    for (const spec of specs) {
      const image = images[spec.page ?? 0], r = spec.rect;
      if (!image || ![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > image.naturalWidth || r.y + r.height > image.naturalHeight) throw new RangeError(`Invalid sprite rectangle: ${spec.name}`);
      if (frames[spec.name]) throw new Error(`Duplicate sprite frame: ${spec.name}`);
      const width = spec.sourceSize?.width ?? (spec.rotated ? r.height : r.width);
      const height = spec.sourceSize?.height ?? (spec.rotated ? r.width : r.height);
      const trim = { x: spec.trim?.x ?? 0, y: spec.trim?.y ?? 0 };
      if (![width, height, trim.x, trim.y].every(Number.isFinite) || width <= 0 || height <= 0 || trim.x < 0 || trim.y < 0 || trim.x + (spec.rotated ? r.height : r.width) > width || trim.y + (spec.rotated ? r.width : r.height) > height) throw new RangeError(`Invalid sprite logical bounds: ${spec.name}`);
      frames[spec.name] = makeFrame({ ...spec, rect: Object.freeze({ ...r }), sourceSize: Object.freeze({ width, height }), trim: Object.freeze(trim), image, owner });
    }
    const animations: Record<string, PibblAnimationDefinition<SpriteFrame>> = Object.create(null);
    for (const [name, entries] of Object.entries(clips)) animations[name] = defineSpriteAnimation({ frames: entries.map(entry => {
      if (!frames[entry.frame]) throw new Error(`Unknown sprite frame: ${entry.frame}`);
      return { frame: frames[entry.frame], duration: entry.duration };
    }) });
    return Object.freeze({ frames: Object.freeze(frames), animations: Object.freeze(animations), dispose });
  } catch (error) { dispose(); throw error; }
}
