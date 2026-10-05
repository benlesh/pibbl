/** Mirrors Pibbl's centered `contain` fit for native canvas pointer events. */
export function mapViewport(width: number, height: number) {
  const scale = Math.min(width / 1200, height / 720);
  return {
    scale,
    left: (width - 1200 * scale) / 2,
    top: (height - 720 * scale) / 2,
  };
}
export function screenToWorld(
  x: number,
  y: number,
  width: number,
  height: number,
  camera: { x: number; y: number; zoom: number },
) {
  const view = mapViewport(width, height);
  return {
    x: ((x - view.left) / view.scale - camera.x) / camera.zoom,
    y: ((y - view.top) / view.scale - camera.y) / camera.zoom,
  };
}
