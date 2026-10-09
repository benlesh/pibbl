/** Options for capturing committed renders of one live Pibbl root.
 * @see {@link PibblFrameRecordingSession}
 */
export interface PibblFrameRecordingOptions {
  /** Recording length in milliseconds, measured after initialization. */
  duration: number;
  /** Maximum capture frequency; defaults to 60 frames per second. */
  frameRate?: number;
  /** Initial estimated memory multiplier; defaults to 1.15. Memory may grow. */
  memoryHeadroom?: number;
  /** Aborting discards the recording, including during initialization. */
  signal?: AbortSignal;
}

/** An active capture; stop keeps frames and cancel discards them.
 * @see {@link PibblFrameRecording}
 */
export interface PibblFrameRecordingSession {
  /** Resolves after frame zero has been captured and capture has started. */
  readonly ready: Promise<void>;
  /** Resolves when retained frames are ready, or rejects on cancellation/failure. */
  readonly finished: Promise<PibblFrameRecording>;
  /** Finish at the current elapsed time, retaining captured frames. Idempotent. */
  stop(): void;
  /** Discard an active recording and release its resources. Idempotent. */
  cancel(): void;
}

/** Metadata for one immutable RGBA bitmap in physical backing pixels.
 * @see {@link PibblRecordedFrame}
 */
export interface PibblRecordedFrameInfo {
  /** Milliseconds since capture began; the initial frame is timestamp zero. */
  readonly timestamp: number;
  /** Bitmap width in physical backing pixels. */
  readonly width: number;
  /** Bitmap height in physical backing pixels. */
  readonly height: number;
}

/** A caller-owned copy of one frame's RGBA8 bytes.
 * @see {@link PibblRecordedFrameInfo}
 */
export interface PibblRecordedFrame extends PibblRecordedFrameInfo {
  /** Independent RGBA8 bytes; mutations never affect retained pixels. */
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

/** Retained worker-owned frames; explicitly dispose after use.
 * @see {@link PibblFrameRecordingSession}
 */
export interface PibblFrameRecording {
  /** Actual recording length in milliseconds, including the final still hold. */
  readonly duration: number;
  /** Immutable metadata ordered by ascending timestamp. */
  readonly frames: readonly PibblRecordedFrameInfo[];
  /** Copy one frame without transferring ownership of stored pixels.
   * @param index Zero-based recorded frame index.
   * @returns A caller-owned pixel copy and its metadata.
   */
  readFrame(index: number): Promise<PibblRecordedFrame>;
  /** Release the worker, stored pixels, and pending reads/exports. Idempotent. */
  dispose(): void;
}

/** GIF encoding options; encoding never changes the retained recording.
 * @see {@link PibblFrameRecording}
 */
export interface PibblGifExportOptions {
  /** Output width in pixels; omitted preserves source width or the specified height's aspect ratio. */
  width?: number;
  /** Output height in pixels; omitted preserves source height or the specified width's aspect ratio. */
  height?: number;
  /** Maximum palette entries, including transparency when no background is supplied; integer 2–256, default 256. */
  maxColors?: number;
  /** Exact opaque CSS palette colors. Replaces automatic palette selection; must fit maxColors. */
  palette?: readonly string[];
  /** Apply Floyd–Steinberg error diffusion; defaults to false. */
  dithering?: boolean;
  /** NeuQuant sampling factor, integer 1–30; 1 spends most effort, default 10. Ignored with a supplied palette. */
  quantizationSampleFactor?: number;
  /** Maximum pixels sampled for automatic palette selection across up to 32 frames; default 262144. Ignored with a supplied palette. */
  paletteSampleCount?: number;
  /** Output sampling frequency; defaults to 25. Must be at most 100. */
  frameRate?: number;
  /** Zero loops forever; omitted plays once; positive values repeat that many times. */
  repeatCount?: number;
  /** Optional opaque CSS color used to flatten partial alpha before quantization. */
  background?: string;
  /** Abort encoding while preserving the recording for another export. */
  signal?: AbortSignal;
  /** Progress from zero to one, delivered between bounded worker batches.
   * @param progress Fraction of output frames encoded.
   */
  onProgress?: (progress: number) => void;
}
