export function core(canvas: HTMLCanvasElement): void {
  // Render a red square on the canvas
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get 2d context');
  }

  ctx.fillStyle = 'red';
  ctx.fillRect(10, 10, 100, 100);
}
