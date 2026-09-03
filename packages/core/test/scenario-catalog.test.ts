import type { ScenarioCatalogRecord } from '@crc/scenarios';
import {
  focusNavigationScenarioEntry,
  interactionLabScenarioEntry,
  loadScenario,
  scenarioCatalog,
  scenarioCatalogIndex,
  validateScenarioCatalog,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import { validateScenarioSourceText } from '../../../tooling/learning-source-contract';
import {
  loadScenarioSource,
  scenarioSourcePaths,
} from '../../../playground/src/scenario-sources';

const controllers: Array<{ dispose: () => Promise<void> }> = [];

const LEGACY_COMPONENT_TYPE_NAMES = [
  'CompEl',
  'CompFn',
  'ComponentCapabilities',
  'ComponentInput',
  'FalsyNodes',
] as const;

function scenarioSource(
  extraModuleSyntax = '',
  scene = '<Rectangle style={{ width: 10, height: 10 }} />',
): string {
  return `
    import { Rectangle } from '@crc/core';
    ${extraModuleSyntax}
    export const Scene = () => (${scene});
  `;
}

afterEach(async () => {
  await Promise.all(controllers.splice(0).map(controller => controller.dispose()));
  document.body.replaceChildren();
});

describe('scenario catalog trust gate', () => {
  it('requires TSX source metadata for every deterministic scenario', () => {
    const [first, ...rest] = scenarioCatalog;
    if (!first) throw new Error('The scenario catalog must not be empty.');
    expect(first.source.path).toMatch(/\.example\.tsx$/u);
    expect(first.source.language).toBe('tsx');

    const oldPath = [
      {
        ...first,
        source: {
          ...first.source,
          path: first.source.path.replace(/\.tsx$/u, '.ts'),
        },
      },
      ...rest,
    ];
    expect(() => validateScenarioCatalog(oldPath)).toThrow(
      /must reference a TSX example source/i,
    );

    const oldLanguage = [
      {
        ...first,
        source: {
          ...first.source,
          language: 'ts' as never,
        },
      },
      ...rest,
    ];
    expect(() => validateScenarioCatalog(oldLanguage)).toThrow(
      /must use TSX source metadata/i,
    );
  });

  describe('deterministic source policy', () => {
    it.each([
      [
        'a named legacy component import',
        scenarioSource(`import { rect } from '@crc/core'; void rect;`),
        /legacy component authoring/i,
      ],
      [
        'an aliased legacy component import',
        scenarioSource(`import { rect as Draw } from '@crc/core'; void Draw;`),
        /legacy component authoring/i,
      ],
      [
        'a direct descriptive component call',
        scenarioSource('', `Rectangle({ style: { width: 10, height: 10 } })`),
        /not direct calls/i,
      ],
      [
        'an aliased descriptive component call',
        scenarioSource(
          `import { Rectangle as Draw } from '@crc/core';`,
          `<>{Draw({ style: { width: 10, height: 10 } })}</>`,
        ),
        /not direct calls/i,
      ],
      [
        'a namespace descriptive component call',
        scenarioSource(
          `import * as CRC from '@crc/core';`,
          `<CRC.Group>{CRC.Rectangle({ style: { width: 10, height: 10 } })}</CRC.Group>`,
        ),
        /not direct calls/i,
      ],
      [
        'a namespace legacy component call',
        scenarioSource(
          `import * as CRC from '@crc/core';`,
          `<CRC.Group>{CRC.rect({ style: { width: 10, height: 10 } })}</CRC.Group>`,
        ),
        /legacy component authoring/i,
      ],
      [
        'an imported namespace component call inside a namespace without a shadow',
        scenarioSource(`
          import * as CRC from '@crc/core';
          namespace Fixture {
            export const invalid = CRC.Rectangle({});
          }
        `),
        /not direct calls/i,
      ],
      [
        'an imported namespace component call inside nested namespaces without a shadow',
        scenarioSource(`
          import * as CRC from '@crc/core';
          namespace Outer {
            namespace Inner {
              export const invalid = CRC.Rectangle({});
            }
          }
        `),
        /not direct calls/i,
      ],
      [
        'an imported namespace component call inside a dotted namespace without a shadow',
        scenarioSource(`
          import * as CRC from '@crc/core';
          namespace Outer.Inner {
            export const invalid = CRC.Rectangle({});
          }
        `),
        /not direct calls/i,
      ],
      [
        'a string-literal module name that does not shadow an imported namespace',
        scenarioSource(`
          import * as CRC from '@crc/core';
          declare module 'CRC' { interface Marker {} }
          void CRC.Rectangle({});
        `),
        /not direct calls/i,
      ],
      [
        'a namespace-local shadow that does not escape its module block',
        scenarioSource(`
          import * as CRC from '@crc/core';
          namespace Fixture {
            namespace CRC {
              export function Rectangle(): string { return 'local'; }
            }
          }
          void CRC.Rectangle({});
        `),
        /not direct calls/i,
      ],
      [
        'a dotted namespace final-segment value shadow that does not escape its body',
        scenarioSource(`
          import * as CRC from '@crc/core';
          namespace Fixture.CRC {
            export function Rectangle(): string { return 'local'; }
            export const local = CRC.Rectangle();
          }
          void CRC.Rectangle({});
        `),
        /not direct calls/i,
      ],
      [
        'an imported legacy type namespace referenced inside an unshadowed namespace',
        scenarioSource(`
          import type * as CRC from '@crc/core';
          namespace Fixture { export type Legacy = CRC.CompEl; }
        `),
        /obsolete component types/i,
      ],
      [
        'a dotted namespace final-segment type shadow that does not escape its body',
        scenarioSource(`
          import type * as CRC from '@crc/core';
          namespace Fixture.CRC { export interface CompEl { local: true } }
          type Legacy = CRC.CompEl;
        `),
        /obsolete component types/i,
      ],
      [
        'createElement-only authoring',
        scenarioSource(
          `import { createElement } from '@crc/core';`,
          `createElement(Rectangle, { style: { width: 10, height: 10 } })`,
        ),
        /must use descriptive JSX/i,
      ],
      [
        'an inline legacy Text style',
        scenarioSource(
          `import { Text } from '@crc/core';`,
          `<Text style={{ text: 'legacy', x: 10, y: 10 }}>current</Text>`,
        ),
        /legacy Text style\.text/i,
      ],
      [
        'an external Text style',
        scenarioSource(
          `import { Text } from '@crc/core'; const style = { text: 'legacy' };`,
          `<Text style={style}>current</Text>`,
        ),
        /inspectable Text style/i,
      ],
      [
        'an inline legacy Layer render prop',
        scenarioSource(
          `import { Layer } from '@crc/core';`,
          `<Layer render={<Rectangle style={{ width: 10, height: 10 }} />} />`,
        ),
        /legacy Layer render prop/i,
      ],
      [
        'a Layer props spread',
        scenarioSource(
          `import { Layer } from '@crc/core'; const props = { render: <Rectangle style={{ width: 10, height: 10 }} /> };`,
          `<Layer {...props}><Rectangle style={{ width: 10, height: 10 }} /></Layer>`,
        ),
        /inspectable Layer props/i,
      ],
    ] as const)(
      'rejects %s',
      (_name, source, diagnostic) => {
        expect(() =>
          validateScenarioSourceText(source, 'invalid deterministic authoring'),
        ).toThrow(diagnostic);
      },
    );

    it.each([
      [
        'a dynamic legacy import',
        `export async function loadLegacy() { const { rect } = await import('@crc/core'); return rect({}); }`,
        /dynamic import expressions/i,
      ],
      [
        'a dynamic type import',
        `type Legacy = import('@crc/core').CompEl;`,
        /TypeScript import types/i,
      ],
      ['import.meta', `void import.meta.url;`, /import\.meta/i],
      [
        'a bare require call',
        `void require('@crc/core');`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a bare require.resolve call',
        `void require.resolve('@crc/core');`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'bare module.exports',
        `module.exports = {};`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a bare exports reference',
        `void exports.fixture;`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a globalThis require call',
        `void (globalThis as any).require('@crc/core');`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a computed global module.exports path',
        `(globalThis as any)['module']['exports'] = {};`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'an optional nested global require path',
        `void (globalThis as any)?.window?.self?.['require']?.('@crc/core');`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a window require path',
        `void (window as any)['require']('@crc/core');`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a self exports path',
        `void (self as any).exports.fixture;`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a global module.exports path',
        `(global as any).module.exports = {};`,
        /must not use CommonJS module loading or exports/i,
      ],
      [
        'a top-level import-equals declaration',
        `import Legacy = require('@crc/core'); void Legacy;`,
        /TypeScript import-equals/i,
      ],
      [
        'a nested import-equals declaration',
        `namespace Fixture { import Legacy = Other.Core; }`,
        /TypeScript import-equals/i,
      ],
      [
        'a TypeScript export assignment',
        `export = Rectangle;`,
        /TypeScript export assignment/i,
      ],
      [
        'a TypeScript namespace export',
        `export as namespace Fixture;`,
        /export as namespace/i,
      ],
      [
        'a default core import',
        `import Core from '@crc/core'; void Core;`,
        /supported static imports/i,
      ],
      [
        'a side-effect core import',
        `import '@crc/core';`,
        /supported static imports/i,
      ],
      [
        'a core import with attributes',
        `import { Rectangle as AttributedRectangle } from '@crc/core' with { type: 'json' }; void AttributedRectangle;`,
        /import attributes or assertions/i,
      ],
      [
        'a legacy JSON import assertion',
        `import fixture from './x.json' assert { type: 'json' }; void fixture;`,
        /^invalid deterministic module must not use import attributes or assertions\.$/u,
      ],
      [
        'a relative runtime named import',
        `import { helper } from './helper'; void helper;`,
        /supported static imports/i,
      ],
      [
        'a relative runtime default import',
        `import helper from './helper'; void helper;`,
        /supported static imports/i,
      ],
      [
        'a relative runtime namespace import',
        `import * as helper from './helper'; void helper;`,
        /supported static imports/i,
      ],
      [
        'a relative side-effect import',
        `import './helper';`,
        /supported static imports/i,
      ],
      [
        'a bare-dot runtime default import',
        `import helper from '.'; void helper;`,
        /supported static imports/i,
      ],
      [
        'a bare-dot-dot runtime named import',
        `import { helper } from '..'; void helper;`,
        /supported static imports/i,
      ],
      [
        'a bare-dot runtime namespace import',
        `import * as helper from '.'; void helper;`,
        /supported static imports/i,
      ],
      [
        'a bare-dot-dot side-effect import',
        `import '..';`,
        /supported static imports/i,
      ],
      [
        'an external runtime import',
        `import { helper } from 'fixture-package'; void helper;`,
        /supported static imports/i,
      ],
      [
        'an external type-only import',
        `import type External from 'fixture-package'; type Local = External;`,
        /supported static imports/i,
      ],
      [
        'an @crc/core legacy re-export',
        `export { rect } from '@crc/core';`,
        /re-export/i,
      ],
      [
        'a relative named re-export',
        `export { helper } from './helper';`,
        /re-export/i,
      ],
      [
        'an external named re-export',
        `export { helper } from 'fixture-package';`,
        /re-export/i,
      ],
      [
        'a relative star re-export',
        `export * from './helper';`,
        /re-export/i,
      ],
      [
        'an external namespace re-export',
        `export * as helper from 'fixture-package';`,
        /re-export/i,
      ],
      [
        'an obsolete type re-export',
        `export type { CompEl } from '@crc/core';`,
        /re-export/i,
      ],
    ] as const)(
      'rejects %s',
      (_name, extraModuleSyntax, diagnostic) => {
        expect(() =>
          validateScenarioSourceText(
            scenarioSource(extraModuleSyntax),
            'invalid deterministic module',
          ),
        ).toThrow(diagnostic);
      },
    );

    it.each(LEGACY_COMPONENT_TYPE_NAMES)(
      'rejects aliased legacy type import %s',
      typeName => {
        expect(() =>
          validateScenarioSourceText(
            scenarioSource(`
              import type { ${typeName} as LegacyType } from '@crc/core';
              type Local = LegacyType;
            `),
            'aliased legacy type module',
          ),
        ).toThrow(/obsolete component types/i);
      },
    );

    it.each(LEGACY_COMPONENT_TYPE_NAMES)(
      'rejects namespace-qualified legacy type %s',
      typeName => {
        expect(() =>
          validateScenarioSourceText(
            scenarioSource(`
              import type * as CoreTypes from '@crc/core';
              type Local = CoreTypes.${typeName};
            `),
            'namespace legacy type module',
          ),
        ).toThrow(/obsolete component types/i);
      },
    );

    it.each([
      [
        'default relative type-only import',
        `import type Shared from './shared-types'; type Local = Shared;`,
        undefined,
      ],
      [
        'named relative type-only import',
        `import type { Shared } from '../shared-types'; type Local = Shared;`,
        undefined,
      ],
      [
        'namespace relative type-only import',
        `import type * as Shared from './shared-types'; type Local = Shared.Entry;`,
        undefined,
      ],
      [
        'inline relative type-only specifier',
        `import { type Shared } from './shared-types'; type Local = Shared;`,
        undefined,
      ],
      [
        'inline relative default type-only specifier',
        `import { type default as Shared } from './shared-types'; type Local = Shared;`,
        undefined,
      ],
      [
        'multiple named relative type-only imports',
        `import type { Shared, Entry } from './shared-types'; type Local = Shared | Entry;`,
        undefined,
      ],
      [
        'bare-dot default type-only import',
        `import type Shared from '.'; type Local = Shared;`,
        undefined,
      ],
      [
        'bare-dot-dot default type-only import',
        `import type Shared from '..'; type Local = Shared;`,
        undefined,
      ],
      [
        'bare-dot named type-only import',
        `import type { Shared } from '.'; type Local = Shared;`,
        undefined,
      ],
      [
        'bare-dot-dot named type-only import',
        `import type { Shared } from '..'; type Local = Shared;`,
        undefined,
      ],
      [
        'bare-dot namespace type-only import',
        `import type * as Shared from '.'; type Local = Shared.Entry;`,
        undefined,
      ],
      [
        'bare-dot-dot namespace type-only import',
        `import type * as Shared from '..'; type Local = Shared.Entry;`,
        undefined,
      ],
      [
        'bare-dot inline type-only specifier',
        `import { type Shared } from '.'; type Local = Shared;`,
        undefined,
      ],
      [
        'bare-dot-dot inline default type-only specifier',
        `import { type default as Shared } from '..'; type Local = Shared;`,
        undefined,
      ],
      [
        'namespace core JSX',
        `import * as CRC from '@crc/core';`,
        '<CRC.Rectangle style={{ width: 10, height: 10 }} />',
      ],
      [
        'local named and default exports',
        `const helper = 1; export { helper }; export default function mount() { return helper; }`,
        undefined,
      ],
      [
        'a lexically shadowed component call',
        `function invoke(Rectangle: () => string): string { return Rectangle(); } void invoke;`,
        undefined,
      ],
      [
        'a lexically shadowed namespace component call',
        `
          import * as CRC from '@crc/core';
          function invoke(CRC: { Rectangle: () => string }): string {
            return CRC.Rectangle();
          }
          void invoke;
        `,
        undefined,
      ],
      [
        'a namespace-local namespace component shadow',
        `
          import * as CRC from '@crc/core';
          namespace Fixture {
            namespace CRC {
              export function Rectangle(): string { return 'local'; }
            }
            export const local = CRC.Rectangle();
          }
        `,
        '<CRC.Rectangle style={{ width: 10, height: 10 }} />',
      ],
      [
        'a namespace-local named component shadow',
        `
          namespace Fixture {
            function Rectangle(): string { return 'local'; }
            export const local = Rectangle();
          }
        `,
        undefined,
      ],
      [
        'a nested namespace-local component shadow',
        `
          import * as CRC from '@crc/core';
          namespace Outer {
            namespace Inner {
              namespace CRC {
                export function Rectangle(): string { return 'local'; }
              }
              export const local = CRC.Rectangle();
            }
          }
        `,
        '<CRC.Rectangle style={{ width: 10, height: 10 }} />',
      ],
      [
        'a dotted namespace-local component shadow',
        `
          import * as CRC from '@crc/core';
          namespace Outer.Inner {
            namespace CRC {
              export function Rectangle(): string { return 'local'; }
            }
            export const local = CRC.Rectangle();
          }
        `,
        '<CRC.Rectangle style={{ width: 10, height: 10 }} />',
      ],
      [
        'a dotted namespace final-segment value and type self-binding',
        `
          import * as CRC from '@crc/core';
          namespace Fixture.CRC {
            export function Rectangle(): string { return 'local'; }
            export interface CompEl { local: true }
            export const local = CRC.Rectangle();
            export type Local = CRC.CompEl;
          }
        `,
        '<CRC.Rectangle style={{ width: 10, height: 10 }} />',
      ],
      [
        'a deeply dotted namespace final-segment value and type self-binding',
        `
          import * as C from '@crc/core';
          namespace A.B.C {
            export function Rectangle(): string { return 'local'; }
            export interface CompEl { local: true }
            export const local = C.Rectangle();
            export type Local = C.CompEl;
          }
        `,
        '<C.Rectangle style={{ width: 10, height: 10 }} />',
      ],
      [
        'a dotted local namespace binding that uses a legacy CRC member name',
        `
          import * as CRC from '@crc/core';
          namespace Fixture {
            namespace CRC.rect {
              export function invoke(): string { return 'local'; }
            }
            export const local = CRC.rect.invoke();
          }
        `,
        '<CRC.Rectangle style={{ width: 10, height: 10 }} />',
      ],
      [
        'a namespace-local legacy type-name shadow',
        `
          import type * as CRC from '@crc/core';
          namespace Fixture {
            namespace CRC { export interface CompEl { local: true } }
            export type Local = CRC.CompEl;
          }
        `,
        undefined,
      ],
      [
        'a string-module-local legacy type-name shadow',
        `
          import type * as CRC from '@crc/core';
          declare module 'fixture' {
            namespace CRC { interface CompEl { local: true } }
            type Local = CRC.CompEl;
          }
        `,
        undefined,
      ],
      [
        'native Canvas and unrelated CommonJS property names',
        `
          const path = new Path2D();
          path.rect(0, 0, 10, 10);
          const loader = { require: () => 'local', module: { exports: {} } };
          void loader.require();
          void loader.module.exports;
        `,
        undefined,
      ],
    ] as const)(
      'accepts %s',
      (_name, extraModuleSyntax, scene) => {
        expect(() =>
          validateScenarioSourceText(
            scenarioSource(extraModuleSyntax, scene),
            'valid deterministic module',
          ),
        ).not.toThrow();
      },
    );
  });

  it('publishes the shared focus-navigation demonstration contract', () => {
    expect(focusNavigationScenarioEntry.metadata.id)
      .toBe('focus-and-keyboard-navigation');
    expect(focusNavigationScenarioEntry.metadata.apiTags).toEqual(
      expect.arrayContaining([
        'crcEventTarget',
        'FocusManagement',
        'KeyboardNavigation',
      ]),
    );
    expect(focusNavigationScenarioEntry.metadata.manualSteps).toHaveLength(5);
  });

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
