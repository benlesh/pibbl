import assert from 'node:assert/strict';
import test from 'node:test';
import { preserveJsdocImports } from './preserve-declaration-jsdoc.mjs';

test('restores documentation-only imports as type-only bindings without duplicate imports', () => {
  const source = `import type { Related, Options } from './related.js';
    /** See {@link Related} and {@link Options}. */ export type API = Options;`;
  const declaration = `import type { Options } from './related.js';
    /** See {@link Related} and {@link Options}. */ export type API = Options;`;
  const output = preserveJsdocImports(source, declaration);
  assert.match(output, /import type \{ Related \} from "\.\/related\.js";/);
  assert.equal(output.match(/import type \{ Options \}/g).length, 1);
  assert.equal(preserveJsdocImports(source, output), output);
});

test('preserves aliases, namespace links, and default imports without retaining unused bindings', () => {
  const source = `import { Thing as Alias, Unused } from './other.js';
    import type * as THREE from 'three';
    import Default from './default.js';
    /** {@link Alias} {@linkcode THREE.Scene} {@linkplain Default} */
    export type API = number;`;
  const output = preserveJsdocImports(source, '/** {@link Alias} {@linkcode THREE.Scene} {@linkplain Default} */ export type API = number;');
  assert.match(output, /import type \{ Thing as Alias \} from "\.\/other\.js";/);
  assert.match(output, /import type \* as THREE from "three";/);
  assert.match(output, /import type Default from "\.\/default\.js";/);
  assert.doesNotMatch(output, /Unused/);
});

test('does not preserve links from erased implementation comments or add public exports', () => {
  const source = `import type { Internal } from './internal.js';
    /** {@link Internal} */ function privateHelper() {}
    export type API = number;`;
  assert.equal(preserveJsdocImports(source, 'export type API = number;'), 'export type API = number;');
});
