import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

/** Audit declarations reached through every package export map, including private packages. */
export function auditPublicJsdoc(root, { built = false } = {}) {
  const modules = new Map();
  const packages = readdirSync(resolve(root, 'packages'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => resolve(root, 'packages', entry.name))
    .filter(directory => existsSync(resolve(directory, 'package.json')))
    .map(directory => ({ directory, manifest: JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8')) }));
  const entryPaths = new Map();
  for (const { directory, manifest } of packages) {
    for (const [subpath, descriptor] of Object.entries(manifest.exports ?? {})) {
      const target = typeof descriptor === 'string' ? descriptor : descriptor.types;
      if (!target || target.endsWith('.json')) continue;
      const source = built ? target : target.replace('./dist/', './src/').replace(/\.d\.ts$/, '.ts');
      entryPaths.set(manifest.name + (subpath === '.' ? '' : subpath.slice(1)), resolve(directory, source));
    }
  }
  function locate(file) {
    if (built && file.endsWith('.js') && existsSync(file.replace(/\.js$/, '.d.ts'))) return file.replace(/\.js$/, '.d.ts');
    if (existsSync(file)) return file;
    const candidates = file.endsWith('.js')
      ? [file.replace(/\.js$/, '.ts'), file.replace(/\.js$/, '.tsx'), file.replace(/\.js$/, '.d.ts')]
      : extname(file) === '.ts' ? [file + 'x'] : [file + '.ts', file + '.tsx', file + '.d.ts'];
    const found = candidates.find(existsSync);
    if (!found) throw new Error(`Cannot resolve documentation source: ${file}`);
    return found;
  }
  function resolveModule(file, specifier) {
    if (specifier.startsWith('.')) return locate(resolve(dirname(file), specifier));
    const entry = entryPaths.get(specifier);
    if (entry) return locate(entry);
    throw new Error(`External re-export requires an explicit audit policy: ${specifier}`);
  }
  function load(file) {
    file = locate(file);
    if (modules.has(file)) return modules.get(file);
    const source = readFileSync(file, 'utf8');
    const ast = parse(source, { sourceType: 'module', plugins: ['typescript', ...(file.endsWith('.tsx') ? ['jsx'] : [])] });
    const data = { file, source, ast, locals: new Map(), imports: new Map(), exports: [], names: new Set() };
    modules.set(file, data);
    for (const outer of ast.program.body) {
      const node = outer.declaration ?? outer;
      if (outer.type === 'ImportDeclaration') {
        for (const specifier of outer.specifiers) {
          data.names.add(specifier.local.name);
          data.imports.set(specifier.local.name, { source: outer.source.value, name: specifier.imported?.name });
        }
      }
      const declarations = node.type === 'VariableDeclaration' ? node.declarations : [node];
      for (const declaration of declarations) {
        const name = declaration.id?.name;
        if (!name) continue;
        data.names.add(name);
        const list = data.locals.get(name) ?? [];
        list.push({ file, name, node: declaration, outer });
        data.locals.set(name, list);
      }
      if (outer.type === 'ExportNamedDeclaration' || outer.type === 'ExportAllDeclaration') data.exports.push(outer);
    }
    return data;
  }
  function exported(file, visiting = new Set()) {
    const data = load(file);
    if (visiting.has(data.file)) return new Map();
    const next = new Set(visiting).add(data.file);
    const output = new Map();
    for (const item of data.exports) {
      if (item.type === 'ExportAllDeclaration') {
        for (const [name, declarations] of exported(resolveModule(data.file, item.source.value), next)) output.set(name, declarations);
      } else if (item.declaration) {
        const names = item.declaration.type === 'VariableDeclaration'
          ? item.declaration.declarations.map(declaration => declaration.id.name)
          : [item.declaration.id?.name];
        for (const name of names) if (name) output.set(name, data.locals.get(name));
      } else {
        for (const specifier of item.specifiers) {
          if (specifier.type !== 'ExportSpecifier') throw new Error(`Unsupported export in ${data.file}`);
          const localName = specifier.local.name;
          const imported = data.imports.get(localName);
          const source = item.source?.value ?? imported?.source;
          const declarations = source
            ? exported(resolveModule(data.file, source), next).get(item.source ? localName : imported.name)
            : data.locals.get(localName);
          if (!declarations) throw new Error(`Unresolved export ${localName} in ${data.file}`);
          output.set(specifier.exported.name, declarations);
        }
      }
    }
    return output;
  }
  const declarations = new Map();
  const entries = [];
  for (const [name, file] of entryPaths) {
    const exports = exported(file);
    entries.push({ name, exports: exports.size });
    for (const values of exports.values()) for (const declaration of values) {
      declarations.set(`${declaration.file}:${declaration.node.start}`, declaration);
    }
  }
  const inherited = new Map();
  function collectBase(record, reference) {
    if (!reference) return;
    const name = reference.typeName?.name ?? reference.expression?.name;
    if (!name) return;
    if (['Omit', 'Pick', 'Readonly', 'Partial', 'Required'].includes(name)) {
      collectBase(record, (reference.typeParameters ?? reference.typeArguments)?.params[0]);
      return;
    }
    const data = load(record.file);
    const imported = data.imports.get(name);
    const values = imported && (imported.source.startsWith('.') || entryPaths.has(imported.source))
      ? exported(resolveModule(record.file, imported.source)).get(imported.name)
      : data.locals.get(name);
    for (const value of values ?? []) {
      if (!['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'].includes(value.node.type)) continue;
      const key = `${value.file}:${value.node.start}`;
      if (declarations.has(key) || inherited.has(key)) continue;
      inherited.set(key, value);
      collectBases(value);
    }
  }
  function collectBases(record) {
    for (const base of record.node.extends ?? []) collectBase(record, base);
    const type = record.node.typeAnnotation;
    if (type?.type === 'TSIntersectionType') for (const base of type.types) collectBase(record, base);
  }
  for (const record of declarations.values()) collectBases(record);
  const issues = [];
  let memberCount = 0;
  let linkCount = 0;
  const checkedMembers = new Set();
  function jsdoc(node) {
    return (node.leadingComments ?? []).filter(comment => comment.type === 'CommentBlock' && comment.value.startsWith('*')).at(-1);
  }
  function checkSignature(record, node, comment, location) {
    if (!node) return;
    const callableKinds = new Set(['FunctionDeclaration', 'TSDeclareFunction', 'FunctionExpression', 'ArrowFunctionExpression', 'TSFunctionType', 'ClassMethod', 'TSDeclareMethod', 'TSMethodSignature', 'TSCallSignatureDeclaration', 'TSConstructSignatureDeclaration', 'ObjectMethod']);
    if (!callableKinds.has(node.type)) {
      if (node.type === 'Identifier' || node.type === 'TSTypeQuery') {
        const name = node.type === 'Identifier' ? node.name : node.exprName?.name;
        for (const local of load(record.file).locals.get(name) ?? []) {
          if (callableKinds.has(local.node.type)) checkSignature(record, local.node, comment, location);
        }
      }
      if (node.type === 'VariableDeclaration') node.declarations.forEach(value => checkSignature(record, value, comment, location));
      else if (node.type === 'VariableDeclarator') checkSignature(record, node.id.typeAnnotation ?? node.init, comment, location);
      else if (node.type === 'TSUnionType' || node.type === 'TSIntersectionType') node.types.forEach(value => checkSignature(record, value, comment, location));
      else if (['TSTypeAliasDeclaration', 'TSPropertySignature', 'TSTypeAnnotation', 'TSParenthesizedType'].includes(node.type)) checkSignature(record, node.typeAnnotation, comment, location);
      else if (node.type === 'ObjectProperty') checkSignature(record, node.value, comment, location);
      return;
    }
    const prose = comment.value.split('\n').map(line => line.replace(/^\s*\* ?/, '')).join('\n');
    const tags = [...prose.matchAll(/^@param[^\S\n]+(?:\{[^}]*\}[^\S\n]*)?(\S+)[^\S\n]+([\s\S]*?)(?=\n@|$)/gm)];
    const documented = new Map(tags.map(([, name, description]) => [name.replace(/^\[|\]$/g, '').split('=')[0], description.replace(/[\s*-]/g, '')]));
    for (const [index, parameter] of (node.params ?? node.parameters ?? []).entries()) {
      let param = parameter;
      if (param.type === 'TSParameterProperty') param = param.parameter;
      if (param.type === 'AssignmentPattern') param = param.left;
      if (param.type === 'RestElement') param = param.argument;
      if (param.name === 'this') continue;
      const name = param.name ?? tags[index]?.[1];
      if (!name || !documented.get(name)) issues.push(`${location}: missing @param ${name ?? `argument ${index + 1}`}`);
    }
    function hasReturnedValue(value) {
      if (!value || typeof value !== 'object') return false;
      if (Array.isArray(value)) return value.some(hasReturnedValue);
      if (value.type === 'ReturnStatement') return value.argument !== null;
      if (callableKinds.has(value.type) || value.type === 'ClassDeclaration') return false;
      return Object.entries(value).some(([key, child]) => !['loc', 'leadingComments', 'trailingComments', 'innerComments'].includes(key) && hasReturnedValue(child));
    }
    const resultType = (node.returnType ?? node.typeAnnotation)?.typeAnnotation;
    const returnsValue = node.kind !== 'constructor' && node.kind !== 'set' && (resultType
      ? !['TSVoidKeyword', 'TSNeverKeyword', 'TSUndefinedKeyword'].includes(resultType.type)
      : node.async || node.generator || (node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement') || hasReturnedValue(node.body));
    if (returnsValue && !/@returns?\s+(?:-\s*)?[^\s*@]/.test(comment.value)) issues.push(`${location}: missing @returns`);
  }
  function checkComment(record, node, name, requireLinks) {
    const comment = jsdoc(node);
    const location = `${relative(root, record.file)}:${node.loc.start.line} ${name}`;
    if (!comment || !comment.value.replace(/^\*|\s|\*/g, '')) {
      issues.push(`${location}: missing JSDoc`);
      return;
    }
    checkSignature(record, node.declaration ?? node, comment, location);
    const links = [...comment.value.matchAll(/\{@link(?:code|plain)?\s+([^\s}|]+)/g)];
    if (requireLinks && links.length === 0) issues.push(`${location}: missing related API/type link`);
    for (const [, target] of links) {
      linkCount++;
      if (/^https?:\/\//.test(target)) continue;
      const base = target.split(/[.#]/)[0];
      if (!load(record.file).names.has(base)) issues.push(`${location}: unresolved link ${target}`);
    }
  }
  function members(record, node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(value => members(record, value)); return; }
    const isMember = ['TSPropertySignature', 'TSMethodSignature', 'ClassMethod', 'ClassProperty', 'TSDeclareMethod', 'TSCallSignatureDeclaration', 'TSConstructSignatureDeclaration', 'ObjectProperty', 'ObjectMethod'].includes(node.type);
    if (isMember) {
      if (node.accessibility === 'private' || node.accessibility === 'protected' || node.key?.type === 'PrivateName' || (node.computed && node.key?.type !== 'MemberExpression')) return;
      const key = `${record.file}:${node.start}`;
      if (!checkedMembers.has(key)) {
        checkedMembers.add(key);
        memberCount++;
        checkComment(record, node, `${record.name}.${node.key?.name ?? node.key?.value ?? 'call'}`, false);
      }
    }
    if (node.type === 'VariableDeclarator') {
      members(record, node.id.typeAnnotation);
      if (!node.id.typeAnnotation) {
        let value = node.init;
        while (value?.type === 'TSAsExpression' || value?.type === 'TSSatisfiesExpression') value = value.expression;
        if (value?.type === 'CallExpression' && value.callee?.object?.name === 'Object' && value.callee?.property?.name === 'freeze') value = value.arguments[0];
        if (value?.type === 'ObjectExpression') members(record, value.properties);
      }
      return;
    }
    if (node.type === 'FunctionDeclaration' || node.type === 'TSDeclareFunction') return;
    if (node.type === 'ObjectMethod' || node.type === 'ObjectProperty') {
      if (node.value?.type === 'ObjectExpression') members(record, node.value.properties);
      return;
    }
    if (node.type === 'TSModuleDeclaration') {
      for (const item of node.body.body ?? []) {
        const child = item.declaration ?? item;
        if (child.type === 'TSInterfaceDeclaration' || child.type === 'TSTypeAliasDeclaration') {
          memberCount++;
          checkComment(record, item, `${record.name}.${child.id.name}`, false);
          members(record, child);
        }
      }
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (!['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'extra', 'body'].includes(key)) members(record, value);
    }
    if (node.type === 'TSInterfaceDeclaration' || node.type === 'ClassDeclaration') members(record, node.body.body);
  }
  for (const record of [...declarations.values(), ...inherited.values()]) {
    checkComment(record, record.outer, record.name, true);
    members(record, record.node);
  }
  return { entries, declarations: declarations.size, inherited: inherited.size, members: memberCount, links: linkCount, issues };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = auditPublicJsdoc(resolve(import.meta.dirname, '..'), { built: process.argv.includes('--built') });
  if (result.issues.length) {
    console.error(result.issues.join('\n'));
    process.exitCode = 1;
  } else {
    process.stdout.write(`Public JSDoc: ${result.entries.length} entries, ${result.declarations} declarations, ${result.inherited} inherited types, ${result.members} members, ${result.links} resolved links.\n`);
  }
}
