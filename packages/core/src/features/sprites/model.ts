import { defineAnimation } from '../../lib/animation/definition.js';
import type { PibblAnimationDefinition } from '../../lib/animation/types.js';

/** Pixel rectangle within an atlas page or original frame. See {@link SpriteFrame}. */
export interface SpriteRectangle { /** Horizontal pixel offset. */ readonly x: number; /** Vertical pixel offset. */ readonly y: number; /** Width in pixels. */ readonly width: number; /** Height in pixels. */ readonly height: number }
/** Normalized frame information returned by a format adapter. See {@link SpriteFrame}. */
export interface SpriteFrameData {
  /** Unique frame name in this sheet. */ readonly name: string;
  /** Zero-based atlas page index; defaults to zero. */ readonly page?: number;
  /** Packed rectangle within the atlas page. */ readonly rect: SpriteRectangle;
  /** Original frame dimensions before trimming. */ readonly sourceSize?: Readonly<{ /** Width in pixels. */ width: number; /** Height in pixels. */ height: number }>;
  /** Trimmed content offset within the original frame. */ readonly trim?: Readonly<{ /** Horizontal pixel offset. */ x: number; /** Vertical pixel offset. */ y: number }>;
  /** Whether the packed rectangle is rotated clockwise. */ readonly rotated?: boolean;
}
/** One normalized timed frame reference. Durations are milliseconds. See {@link SpriteFrame}. */
export interface SpriteAnimationFrameData { /** Name of the frame used by this animation step. */ readonly frame: string; /** Positive duration of the animation step in milliseconds. */ readonly duration: number }
/** Adapter result. Image paths resolve relative to the metadata URL. See {@link SpriteFrame}. */
export interface SpriteSheetData {
  /** Atlas image URLs, relative to the metadata URL. */ readonly images: readonly string[];
  /** Normalized frame records for this sheet. */ readonly frames: readonly SpriteFrameData[];
  /** Named sequences of timed frame references. */ readonly animations?: Readonly<Record<string, readonly SpriteAnimationFrameData[]>>;
}
/** Import adapter; loaders invoke this directly without a format registry. See {@link SpriteFrame}. */
export interface SpriteSheetFormat { /** Convert decoded metadata to normalized sheet data.
 * @param data - Parsed atlas JSON.
 * @returns Validated adapter data for loading the sheet.
 */ readonly parse: (data: unknown) => SpriteSheetData }

export interface FrameRecord extends SpriteFrameData { readonly image: HTMLImageElement; readonly owner: { disposed: boolean } }
const records = new WeakMap<SpriteFrame, FrameRecord>();
/** Immutable atlas frame. Obtain frames from loadSpriteSheet; images belong to the sheet. See {@link SpriteFrame}. */
export class SpriteFrame {
  private readonly identity = true;
  /** Original logical frame width, before transparent borders were trimmed.
   * @returns Width in logical pixels.
   */
  get width(): number { return frameRecord(this).sourceSize?.width ?? frameRecord(this).rect.width; }
  /** Original logical frame height, before transparent borders were trimmed.
   * @returns Height in logical pixels.
   */
  get height(): number { return frameRecord(this).sourceSize?.height ?? frameRecord(this).rect.height; }
  /** Stable name supplied by the atlas or numeric grid index.
   * @returns The frame name.
   */
  get name(): string { void this.identity; return frameRecord(this).name; }
}
export function makeFrame(record: FrameRecord): SpriteFrame {
  const frame = new SpriteFrame(); records.set(frame, record); Object.freeze(frame); return frame;
}
export function frameRecord(frame: SpriteFrame): FrameRecord {
  const record = records.get(frame);
  if (!record) throw new TypeError('Expected a SpriteFrame from loadSpriteSheet.');
  if (record.owner.disposed) throw new Error('Sprite sheet has been disposed.');
  return record;
}
/** Author a finite discrete animation using FPS or explicit positive millisecond durations. See {@link SpriteFrame}.
 * @param options - Frames with a shared FPS or individual millisecond durations.
 * @returns A seekable discrete animation definition.
 */
export function defineSpriteAnimation(options: {
  readonly frames: readonly SpriteFrame[];
  readonly fps: number;
} | {
  readonly frames: readonly Readonly<{ frame: SpriteFrame; duration: number }>[];
}): PibblAnimationDefinition<SpriteFrame> {
  if (!options.frames.length) throw new RangeError('Sprite animation requires at least one frame.');
  if ('fps' in options && (!Number.isFinite(options.fps) || options.fps <= 0)) throw new RangeError('Sprite FPS must be finite and positive.');
  const entries = options.frames.map(item => {
    const entry = 'fps' in options ? { frame: item as SpriteFrame, duration: 1000 / options.fps } : item as { frame: SpriteFrame; duration: number };
    frameRecord(entry.frame);
    if (!Number.isFinite(entry.duration) || entry.duration <= 0) throw new RangeError('Sprite duration must be finite and positive.');
    return { ...entry };
  });
  let duration = 0;
  const ends = entries.map(entry => duration += entry.duration);
  return defineAnimation({ duration, sample: ({ localTime }) => {
    let low = 0, high = ends.length - 1;
    while (low < high) { const mid = (low + high) >>> 1; if (localTime < ends[mid]) high = mid; else low = mid + 1; }
    return entries[low].frame;
  } });
}
