export function createLinePath(
  coords: [number, number][],
  config?: { closePath?: boolean }
) {
  const path = new Path2D();
  for (let i = 0; i < coords.length; i++) {
    const [x, y] = coords[i];
    if (i === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  if (config?.closePath) {
    path.closePath();
  }
  return path;
}
