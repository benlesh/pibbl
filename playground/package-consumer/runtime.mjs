import * as core from '@crc/core';

const expected = [
  'clip',
  'crc',
  'crcCursor',
  'crcEvent',
  'crcLinePath',
  'crcMemo',
  'crcRectPath',
  'crcRef',
  'crcState',
  'crcSvgPath',
  'crcWhenChanged',
  'defineComp',
  'g',
  'horizontalLine',
  'img',
  'layer',
  'line',
  'path',
  'rect',
  'svgPath',
  'text',
  'verticalLine',
];

const actual = Object.keys(core).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected @crc/core exports: ${actual.join(', ')}`);
}
