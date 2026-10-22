import { parse } from "@babel/parser";

const SUPPORTED_MODULES = new Set([
  "@pibbl/core/machines",
  "@pibbl/core/machines/animation",
  "@pibbl/core/sprites",
  "@pibbl/core/sprites/formats/aseprite",
  "@pibbl/core/sprites/formats/texture-packer",

  "@pibbl/text",
  "@pibbl/core",
  "@pibbl/core/filters",
  "@pibbl/core/viz",
  "@pibbl/core/viz/inspection",
  "@pibbl/core/textures",
  "@pibbl/core/jsx-runtime",
  "@pibbl/core/jsx-dev-runtime",
  "@pibbl/core/particles",
  "@pibbl/three",
  "@pibbl/core/physics/2d",
  "@pibbl/core/physics/2d/geometry",
  "three",
  "three/addons/controls/OrbitControls.js",
]);

const RESTRICTED_MODULE_EXPORTS = new Map<string, ReadonlySet<string>>([
  ["@pibbl/three", new Set(["defineThreeLayer"])],
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
  ["three/addons/controls/OrbitControls.js", new Set(["OrbitControls"])],
]);

interface SourceEdit {
  start: number;
  end: number;
  replacement: string;
}

function invalidModuleShape(): Error {
  return new Error(
    "Lessons may contain named imports only from @pibbl/core/machines, @pibbl/core/machines/animation, @pibbl/core/sprites and its format adapters, @pibbl/core, @pibbl/core/filters, @pibbl/core/viz, @pibbl/core/textures, " +
      "@pibbl/core/jsx-runtime, @pibbl/core/jsx-dev-runtime, @pibbl/core/particles, " +
      "@pibbl/core/physics/2d, @pibbl/core/physics/2d/geometry, @pibbl/three, three, and " +
      "three/addons/controls/OrbitControls.js, with a catalog-selected named component export.",
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
  let binding = "__pibblStudioRuntime";
  while (identifiers.has(binding)) binding += "_";
  return binding;
}

export function toRunnableScript(
  emittedCode: string,
  options: { exportName: string },
): string {
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
  let emptyExports = 0;
  let componentName: string | undefined;
  const exports = new Map<string, string>();
  const functions = new Map<
    string,
    {
      async: boolean;
      generator?: boolean | null;
      params: readonly { type: string }[];
    }
  >();
  for (const statement of file.program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type === "FunctionDeclaration" && declaration.id)
      functions.set(declaration.id.name, declaration);
    if (declaration?.type === "VariableDeclaration")
      for (const binding of declaration.declarations) {
        if (
          binding.id.type === "Identifier" &&
          (binding.init?.type === "ArrowFunctionExpression" ||
            binding.init?.type === "FunctionExpression")
        )
          functions.set(binding.id.name, binding.init);
      }
  }

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

    if (statement.type.startsWith("Export")) {
      if (statement.type !== "ExportNamedDeclaration" || statement.source)
        throw invalidModuleShape();
      if (statement.declaration) {
        const declaration = statement.declaration;
        if (declaration.type === "FunctionDeclaration" && declaration.id) {
          exports.set(declaration.id.name, declaration.id.name);
        } else if (declaration.type === "VariableDeclaration") {
          for (const binding of declaration.declarations) {
            if (binding.id.type !== "Identifier") throw invalidModuleShape();
            exports.set(binding.id.name, binding.id.name);
          }
        } else throw invalidModuleShape();
        const token = file.tokens?.find(
          (token) =>
            token.start === statement.start && token.type.label === "export",
        );
        if (!token) throw invalidModuleShape();
        edits.push({
          start: requiredOffset(token.start),
          end: requiredOffset(token.end),
          replacement: "",
        });
      } else {
        if (!statement.specifiers.length && ++emptyExports !== 1)
          throw invalidModuleShape();
        for (const specifier of statement.specifiers) {
          if (
            specifier.type !== "ExportSpecifier" ||
            specifier.exported.type !== "Identifier"
          )
            throw invalidModuleShape();
          exports.set(specifier.exported.name, specifier.local.name);
        }
        const start = requiredOffset(statement.start);
        const end = requiredOffset(statement.end);
        const tokens = file.tokens?.filter(
          (token) =>
            requiredOffset(token.start) >= start &&
            requiredOffset(token.end) <= end &&
            typeof token.type !== "string",
        );
        if (!tokens?.length) throw invalidModuleShape();
        for (const token of tokens)
          edits.push({
            start: requiredOffset(token.start),
            end: requiredOffset(token.end),
            replacement: "",
          });
      }
    }
  }
  componentName = exports.get(options.exportName);

  if (options.exportName && !componentName) {
    throw new Error(
      `Preview component export "${options.exportName}" was not found. Keep the catalog-selected export when editing the lesson.`,
    );
  }
  const component = functions.get(componentName!);
  if (
    bindings.size === 0 ||
    !component ||
    component.async ||
    component.generator ||
    component.params.length > 1 ||
    component.params.some((parameter) => parameter.type !== "AssignmentPattern")
  ) {
    throw invalidModuleShape();
  }

  const runtimeBinding = uniqueRuntimeBinding(identifiers);
  const runnable = applyEdits(emittedCode, edits);
  const runtimeBindings = [...bindings]
    .map(([moduleName, moduleBindings]) => {
      const runtimeSource = RESTRICTED_MODULE_EXPORTS.has(moduleName)
        ? `${runtimeBinding}.__pibblStudioModules[${JSON.stringify(moduleName)}]`
        : runtimeBinding;
      return `const { ${moduleBindings.join(", ")} } = ${runtimeSource};`;
    })
    .join("\n");
  const wrapped = `globalThis.__PIBBL_EXAMPLE_MOUNT__ = (function (${runtimeBinding}) {
"use strict";
${runtimeBindings}
${runnable}
return (canvas, config) => ${runtimeBinding}.pibbl(canvas, ${runtimeBinding}.createElement(${componentName}, null), config);
})(globalThis["PIBBL_CORE"]);`;

  try {
    parse(wrapped, { createImportExpressions: true, sourceType: "script" });
  } catch {
    throw invalidModuleShape();
  }
  return wrapped;
}
