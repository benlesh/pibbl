import { Path, crc, type CRCController } from '@crc/core';
import {
  createTextGeometry,
  loadOutlineFont,
  type InkBounds,
  type OutlineFont,
  type OutlineFontOptions,
  type TextGeometryOptions,
  type TextGeometryResult,
  type TextGlyph,
} from '@crc/text';

const canvas = document.createElement('canvas');
canvas.width = 440;
canvas.height = 230;
const status = document.createElement('p');
status.textContent = 'Loading outline font...';
document.body.append(canvas, status);

const abort = new AbortController();
const fontOptions: OutlineFontOptions = { signal: abort.signal };
const shapeOptions: TextGeometryOptions = {
  fontSize: 72,
  direction: 'ltr',
  features: { kern: true, liga: true },
};
let font: OutlineFont | undefined;
let controller: CRCController | undefined;
let disposed = false;

function dispose() {
  if (disposed) return;
  disposed = true;
  abort.abort();
  controller?.dispose();
  font?.dispose();
  window.removeEventListener('pagehide', dispose);
}

window.addEventListener('pagehide', dispose);

void loadOutlineFont(new URL('/crc-text/ABeeZee-Regular.ttf', document.baseURI), fontOptions)
  .then((loadedFont) => {
    if (disposed) {
      loadedFont.dispose();
      return;
    }
    font = loadedFont;
    const result: TextGeometryResult = createTextGeometry(font, 'Hello CRC', shapeOptions);
    const firstGlyph: TextGlyph | undefined = result.glyphs[0];
    const ink: Readonly<InkBounds> | null = result.inkBounds;
    result.geometry.transform({ a: 1, d: 1, e: 24, f: 145 });
    controller = crc(
      canvas,
      <Path style={{ d: result.geometry, fill: '#0f766e' }} />,
    );
    status.textContent = `${result.glyphs.length} glyphs; first cluster ${firstGlyph?.cluster ?? 'none'}; advance ${result.advance.x.toFixed(1)}; ink ${ink ? `${ink.width.toFixed(1)} x ${ink.height.toFixed(1)}` : 'empty'}`;
  })
  .catch((error: unknown) => {
    if (!disposed) status.textContent = `Could not load font: ${String(error)}`;
  });
