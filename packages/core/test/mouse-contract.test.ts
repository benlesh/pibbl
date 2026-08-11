import type {
  MouseContractScenarioState,
  ScenarioController,
} from '@crc/scenarios';
import {
  formatContractTrace,
  loadScenario,
  mouseContractScenarioEntry,
  MOUSE_CONTRACT_CASES,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import mouseContractSource from '../../scenarios/src/mouse-contract.example.ts?raw';

let activeController: ScenarioController<MouseContractScenarioState> | undefined;

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The mouse contract Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  document.body.replaceChildren();
});

describe('mouse interaction contract oracle', () => {
  it('loads the shared contract explorer and renders every approved case', async () => {
    expect(mouseContractSource).toContain(mouseContractScenarioEntry.source.marker);
    expect(mouseContractScenarioEntry.actions.map(action => action.id)).toEqual(
      MOUSE_CONTRACT_CASES.map(contractCase => `show-${contractCase.id}`),
    );

    const canvas = document.createElement('canvas');
    canvas.width = mouseContractScenarioEntry.canvas.width;
    canvas.height = mouseContractScenarioEntry.canvas.height;
    document.body.replaceChildren(canvas);
    const definition = await loadScenario(mouseContractScenarioEntry);
    const controller = await definition.mount({ canvas });
    activeController = controller;

    for (const contractCase of MOUSE_CONTRACT_CASES) {
      await controller.perform(`show-${contractCase.id}`);
      expect(controller.getState()).toEqual({
        caseId: contractCase.id,
        lastAction: 'select',
      });
      expect(definition.formatState(controller.getState())).toEqual([
        { label: 'Case', value: contractCase.title },
        { label: 'Gesture', value: contractCase.gesture },
        { label: 'Native reference', value: formatContractTrace(contractCase.nativeTrace) },
        { label: 'Approved CRC', value: formatContractTrace(contractCase.crcTrace) },
        { label: 'Rule', value: contractCase.rule },
      ]);

      if (contractCase.visualTarget === 'none') {
        expect(pixelAt(canvas, 100, 150)).toEqual([147, 197, 253, 255]);
        expect(pixelAt(canvas, 350, 180)).toEqual([196, 181, 253, 255]);
      } else if (contractCase.visualTarget === 'a' || contractCase.visualTarget === 'child') {
        expect(pixelAt(canvas, 100, 150)).toEqual([37, 99, 235, 255]);
        expect(pixelAt(canvas, 350, 180)).toEqual([196, 181, 253, 255]);
      } else {
        expect(pixelAt(canvas, 100, 150)).toEqual([147, 197, 253, 255]);
        expect(pixelAt(canvas, 350, 180)).toEqual([124, 58, 237, 255]);
      }
    }

    await controller.reset();
    expect(controller.getState()).toEqual({
      caseId: 'enter-region',
      lastAction: 'reset',
    });
  });
});
