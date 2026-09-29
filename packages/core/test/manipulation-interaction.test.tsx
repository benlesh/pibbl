import { afterEach, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import * as CRC from '@crc/core';
import type { CRCController, CRCNode } from '@crc/core';

let mount: CRCController | undefined;
afterEach(async () => {
  mount?.dispose();
  mount = undefined;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  document.body.replaceChildren();
});
const settle = async () => {
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
};

it('moves the public frame with trusted pointer capture and commits the final geometry once', async () => {
  const useManipulation = Reflect.get(CRC, 'useManipulation');
  const ManipulationFrame = Reflect.get(CRC, 'ManipulationFrame');
  const DragHandle = Reflect.get(CRC, 'DragHandle');
  expect(useManipulation).toBeTypeOf('function');
  expect(ManipulationFrame).toBeTypeOf('function');
  expect(DragHandle).toBeTypeOf('function');
  const box = CRC.signal({ left: 32, top: 40, width: 100, height: 80 });
  const commits: unknown[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300;
  canvas.dataset.manipulationTest = '';
  canvas.style.touchAction = 'none';
  document.body.append(canvas);
  let trusted = false;
  let captured = false;
  canvas.addEventListener('pointerdown', event => { trusted = event.isTrusted; });
  canvas.addEventListener('gotpointercapture', () => { captured = true; });
  function Scene(): CRCNode {
    const manipulation = useManipulation({ box, move: {}, onCommit: (event: unknown) => commits.push(event) });
    return CRC.createElement(ManipulationFrame, { ...manipulation.frameProps },
      CRC.createElement(DragHandle, { controller: manipulation, style: { width: 100, height: 30 } }),
    );
  }
  mount = CRC.crc(canvas, CRC.createElement(Scene, {}));
  await settle();
  await commands.manipulationPointer([
    { type: 'move', x: 42, y: 50 }, { type: 'down' },
    { type: 'move', x: 65, y: 65 }, { type: 'up' },
  ]);
  await settle();
  expect(trusted).toBe(true);
  expect(captured).toBe(true);
  expect(box.get()).toEqual({ left: 55, top: 55, width: 100, height: 80 });
  expect(commits).toHaveLength(1);
  expect(commits[0]).toMatchObject({ changed: true, before: { box: { left: 32, top: 40 } }, after: { box: { left: 55, top: 55 } } });
});

it('resizes the public corner handle with size snapping while keeping its opposite anchor fixed', async () => {
  const ResizeHandles = Reflect.get(CRC, 'ResizeHandles');
  expect(ResizeHandles).toBeTypeOf('function');
  const box = CRC.signal({ left: 32, top: 40, width: 100, height: 80 });
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300; canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  function Scene(): CRCNode {
    const manipulation = Reflect.get(CRC, 'useManipulation')({ box, resize: { snap: { step: 8 } } });
    return CRC.createElement(Reflect.get(CRC, 'ManipulationFrame'), { ...manipulation.frameProps },
      CRC.createElement(ResizeHandles, { controller: manipulation, positions: 'corners' }));
  }
  mount = CRC.crc(canvas, CRC.createElement(Scene, {}));
  await settle();
  await commands.manipulationPointer([{ type: 'move', x: 132, y: 120 }, { type: 'down' }, { type: 'move', x: 155, y: 131 }, { type: 'up' }]);
  await settle();
  expect(box.get()).toEqual({ left: 32, top: 40, width: 120, height: 88 });
});

it('cancels a captured drag without committing and preserves an external replacement', async () => {
  const box = CRC.signal({ left: 32, top: 40, width: 100, height: 80 });
  const commits: unknown[] = [];
  let manipulation: { cancel(): void } | undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300; canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  function Scene(): CRCNode {
    const control = Reflect.get(CRC, 'useManipulation')({ box, move: {}, onCommit: (event: unknown) => commits.push(event) });
    manipulation = control;
    return CRC.createElement(Reflect.get(CRC, 'ManipulationFrame'), { ...control.frameProps },
      CRC.createElement(Reflect.get(CRC, 'DragHandle'), { controller: control, style: { width: 100, height: 30 } }));
  }
  mount = CRC.crc(canvas, CRC.createElement(Scene, {}));
  await settle();
  await commands.manipulationPointer([{ type: 'move', x: 42, y: 50 }, { type: 'down' }, { type: 'move', x: 65, y: 65 }]);
  manipulation!.cancel();
  await commands.manipulationPointer([{ type: 'up' }]);
  expect(box.get()).toEqual({ left: 32, top: 40, width: 100, height: 80 });
  expect(commits).toHaveLength(0);
  await settle();
  await commands.manipulationPointer([{ type: 'move', x: 42, y: 50 }, { type: 'down' }, { type: 'move', x: 65, y: 65 }]);
  box.set({ left: 200, top: 180, width: 100, height: 80 });
  await commands.manipulationPointer([{ type: 'up' }]);
  expect(box.get().left).toBe(200);
  expect(commits).toHaveLength(0);
});
