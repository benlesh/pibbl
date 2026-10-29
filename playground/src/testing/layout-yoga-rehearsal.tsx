import { createElement } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import yogaReference from '../../../tooling/layout-yoga-rehearsal/reference.json';
import {
  WasmYogaMigrationExample,
} from '../../../packages/scenarios/src/learning/layout/wasm-yoga-migration.example';

type YogaMigrationFixtures = NonNullable<NonNullable<Parameters<typeof WasmYogaMigrationExample>[0]>['fixtures']>;

const canvas = document.createElement('canvas');
canvas.width = 760;
canvas.height = 540;
canvas.style.cssText = 'display:block;width:760px;height:540px;max-width:100%;margin:auto';
document.body.append(canvas);

const controller = pibblSync(
  canvas,
  createElement(WasmYogaMigrationExample, {
    fixtures: yogaReference.cases as YogaMigrationFixtures,
  }),
);

addEventListener('pagehide', () => controller.dispose(), { once: true });
