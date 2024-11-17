const recentCoords = new WeakMap<MouseEvent, readonly [number, number]>();

export function getMouseCoordinates(event: MouseEvent): readonly [number, number] {
  if (recentCoords.has(event)) {
    return recentCoords.get(event)!;
  }
  const target = event.target as HTMLElement;
  const bounds = target.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const result = [x, y] as const;
  recentCoords.set(event, result);
  return result;
}
