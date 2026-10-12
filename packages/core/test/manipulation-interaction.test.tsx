import { afterEach, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import * as Pibbl from '@pibbl/core';
import type { PibblController, PibblNode } from '@pibbl/core';

let mount: PibblController | undefined;
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
  const useManipulation = Reflect.get(Pibbl, 'useManipulation');
  const ManipulationFrame = Reflect.get(Pibbl, 'ManipulationFrame');
  const DragHandle = Reflect.get(Pibbl, 'DragHandle');
  expect(useManipulation).toBeTypeOf('function');
  expect(ManipulationFrame).toBeTypeOf('function');
  expect(DragHandle).toBeTypeOf('function');
  const box = Pibbl.signal({ left: 32, top: 40, width: 100, height: 80 });
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
  function Scene(): PibblNode {
    const manipulation = useManipulation({ box, move: {}, onCommit: (event: unknown) => commits.push(event) });
    return Pibbl.createElement(
      ManipulationFrame,
      { ...manipulation.frameProps },
      Pibbl.createElement(
        DragHandle,
        { controller: manipulation },
        Pibbl.createElement(Pibbl.Rectangle, {
          pointerEvents: 'auto',
          keyboardFocusable: true,
          style: { width: 100, height: 30, fill: 'transparent' },
        }),
      ),
    );
  }
  mount = Pibbl.pibbl(canvas, Pibbl.createElement(Scene, {}));
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
  const ResizeHandles = Reflect.get(Pibbl, 'ResizeHandles');
  expect(ResizeHandles).toBeTypeOf('function');
  const box = Pibbl.signal({ left: 32, top: 40, width: 100, height: 80 });
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300; canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  function Scene(): PibblNode {
    const manipulation = Reflect.get(Pibbl, 'useManipulation')({ box, resize: { snap: { step: 8 } } });
    return Pibbl.createElement(Reflect.get(Pibbl, 'ManipulationFrame'), { ...manipulation.frameProps },
      Pibbl.createElement(ResizeHandles, { controller: manipulation, positions: 'corners' }));
  }
  mount = Pibbl.pibbl(canvas, Pibbl.createElement(Scene, {}));
  await settle();
  await commands.manipulationPointer([{ type: 'move', x: 132, y: 120 }, { type: 'down' }, { type: 'move', x: 155, y: 131 }, { type: 'up' }]);
  await settle();
  expect(box.get()).toEqual({ left: 32, top: 40, width: 120, height: 88 });
});

it('cancels a captured drag without committing and preserves an external replacement', async () => {
  const box = Pibbl.signal({ left: 32, top: 40, width: 100, height: 80 });
  const commits: unknown[] = [];
  let manipulation: { cancel(): void } | undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300; canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  function Scene(): PibblNode {
    const control = Reflect.get(Pibbl, 'useManipulation')({ box, move: {}, onCommit: (event: unknown) => commits.push(event) });
    manipulation = control;
    return Pibbl.createElement(
      Reflect.get(Pibbl, 'ManipulationFrame'),
      { ...control.frameProps },
      Pibbl.createElement(
        Reflect.get(Pibbl, 'DragHandle'),
        { controller: control },
        Pibbl.createElement(Pibbl.Rectangle, {
          pointerEvents: 'auto',
          keyboardFocusable: true,
          style: { width: 100, height: 30, fill: 'transparent' },
        }),
      ),
    );
  }
  mount = Pibbl.pibbl(canvas, Pibbl.createElement(Scene, {}));
  await settle();
  await commands.manipulationPointer([{ type: 'move', x: 42, y: 50 }, { type: 'down' }, { type: 'move', x: 65, y: 65 }]);
  expect(box.get()).toEqual({ left: 55, top: 55, width: 100, height: 80 });
  manipulation!.cancel();
  await commands.manipulationPointer([{ type: 'up' }]);
  expect(box.get()).toEqual({ left: 32, top: 40, width: 100, height: 80 });
  expect(commits).toHaveLength(0);
  await settle();
  await commands.manipulationPointer([{ type: 'move', x: 42, y: 50 }, { type: 'down' }, { type: 'move', x: 65, y: 65 }]);
  expect(box.get()).toEqual({ left: 55, top: 55, width: 100, height: 80 });
  box.set({ left: 200, top: 180, width: 100, height: 80 });
  await commands.manipulationPointer([{ type: 'up' }]);
  expect(box.get().left).toBe(200);
  expect(commits).toHaveLength(0);
});
