import { afterEach, vi } from 'vitest';
import { bytes } from '../../src/lib/layout/wasm/bytes.js';
export const controllers: {dispose():void}[] = [];
afterEach(() => { for (const controller of controllers) controller.dispose(); controllers.length=0; vi.restoreAllMocks(); document.body.replaceChildren(); });
export function canvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100; document.body.append(canvas);
  return canvas;
}
export function binaryResponse() {
  return new Response(Uint8Array.from(atob(bytes), value => value.charCodeAt(0)), { headers: { 'Content-Type': 'application/wasm' } });
}
