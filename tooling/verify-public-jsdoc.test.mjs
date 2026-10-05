import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { auditPublicJsdoc } from './verify-public-jsdoc.mjs';

function fixture(t, files, exports = { '.': './src/index.ts' }) {
  const root = mkdtempSync(join(tmpdir(), 'crc-public-jsdoc-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, 'packages', 'example');
  files = {
    'package.json': JSON.stringify({ name: '@crc/example', private: true, exports }),
    ...files,
  };
  for (const [name, contents] of Object.entries(files)) {
    const file = join(directory, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
  return root;
}

test('follows wildcard, renamed, and imported re-exports in private package entry maps', t => {
  const root = fixture(t, {
    'src/index.ts': `export * from './api.js'; export { Input as Options } from './api.js';`,
    'src/other.ts': `import { run } from './api.js'; export { run };`,
    'src/api.ts': `
      /** Inputs for {@link run}. */
      export interface Input { /** Output value. */ value: number; }
      /** Consumes {@link Input}.
       * @param input - Input value to read.
       * @returns The input value.
       */
      export function run(input: Input): number { return input.value; }
      function implementationOnly() {}
    `,
  }, { '.': './src/index.ts', './other': './src/other.ts' });
  const result = auditPublicJsdoc(root);
  assert.equal(result.entries.length, 2);
  assert.equal(result.declarations, 2);
  assert.equal(result.members, 1);
  assert.deepEqual(result.issues, []);
});

test('checks every overload and public class method, including computed iteration', t => {
  const root = fixture(t, {
    'src/index.ts': `
      export function run(value: string): string;
      /** Implements {@link Model}.
       * @param value - Text to return.
       * @returns The supplied text.
       */
      export function run(value: string) { return value; }
      /** Related to {@link run}. */
      export class Model {
        read() { return 0; }
        *[Symbol.iterator]() { yield 0; }
        private hidden() {}
      }
    `,
  });
  const result = auditPublicJsdoc(root);
  assert.equal(result.declarations, 3);
  assert.equal(result.issues.length, 3);
  assert.ok(result.issues.some(issue => issue.includes('run: missing JSDoc')));
  assert.ok(result.issues.some(issue => issue.includes('Model.read: missing JSDoc')));
  assert.ok(!result.issues.some(issue => issue.includes('hidden')));
});

test('checks inherited prop types and JSX namespace declarations', t => {
  const root = fixture(t, {
    'src/index.ts': `
      interface Base { value: number; }
      /** Derived from {@link Base}. */
      export interface Input extends Base {}
      /** Compiler types for {@link Input}. */
      export namespace JSX { export type Element = Input; }
    `,
  });
  const result = auditPublicJsdoc(root);
  assert.equal(result.inherited, 1);
  assert.ok(result.issues.some(issue => issue.includes('Base: missing JSDoc')));
  assert.ok(result.issues.some(issue => issue.includes('Base.value: missing JSDoc')));
  assert.ok(result.issues.some(issue => issue.includes('JSX.Element: missing JSDoc')));
});

test('rejects missing and unresolved related-type links', t => {
  const root = fixture(t, {
    'src/index.ts': `
      /** An option. */ export type Option = string;
      /** A result of {@link Typo}. */ export type Result = number;
    `,
  });
  const result = auditPublicJsdoc(root);
  assert.ok(result.issues.some(issue => issue.includes('Option: missing related API/type link')));
  assert.ok(result.issues.some(issue => issue.includes('unresolved link Typo')));
});

test('built mode resolves declaration files before neighboring emitted JavaScript', t => {
  const root = fixture(t, {
    'dist/index.d.ts': `export { Input, run } from './api.js';`,
    'dist/api.js': `export function run(input) { return input.value; }`,
    'dist/api.d.ts': `
      /** Inputs for {@link run}. */ export interface Input { /** Value. */ value: number; }
      /** Consumes {@link Input}.
       * @param input - Input value to read.
       * @returns The input value.
       */ export declare function run(input: Input): number;
    `,
  }, { '.': { types: './dist/index.d.ts', default: './dist/index.js' } });
  const result = auditPublicJsdoc(root, { built: true });
  assert.deepEqual(result.issues, []);
  assert.equal(result.declarations, 2);
});

test('checks functions exposed as members of exported constant records', t => {
  const root = fixture(t, {
    'src/index.ts': `/** Utilities. See {@link tools}. */
      export const tools = Object.freeze({ run() { return 1; } });`,
  });
  assert.ok(auditPublicJsdoc(root).issues.some(issue => issue.includes('tools.run: missing JSDoc')));
});

test('requires argument and result descriptions on functions, overloads, and callbacks', t => {
  const root = fixture(t, {
    'src/index.ts': `
      /** Reads {@link Reader}. */
      export function read(value: string): string;
      /** Reads {@link Reader}.
       * @param value - Text to read.
       * @returns The text.
       */
      export function read(value: string) { return value; }
      /** Callback used by {@link read}. */
      export type Reader = (text: string) => number;
      /** Controls for {@link read}. */
      export interface Controls {
        /** Changes the current value. */
        set(value: string): void;
        /** Reads the current value. */
        get(): string;
        /** Releases resources. */
        dispose(): void;
      }
    `,
  });
  const issues = auditPublicJsdoc(root).issues;
  assert.ok(issues.some(issue => issue.includes('read: missing @param value')));
  assert.ok(issues.some(issue => issue.includes('read: missing @returns')));
  assert.ok(issues.some(issue => issue.includes('Reader: missing @param text')));
  assert.ok(issues.some(issue => issue.includes('Reader: missing @returns')));
  assert.ok(issues.some(issue => issue.includes('Controls.set: missing @param value')));
  assert.ok(issues.some(issue => issue.includes('Controls.get: missing @returns')));
  assert.ok(!issues.some(issue => issue.includes('Controls.dispose')));
});

test('checks exported function aliases and shorthand object methods', t => {
  const root = fixture(t, {
    'src/index.ts': `
      function implementation(value: number) { return value; }
      /** Alias for {@link implementation}. */
      export const alias = implementation;
      /** Helpers related to {@link alias}. */
      export const helpers = Object.freeze({
        /** Calls the implementation. */ implementation,
      });
    `,
  });
  const issues = auditPublicJsdoc(root).issues;
  for (const name of ['alias', 'helpers.implementation']) {
    assert.ok(issues.some(issue => issue.includes(`${name}: missing @param value`)));
    assert.ok(issues.some(issue => issue.includes(`${name}: missing @returns`)));
  }
});

test('ignores private implementation returns and accepts documented destructured and rest arguments', t => {
  const root = fixture(t, {
    'src/index.ts': `
      /** Works with {@link run}.
       * @param options - Initial value.
       * @param values - Additional values.
       * @returns Their sum.
       */
      export const sum = ({ value }: { value: number }, ...values: number[]) => value + values.length;
      /** Runs work related to {@link sum}. */
      export function run(): void { const nested = () => 1; nested(); }
    `,
  });
  assert.deepEqual(auditPublicJsdoc(root).issues, []);
});
