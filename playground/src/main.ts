import { crc, rect } from '@crc/core';

const app = document.getElementById('app');
if (!app) {
  throw new Error('No app element found');
}

app.innerHTML = `
  <h1>Hello from @crc/core!</h1>
  <canvas id="canvas"></canvas>
`;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
crc(canvas, rect({
  x: 10,
  y: 10,
  width: 100,
  height: 100,
  fillStyle: 'red',
  strokeStyle: 'black',
}));
