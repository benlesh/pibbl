import {
  DragHandle,
  ManipulationFrame,
  Rectangle,
  pibbl,
  signal,
  useEventListener,
  useManipulation,
  type PibblController,
  type PibblNode,
} from '@pibbl/core';
import { afterEach, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

let controller: PibblController | undefined;

afterEach(async () => {
  controller?.dispose();
  controller = undefined;
  await settle();
  document.body.replaceChildren();
});

function Scene({
  clicks,
  doubleClicks,
  ordinaryClicks,
}: {
  readonly clicks: number[];
  readonly doubleClicks: number[];
  readonly ordinaryClicks: number[];
}): PibblNode {
  useEventListener({
    onClick() { clicks.push(1); },
    onDblClick() { doubleClicks.push(1); },
  });
  const box = useManipulationBox;
  const manipulation = useManipulation({ box, move: {} });
  return [
    <ManipulationFrame key="frame" {...manipulation.frameProps}>
      <DragHandle controller={manipulation}>
        <Rectangle
          pointerEvents="auto"
          keyboardFocusable
          style={{ width: 100, height: 30, fill: "transparent" }}
        />
      </DragHandle>
    </ManipulationFrame>,
    <Rectangle
      key="ordinary"
      style={{ left: 220, top: 40, width: 40, height: 40, fill: '#16a34a' }}
      onClick={() => ordinaryClicks.push(1)}
    />,
  ];
}

const useManipulationBox = signal({ left: 32, top: 40, width: 100, height: 80 });

it('suppresses only the activated drag click through native lost capture and resets its double-click streak', async () => {
  const clicks: number[] = [];
  const doubleClicks: number[] = [];
  const ordinaryClicks: number[] = [];
  useManipulationBox.set({ left: 32, top: 40, width: 100, height: 80 });
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  canvas.dataset.manipulationTest = '';
  canvas.style.touchAction = 'none';
  document.body.append(canvas);
  let lostCapture = 0;
  let nativeClicks = 0;
  let nativeMouseDowns = 0;
  let nativeMouseUps = 0;
  canvas.addEventListener('lostpointercapture', () => { lostCapture++; });
  canvas.addEventListener('click', () => { nativeClicks++; });
  canvas.addEventListener('mousedown', () => { nativeMouseDowns++; });
  canvas.addEventListener('mouseup', () => { nativeMouseUps++; });
  controller = pibbl(
    canvas,
    <Scene
      clicks={clicks}
      doubleClicks={doubleClicks}
      ordinaryClicks={ordinaryClicks}
    />,
    { pixelRatio: 1 },
  );
  await settle();

  await commands.manipulationPointer([
    { type: 'move', x: 42, y: 50 },
    { type: 'down' },
    { type: 'move', x: 65, y: 65 },
    { type: 'up' },
  ]);
  await settle();

  expect(lostCapture).toBeGreaterThan(0);
  expect(nativeClicks).toBe(1);
  expect(nativeMouseDowns).toBe(1);
  expect(nativeMouseUps).toBe(1);
  expect(clicks).toHaveLength(0);
  expect(doubleClicks).toHaveLength(0);

  await commands.manipulationPointer([
    { type: 'move', x: 65, y: 65 },
    { type: 'down' },
    { type: 'up' },
  ]);
  await settle();

  expect(clicks).toHaveLength(1);
  expect(doubleClicks).toHaveLength(0);

  await commands.manipulationPointer([
    { type: 'move', x: 230, y: 50 },
    { type: 'down' },
    { type: 'up' },
  ]);
  await settle();

  expect(clicks).toHaveLength(2);
  expect(ordinaryClicks).toHaveLength(1);
  expect(doubleClicks).toHaveLength(0);
});

function settle(): Promise<void> {
  return new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
