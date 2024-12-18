import { crc } from '@crc/core';
import { DirectComponent, VirtualComponent } from './TestComponent';
// import { getMetrics } from '@crc/jsx';
// import * as merp from '@crc/types'
// import * as crc from '@crc/core'
// import * as jsx from '@crc/jsx'

const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;
document.body.appendChild(canvas);
// const ctx = canvas.getContext('2d')!;

// Direct transformation example
crc(canvas, DirectComponent({
  x: 10,
  y: 10,
  width: 200,
  height: 100,
  text: 'Direct Transform',
  debug: true,
}));

// Virtual tree example
crc(canvas, VirtualComponent({
  x: 10,
  y: 120,
  width: 200,
  height: 100,
  text: 'Virtual Tree',
  debug: true,
}));
