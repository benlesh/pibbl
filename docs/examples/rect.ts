import { crc, rect } from '../../core/src/index'

export function render() {
  crc(document.querySelector('canvas'), rect({
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    fillStyle: 'green'
  }))
}

export const name = 'Rectangles'
