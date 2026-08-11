import type { MouseContractCase } from './mouse-contract';
import { defineComp, rect, text } from '@crc/core';

export const MOUSE_CONTRACT_SOURCE_ID = 'mouse-interaction-contract-example';

export interface MouseContractScenarioState {
  caseId: string;
  lastAction: 'mount' | 'select' | 'reset';
}

interface MouseContractSceneProps {
  contractCase: MouseContractCase;
}

const MouseContractScene = defineComp<MouseContractSceneProps>(({ contractCase }) => {
  const aSelected = ['a', 'child'].includes(contractCase.visualTarget);
  const bSelected = ['b', 'layer', 'top'].includes(contractCase.visualTarget);
  return [
    rect({ x: 0, y: 0, width: 480, height: 240, fillStyle: '#f8fafc' }),
    text({
      x: 24,
      y: 28,
      text: contractCase.title,
      font: '700 17px Arial',
      fillStyle: '#0f172a',
    }),
    rect({
      x: 72,
      y: 68,
      width: 190,
      height: 112,
      fillStyle: aSelected ? '#2563eb' : '#93c5fd',
      strokeStyle: aSelected ? '#172554' : '#475569',
      lineWidth: aSelected ? 4 : 2,
    }),
    rect({
      x: 206,
      y: 94,
      width: 190,
      height: 112,
      fillStyle: bSelected ? '#7c3aed' : '#c4b5fd',
      strokeStyle: bSelected ? '#3b0764' : '#475569',
      lineWidth: bSelected ? 4 : 2,
    }),
    text({ x: 94, y: 98, text: 'A', font: '700 18px Arial', fillStyle: '#ffffff' }),
    text({ x: 228, y: 124, text: 'B / later paint', font: '700 16px Arial', fillStyle: '#ffffff' }),
    text({
      x: 24,
      y: 224,
      text: `approved target: ${contractCase.visualTarget}`,
      font: '13px Arial',
      fillStyle: '#334155',
    }),
  ];
});

export function createMouseContractScene(
  contractCase: MouseContractCase,
): ReturnType<typeof MouseContractScene> {
  return MouseContractScene({ contractCase });
}
