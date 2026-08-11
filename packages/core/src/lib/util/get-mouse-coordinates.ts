const recentCoords = new WeakMap<MouseEvent, readonly [number, number]>();

export function getMouseCoordinates(event: MouseEvent): readonly [number, number] {
  if (recentCoords.has(event)) {
    return recentCoords.get(event)!;
  }
  const target = event.target as HTMLCanvasElement;
  const bounds = target.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * target.width / bounds.width;
  const y = (event.clientY - bounds.top) * target.height / bounds.height;
  const result = [x, y] as const;
  recentCoords.set(event, result);
  return result;
}
