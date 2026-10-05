import type { SpriteSheetFormat, SpriteFrameData, SpriteAnimationFrameData } from '../model.js';
/** Import Aseprite JSON hash or array exports, including frame tags and millisecond timing. See {@link SpriteSheetFormat}.
 * @returns An explicit atlas metadata adapter.
 */
export function aseprite(): SpriteSheetFormat {
  return { parse(data: unknown) {
    const value = data as { frames: Record<string, Entry> | Entry[]; meta: { image: string; frameTags?: { name: string; from: number; to: number; direction?: string }[] } };
    if (!value?.frames || typeof value.meta?.image !== 'string') throw new TypeError('Expected Aseprite frames and meta.image.');
    const entries = Array.isArray(value.frames) ? value.frames.map((entry, index) => [entry.filename ?? String(index), entry] as const) : Object.entries(value.frames);
    const frames: SpriteFrameData[] = entries.map(([name, entry]) => ({ name, rect: { x: entry.frame.x, y: entry.frame.y, width: entry.frame.w, height: entry.frame.h }, sourceSize: entry.sourceSize && { width: entry.sourceSize.w, height: entry.sourceSize.h }, trim: entry.spriteSourceSize && { x: entry.spriteSourceSize.x, y: entry.spriteSourceSize.y }, rotated: entry.rotated }));
    const animations: Record<string, SpriteAnimationFrameData[]> = Object.create(null);
    for (const tag of value.meta.frameTags ?? []) {
      if (!Number.isInteger(tag.from) || !Number.isInteger(tag.to) || tag.from < 0 || tag.to < tag.from || tag.to >= entries.length) throw new RangeError(`Invalid Aseprite tag: ${tag.name}`);
      let selected = entries.slice(tag.from, tag.to + 1);
      const direction = tag.direction ?? 'forward';
      if (!['forward', 'reverse', 'pingpong', 'pingpong_reverse'].includes(direction)) throw new Error(`Unsupported Aseprite direction: ${direction}`);
      if (direction === 'reverse' || direction === 'pingpong_reverse') selected.reverse();
      if (direction.startsWith('pingpong')) selected = [...selected, ...selected.slice(1, -1).reverse()];
      animations[tag.name] = selected.map(([frame, entry]) => ({ frame, duration: entry.duration }));
    }
    return { images: [value.meta.image], frames, animations };
  } };
}
interface Entry {
  filename?: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated?: boolean;
  sourceSize?: { w: number; h: number };
  spriteSourceSize?: { x: number; y: number };
  duration: number;
}
