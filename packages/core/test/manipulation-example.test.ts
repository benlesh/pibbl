import { afterEach, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import mountExample from '../../scenarios/src/learning/user-events/manipulation.example';
import type { CRCController } from '@crc/core';
let mounted: CRCController | undefined;
afterEach(() => { mounted?.dispose(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
it('runs the public card with nested Flex reflow and a geometry readout', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 560; canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const labels: string[] = [];
  const draw = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, 'fillText').mockImplementation((text, x, y, maxWidth) => {
    labels.push(text);
    if (maxWidth === undefined) draw(text, x, y); else draw(text, x, y, maxWidth);
  });
  mounted = mountExample(canvas);
  await settle();
  expect(labels).toContain('320 × 224 local units');
  await commands.manipulationPointer([{ type: 'move', x: 416, y: 344 }, { type: 'down' }, { type: 'move', x: 448, y: 368 }, { type: 'up' }]);
  await settle();
  expect(labels).toContain('352 × 248 local units');
  expect(labels).toContain('left 96 · top 120 · width 352 · height 248');
});
