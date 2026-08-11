import type { CRCMouseEvent } from '@crc/core';
import type { MouseContractCase } from './mouse-contract';
import {
  clip,
  crcEvent,
  defineComp,
  g,
  layer,
  line,
  path as crcPath,
  rect,
  text,
} from '@crc/core';

export const MOUSE_CONTRACT_SOURCE_ID = 'mouse-interaction-contract-example';

export interface MouseContractScenarioState {
  caseId: string;
  lastAction: 'mount' | 'select' | 'reset';
  interactionCount: number;
  lastInteractionTarget: string | null;
}

interface MouseContractSceneProps {
  contractCase: MouseContractCase;
  recordTarget?: (target: string) => void;
}

function caseVisual(
  contractCase: MouseContractCase,
  recordTarget: (target: string) => void,
) {
  const rectanglePath = (x: number, y: number, width: number, height: number) => {
    const path = new Path2D();
    path.rect(x, y, width, height);
    return path;
  };
  const interactive = (target: string) => ({
    cursor: 'crosshair',
    onMouseMove: (_event: CRCMouseEvent) => recordTarget(target),
  });
  const region = (
    target: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fillStyle: string,
  ) => rect({
    key: `region-${target}`,
    x,
    y,
    width,
    height,
    fillStyle,
    strokeStyle: '#334155',
    lineWidth: 2,
    ...interactive(target),
  });

  switch (contractCase.id) {
    case 'overlap-topmost':
      return [
        region('a', 88, 78, 190, 100, '#93c5fd'),
        region('top', 190, 96, 190, 100, '#7c3aed'),
        text({ x: 214, y: 126, text: 'later-painted top', font: '700 14px Arial', fillStyle: '#fff' }),
      ];
    case 'nested-child':
      return [
        g({
          key: 'translated-group',
          x: 90,
          y: 30,
          children: [
            rect({ x: 42, y: 45, width: 190, height: 120, fillStyle: '#dbeafe' }),
            region('child', 70, 70, 100, 72, '#2563eb'),
            text({ x: 84, y: 100, text: 'child', font: '700 15px Arial', fillStyle: '#fff' }),
          ],
        }),
      ];
    case 'clip-intersection-miss': {
      const outerClip = new Path2D();
      outerClip.rect(145, 72, 190, 118);
      const innerClip = new Path2D();
      innerClip.rect(178, 94, 92, 76);
      return [
        clip({
          path: outerClip,
          children: [
            clip({
              path: innerClip,
              children: [region('a', 132, 62, 220, 138, '#2563eb')],
            }),
          ],
        }),
        text({ x: 286, y: 132, text: '× outside inner clip', font: '700 13px Arial', fillStyle: '#b91c1c' }),
      ];
    }
    case 'transformed-hit':
      return [
        g({
          key: 'scaled-translated-group',
          scaleX: 1.2,
          scaleY: 1.1,
          x: 180,
          y: 20,
          children: [region('a', 60, 80, 104, 60, '#2563eb')],
        }),
        text({ x: 96, y: 136, text: 'local shape', font: '13px Arial', fillStyle: '#64748b' }),
        line({ coords: [[158, 132], [278, 132]], strokeStyle: '#94a3b8', lineWidth: 1 }),
      ];
    case 'later-layer-topmost':
      return [
        region('a', 112, 76, 190, 112, '#93c5fd'),
        layer({
          key: 'later-layer',
          render: region('layer', 198, 96, 180, 94, '#f59e0b'),
        }),
        text({ x: 218, y: 126, text: 'later layer', font: '700 14px Arial', fillStyle: '#422006' }),
      ];
    case 'css-scaled-coordinates':
      return [
        region('a', 150, 88, 180, 88, '#2563eb'),
        line({ coords: [[150, 188], [330, 188]], strokeStyle: '#64748b', lineWidth: 1 }),
        text({ x: 173, y: 122, text: 'intrinsic 180 × 88', font: '700 14px Arial', fillStyle: '#fff' }),
        text({ x: 166, y: 207, text: 'CSS pixels → intrinsic coordinates', font: '13px Arial', fillStyle: '#475569' }),
      ];
    case 'fill-hit':
      return [region('a', 72, 72, 190, 112, '#2563eb')];
    case 'stroke-hit':
      return [
        line({
          key: 'stroke-region-a',
          coords: [[78, 76], [264, 76], [264, 188], [78, 188], [78, 76]],
          strokeStyle: '#2563eb',
          lineWidth: 6,
          lineInteractionWidth: 12,
          ...interactive('a'),
        }),
        text({ x: 116, y: 136, text: 'stroke only', font: '700 15px Arial', fillStyle: '#1e3a8a' }),
      ];
    case 'fill-stroke-hit':
      return [
        crcPath({
          key: 'fill-stroke-region-a',
          path: rectanglePath(72, 72, 190, 112),
          fillStyle: '#93c5fd',
          strokeStyle: '#1d4ed8',
          lineWidth: 6,
          lineInteractionWidth: 6,
          ...interactive('a'),
        }),
      ];
    case 'transparent-fill-hit':
      return [
        rect({ x: 72, y: 72, width: 190, height: 112, fillStyle: '#e2e8f0' }),
        line({ coords: [[72, 72], [262, 184]], strokeStyle: '#cbd5e1', lineWidth: 1 }),
        line({ coords: [[262, 72], [72, 184]], strokeStyle: '#cbd5e1', lineWidth: 1 }),
        rect({
          key: 'transparent-fill-region-a',
          x: 72,
          y: 72,
          width: 190,
          height: 112,
          fillStyle: 'rgba(37, 99, 235, 0)',
          ...interactive('a'),
        }),
        text({ x: 94, y: 136, text: 'transparent fill hit area', font: '700 14px Arial', fillStyle: '#1e3a8a' }),
      ];
    case 'line-interaction-width-hit':
    case 'line-interaction-width-miss':
      return [
        line({
          key: 'expanded-line-a',
          coords: [[90, 132], [390, 132]],
          strokeStyle: '#2563eb',
          lineWidth: 2,
          lineInteractionWidth: 24,
          ...interactive('a'),
        }),
        line({ coords: [[90, 120], [390, 120]], strokeStyle: '#bfdbfe', lineWidth: 1 }),
        line({ coords: [[90, 144], [390, 144]], strokeStyle: '#bfdbfe', lineWidth: 1 }),
        text({ x: 126, y: 104, text: '24px interaction stroke', font: '13px Arial', fillStyle: '#475569' }),
      ];
    case 'root-event-no-path':
      return [
        text({ x: 120, y: 126, text: 'Canvas-wide observer', font: '700 20px Arial', fillStyle: '#334155' }),
        text({ x: 94, y: 154, text: 'not a logical target or cursor region', font: '14px Arial', fillStyle: '#64748b' }),
      ];
    case 'remove-target-during-press':
    case 'remove-target-during-move-plan':
      return [
        rect({ x: 72, y: 72, width: 190, height: 112, strokeStyle: '#94a3b8', lineWidth: 2 }),
        line({ coords: [[72, 72], [262, 184]], strokeStyle: '#ef4444', lineWidth: 4 }),
        line({ coords: [[262, 72], [72, 184]], strokeStyle: '#ef4444', lineWidth: 4 }),
        text({ x: 102, y: 136, text: 'target removed', font: '700 15px Arial', fillStyle: '#991b1b' }),
      ];
    default: {
      const selectedA = ['a', 'child'].includes(contractCase.visualTarget);
      const selectedB = ['b', 'layer', 'top'].includes(contractCase.visualTarget);
      return [
        region('a', 72, 68, 190, 112, selectedA ? '#2563eb' : '#93c5fd'),
        region('b', 278, 86, 118, 100, selectedB ? '#7c3aed' : '#c4b5fd'),
        text({ x: 94, y: 100, text: 'A', font: '700 18px Arial', fillStyle: '#fff' }),
        text({ x: 300, y: 118, text: 'B', font: '700 18px Arial', fillStyle: '#fff' }),
      ];
    }
  }
}

const MouseContractScene = defineComp<MouseContractSceneProps>(({ contractCase, recordTarget }) => {
  const record = recordTarget ?? (() => undefined);
  crcEvent(
    'mousemove',
    contractCase.targeting.candidatePolicy === 'canvas-wide-observer' ?
      () => record('canvas-wide-observer') :
      undefined,
  );

  const probe = contractCase.visualProbe;
  return [
    rect({ key: 'background', x: 0, y: 0, width: 480, height: 240, fillStyle: '#f8fafc' }),
    text({
      key: 'title',
      x: 24,
      y: 28,
      text: contractCase.title,
      font: '700 17px Arial',
      fillStyle: '#0f172a',
    }),
    ...caseVisual(contractCase, record),
    line({
      key: 'probe-horizontal',
      coords: [[probe.x - 6, probe.y], [probe.x + 6, probe.y]],
      strokeStyle: '#dc2626',
      lineWidth: 2,
    }),
    line({
      key: 'probe-vertical',
      coords: [[probe.x, probe.y - 6], [probe.x, probe.y + 6]],
      strokeStyle: '#dc2626',
      lineWidth: 2,
    }),
    text({
      key: 'approved-target',
      x: 24,
      y: 224,
      text: `approved target: ${probe.expectedTarget ?? 'none'}`,
      font: '13px Arial',
      fillStyle: '#334155',
    }),
  ];
});

export function createMouseContractScene(
  contractCase: MouseContractCase,
  recordTarget?: (target: string) => void,
): ReturnType<typeof MouseContractScene> {
  return MouseContractScene({ contractCase, recordTarget });
}
