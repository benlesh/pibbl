import {
  absolute,
  crc,
  flex,
  flow,
  grid,
  overlay,
  rect,
  text,
  type CRCController,
} from '@crc/core';

export interface LayoutFoundationState {
  bottomClicks: number;
  topClicks: number;
  flowClicks: number;
  flexClicks: number;
  gridClicks: number;
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
    flexClicks: 0,
    gridClicks: 0,
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
      flex({
        style: { width: 180, height: 20 },
        children: [
          rect({
            style: {
              width: 90,
              height: 20,
              minWidth: 0,
              flexBasis: 90,
              flexShrink: 0,
              fill: '#dc2626',
            },
          }),
          rect({
            style: {
              width: 90,
              height: 20,
              minWidth: 0,
              flexBasis: 90,
              flexShrink: 0,
              fill: '#7c3aed',
            },
            onClick: () => state.flexClicks++,
          }),
        ],
      }),
      grid({
        style: {
          width: 150,
          height: 20,
          gridTemplateColumns: [50, '1fr', 50],
          gridTemplateRows: [20],
        },
        children: [
          rect({
            style: {
              width: 'auto',
              height: 'auto',
              gridColumnStart: 1,
              gridRowStart: 1,
              fill: '#0e7490',
            },
            onClick: () => state.gridClicks++,
          }),
          rect({
            style: {
              width: 'auto',
              height: 'auto',
              gridColumnStart: 2,
              gridRowStart: 1,
              fill: '#0891b2',
            },
            onClick: () => state.gridClicks++,
          }),
          rect({
            style: {
              width: 'auto',
              height: 'auto',
              gridColumnStart: 3,
              gridRowStart: 1,
              fill: '#0e7490',
            },
            onClick: () => state.gridClicks++,
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
