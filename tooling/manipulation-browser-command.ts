import { defineBrowserCommand } from '@vitest/browser-playwright';

export type ManipulationPointerAction =
  | { type: 'move'; x: number; y: number }
  | { type: 'down' | 'up' }
  | { type: 'keyDown' | 'keyUp'; key: string };

export const manipulationPointer = defineBrowserCommand(async ({ page, frame }, actions: readonly ManipulationPointerAction[]) => {
  const browserFrame = await frame();
  const canvas = browserFrame.locator('canvas[data-manipulation-test]');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected the public manipulation test Canvas.');
  for (const action of actions) {
    if (action.type === 'move') await page.mouse.move(bounds.x + action.x, bounds.y + action.y);
    else if (action.type === 'down') await page.mouse.down();
    else if (action.type === 'up') await page.mouse.up();
    else if (action.type === 'keyDown') await page.keyboard.down(action.key);
    else if (action.type === 'keyUp') await page.keyboard.up(action.key);
  }
});

declare module 'vitest/browser' {
  interface BrowserCommands {
    manipulationPointer(actions: readonly ManipulationPointerAction[]): Promise<void>;
  }
}
