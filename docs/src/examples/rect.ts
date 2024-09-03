import { crc, rect } from '@crc/core';
import { createLogger } from '../utils/create-logger';

const canvas = document.getElementById('example-canvas') as HTMLCanvasElement;
const logs = document.getElementById('logs') as HTMLUListElement;

const logger = createLogger(logs);

crc(
  canvas,
  rect({
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    fillStyle: 'red',
    strokeStyle: 'black',
    lineWidth: 2,
    onClick: (e) => {
      logger.log('Click', e);
    },
    onDblClick: (e) => {
      logger.log('DblClick', e);
    },
    onMouseOver: (e) => {
      logger.log('MouseOver', e);
    },
    onMouseOut: (e) => {
      logger.log('MouseOut', e);
    },
  })
);
