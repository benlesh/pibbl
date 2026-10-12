import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

/** Retain imported JSDoc link targets that TypeScript omits from declaration emit. */
export function preserveJsdocImports(source, declaration) {
  const options = { sourceType: 'module', plugins: ['typescript', 'jsx'] };
  const emitted = parse(declaration, options);
  const names = new Set();
  for (const outer of emitted.program.body) {
    if (outer.type === 'ImportDeclaration') for (const specifier of outer.specifiers) names.add(specifier.local.name);
    const node = outer.declaration ?? outer;
    if (node.id?.name) names.add(node.id.name);
    if (node.type === 'VariableDeclaration') for (const item of node.declarations) names.add(item.id.name);
  }
  // Only comments actually retained in the declaration can create a dependency.
  const links = new Set();
  for (const comment of emitted.comments ?? []) {
    if (comment.type !== 'CommentBlock' || !comment.value.startsWith('*')) continue;
    for (const [, target] of comment.value.matchAll(/\{@link(?:code|plain)?\s+([^\s}|]+)/g)) links.add(target.split(/[.#]/)[0]);
  }
  const additions = [];
  for (const node of parse(source, options).program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const from = JSON.stringify(node.source.value);
    const named = [];
    for (const specifier of node.specifiers) {
      const local = specifier.local.name;
      if (!links.has(local) || names.has(local)) continue;
      names.add(local);
      if (specifier.type === 'ImportNamespaceSpecifier') additions.push(`import type * as ${local} from ${from};`);
      else if (specifier.type === 'ImportDefaultSpecifier') additions.push(`import type ${local} from ${from};`);
      else {
        const imported = specifier.imported.name ?? JSON.stringify(specifier.imported.value);
        named.push(imported === local ? local : `${imported} as ${local}`);
      }
    }
    if (named.length) additions.push(`import type { ${named.join(', ')} } from ${from};`);
  }
  return additions.length ? additions.join('\n') + '\n' + declaration : declaration;
}

/** Repairs a package's emitted declarations without altering runtime modules or exports. */
export function preserveDeclarationJsdoc(sourceRoot, outputRoot) {
  let updated = 0;
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.d.ts')) {
        const base = resolve(sourceRoot, relative(outputRoot, file).replace(/\.d\.ts$/, ''));
        const sourceFile = [base + '.ts', base + '.tsx', base + '.d.ts'].find(existsSync);
        if (!sourceFile) continue;
        const original = readFileSync(file, 'utf8');
        const repaired = preserveJsdocImports(readFileSync(sourceFile, 'utf8'), original);
        if (repaired !== original) { writeFileSync(file, repaired); updated++; }
      }
    }
  }
  visit(outputRoot);
  return updated;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 4) throw new Error('Usage: preserve-declaration-jsdoc.mjs <source-directory> <declaration-directory>');
  preserveDeclarationJsdoc(resolve(process.argv[2]), resolve(process.argv[3]));
}
