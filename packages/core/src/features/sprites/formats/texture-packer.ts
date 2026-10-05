import type { SpriteSheetFormat } from '../model.js';
/** Import TexturePacker JSON hash/array rectangles with clockwise packed rotation and trim offsets. See {@link SpriteSheetFormat}.
 * @returns An explicit atlas metadata adapter.
 */
export function texturePacker(): SpriteSheetFormat {
  return { parse(data: unknown) {
    const value = data as { frames: Record<string, Entry> | Entry[]; meta: { image: string; scale?: string; related_multi_packs?: string[] } };
    if (!value?.frames || typeof value.meta?.image !== 'string') throw new TypeError('Expected TexturePacker frames and meta.image.');
    if (value.meta.related_multi_packs?.length) throw new Error('Linked TexturePacker multipacks are not supported yet.');
    if (value.meta.scale !== undefined && Number(value.meta.scale) !== 1) throw new Error('TexturePacker scale must be 1.');
    const entries = Array.isArray(value.frames) ? value.frames.map((entry, index) => [entry.filename ?? String(index), entry] as const) : Object.entries(value.frames);
    return { images: [value.meta.image], frames: entries.map(([name, entry]) => ({ name, rect: { x: entry.frame.x, y: entry.frame.y, width: entry.frame.w, height: entry.frame.h }, sourceSize: entry.sourceSize && { width: entry.sourceSize.w, height: entry.sourceSize.h }, trim: entry.spriteSourceSize && { x: entry.spriteSourceSize.x, y: entry.spriteSourceSize.y }, rotated: entry.rotated })) };
  } };
}
interface Entry { filename?: string; frame: { x: number; y: number; w: number; h: number }; rotated?: boolean; sourceSize?: { w: number; h: number }; spriteSourceSize?: { x: number; y: number } }
