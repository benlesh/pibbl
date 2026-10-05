import { activeProfile } from "./lib/profiling.js";
import { validateFontContainer } from "./lib/font-container.js";
import { fontBytes } from "./lib/font-bytes.js";
import { getEngine, type Engine } from "./lib/engine.js";
import { PathGeometry } from "@crc/core";
import { inkBounds, type InkBounds } from "./lib/bounds.js";
export type { InkBounds } from "./lib/bounds.js";

/**
 * An explicitly owned native font loaded for text shaping. Dispose it when no more geometry will be
 * created from it; disposal is idempotent.
 *
 * @see {@link loadOutlineFont}
 * @see {@link createTextGeometry}
 */
export interface OutlineFont extends Disposable {
  /**
   * Releases the native font owner; repeated calls are harmless and later shaping with this font
   * fails. See {@link OutlineFont}.
   */
  dispose(): void;
}
/**
 * Cancellation and monochrome-fallback policy used when loading an outline font.
 *
 * @see {@link loadOutlineFont}
 */
export interface OutlineFontOptions {
  /** Abort signal for font loading and validation. See {@link OutlineFontOptions}. */
  signal?: AbortSignal;
  /**
   * Allows supported monochrome outlines when the font includes color glyph data. See
   * {@link OutlineFontOptions}.
   */
  monochromeFallback?: boolean;
}
/**
 * Font size, shaping direction, OpenType features, and work limits for one text run.
 *
 * @see {@link createTextGeometry}
 */
export interface TextGeometryOptions {
  /** Positive finite output font size in logical units. See {@link TextGeometryOptions}. */
  fontSize: number;
  /** Upper bound on the number of output path segments. See {@link TextGeometryOptions}. */
  maxSegments?: number;
  /**
   * Whether an absent glyph fails shaping or uses the font's .notdef glyph. See
   * {@link TextGeometryOptions}.
   */
  missingGlyphs?: "error" | "notdef";
  /**
   * Explicit left-to-right or right-to-left shaping direction; omitted direction is inferred. See
   * {@link TextGeometryOptions}.
   */
  direction?: "ltr" | "rtl";
  /**
   * Four-character OpenType script tag overriding script inference. See
   * {@link TextGeometryOptions}.
   */
  script?: string;
  /**
   * Language tag used for shaping; distinct interned tags are bounded by the engine. See
   * {@link TextGeometryOptions}.
   */
  language?: string;
  /** OpenType feature overrides keyed by four-character tags. See {@link TextGeometryOptions}. */
  features?: Readonly<Record<string, boolean>>;
}
/**
 * Shaped glyph identity, UTF-16 source cluster, outline segment range, and scaled placement metrics.
 *
 * @see {@link TextGeometryResult}
 */
export interface TextGlyph {
  /** Font-specific identifier of the shaped glyph. See {@link TextGlyph}. */
  readonly glyphId: number;
  /** UTF-16 offset of the source cluster associated with this glyph. See {@link TextGlyph}. */
  readonly cluster: number;
  /** Index of the glyph's first segment in the returned geometry. See {@link TextGlyph}. */
  readonly segmentStart: number;
  /** Number of outline segments belonging to this glyph. See {@link TextGlyph}. */
  readonly segmentCount: number;
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link TextGlyph}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See {@link TextGlyph}
   * .
   */
  readonly y: number;
  /** Horizontal pen advance in scaled logical units. See {@link TextGlyph}. */
  readonly xAdvance: number;
  /** Vertical pen advance in Canvas-oriented logical units. See {@link TextGlyph}. */
  readonly yAdvance: number;
}
/**
 * Independent path geometry, optional ink bounds, advances, and glyph metadata for a shaped text run.
 *
 * @see {@link PathGeometry}
 * @see {@link InkBounds}
 * @see {@link TextGlyph}
 * @see {@link createTextGeometry}
 */
export interface TextGeometryResult {
  /**
   * Independent mutable outline geometry in Canvas-oriented output coordinates. See
   * {@link PathGeometry}.
   */
  readonly geometry: PathGeometry;
  /** Bounds of visible outlines, or null when the run has no ink. See {@link InkBounds}. */
  readonly inkBounds: Readonly<InkBounds> | null;
  /**
   * Final pen displacement, including glyph advances even when no ink is drawn. See
   * {@link TextGeometryResult}.
   */
  readonly advance: Readonly<{
    /**
     * Horizontal coordinate or displacement in the containing coordinate system. See
     * {@link TextGeometryResult}.
     */
    x: number;
    /**
     * Vertical coordinate or displacement in the containing coordinate system. See
     * {@link TextGeometryResult}.
     */
    y: number;
  }>;
  /**
   * Ordered shaped-glyph metadata corresponding to the returned outline segments. See
   * {@link TextGlyph}.
   */
  readonly glyphs: readonly TextGlyph[];
}
// HarfBuzz interns languages until module teardown. Bound that shared lifetime
// separately from font ownership; canonical case avoids duplicate reservations.
const internedLanguages = new Set<string>();
const owners = new WeakMap<
  OutlineFont,
  { engine: Engine; handle: number; upem: number }
>();
/**
 * Loads and validates font bytes from a URL or buffer and returns an explicitly disposable font.
 * Rejects on cancellation, unsupported font data, or allocation failure.
 *
 * @param source - Font URL to fetch, or in-memory font bytes to copy into the shaping engine.
 * @param options - Cancellation signal and explicit monochrome fallback policy. See
 * {@link OutlineFontOptions} .
 * @returns A promise for an owned font; dispose it when no further shaping will use it. See
 * {@link OutlineFont} .
 *
 * @see {@link OutlineFontOptions}
 * @see {@link OutlineFont}
 */
export async function loadOutlineFont(
  source: string | URL | ArrayBuffer | Uint8Array,
  options: OutlineFontOptions = {},
): Promise<OutlineFont> {
  const { signal, monochromeFallback } = options;
  if (
    monochromeFallback !== undefined &&
    typeof monochromeFallback !== "boolean"
  )
    throw new TypeError("monochromeFallback must be boolean.");
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  let engine: Engine, bytes: Uint8Array;
  try {
    [engine, bytes] = await Promise.all([
      getEngine(),
      fontBytes(source, controller.signal),
    ]);
  } catch (error) {
    controller.abort(error);
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
  signal?.throwIfAborted();
  validateFontContainer(bytes, monochromeFallback ?? false);
  const pointer = engine._malloc(bytes.byteLength);
  if (!pointer) throw new Error("Font allocation failed.");
  let handle: number;
  try {
    engine.HEAPU8.set(bytes, pointer);
    handle = engine._crc_font_create(pointer, bytes.length);
  } finally {
    engine._free(pointer);
  }
  if (!handle)
    throw new Error("Invalid font or native font allocation failed.");
  const font: OutlineFont = {
    dispose() {
      const state = owners.get(font);
      if (!state) return;
      owners.delete(font);
      state.engine._crc_font_release(state.handle);
    },
    [Symbol.dispose]() {
      font.dispose();
    },
  };
  owners.set(font, { engine, handle, upem: engine._crc_font_upem(handle) });
  return font;
}
/**
 * Synchronously shapes a single text run into independent Canvas-oriented outlines. The font must
 * be live, fontSize positive and finite, and text must not contain line breaks or tabs.
 *
 * @param font - Live font returned by loadOutlineFont; it must not have been disposed. See
 * {@link OutlineFont} .
 * @param text - Text to shape as one run.
 * @param options - Font size, shaping overrides, missing-glyph policy, and work limits. See
 * {@link TextGeometryOptions} .
 * @returns Independent mutable path geometry plus glyph placements, ink bounds, and advances; the
 * result remains usable after font disposal. See {@link TextGeometryResult} .
 *
 * @see {@link OutlineFont}
 * @see {@link TextGeometryOptions}
 * @see {@link TextGeometryResult}
 */
export function createTextGeometry(
  font: OutlineFont,
  text: string,
  options: TextGeometryOptions,
): TextGeometryResult {
  const profile = activeProfile;
  let phaseStart = profile ? performance.now() : 0;
  const owner = owners.get(font);
  if (!owner) throw new Error("Font is disposed or is not an OutlineFont.");
  if (
    typeof text !== "string" ||
    text.length > 100000 ||
    /[\r\n\t]/u.test(text)
  )
    throw new TypeError(
      "Expected a single text run of at most 100000 UTF-16 units.",
    );
  if (!Number.isFinite(options.fontSize) || options.fontSize <= 0)
    throw new RangeError("fontSize must be finite and positive.");
  if (
    options.missingGlyphs !== undefined &&
    options.missingGlyphs !== "error" &&
    options.missingGlyphs !== "notdef"
  )
    throw new TypeError("missingGlyphs must be error or notdef.");
  const limit = options.maxSegments ?? 1000000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000000)
    throw new RangeError("maxSegments must be an integer from 1 to 1000000.");
  const tag = (value: string) => {
    if (!/^[ -~]{4}$/u.test(value))
      throw new TypeError("OpenType tags must contain four ASCII characters.");
    return (
      ((value.charCodeAt(0) << 24) |
        (value.charCodeAt(1) << 16) |
        (value.charCodeAt(2) << 8) |
        value.charCodeAt(3)) >>>
      0
    );
  };
  if (
    options.direction !== undefined &&
    options.direction !== "ltr" &&
    options.direction !== "rtl"
  )
    throw new TypeError("Expected ltr or rtl direction.");
  const script = options.script === undefined ? 0 : tag(options.script);
  if (
    options.language !== undefined &&
    !/^[A-Za-z0-9-]{1,63}$/u.test(options.language)
  )
    throw new TypeError("Invalid language tag.");
  const languageTag = options.language?.toLowerCase();
  if (
    languageTag !== undefined &&
    !internedLanguages.has(languageTag) &&
    internedLanguages.size >= 256
  )
    throw new RangeError(
      "At most 256 distinct language tags may be used per text engine instance.",
    );
  const language =
    languageTag === undefined
      ? new Uint8Array(0)
      : new TextEncoder().encode(languageTag + "\0");
  const features = Object.entries(options.features ?? {});
  if (features.length > 64)
    throw new RangeError(
      "At most 64 OpenType feature overrides are supported.",
    );
  const featureData = new Uint32Array(features.length * 4);
  features.forEach(([name, enabled], index) => {
    if (typeof enabled !== "boolean")
      throw new TypeError("Feature overrides must be boolean.");
    featureData.set([tag(name), Number(enabled), 0, 0xffffffff], index * 4);
  });
  const { engine, handle, upem } = owner;
  const textBytes = Math.max(4, Math.ceil((text.length * 2) / 4) * 4);
  const pointer = engine._malloc(
    textBytes + featureData.byteLength + language.length,
  );
  if (!pointer) throw new Error("Text allocation failed.");
  let result: number;
  try {
    const units = new Uint16Array(engine.HEAPU8.buffer, pointer, text.length);
    for (let i = 0; i < text.length; i++) units[i] = text.charCodeAt(i);
    engine.HEAPU8.set(new Uint8Array(featureData.buffer), pointer + textBytes);
    engine.HEAPU8.set(language, pointer + textBytes + featureData.byteLength);
    if (languageTag !== undefined) internedLanguages.add(languageTag);
    if (profile) {
      profile.inputMs = performance.now() - phaseStart;
      engine._crc_profile_enabled(1);
    }
    result = engine._crc_shape(
      handle,
      pointer,
      text.length,
      limit,
      options.direction === "ltr" ? 1 : options.direction === "rtl" ? 2 : 0,
      script,
      language.length ? pointer + textBytes + featureData.byteLength : 0,
      pointer + textBytes,
      features.length,
      options.missingGlyphs === "notdef" ? 1 : 0,
    );
  } finally {
    if (profile) {
      profile.nativeSetupMs = engine._crc_profile_time(0);
      profile.shapingMs = engine._crc_profile_time(1);
      profile.outlineMs = engine._crc_profile_time(2);
      engine._crc_profile_enabled(0);
    }
    engine._free(pointer);
  }
  if (!result)
    throw new Error(
      [
        "Text conversion failed.",
        "Font is missing a required glyph.",
        "Text exceeded the outline work or output segment limit.",
        "Native shaping allocation failed.",
        "Font glyph has no valid supported outline.",
      ][engine._crc_error()] ?? "Text conversion failed.",
    );
  try {
    if (profile) phaseStart = performance.now();
    const lengths = [0, 1, 2, 3].map((field) =>
      engine._crc_result_length(result, field),
    );
    const offsets = [0, 1, 2, 3].map((field) =>
      engine._crc_result_data(result, field),
    );
    const memory = engine.HEAPU8.buffer;
    const commands = new Uint8Array(memory, offsets[0], lengths[0]);
    const coords = new Float64Array(memory, offsets[1], lengths[1]);
    const ids = new Uint32Array(memory, offsets[2], lengths[2]);
    const positions = new Float64Array(memory, offsets[3], lengths[3]);
    if (profile) {
      profile.bufferViewsMs = performance.now() - phaseStart;
      phaseStart = performance.now();
    }
    const scale = options.fontSize / upem;
    const geometry = new PathGeometry();
    let index = 0;
    const coordinate = () => {
      const value = coords[index] * scale * (index++ & 1 ? -1 : 1);
      if (!Number.isFinite(value))
        throw new RangeError("Nonfinite outline coordinate.");
      return value;
    };
    for (const command of commands) {
      switch (command) {
        case 0:
          geometry.moveTo(coordinate(), coordinate());
          break;
        case 1:
          geometry.lineTo(coordinate(), coordinate());
          break;
        case 2:
          geometry.quadraticCurveTo(
            coordinate(),
            coordinate(),
            coordinate(),
            coordinate(),
          );
          break;
        case 3:
          geometry.bezierCurveTo(
            coordinate(),
            coordinate(),
            coordinate(),
            coordinate(),
            coordinate(),
            coordinate(),
          );
          break;
        case 4:
          geometry.closePath();
          break;
        default:
          throw new Error("Invalid outline command.");
      }
    }
    if (
      index !== coords.length ||
      ids.length % 4 ||
      positions.length !== ids.length
    )
      throw new Error("Invalid native result.");
    const finite = (value: number) => {
      if (!Number.isFinite(value))
        throw new RangeError("Nonfinite text metric.");
      return value === 0 ? 0 : value;
    };
    const glyphs: TextGlyph[] = [];
    let segmentEnd = 0;
    for (let i = 0; i < ids.length; i += 4) {
      if (
        ids[i + 1] >= text.length ||
        ids[i + 2] !== segmentEnd ||
        ids[i + 3] > commands.length - segmentEnd
      ) {
        throw new Error("Invalid native glyph metadata.");
      }
      segmentEnd += ids[i + 3];
      glyphs.push(
        Object.freeze({
          glyphId: ids[i],
          cluster: ids[i + 1],
          segmentStart: ids[i + 2],
          segmentCount: ids[i + 3],
          x: finite(positions[i] * scale),
          y: finite(-positions[i + 1] * scale),
          xAdvance: finite(positions[i + 2] * scale),
          yAdvance: finite(-positions[i + 3] * scale),
        }),
      );
    }
    if (segmentEnd !== commands.length)
      throw new Error("Invalid native glyph segment coverage.");
    if (profile) {
      profile.materializationMs = performance.now() - phaseStart;
      phaseStart = performance.now();
    }
    const bounds = inkBounds(geometry);
    if (profile) profile.boundsMs = performance.now() - phaseStart;
    return Object.freeze({
      geometry,
      inkBounds: bounds,
      glyphs: Object.freeze(glyphs),
      advance: Object.freeze({
        x: finite(engine._crc_result_advance(result, 0) * scale),
        y: finite(-engine._crc_result_advance(result, 1) * scale),
      }),
    });
  } finally {
    engine._crc_result_release(result);
  }
}
