import {
  focusNavigationScenarioEntry,
  loadScenario,
  type FocusNavigationState,
  type ScenarioController,
} from '@crc/scenarios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clickLogicalPoint,
  pressKey,
  pressPenLogicalPoint,
  tab,
  tapTouchLogicalPoint,
} from './support/user-input';

const activeControllers: ScenarioController<FocusNavigationState>[] = [];

const FORWARD_TARGETS = [
  'top-primary',
  'top-form-like',
  'square-1',
  'square-2',
  'square-3',
  'square-4',
  'square-5',
  'square-6',
  'square-7',
  'square-8',
  'square-9',
  'square-10',
  'square-11',
  'square-12',
  'bottom-primary',
  'bottom-secondary',
] as const;

const POINTS = {
  background: { x: 530, y: 400 },
  bottomPrimary: { x: 115, y: 371 },
  square4: { x: 404, y: 154 },
  square6: { x: 204, y: 224 },
  square12: { x: 404, y: 294 },
  topPrimary: { x: 115, y: 70 },
} as const;

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(async () => {
  await Promise.all(activeControllers.splice(0).map(controller => controller.dispose()));
  document.body.replaceChildren();
});

async function mountScenario() {
  const definition = await loadScenario(focusNavigationScenarioEntry);
  const canvas = document.createElement('canvas');
  canvas.width = focusNavigationScenarioEntry.canvas.width;
  canvas.height = focusNavigationScenarioEntry.canvas.height;
  canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
  document.body.append(canvas);
  const controller = await definition.mount({ canvas });
  activeControllers.push(controller);
  await controller.settled();
  const before = document.querySelector<HTMLButtonElement>(
    '[data-crc-focus-navigation="before"]',
  );
  const after = document.querySelector<HTMLButtonElement>(
    '[data-crc-focus-navigation="after"]',
  );
  if (!before || !after) throw new Error('Expected native controls around the Canvas.');
  return { after, before, canvas, controller, definition };
}

async function state(
  controller: ScenarioController<FocusNavigationState>,
): Promise<Readonly<FocusNavigationState>> {
  await controller.settled();
  return controller.getState();
}

describe('focus and keyboard-navigation public scenario', () => {
  it('publishes the readable control structure and four observable state fields', async () => {
    const mounted = await mountScenario();

    expect(focusNavigationScenarioEntry.metadata.id)
      .toBe('focus-and-keyboard-navigation');
    expect(focusNavigationScenarioEntry.metadata.visibility)
      .toBe('documentation-candidate');
    expect(focusNavigationScenarioEntry.actions.map(action => action.id)).toEqual([
      'reorder-squares',
      'remove-current-square',
      'restore-squares',
    ]);
    expect(mounted.definition.formatState(mounted.controller.getState())).toEqual([
      { label: 'Current target', value: 'none' },
      { label: 'Last activation source', value: 'none' },
      { label: 'Activation count', value: '0' },
      { label: 'Focus-visible modality', value: 'none' },
    ]);
    expect(mounted.before.nextElementSibling).toBe(mounted.canvas);
    expect(mounted.canvas.nextElementSibling).toBe(mounted.after);
  });

  it('uses one forward and reverse Tab order across every native and logical stop', async () => {
    const mounted = await mountScenario();
    mounted.before.focus();

    for (const target of FORWARD_TARGETS) {
      await tab();
      expect(document.activeElement).toBe(mounted.canvas);
      expect((await state(mounted.controller)).currentTarget).toBe(target);
    }
    await tab();
    expect(document.activeElement).toBe(mounted.after);
    expect((await state(mounted.controller)).currentTarget).toBe('none');

    for (const target of [...FORWARD_TARGETS].reverse()) {
      await tab(true);
      expect(document.activeElement).toBe(mounted.canvas);
      expect((await state(mounted.controller)).currentTarget).toBe(target);
    }
    await tab(true);
    expect(document.activeElement).toBe(mounted.before);
    expect((await state(mounted.controller)).currentTarget).toBe('none');
  }, 30_000);

  it('keeps arrows in the nearest square boundary and gives target handlers precedence', async () => {
    const mounted = await mountScenario();
    mounted.before.focus();
    await tab();
    await tab();
    expect((await state(mounted.controller)).currentTarget).toBe('top-form-like');

    await pressKey('ArrowRight');
    expect((await state(mounted.controller)).currentTarget).toBe('top-form-like');

    await tab();
    expect((await state(mounted.controller)).currentTarget).toBe('square-1');
    await pressKey('ArrowRight');
    expect((await state(mounted.controller)).currentTarget).toBe('square-2');
    await pressKey('ArrowDown');
    expect((await state(mounted.controller)).currentTarget).toBe('square-6');
    await pressKey('ArrowLeft');
    expect((await state(mounted.controller)).currentTarget).toBe('square-5');
    await pressKey('ArrowUp');
    expect((await state(mounted.controller)).currentTarget).toBe('square-1');

    await pressPenLogicalPoint(mounted.canvas, POINTS.square4);
    expect((await state(mounted.controller)).currentTarget).toBe('square-4');
    await pressKey('ArrowRight');
    expect((await state(mounted.controller)).currentTarget).toBe('square-4');

    await tapTouchLogicalPoint(mounted.canvas, POINTS.square12);
    expect((await state(mounted.controller)).currentTarget).toBe('square-12');
    await pressKey('ArrowDown');
    expect((await state(mounted.controller)).currentTarget).toBe('square-12');
  });

  it('reports real click, Enter, and Space activation plus focus-visible modality', async () => {
    const mounted = await mountScenario();

    await clickLogicalPoint(mounted.canvas, POINTS.topPrimary);
    expect(await state(mounted.controller)).toMatchObject({
      activationCount: 1,
      currentTarget: 'top-primary',
      focusVisibleModality: 'pointer',
      lastActivationSource: 'click',
    });

    await pressKey('Enter');
    expect(await state(mounted.controller)).toMatchObject({
      activationCount: 2,
      currentTarget: 'top-primary',
      focusVisibleModality: 'pointer',
      lastActivationSource: 'enter',
    });

    await pressKey('Space');
    expect(await state(mounted.controller)).toMatchObject({
      activationCount: 3,
      lastActivationSource: 'space',
    });

    await tab();
    expect(await state(mounted.controller)).toMatchObject({
      currentTarget: 'top-form-like',
      focusVisibleModality: 'keyboard',
    });
  });

  it('handles mouse, pen, and touch focus, background clear, and DOM blur', async () => {
    const mounted = await mountScenario();

    await clickLogicalPoint(mounted.canvas, POINTS.square6);
    expect(await state(mounted.controller)).toMatchObject({
      currentTarget: 'square-6',
      focusVisibleModality: 'pointer',
    });
    await pressPenLogicalPoint(mounted.canvas, POINTS.square4);
    expect((await state(mounted.controller)).currentTarget).toBe('square-4');
    await tapTouchLogicalPoint(mounted.canvas, POINTS.square12);
    expect((await state(mounted.controller)).currentTarget).toBe('square-12');

    await clickLogicalPoint(mounted.canvas, POINTS.background);
    expect(await state(mounted.controller)).toMatchObject({
      currentTarget: 'none',
      focusVisibleModality: 'none',
    });

    await clickLogicalPoint(mounted.canvas, POINTS.bottomPrimary);
    mounted.after.focus();
    expect(await state(mounted.controller)).toMatchObject({
      currentTarget: 'none',
      focusVisibleModality: 'none',
    });
  });

  it('preserves keyed focus through reorder and clears it when the target is removed', async () => {
    const mounted = await mountScenario();
    await clickLogicalPoint(mounted.canvas, POINTS.square6);
    expect((await state(mounted.controller)).currentTarget).toBe('square-6');

    await mounted.controller.perform('reorder-squares');
    expect((await state(mounted.controller)).currentTarget).toBe('square-6');

    await mounted.controller.perform('remove-current-square');
    expect(await state(mounted.controller)).toMatchObject({
      currentTarget: 'none',
      focusVisibleModality: 'none',
    });

    await mounted.controller.perform('restore-squares');
    mounted.before.focus();
    await tab();
    await tab();
    await tab();
    expect((await state(mounted.controller)).currentTarget).toBe('square-1');
  });
});
