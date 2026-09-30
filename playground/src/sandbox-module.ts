import { parse } from "@babel/parser";

const SUPPORTED_MODULES = new Set([
  "@crc/core",
  "@crc/text",
  "@crc/viz",
  "@crc/core/jsx-runtime",
  "@crc/core/jsx-dev-runtime",
  "@crc/particles",
  "@crc/three",
  "@crc/physics/2d",
  "@crc/physics/2d/geometry",
  "@crc/physics/3d/geometry",
  "three",
  "three/addons/controls/OrbitControls.js",
]);

const RESTRICTED_MODULE_EXPORTS = new Map<string, ReadonlySet<string>>([
  ["@crc/three", new Set(["defineThreeLayer"])],
  [
    "three",
    new Set([
      "Color",
      "HemisphereLight",
      "IcosahedronGeometry",
      "InstancedMesh",
      "Matrix4",
      "Mesh",
      "MeshPhongMaterial",
      "PerspectiveCamera",
      "Raycaster",
      "Scene",
      "Vector2",
    ]),
  ],
  [
    "three/addons/controls/OrbitControls.js",
    new Set(["OrbitControls"]),
  ],
]);

interface SourceEdit {
  start: number;
  end: number;
  replacement: string;
}

function invalidModuleShape(): Error {
  return new Error(
    "Lessons may contain named imports only from @crc/core, @crc/viz, " +
      "@crc/core/jsx-runtime, @crc/core/jsx-dev-runtime, @crc/particles, " +
      "@crc/physics/2d, @crc/physics/2d/geometry, " +
      "@crc/physics/3d/geometry, @crc/three, three, and " +
      "three/addons/controls/OrbitControls.js, plus exactly " +
      "one default mount(canvas) export.",
  );
}

function requiredOffset(value: number | null | undefined): number {
  if (typeof value !== "number") throw invalidModuleShape();
  return value;
}

function inspectSyntax(value: unknown, identifiers: Set<string>): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => inspectSyntax(item, identifiers));
  }
  const node = value as Record<string, unknown>;
  if (node.type === "Identifier" && typeof node.name === "string") {
    identifiers.add(node.name);
  }
  if (node.type === "ImportExpression" || node.type === "Import") return true;
  return Object.entries(node).some(([key, child]) => {
    if (
      key === "comments" ||
      key === "errors" ||
      key === "extra" ||
      key === "loc" ||
      key === "tokens"
    ) {
      return false;
    }
    return inspectSyntax(child, identifiers);
  });
}

function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  let result = source;
  for (const edit of [...edits].sort(
    (left, right) => right.start - left.start,
  )) {
    result =
      result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }
  return result;
}

function uniqueRuntimeBinding(identifiers: ReadonlySet<string>): string {
  let binding = "__crcStudioRuntime";
  while (identifiers.has(binding)) binding += "_";
  return binding;
}

export function toRunnableScript(emittedCode: string): string {
  let file;
  try {
    file = parse(emittedCode, {
      createImportExpressions: true,
      sourceType: "module",
      tokens: true,
    });
  } catch {
    throw invalidModuleShape();
  }

  const identifiers = new Set<string>();
  if (inspectSyntax(file.program, identifiers)) throw invalidModuleShape();

  const bindings = new Map<string, string[]>();
  const localBindings = new Set<string>();
  const edits: SourceEdit[] = [];
  let mountExports = 0;
  let emptyExports = 0;

  for (const statement of file.program.body) {
    if (statement.type === "ImportDeclaration") {
      if (
        statement.importKind === "type" ||
        typeof statement.source.value !== "string" ||
        !SUPPORTED_MODULES.has(statement.source.value) ||
        statement.specifiers.length === 0 ||
        statement.attributes?.length
      ) {
        throw invalidModuleShape();
      }
      for (const specifier of statement.specifiers) {
        const moduleName = statement.source.value;
        if (
          specifier.type !== "ImportSpecifier" ||
          specifier.importKind === "type" ||
          specifier.imported.type !== "Identifier" ||
          specifier.imported.name === "default" ||
          RESTRICTED_MODULE_EXPORTS.get(moduleName)?.has(
            specifier.imported.name,
          ) === false ||
          localBindings.has(specifier.local.name)
        ) {
          throw invalidModuleShape();
        }
        localBindings.add(specifier.local.name);
        const moduleBindings = bindings.get(moduleName) ?? [];
        moduleBindings.push(
          specifier.imported.name === specifier.local.name
            ? specifier.imported.name
            : `${specifier.imported.name}: ${specifier.local.name}`,
        );
        bindings.set(moduleName, moduleBindings);
      }
      const statementStart = requiredOffset(statement.start);
      const statementEnd = requiredOffset(statement.end);
      const syntaxTokens = file.tokens?.filter(
        (token) =>
          requiredOffset(token.start) >= statementStart &&
          requiredOffset(token.end) <= statementEnd &&
          typeof token.type !== "string",
      );
      if (!syntaxTokens?.length) throw invalidModuleShape();
      for (const token of syntaxTokens) {
        edits.push({
          start: requiredOffset(token.start),
          end: requiredOffset(token.end),
          replacement: "",
        });
      }
      continue;
    }

    if (statement.type === "ExportDefaultDeclaration") {
      const declaration = statement.declaration;
      if (
        ++mountExports !== 1 ||
        declaration.type !== "FunctionDeclaration" ||
        declaration.async ||
        declaration.generator ||
        declaration.id?.name !== "mount" ||
        declaration.params.length < 1 ||
        declaration.params.slice(1).some(parameter => parameter.type !== "AssignmentPattern") ||
        declaration.params[0]?.type !== "Identifier" ||
        declaration.params[0].name !== "canvas"
      ) {
        throw invalidModuleShape();
      }
      const statementStart = requiredOffset(statement.start);
      const declarationStart = requiredOffset(declaration.start);
      const keywordTokens = file.tokens?.filter(
        (token) =>
          requiredOffset(token.start) >= statementStart &&
          requiredOffset(token.end) <= declarationStart &&
          (token.type.label === "export" || token.type.label === "default"),
      );
      if (keywordTokens?.length !== 2) throw invalidModuleShape();
      for (const token of keywordTokens) {
        edits.push({
          start: requiredOffset(token.start),
          end: requiredOffset(token.end),
          replacement: "",
        });
      }
      continue;
    }

    if (statement.type.startsWith("Export")) {
      if (
        statement.type !== "ExportNamedDeclaration" ||
        statement.declaration ||
        statement.source ||
        statement.specifiers.length !== 0 ||
        ++emptyExports !== 1
      ) {
        throw invalidModuleShape();
      }
      const statementStart = requiredOffset(statement.start);
      const statementEnd = requiredOffset(statement.end);
      const syntaxTokens = file.tokens?.filter(
        (token) =>
          requiredOffset(token.start) >= statementStart &&
          requiredOffset(token.end) <= statementEnd &&
          typeof token.type !== "string",
      );
      if (!syntaxTokens?.length) throw invalidModuleShape();
      for (const token of syntaxTokens) {
        edits.push({
          start: requiredOffset(token.start),
          end: requiredOffset(token.end),
          replacement: "",
        });
      }
    }
  }

  if (bindings.size === 0 || mountExports !== 1) {
    throw invalidModuleShape();
  }

  const runtimeBinding = uniqueRuntimeBinding(identifiers);
  const runnable = applyEdits(emittedCode, edits);
  const runtimeBindings = [...bindings]
    .map(([moduleName, moduleBindings]) => {
      const runtimeSource = RESTRICTED_MODULE_EXPORTS.has(moduleName)
        ? `${runtimeBinding}.__crcStudioModules[${JSON.stringify(moduleName)}]`
        : runtimeBinding;
      return `const { ${moduleBindings.join(", ")} } = ${runtimeSource};`;
    })
    .join("\n");
  const wrapped = `globalThis.__CRC_EXAMPLE_MOUNT__ = (function (${runtimeBinding}) {
"use strict";
${runtimeBindings}
${runnable}
return mount;
})(globalThis["CRC_CORE"]);`;

  try {
    parse(wrapped, { createImportExpressions: true, sourceType: "script" });
  } catch {
    throw invalidModuleShape();
  }
  return wrapped;
}
