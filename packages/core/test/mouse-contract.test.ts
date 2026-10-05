import type {
  MouseContractScenarioState,
  ScenarioController,
} from '@crc/scenarios';
import {
  formatContractTrace,
  formatOrderingPolicy,
  GEOMETRY_MATRIX_CASES,
  loadScenario,
  mouseContractScenarioEntry,
  MOUSE_CONTRACT_CASES,
  validateMouseContractCases,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import mouseContractSource from '../../scenarios/src/mouse-contract.example.tsx?raw';

let activeController: ScenarioController<MouseContractScenarioState> | undefined;

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The mouse contract Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

function moveCanvas(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    clientX: bounds.left + x * bounds.width / canvas.width,
    clientY: bounds.top + y * bounds.height / canvas.height,
  }));
}

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  document.body.replaceChildren();
});

describe('mouse interaction contract oracle', () => {
  it('validates the structure and independently freezes critical traces', () => {
    expect(validateMouseContractCases(MOUSE_CONTRACT_CASES)).toBe(MOUSE_CONTRACT_CASES);
    expect(() => validateMouseContractCases([
      ...MOUSE_CONTRACT_CASES,
      MOUSE_CONTRACT_CASES[0],
    ])).toThrow(/unique/);

    const expectedTraces = {
      'enter-region': 'mouseover(a ← canvas-background) → mousemove(a)',
      'leave-region-to-canvas-background': 'mouseout(a ← canvas-background)',
      'exit-root-canvas': 'mouseout(a ← outside-root)',
      'primary-click-reentry': 'mousedown(a) → mouseout(a ← canvas-background) → mouseover(a ← canvas-background) → mousemove(a) → mouseup(a) → click(a)',
      'context-menu': 'mousedown(b) → contextmenu(b) → mouseup(b)',
      'fill-stroke-hit': 'mouseover(a ← canvas-background) → mousemove(a)',
      'remove-target-during-move-plan': 'mouseout(a ← b)',
    } as const;
    for (const [id, expected] of Object.entries(expectedTraces)) {
      const contractCase = MOUSE_CONTRACT_CASES.find(candidate => candidate.id === id);
      expect(contractCase, id).toBeDefined();
      expect(formatContractTrace(contractCase!.crcTrace), id).toBe(expected);
    }
    expect(MOUSE_CONTRACT_CASES.find(candidate => candidate.id === 'context-menu')?.ordering)
      .toEqual({ kind: 'browser-dependent', referenceEnvironment: 'Chromium on macOS' });
    expect(MOUSE_CONTRACT_CASES.filter(contractCase => contractCase.phase === 'tfc-05').map(
      contractCase => contractCase.id,
    )).toEqual([
      'nested-child',
      'clip-intersection-miss',
      'transformed-hit',
      'later-layer-topmost',
      'css-scaled-coordinates',
    ]);
    const geometryContractCases = new Set<string>(
      GEOMETRY_MATRIX_CASES.flatMap(matrixCase => matrixCase.contractCaseIds),
    );
    expect(MOUSE_CONTRACT_CASES.filter(contractCase => contractCase.phase === 'tfc-05').map(
      contractCase => contractCase.id,
    ).filter(caseId => !geometryContractCases.has(caseId))).toEqual([]);
    expect(MOUSE_CONTRACT_CASES.filter(
      contractCase => contractCase.phase === 'reference-only',
    ).map(contractCase => contractCase.id)).toEqual(['context-menu']);
    expect(MOUSE_CONTRACT_CASES.filter(contractCase => contractCase.phase === 'tfc-04')).toContainEqual(
      expect.objectContaining({ id: 'fill-stroke-hit' }),
    );
  });

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
        interactionCount: 0,
        lastInteractionTarget: null,
      });
      expect(definition.formatState(controller.getState())).toEqual([
        { label: 'Case', value: contractCase.title },
        { label: 'Gesture', value: contractCase.gesture },
        { label: 'Native reference', value: formatContractTrace(contractCase.nativeTrace) },
        { label: 'Approved CRC (logical route)', value: formatContractTrace(contractCase.crcTrace) },
        { label: 'Ordering', value: formatOrderingPolicy(contractCase.ordering) },
        {
          label: 'Target policy',
          value: `${contractCase.targeting.candidatePolicy} · ${contractCase.targeting.identityPolicy}`,
        },
        { label: 'Rule', value: contractCase.rule },
        { label: 'Last probe target', value: 'none' },
      ]);
      expect(pixelAt(canvas, 470, 40)).toEqual([248, 250, 252, 255]);

      // TFC-05 and reference-only cases remain oracle diagrams rather than
      // being misreported as TFC-04 runtime conformance.
      const schematicOnly = [
        'line-interaction-width-miss',
        'remove-target-during-move-plan',
        'remove-target-during-press',
      ];
      if (contractCase.phase === 'tfc-04' && !schematicOnly.includes(contractCase.id)) {
        moveCanvas(canvas, contractCase.visualProbe.x, contractCase.visualProbe.y);
        const expectedProbe = contractCase.visualProbe.expectedTarget;
        expect(controller.getState().lastInteractionTarget, contractCase.id).toBe(expectedProbe);
      }
    }

    await controller.reset();
    expect(controller.getState()).toEqual({
      caseId: 'enter-region',
      lastAction: 'reset',
      interactionCount: 0,
      lastInteractionTarget: null,
    });
  });
});
