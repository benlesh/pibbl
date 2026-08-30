import type { ScenarioCatalogRecord } from '@crc/scenarios';
import {
  interactionLabScenarioEntry,
  loadScenario,
  scenarioCatalog,
  scenarioCatalogIndex,
  validateScenarioCatalog,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadScenarioSource,
  scenarioSourcePaths,
} from '../../../playground/src/scenario-sources';

const controllers: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(controllers.splice(0).map(controller => controller.dispose()));
  document.body.replaceChildren();
});

describe('scenario catalog trust gate', () => {
  it('publishes the complete shared user-event laboratory action surface', () => {
    expect(interactionLabScenarioEntry.actions.map(action => action.id)).toEqual(
      expect.arrayContaining([
        'show-propagation',
        'show-pointer-capture',
        'show-touch-retention',
        'show-wheel-cancellation',
        'show-keyboard-fields',
        'show-composition',
        'show-clipboard',
        'show-drag-drop',
      ]),
    );
    expect(interactionLabScenarioEntry.metadata.apiTags).toEqual(
      expect.arrayContaining([
        'crcEventListener',
        'crcEventTarget',
        'pointer events',
        'touch events',
        'wheel events',
        'keyboard events',
        'composition events',
        'clipboard events',
        'drag events',
      ]),
    );
    const instructions = interactionLabScenarioEntry.metadata.manualSteps
      .map(step => `${step.action} ${step.expected}`)
      .join(' ');
    expect(instructions).not.toContain('explicit input adapter');
    expect(instructions).toContain('internal headless contract transport');
  });

  it('discovers exactly one catalog entry for every executable example', () => {
    expect(validateScenarioCatalog(scenarioCatalog)).toBe(scenarioCatalog);
    expect(scenarioCatalog.map(entry => entry.source.path).sort()).toEqual(
      scenarioSourcePaths,
    );
    expect(scenarioCatalogIndex.learningPath).toHaveLength(scenarioCatalog.length);
    expect(
      scenarioCatalogIndex.byApi.find(group => group.key === 'crcCursor')
        ?.scenarios.map(entry => entry.metadata.id),
    ).toEqual(['runtime-hooks-laboratory']);
  });

  it('rejects duplicate executable source identities and paths', () => {
    const first = scenarioCatalog[0];
    const second = scenarioCatalog[1];
    if (!first || !second) {
      throw new Error('The scenario catalog needs at least two entries.');
    }
    const duplicateId: ScenarioCatalogRecord = {
      ...second,
      metadata: { ...second.metadata, learningOrder: 9_001 },
      source: { ...second.source, id: first.source.id },
    };
    expect(() => validateScenarioCatalog([first, duplicateId])).toThrow(
      `Duplicate scenario source id "${first.source.id}".`,
    );

    const duplicatePath: ScenarioCatalogRecord = {
      ...second,
      metadata: { ...second.metadata, learningOrder: 9_002 },
      source: { ...second.source, path: first.source.path },
    };
    expect(() => validateScenarioCatalog([first, duplicatePath])).toThrow(
      `Duplicate scenario source path "${first.source.path}".`,
    );
  });

  it.each(scenarioCatalog)(
    'loads, mounts, resets, and disposes $metadata.id through its registered contract',
    async entry => {
      const sourceText = await loadScenarioSource(entry);
      expect(sourceText).toContain(entry.source.marker);

      const definition = await loadScenario(entry);
      const canvas = document.createElement('canvas');
      canvas.width = entry.canvas.width;
      canvas.height = entry.canvas.height;
      const referenceHost = document.createElement('div');
      document.body.append(canvas, referenceHost);

      const controller = await definition.mount({ canvas, referenceHost });
      controllers.push(controller);
      await controller.settled();
      expect(definition.formatState(controller.getState()).length).toBeGreaterThan(0);
      await controller.reset();
      await controller.settled();
      expect(definition.formatState(controller.getState()).length).toBeGreaterThan(0);
      for (const action of entry.actions) {
        await controller.perform(action.id);
        await controller.settled();
        expect(definition.formatState(controller.getState()).length).toBeGreaterThan(0);
        await controller.reset();
        await controller.settled();
      }
      await controller.dispose();
      controllers.splice(controllers.indexOf(controller), 1);
    },
    60_000,
  );
});
