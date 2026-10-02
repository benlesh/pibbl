import { seededRandom } from "./reference-simulation.js";
export type TextureKind = "marble" | "paper" | "cellular";

function modulo(value: number, period: number): number {
  return ((value % period) + period) % period;
}
function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Periodic lattice values and smooth interpolation make values and slopes join. */
function noise(
  x: number,
  y: number,
  seed: number,
  periodX: number,
  periodY: number,
): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const at = (dx: number, dy: number) =>
    hash(modulo(ix + dx, periodX), modulo(iy + dy, periodY), seed);
  return (
    (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) +
    (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy
  );
}
function turbulence(
  u: number,
  v: number,
  seed: number,
  frequency: number,
  ox: number,
  oy: number,
): number {
  let value = 0,
    amplitude = 0.5;
  for (let octave = 0; octave < 4; octave++) {
    value +=
      noise(
        u * frequency + ox,
        v * frequency + oy,
        seed + octave,
        frequency,
        frequency,
      ) * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
    ox *= 2;
    oy *= 2;
  }
  return value;
}

type FieldSampler = (u: number, v: number, x: number, y: number) => number;
export type MaterialGenerator = (
  width: number,
  height: number,
  seed: number,
  scale: number,
  detail: number,
) => Float32Array;

/** Shared raster traversal. Endpoints sample the same location on the torus. */
function sampleField(
  width: number,
  height: number,
  sample: FieldSampler,
): Float32Array {
  const field = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      field[y * width + x] = sample(x / (width - 1), v, x, y);
    }
  }
  return field;
}

export const marbleField: MaterialGenerator = (
  width,
  height,
  seed,
  scale,
  detail,
) => {
  const random = seededRandom(seed);
  const offsetX = random() * 100,
    offsetY = random() * 100;
  const frequency = Math.max(1, Math.round(scale));
  const bandsX = Math.max(1, Math.round(scale * 0.7));
  const bandsY = Math.max(1, Math.round(scale * 0.25));
  return sampleField(width, height, (u, v) => {
    const warp = turbulence(u, v, seed, frequency, offsetX, offsetY);
    const wave = Math.sin(
      (u * bandsX + v * bandsY + warp * (2 + detail * 7)) * Math.PI * 2,
    );
    return Math.pow(1 - Math.abs(wave), 2.5) * 0.9 + warp * 0.1;
  });
};

export const paperField: MaterialGenerator = (
  width,
  height,
  seed,
  scale,
  detail,
) => {
  const random = seededRandom(seed);
  const offsetX = random() * 100,
    offsetY = random() * 100;
  const broad = Math.max(1, Math.round(scale * 0.7));
  const fiberX = Math.max(1, Math.round(scale * 7));
  const fiberY = Math.max(1, Math.round(scale * 4));
  return sampleField(width, height, (u, v, x, y) => {
    // Faint pulp mottling and crossing short fibers avoid a dominant grain axis.
    // All lattice periods are integral, so the diagonal coordinates wrap too.
    const pulp = noise(
      u * broad + offsetX,
      v * broad + offsetY,
      seed,
      broad,
      broad,
    );
    const fibers =
      (noise(
        (u + v) * fiberX + offsetX,
        (v - u) * fiberY + offsetY,
        seed + 1,
        fiberX,
        fiberY,
      ) +
        noise(
          (u - v) * fiberX + offsetY,
          (v + u) * fiberY + offsetX,
          seed + 2,
          fiberX,
          fiberY,
        )) *
      0.5;
    const grain = hash(x % (width - 1), y % (height - 1), seed);
    // Stay near the light end of the palette. Paper's structure should emerge
    // from small tonal changes, not dark bands or high-contrast static.
    return (
      0.12 +
      (pulp - 0.5) * 0.044 +
      (fibers - 0.5) * (0.025 + detail * 0.025) +
      (grain - 0.5) * (0.015 + detail * 0.0875)
    );
  });
};

export const cellularField: MaterialGenerator = (
  width,
  height,
  seed,
  scale,
  detail,
) => {
  const frequency = Math.max(1, Math.round(scale));
  return sampleField(width, height, (u, v) => {
    const px = u * frequency,
      py = v * frequency;
    const ix = Math.floor(px),
      iy = Math.floor(py);
    let first = Infinity,
      second = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx,
          cy = iy + dy;
        const hx = modulo(cx, frequency),
          hy = modulo(cy, frequency);
        const sx = cx + 0.5 + (hash(hx, hy, seed) - 0.5) * detail;
        const sy = cy + 0.5 + (hash(hx, hy, seed ^ 0x5bd1e995) - 0.5) * detail;
        const distance = Math.hypot(px - sx, py - sy);
        if (distance < first) {
          second = first;
          first = distance;
        } else if (distance < second) second = distance;
      }
    }
    return Math.max(0, Math.min(1, (second - first) * 2.2));
  });
};

// Compatibility dispatch for the component API while its consumers migrate.
// New recipe factories depend directly on their generator, not on this catalog.
const generators: Record<TextureKind, MaterialGenerator> = {
  marble: marbleField,
  paper: paperField,
  cellular: cellularField,
};
export function materialField(
  width: number,
  height: number,
  kind: TextureKind,
  seed: number,
  scale: number,
  detail: number,
): Float32Array {
  return generators[kind](width, height, seed, scale, detail);
}
