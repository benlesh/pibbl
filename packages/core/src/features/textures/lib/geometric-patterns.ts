import { defineTexture, type TextureRecipe } from "@pibbl/core";
import { paletteLut, texturePalettes, validateSeed } from "./palette.js";
import type { PatternMotionOptions } from "./patterns.js";

/** Seamless circular dots with optional stagger and seeded displacement. @see {@link polkaDots} */
export interface PolkaDotsOptions extends PatternMotionOptions {
  /** Integer columns, 1–64; default 12. See {@link PolkaDotsOptions}. */
  readonly columns?: number;
  /** Even integer rows, 2–64; default 12, preserving stagger across the seam. See {@link PolkaDotsOptions}. */
  readonly rows?: number;
  /** Radius in cell fractions, 0–0.5; default 0.3. See {@link PolkaDotsOptions}. */
  readonly radius?: number;
  /** Alternate-row horizontal offset in cell fractions, 0–1; default 0. See {@link PolkaDotsOptions}. */
  readonly stagger?: number;
  /** Seeded center displacement per axis in cell fractions, 0–0.5; default 0. See {@link PolkaDotsOptions}. */
  readonly jitter?: number;
  /** Unsigned 32-bit variation seed; default 42. See {@link PolkaDotsOptions}. */
  readonly seed?: number;
}
/** A periodic tonal field expressed as varying dot sizes. @see {@link halftone} */
export interface HalftoneOptions extends PatternMotionOptions {
  /** Integer columns, 1–64; default 24. See {@link HalftoneOptions}. */
  readonly columns?: number;
  /** Even integer rows, 2–64; default 24. See {@link HalftoneOptions}. */
  readonly rows?: number;
  /** Smallest dot radius in cell fractions, 0–0.5; default 0.05. See {@link HalftoneOptions}. */
  readonly minRadius?: number;
  /** Largest dot radius in cell fractions, minRadius–0.5; default 0.45. See {@link HalftoneOptions}. */
  readonly maxRadius?: number;
  /** Integer horizontal tonal periods, 0–16; default 1. See {@link HalftoneOptions}. */
  readonly cyclesX?: number;
  /** Integer vertical tonal periods, 0–16; default 1. See {@link HalftoneOptions}. */
  readonly cyclesY?: number;
  /** Tonal wave amplitude, 0–1; default 0.7. See {@link HalftoneOptions}. */
  readonly contrast?: number;
  /** Alternate-row offset in cell fractions, 0–1; default 0.5. See {@link HalftoneOptions}. */
  readonly stagger?: number;
}
/** Seeded connecting quarter-circle tiles. @see {@link truchet} */
export interface TruchetOptions extends PatternMotionOptions {
  /** Integer columns, 1–64; default 8. See {@link TruchetOptions}. */
  readonly columns?: number;
  /** Integer rows, 1–64; default 8. See {@link TruchetOptions}. */
  readonly rows?: number;
  /** Stroke width in cell fractions, 0–0.5; default 0.12. See {@link TruchetOptions}. */
  readonly lineWidth?: number;
  /** Fraction of tiles with the first orientation, 0–1; default 0.5. See {@link TruchetOptions}. */
  readonly orientationBias?: number;
  /** Unsigned 32-bit orientation seed; default 42. See {@link TruchetOptions}. */
  readonly seed?: number;
}
/** One band in an ordered plaid repeat; colors are named keys. @see {@link PlaidOptions} */
export interface PlaidBand<Key extends string = string> {
  /** Positive relative width; all widths on an axis are normalized together. See {@link PlaidBand}. */
  readonly width: number;
  /** A key from the plaid's colors dictionary. See {@link PlaidBand}. */
  readonly color: Key;
}
/** A plaid's named colors, ordered bands, and crossing balance. @see {@link plaid} */
export interface PlaidOptions<
  Colors extends Readonly<Record<string, string>> = Readonly<
    Record<string, string>
  >,
> extends PatternMotionOptions {
  /** Dictionary of 1–16 opaque #RRGGBB colors. See {@link PlaidOptions}. */
  readonly colors: Colors;
  /** Ordered horizontal bands, 1–32, referencing existing color keys. See {@link PlaidOptions}. */
  readonly horizontal: readonly PlaidBand<
    NoInfer<Extract<keyof Colors, string>>
  >[];
  /** Ordered vertical bands, 1–32, referencing existing color keys. See {@link PlaidOptions}. */
  readonly vertical: readonly PlaidBand<
    NoInfer<Extract<keyof Colors, string>>
  >[];
  /** Horizontal contribution at crossings, 0–1; default 0.5. See {@link PlaidOptions}. */
  readonly crossing?: number;
}
const tau = 2 * Math.PI;
const wrap = (n: number) => ((n % 1) + 1) % 1;
function bound(
  name: string,
  n: number,
  min: number,
  max: number,
  integer = false,
) {
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  )
    throw new RangeError(
      `${name} must be ${integer ? "an integer" : "finite"} in ${min}–${max}.`,
    );
  return n;
}
function motion(o: PatternMotionOptions) {
  return {
    phase: wrap(
      bound("phase", o.phase ?? 0, -Number.MAX_VALUE, Number.MAX_VALUE),
    ),
    speed: bound("speed", o.speed ?? 0, 0, 20),
  };
}
function grid(
  o: { columns?: number; rows?: number },
  defaults: number,
  even = false,
) {
  const columns = bound("columns", o.columns ?? defaults, 1, 64, true),
    rows = bound("rows", o.rows ?? defaults, even ? 2 : 1, 64, true);
  if (even && rows % 2)
    throw new RangeError("rows must be even for seamless stagger.");
  return { columns, rows };
}
function hash(
  x: number,
  y: number,
  columns: number,
  rows: number,
  seed: number,
) {
  const ix = ((x % columns) + columns) % columns,
    iy = ((y % rows) + rows) % rows;
  let h = Math.imul((iy * columns + ix) ^ seed, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}
function coverage(distance: number, halfWidth: number, pixel: number) {
  if (halfWidth === 0) return 0;
  const t = Math.max(0, Math.min(1, (halfWidth - distance) / pixel + 0.5));
  return t * t * (3 - 2 * t);
}
type Motion = { phase: number; speed: number };
type RGB = readonly [number, number, number];
interface State<C> {
  config: C;
  phase: number;
  fresh: boolean;
  dirty: boolean;
  image: ImageData | undefined;
  paletteKey: string;
  lut: Uint8ClampedArray | undefined;
}
// Each factory owns a stable definition. Color samplers share only bounded raster
// storage and the existing Pibbl lifecycle; they never start a separate timer.
function geometry<O, C extends Motion>(
  validate: (o: O) => C,
  sample: (
    c: C,
    u: number,
    v: number,
    phase: number,
    pixelX: number,
    pixelY: number,
  ) => number | RGB,
  named = false,
) {
  const definition = defineTexture<C, State<C>>({
    create(context, config) {
      if (config.speed) context.requestFrame();
      return {
        config,
        phase: config.phase,
        fresh: true,
        dirty: true,
        image: new ImageData(context.canvas.width, context.canvas.height),
        paletteKey: "",
        lut: undefined,
      };
    },
    update(state, config, context) {
      if (JSON.stringify(config) === JSON.stringify(state.config)) return;
      if (config.phase !== state.config.phase) state.phase = config.phase;
      if (config.speed !== state.config.speed) state.fresh = true;
      state.config = config;
      state.dirty = true;
      context.invalidate();
      if (config.speed) context.requestFrame();
    },
    advance(state, frame, context) {
      if (!state.config.speed) return;
      if (!state.fresh && frame.delta > 0) {
        state.phase = wrap(
          state.phase + (frame.delta * state.config.speed) / 1000,
        );
        state.dirty = true;
        context.invalidate();
      }
      state.fresh = false;
      context.requestFrame();
    },
    rasterize(state, context) {
      if (named && context.palette !== undefined)
        throw new TypeError(
          "plaid uses its named colors dictionary; omit useTexture palette.",
        );
      const palette = context.palette ?? texturePalettes.porcelain,
        key = palette.join();
      if (!named && key !== state.paletteKey) {
        state.lut = paletteLut(palette);
        state.paletteKey = key;
        state.dirty = true;
      }
      if (!state.dirty) return;
      const { width, height } = context.canvas,
        data = state.image!.data;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const result = sample(
              state.config,
              x === width - 1 ? 0 : x / (width - 1),
              y === height - 1 ? 0 : y / (height - 1),
              state.phase,
              1 / (width - 1),
              1 / (height - 1),
            ),
            index = (y * width + x) * 4;
          if (typeof result === "number") {
            const at = Math.round(Math.max(0, Math.min(1, result)) * 255) * 4;
            data[index] = state.lut![at];
            data[index + 1] = state.lut![at + 1];
            data[index + 2] = state.lut![at + 2];
          } else {
            data[index] = result[0];
            data[index + 1] = result[1];
            data[index + 2] = result[2];
          }
          data[index + 3] = 255;
        }
      context.canvas.getContext("2d")!.putImageData(state.image!, 0, 0);
      state.dirty = false;
    },
    dispose(state) {
      state.image = undefined;
      state.lut = undefined;
    },
  });
  return (o: O): TextureRecipe => definition(validate(o));
}
function dots(
  c: {
    columns: number;
    rows: number;
    stagger: number;
    jitter: number;
    seed: number;
  },
  u: number,
  v: number,
  radius: (x: number, y: number) => number,
  px: number,
  py: number,
) {
  const x = u * c.columns,
    y = v * c.rows,
    pixel = Math.max(px * c.columns, py * c.rows);
  let amount = 0;
  // Neighboring periodic cells include dots displaced across cell/tile boundaries.
  for (let j = Math.floor(y) - 1; j <= Math.floor(y) + 1; j++)
    for (let i = Math.floor(x) - 2; i <= Math.floor(x) + 1; i++) {
      const row = ((j % c.rows) + c.rows) % c.rows;
      const cx =
        i +
        0.5 +
        (row % 2) * c.stagger +
        (hash(i, j, c.columns, c.rows, c.seed) - 0.5) * 2 * c.jitter;
      const cy =
        j +
        0.5 +
        (hash(i, j, c.columns, c.rows, c.seed ^ 0x19ae) - 0.5) * 2 * c.jitter;
      amount = Math.max(
        amount,
        coverage(Math.hypot(x - cx, y - cy), radius(i, j), pixel),
      );
    }
  return amount;
}
const dotRecipe = geometry(
  (o: PolkaDotsOptions) => ({
    ...motion(o),
    ...grid(o, 12, true),
    radius: bound("radius", o.radius ?? 0.3, 0, 0.5),
    stagger: bound("stagger", o.stagger ?? 0, 0, 1),
    jitter: bound("jitter", o.jitter ?? 0, 0, 0.5),
    seed: validateSeed(o.seed ?? 42),
  }),
  (c, u, v, p, px, py) => dots(c, wrap(u + p), v, () => c.radius, px, py),
);
/**
 * Creates a seamless dot lattice using palette endpoints.
 * @param options - Dot geometry and motion.
 * @returns A mountable texture recipe.
 * @see {@link PolkaDotsOptions}
 */
export function polkaDots(options: PolkaDotsOptions = {}): TextureRecipe {
  return dotRecipe(options);
}
const halftoneRecipe = geometry(
  (o: HalftoneOptions) => {
    const minRadius = bound("minRadius", o.minRadius ?? 0.05, 0, 0.5),
      maxRadius = bound("maxRadius", o.maxRadius ?? 0.45, minRadius, 0.5);
    return {
      ...motion(o),
      ...grid(o, 24, true),
      minRadius,
      maxRadius,
      cyclesX: bound("cyclesX", o.cyclesX ?? 1, 0, 16, true),
      cyclesY: bound("cyclesY", o.cyclesY ?? 1, 0, 16, true),
      contrast: bound("contrast", o.contrast ?? 0.7, 0, 1),
      stagger: bound("stagger", o.stagger ?? 0.5, 0, 1),
      jitter: 0,
      seed: 42,
    };
  },
  (c, u, v, p, px, py) =>
    dots(
      c,
      u,
      v,
      (x, y) => {
        const tone =
          0.5 +
          0.25 *
            c.contrast *
            (Math.sin(tau * (((x + 0.5) / c.columns) * c.cyclesX + p)) +
              Math.sin(tau * (((y + 0.5) / c.rows) * c.cyclesY + p)));
        return c.minRadius + (c.maxRadius - c.minRadius) * tone;
      },
      px,
      py,
    ),
);
/**
 * Creates seamless varying-size dots from a periodic tonal field.
 * @param options - Dot sizes, tonal periods, and motion.
 * @returns A mountable texture recipe.
 * @see {@link HalftoneOptions}
 */
export function halftone(options: HalftoneOptions = {}): TextureRecipe {
  return halftoneRecipe(options);
}
const truchetRecipe = geometry(
  (o: TruchetOptions) => ({
    ...motion(o),
    ...grid(o, 8),
    lineWidth: bound("lineWidth", o.lineWidth ?? 0.12, 0, 0.5),
    orientationBias: bound("orientationBias", o.orientationBias ?? 0.5, 0, 1),
    seed: validateSeed(o.seed ?? 42),
  }),
  (c, u, v, p, px, py) => {
    const x = wrap(u + p) * c.columns,
      y = wrap(v + p) * c.rows,
      ix = Math.floor(x),
      iy = Math.floor(y),
      a = x - ix,
      b = y - iy;
    const first = hash(ix, iy, c.columns, c.rows, c.seed) < c.orientationBias;
    const distance = first
      ? Math.min(
          Math.abs(Math.hypot(a, b) - 0.5),
          Math.abs(Math.hypot(1 - a, 1 - b) - 0.5),
        )
      : Math.min(
          Math.abs(Math.hypot(1 - a, b) - 0.5),
          Math.abs(Math.hypot(a, 1 - b) - 0.5),
        );
    return coverage(
      distance,
      c.lineWidth / 2,
      Math.max(px * c.columns, py * c.rows),
    );
  },
);
/**
 * Creates seeded quarter-circle tiles that connect across every edge.
 * @param options - Tile counts, stroke width, seed, and motion.
 * @returns A mountable texture recipe.
 * @see {@link TruchetOptions}
 */
export function truchet(options: TruchetOptions = {}): TextureRecipe {
  return truchetRecipe(options);
}
interface Band {
  end: number;
  color: RGB;
}
function bands(
  input: readonly PlaidBand[],
  colors: Readonly<Record<string, RGB>>,
): Band[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 32)
    throw new RangeError("Plaid requires 1–32 bands per axis.");
  const total = input.reduce(
    (n, b) => n + bound("band width", b.width, Number.MIN_VALUE, 1e6),
    0,
  );
  let end = 0;
  return input.map((b) => {
    if (!Object.hasOwn(colors, b.color))
      throw new TypeError(`Unknown plaid color key: ${b.color}`);
    end += b.width / total;
    return { end, color: colors[b.color] };
  });
}
// Integrate a box footprint across periodic band boundaries, giving crisp interiors
// and gradual coverage at edges at any raster resolution.
function bandColor(
  bands: readonly Band[],
  position: number,
  footprint: number,
): RGB {
  const center = wrap(position),
    lo = center - footprint / 2,
    hi = center + footprint / 2,
    result = [0, 0, 0];
  for (let shift = -1; shift <= 1; shift++) {
    let start = shift;
    for (const band of bands) {
      const end = shift + band.end,
        weight =
          Math.max(0, Math.min(hi, end) - Math.max(lo, start)) / footprint;
      for (let k = 0; k < 3; k++) result[k] += band.color[k] * weight;
      start = end;
    }
  }
  return result as [number, number, number];
}
const plaidRecipe = geometry(
  (
    o: PatternMotionOptions & {
      colors: Readonly<Record<string, string>>;
      horizontal: readonly PlaidBand[];
      vertical: readonly PlaidBand[];
      crossing?: number;
    },
  ) => {
    const entries = Object.entries(o.colors);
    if (entries.length < 1 || entries.length > 16)
      throw new RangeError("Plaid colors requires 1–16 named entries.");
    const colors: Record<string, RGB> = Object.create(null);
    for (const [key, value] of entries) {
      if (!key || !/^#[\da-f]{6}$/i.test(value))
        throw new TypeError("Plaid colors require named #RRGGBB entries.");
      colors[key] = [
        parseInt(value.slice(1, 3), 16),
        parseInt(value.slice(3, 5), 16),
        parseInt(value.slice(5, 7), 16),
      ];
    }
    return {
      ...motion(o),
      horizontal: bands(o.horizontal, colors),
      vertical: bands(o.vertical, colors),
      crossing: bound("crossing", o.crossing ?? 0.5, 0, 1),
    };
  },
  (c, u, v, p, px, py) => {
    const horizontal = bandColor(c.horizontal, v + p, py),
      vertical = bandColor(c.vertical, u + p, px);
    return horizontal.map(
      (n, i) => n * c.crossing + vertical[i] * (1 - c.crossing),
    ) as [number, number, number];
  },
  true,
);
/**
 * Creates plaid using checked color keys and ordered relative-width bands.
 * @param options - Named colors, bands, crossing balance, and motion.
 * @returns A mountable texture recipe.
 * @see {@link PlaidOptions}
 */
export function plaid<const Colors extends Readonly<Record<string, string>>>(
  options: PlaidOptions<Colors>,
): TextureRecipe {
  return plaidRecipe(options);
}
const presetColors = Object.freeze({
  background: "#f5e9d3",
  primary: "#304c48",
  accent: "#c56948",
});
function preset(sequence: readonly PlaidBand<keyof typeof presetColors>[]) {
  const bands = Object.freeze(sequence.map((b) => Object.freeze({ ...b })));
  return Object.freeze({
    colors: presetColors,
    horizontal: bands,
    vertical: bands,
    crossing: 0.5,
  });
}
/** Named-color band configurations for gingham, tartan, and windowpane patterns. @see {@link plaid} */
export const plaidPresets = Object.freeze({
  /** Equal-width alternating bands. See {@link plaidPresets}. */
  gingham: preset([
    { width: 1, color: "background" },
    { width: 1, color: "primary" },
  ]),
  /** Symmetric bands with narrow accent lines. See {@link plaidPresets}. */
  tartan: preset([
    { width: 8, color: "primary" },
    { width: 2, color: "background" },
    { width: 1, color: "accent" },
    { width: 2, color: "background" },
  ]),
  /** Narrow crossing lines on a broad background. See {@link plaidPresets}. */
  windowpane: preset([
    { width: 14, color: "background" },
    { width: 1, color: "primary" },
  ]),
});
