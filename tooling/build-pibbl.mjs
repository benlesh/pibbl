import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const core = JSON.parse(await readFile(resolve(root, 'packages/core/package.json'), 'utf8'));
const directory = resolve(root, 'packages/pibbl');
await mkdir(directory, { recursive: true });
await rm(resolve(directory, 'dist'), { recursive: true, force: true });
const exports = {};
const typesVersions = { '*': {} };
for (const [subpath, entry] of Object.entries(core.exports)) {
  if (subpath === './package.json') { exports[subpath] = './package.json'; continue; }
  const specifier = '@pibbl/core' + (subpath === '.' ? '' : subpath.slice(1));
  const stem = subpath === '.' ? 'index' : subpath.slice(2);
  const source = resolve(directory, `src/${stem}.ts`);
  await mkdir(dirname(source), { recursive: true });
  await writeFile(source, `export * from '${specifier}';\n`);
  exports[subpath] = {};
  for (const condition of Object.keys(entry)) {
    const target = `./dist/${stem}.${condition === 'types' ? 'd.ts' : 'mjs'}`;
    exports[subpath][condition] = target;
    await mkdir(dirname(resolve(directory, target)), { recursive: true });
    await writeFile(resolve(directory, target), `export * from '${specifier}';\n`);
  }
  if (subpath !== '.') typesVersions['*'][stem] = [exports[subpath].types];
}
const manifest = {
  name: 'pibbl', version: core.version, type: 'module',
  description: 'Pibbl Canvas component runtime — the unscoped mirror of @pibbl/core',
  author: core.author, license: core.license, homepage: core.homepage,
  repository: { ...core.repository, directory: 'packages/pibbl' }, bugs: core.bugs,
  sideEffects: false, exports, main: './dist/index.mjs', module: './dist/index.mjs',
  types: './dist/index.d.ts', typesVersions, files: ['dist'],
  scripts: { build: 'node ../../tooling/build-pibbl.mjs', prepublishOnly: 'pnpm run build' },
  dependencies: { '@pibbl/core': `workspace:${core.version}` },
};
await writeFile(resolve(directory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
