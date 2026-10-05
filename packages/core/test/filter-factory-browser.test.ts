import { Group, Rectangle, pibbl, createElement } from '@pibbl/core';
import { blur } from '@pibbl/core/filters';
import { afterEach, describe, expect, it } from 'vitest';
import { clickMouse } from './support/mouse-input';

describe('native filter factories', () => {
  const controllers: Array<{ dispose(): void }> = [];

  afterEach(() => {
    for (const controller of controllers) controller.dispose();
    controllers.length = 0;
    document.body.replaceChildren();
  });

  it('renders an imported blur factory without changing its click target', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    document.body.append(canvas);
    let clicks = 0;

    controllers.push(pibbl(canvas, createElement(Group, {
      style: { filter: blur({ radius: 3 }) },
      children: createElement(Rectangle, {
        style: { left: 20, top: 20, width: 20, height: 20, fill: 'red' },
        onClick: () => { clicks += 1; },
      }),
    })));

    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const context = canvas.getContext('2d');
    expect(context).not.toBeNull();
    // A visible fringe proves the imported effect executed; an identity/no-op cannot pass.
    expect(context!.getImageData(17, 30, 1, 1).data[3]).toBeGreaterThan(0);

    await clickMouse(canvas, { x: 30, y: 30 });
    expect(clicks).toBe(1);
    await clickMouse(canvas, { x: 17, y: 30 });
    // Appearance expands outside the source; interaction keeps original geometry.
    expect(clicks).toBe(1);
  });
});
