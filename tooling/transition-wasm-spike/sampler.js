export function sampler(seed, cached) {
  const noise = (n) => {
    const v = Math.sin(n * 127.1 + seed * 31.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const coefficients = Float64Array.from({ length: 56 * 8 }, (_, k) =>
    noise(Math.floor(k / 8) * 11 + (k % 8) + 1),
  );
  const out = new Float64Array(56 * 6);
  return (seconds, flow, power, width, distance, ex, ey, dx, dy) => {
    const angle = Math.atan2(dy, dx);
    for (let i = 0; i < 56; i++) {
      const n = (j) =>
        cached ? coefficients[i * 8 + j - 1] : noise(i * 11 + j);
      const position = n(2) * 1.8 + flow * seconds * (1.6 + n(1) * 2.8);
      const t = (((position % 1.8) + 1.8) % 1.8) - 0.4;
      const lateral =
        (n(3) - 0.5) * width * 0.95 +
        Math.sin(seconds * 3 + n(4) * 20) * width * 0.035;
      out[i * 6] = ex + dx * t - Math.sin(angle) * lateral;
      out[i * 6 + 1] = ey + dy * t + Math.cos(angle) * lateral;
      out[i * 6 + 2] = Math.max(20, distance * (0.13 + n(5) * 0.28));
      out[i * 6 + 3] = Math.max(4, width * (0.045 + n(6) * 0.13));
      out[i * 6 + 4] = n(7) * 360;
      out[i * 6 + 5] = power * (0.14 + n(8) * 0.22);
    }
    return out;
  };
}
