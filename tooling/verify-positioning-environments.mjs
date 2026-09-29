import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'crc-positioning-env-'));

try {
  for (const [label, entry] of [
    ['source', join(root, 'packages/core/src/lib/development.ts')],
  ]) {
    for (const [mode, expected] of [['true', true], ['false', false]]) {
      const output = join(directory, `${label}-${mode}.mjs`);
      await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: true, outfile: output, define: { 'import.meta.env.DEV': mode } });
      const runtime = await import(`${pathToFileURL(output).href}?${Date.now()}`);
      if (runtime.isDevelopment !== expected) throw new Error(`${label} DEV=${mode} resolved ${runtime.isDevelopment}`);
    }
  }
  process.stdout.write('positioning environment gate: source DEV=true/false passed\n');
} finally {
  await rm(directory, { recursive: true, force: true });
}
