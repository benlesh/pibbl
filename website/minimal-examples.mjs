import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { parse } from "@babel/parser";
import { traverse } from "@babel/core";

export function validateExampleSource(entry, code) {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  const imports = new Map();
  const used = new Set();
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "ImportDeclaration") {
      if (
        !/^@pibbl\/(core(?:\/(?:machines(?:\/animation)?|sprites(?:\/formats\/(?:aseprite|texture-packer))?|filters|types|textures|particles|viz(?:\/inspection)?|jsx-runtime|jsx-dev-runtime|physics\/2d(?:\/(?:geometry|testing))?))?|three|text)$/.test(
          node.source.value,
        ) &&
        !/^three(?:\/addons\/)/.test(node.source.value) &&
        node.source.value !== "three"
      ) {
        throw new Error(
          `Examples must use a public import: ${node.source.value}`,
        );
      }
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportSpecifier")
          imports.set(
            `${node.source.value}:${specifier.imported.name}`,
            specifier.local.name,
          );
        if (specifier.type === "ImportNamespaceSpecifier")
          imports.set(`${node.source.value}:*`, specifier.local.name);
      }
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
    }
  }
  walk(ast.program);
  traverse(ast, {
    "Identifier|JSXIdentifier"(path) {
      const parent = path.parent;
      const typedReference =
        (parent.type === "TSTypeReference" && path.key === "typeName") ||
        (parent.type === "TSQualifiedName" && path.key === "left") ||
        (parent.type === "TSTypeQuery" && path.key === "exprName") ||
        (parent.type === "TSExpressionWithTypeArguments" &&
          path.key === "expression");
      const jsxReference =
        ((parent.type === "JSXOpeningElement" ||
          parent.type === "JSXClosingElement") &&
          path.key === "name") ||
        (parent.type === "JSXMemberExpression" && path.key === "object");
      if (!typedReference && !jsxReference && !path.isReferencedIdentifier())
        return;
      const binding = path.scope.getBinding(path.node.name);
      if (binding?.path.isImportSpecifier()) used.add(path.node.name);
    },
  });
  for (const symbol of entry.symbols) {
    const local = imports.get(`${symbol.importPath}:${symbol.name}`);
    if (!local)
      throw new Error(
        `${symbol.name} needs its public import from ${symbol.importPath}`,
      );
    if (!used.has(local))
      throw new Error(`${symbol.name} is imported but not used`);
  }
}

export async function loadMinimalExamples(root) {
  const directory = resolve(root, "docs/site/minimal");
  const files = await readdir(directory, { recursive: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const examples = [];
  const ids = new Set();
  for (const file of files
    .filter((file) => file.endsWith("/registry.json"))
    .sort()) {
    const family = dirname(file);
    const registry = JSON.parse(
      await readFile(resolve(directory, file), "utf8"),
    );
    for (const record of registry) {
      if (
        !/^[a-z0-9-]+$/.test(record.id) ||
        !/^[a-z0-9-]+\.tsx?$/.test(record.source)
      )
        throw new Error(`Invalid minimal example path in ${file}`);
      if (
        !["browser", "typecheck"].includes(record.environment) ||
        !record.symbols?.length ||
        !record.description ||
        !record.title
      )
        throw new Error(`Incomplete minimal example metadata in ${file}`);
      const id = `${family}/${record.id}`;
      if (ids.has(id)) throw new Error(`Duplicate minimal example ${id}`);
      ids.add(id);
      const path = resolve(directory, family, record.source);
      const code = await readFile(path, "utf8");
      validateExampleSource(record, code);
      examples.push({
        ...record,
        id,
        path,
        sourcePath: relative(root, path),
        code,
      });
    }
  }
  return examples;
}
