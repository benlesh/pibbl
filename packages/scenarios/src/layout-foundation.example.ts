import {
  absolute,
  crc,
  flow,
  overlay,
  rect,
  text,
  type CRCController,
} from '@crc/core';

export interface LayoutFoundationState {
  bottomClicks: number;
  topClicks: number;
  flowClicks: number;
}

export interface LayoutFoundationMount {
  readonly controller: CRCController;
  getState(): Readonly<LayoutFoundationState>;
  resize(width: number, height: number): void;
}

export function mountLayoutFoundation(
  canvas: HTMLCanvasElement,
): LayoutFoundationMount {
  const state: LayoutFoundationState = {
    bottomClicks: 0,
    topClicks: 0,
    flowClicks: 0,
  };
  const createScene = () => absolute({
    style: { width: '100%', height: '100%' },
    children: [
      overlay({
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
      }),
      flow({
        style: {
          width: '50%',
          height: 60,
          gap: 8,
        },
        children: [
          rect({
            style: { width: '50%', height: 20, fill: '#16a34a' },
            onClick: () => state.flowClicks++,
          }),
          text({
            style: {
              text: 'measured flow',
              font: '12px sans-serif',
              fill: '#ffffff',
            },
          }),
        ],
      }),
    ],
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
