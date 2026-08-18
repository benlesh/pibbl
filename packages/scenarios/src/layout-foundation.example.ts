import {
  absolute,
  crc,
  overlay,
  rect,
  type CRCController,
} from '@crc/core';

export interface LayoutFoundationState {
  bottomClicks: number;
  topClicks: number;
}

export interface LayoutFoundationMount {
  readonly controller: CRCController;
  getState(): Readonly<LayoutFoundationState>;
  resize(width: number, height: number): void;
}

export function mountLayoutFoundation(
  canvas: HTMLCanvasElement,
): LayoutFoundationMount {
  const state: LayoutFoundationState = { bottomClicks: 0, topClicks: 0 };
  const createScene = () => absolute({
    style: { width: '100%', height: '100%' },
    children: [overlay({
      style: {
        width: '80%',
        height: 100,
        alignItems: 'center',
        justifyItems: 'center',
      },
      children: [
        rect({
          key: 'bottom',
          style: {
            width: '100%',
            height: 80,
            fill: '#2563eb',
          },
          onClick: () => state.bottomClicks++,
        }),
        rect({
          key: 'top',
          style: {
            width: 80,
            height: 50,
            fill: '#f97316',
            alignSelf: 'center',
            justifySelf: 'center',
          },
          onClick: () => state.topClicks++,
        }),
      ],
    })],
  });
  const controller = crc(canvas, createScene());

  return {
    controller,
    getState: () => ({ ...state }),
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      crc(canvas, createScene());
    },
  };
}
