// import { DirectComponent, VirtualComponent } from './TestComponent';
import { getMetrics } from '@crc/jsx';

// const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
// const ctx = canvas.getContext('2d')!;

// // Direct transformation example
// DirectComponent({
//   x: 10,
//   y: 10,
//   width: 200,
//   height: 100,
//   text: 'Direct Transform',
//   debug: true
// });

// // Virtual tree example
// VirtualComponent({
//   x: 10,
//   y: 120,
//   width: 200,
//   height: 100,
//   text: 'Virtual Tree',
//   debug: true,
//   ctx
// });

// // Log performance metrics
console.table(getMetrics());


// eslint-disable-next-line no-console
console.log('Hello World');
