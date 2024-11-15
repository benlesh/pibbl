export function createMouseEventTransform(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const bounds = canvas.getBoundingClientRect();
  const xScale = width / bounds.width;
  const yScale = height / bounds.height;
  if (xScale !== 1 || yScale !== 1) {
    return new DOMMatrix().scale(xScale, yScale);
  }

  return undefined;
}
