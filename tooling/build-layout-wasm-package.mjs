// Local, unpublished private output for built-layout verification. The ordinary
// package is also native by default; this output only keeps the old isolated
// artifact lane available to its verification fixtures.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../packages/core/.layout-wasm-package/', import.meta.url);
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });
run(process.execPath, ['tooling/build-layout-wasm.mjs', '--check']);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(new URL('tsconfig.json', output), JSON.stringify({ extends: '../tsconfig.build.json', compilerOptions: { outDir: './dist', paths: { '@pibbl/core': ['../src/index.ts'], '@pibbl/core/sync': ['../src/sync.ts'], '@pibbl/core/internal': ['../src/internal.ts'], '@pibbl/core/jsx-runtime': ['../src/jsx-runtime.ts'], '@pibbl/core/jsx-dev-runtime': ['../src/jsx-dev-runtime.ts'] } } }));
run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', fileURLToPath(new URL('tsconfig.json', output))]);
run(process.execPath, ['tooling/build-core.mjs', '--layout-wasm']);
const manifest = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url)));
delete manifest.scripts;
manifest.private = true;
await copyFile(new URL('../packages/core/THIRD_PARTY_NOTICES.txt', import.meta.url), new URL('THIRD_PARTY_NOTICES.txt', output));
await rm(new URL('tsconfig.json', output));
await writeFile(new URL('package.json', output), JSON.stringify(manifest, null, 2) + '\n');
console.warn('Unpublished private layout artifact built at packages/core/.layout-wasm-package');
