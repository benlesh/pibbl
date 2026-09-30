import { seededRandom } from "./simulation.js";
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

/** Samples a torus, including a shared endpoint on each raster edge. */
export function materialField(
  width: number,
  height: number,
  kind: TextureKind,
  seed: number,
  scale: number,
  detail: number,
): Float32Array {
  const field = new Float32Array(width * height),
    random = seededRandom(seed);
  const offsetX = random() * 100,
    offsetY = random() * 100;
  // An integral count of features closes each period.
  const frequency = Math.max(1, Math.round(scale));
  const fiberX = Math.max(1, Math.round(scale * 5)),
    fiberY = Math.max(1, Math.round(scale * 0.4));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1),
        v = y / (height - 1);
      let value: number;
      if (kind === "marble") {
        const warp = turbulence(u, v, seed, frequency, offsetX, offsetY);
        const wave = Math.sin(
          (u * Math.max(1, Math.round(scale * 0.7)) +
            v * Math.max(1, Math.round(scale * 0.25)) +
            warp * (2 + detail * 7)) *
            Math.PI *
            2,
        );
        value = Math.pow(1 - Math.abs(wave), 2.5) * 0.9 + warp * 0.1;
      } else if (kind === "paper") {
        const fibers = noise(
          u * fiberX + offsetX,
          v * fiberY + offsetY,
          seed,
          fiberX,
          fiberY,
        );
        const grain = hash(x % (width - 1), y % (height - 1), seed);
        value = Math.max(
          0,
          Math.min(
            1,
            0.48 + (grain - 0.5) * detail * 0.6 + (fibers - 0.5) * 0.5,
          ),
        );
      } else {
        const px = u * frequency,
          py = v * frequency,
          ix = Math.floor(px),
          iy = Math.floor(py);
        let first = Infinity,
          second = Infinity;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const cx = ix + dx,
              cy = iy + dy,
              hx = modulo(cx, frequency),
              hy = modulo(cy, frequency);
            const sx = cx + 0.5 + (hash(hx, hy, seed) - 0.5) * detail;
            const sy =
              cy + 0.5 + (hash(hx, hy, seed ^ 0x5bd1e995) - 0.5) * detail;
            const distance = Math.hypot(px - sx, py - sy);
            if (distance < first) {
              second = first;
              first = distance;
            } else if (distance < second) second = distance;
          }
        value = Math.max(0, Math.min(1, (second - first) * 2.2));
      }
      field[y * width + x] = value;
    }
  return field;
}
