// Read-only pixel measurement: preserve the generated image, author atlas metadata.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const { data, info } = await sharp(new URL('./sprites.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
const xs = [0, 320, 625, 930, 1254], ys = [0, 345, 695, 975, 1254];
const names = ['standing', 'run-0', 'run-1', 'run-2', 'jump', 'fall', 'crouch', 'celebrate', 'coin-0', 'coin-1', 'coin-2', 'coin-3', 'brick', 'shard-0', 'shard-1', 'stone'];
const frames = {};
for (let i = 0; i < 16; i++) {
  const col = i % 4, row = Math.floor(i / 4);
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = xs[col]; x < xs[col + 1]; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 20) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  const w = right - left + 1, h = bottom - top + 1;
  const sw = row < 2 ? 240 : row === 2 ? 220 : w, sh = row < 2 ? 300 : row === 2 ? 220 : h;
  frames[names[i]] = { frame: { x: left, y: top, w, h }, sourceSize: { w: sw, h: sh }, spriteSourceSize: { x: Math.floor((sw-w)/2), y: sh-h }, duration: 100 };
}
await writeFile(new URL('./sprites.json', import.meta.url), JSON.stringify({ frames, meta: { image: 'sprites.png', frameTags: [{ name: 'idle', from: 0, to: 0, direction: 'forward' }, { name: 'walk', from: 1, to: 3, direction: 'forward' }, { name: 'spin', from: 8, to: 11, direction: 'forward' }] } }, null, 2)+'\n');
console.warn(frames);
