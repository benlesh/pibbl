import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const compiler = process.env.PIBBL_ASC ?? '/private/tmp/pibbl-texture-wasm-compiler/node_modules/assemblyscript/bin/asc.js';
const root = fileURLToPath(new URL('.', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'pibbl-texture-asc-'));
try {
  for (const name of ['kernel','materials']) {
  const source = join(directory, `${name}.ts`);
  await copyFile(`${root}${name}.asc`, source);
  const result = spawnSync(process.execPath, [compiler, source, '--outFile', `${root}${name}.wasm`, '--optimizeLevel', '3', '--shrinkLevel', '0', '--runtime', 'stub', '--importMemory', '--initialMemory', '1', '--noAssert'], {stdio:'inherit'});
  if (result.status !== 0) {process.exitCode = result.status ?? 1; break;}
  }
} finally { await rm(directory, {recursive:true,force:true}); }
if (!process.exitCode) await import('./build-material-control.mjs');
