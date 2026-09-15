import { parse } from "@babel/parser";

export type LearningSourceAuthoring = "jsx" | "createElement";

export interface LearningSourceContract {
  readonly authoring: LearningSourceAuthoring;
  readonly label: string;
  readonly sourcePath?: string;
}

interface SyntaxNode {
  readonly type: string;
  readonly [key: string]: unknown;
}

interface SourceInspection {
  readonly hasBindingViolation: boolean;
  readonly hasCommonJsSyntax: boolean;
  readonly hasCoreValueImport: boolean;
  readonly hasPhysicsValueImport: boolean;
  readonly hasWebGLValueImport: boolean;
  readonly hasCreateElementCall: boolean;
  readonly hasDirectComponentCall: boolean;
  readonly hasDynamicImportExpression: boolean;
  readonly hasExportAssignment: boolean;
  readonly hasForbiddenLearningModuleSyntax: boolean;
  readonly hasImportAttributes: boolean;
  readonly hasImportEquals: boolean;
  readonly hasImportMeta: boolean;
  readonly hasInvalidCreateElementCallForm: boolean;
  readonly hasJsx: boolean;
  readonly hasLegacyAuthoring: boolean;
  readonly hasLegacyLayerRender: boolean;
  readonly hasLegacyTextStyle: boolean;
  readonly hasLegacyTypes: boolean;
  readonly hasNamedValueCoreImport: boolean;
  readonly hasNamedValuePhysicsImport: boolean;
  readonly hasNamedValueWebGLImport: boolean;
  readonly hasNamespaceExport: boolean;
  readonly hasOnlyApprovedImports: boolean;
  readonly hasOnlyScenarioImports: boolean;
  readonly hasOrbitHandlersSpread: boolean;
  readonly hasScenarioReExport: boolean;
  readonly hasCanonicalMount: boolean;
  readonly hasTestScaffolding: boolean;
  readonly hasUninspectableProps: boolean;
  readonly hasUninspectableLegacySensitiveProps: boolean;
  readonly hasTypeImport: boolean;
  readonly packageImportModules: readonly string[];
}

const CORE_MODULE = "@crc/core";
const PHYSICS_MODULE = "@crc/physics/2d";
const WEBGL_MODULE = "@crc/webgl";
const LEARNING_VALUE_MODULES = new Set([
  CORE_MODULE,
  PHYSICS_MODULE,
  WEBGL_MODULE,
]);
const WEBGL_ISLAND_LEARNING_SOURCE_PATH =
  "packages/scenarios/src/learning/composition/webgl-islands.example.tsx";
const WEBGL_LIGHTING_LEARNING_SOURCE_DIRECTORY =
  "packages/scenarios/src/learning/webgl/";
const PHYSICS_LEARNING_SOURCE_PATH =
  "packages/scenarios/src/learning/composition/physics-2d.example.tsx";

const LEGACY_AUTHORING_NAMES = new Set([
  ["define", "Comp"].join(""),
  "rect",
  "path",
  "svgPath",
  "line",
  "horizontalLine",
  "verticalLine",
  "text",
  "img",
  "g",
  "clip",
  "layer",
  "absolute",
  "overlay",
  "flow",
  "flex",
  "grid",
  ["with", "Focus", "Management"].join(""),
  ["with", "Keyboard", "Navigation"].join(""),
]);
const LEGACY_TYPE_NAMES = new Set([
  ["Comp", "El"].join(""),
  ["Comp", "Fn"].join(""),
  ["Component", "Capabilities"].join(""),
  ["Component", "Input"].join(""),
  ["Falsy", "Nodes"].join(""),
]);
// Uppercase element types exported from packages/core/src/index.ts. They are
// values so direct calls parse, but lessons must construct them declaratively.
const DESCRIPTIVE_COMPONENT_EXPORTS = new Set([
  "Absolute",
  "Clip",
  "Flex",
  "Flow",
  "FocusManagement",
  "Fragment",
  "Grid",
  "Group",
  "HorizontalLine",
  "Image",
  "KeyboardNavigation",
  "Layer",
  "Line",
  "Overlay",
  "Path",
  "Rectangle",
  "SvgPath",
  "Text",
  "VerticalLine",
  "Cube",
  "AmbientLight",
  "DirectionalLight",
  "Group3D",
  "HemisphereLight",
  "Mesh",
  "PointLight",
  "Sphere",
  "SpotLight",
  "WebGLBackground",
  "WebGLLayer",
  "PhysicsWorld2D",
]);
const COMMONJS_BINDING_NAMES = new Set(["exports", "module", "require"]);
const COMMONJS_GLOBAL_NAMES = new Set([
  "global",
  "globalThis",
  "self",
  "window",
]);
const FUNCTION_LIKE_BINDING_TYPES = new Set([
  "ArrowFunctionExpression",
  "ClassMethod",
  "ClassPrivateMethod",
  "FunctionDeclaration",
  "FunctionExpression",
  "ObjectMethod",
  "TSDeclareFunction",
]);
const TRANSPARENT_EXPRESSION_TYPES = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSInstantiationExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
  "TypeCastExpression",
]);
const SKIPPED_AST_KEYS = new Set([
  "comments",
  "errors",
  "extra",
  "innerComments",
  "leadingComments",
  "loc",
  "tokens",
  "trailingComments",
]);

function invalid(label: string, detail: string): Error {
  return new Error(`${label} ${detail}`);
}

function isNode(value: unknown): value is SyntaxNode {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function nodes(value: unknown): readonly SyntaxNode[] {
  return Array.isArray(value) ? value.filter(isNode) : [];
}

function identifierName(value: unknown): string | undefined {
  return isNode(value) && value.type === "Identifier" && typeof value.name === "string"
    ? value.name
    : undefined;
}

function propertyName(value: unknown): string | undefined {
  const node = unwrapTransparentExpression(value);
  if (!node) return undefined;
  if (
    (node.type === "Identifier" || node.type === "JSXIdentifier") &&
    typeof node.name === "string"
  ) {
    return node.name;
  }
  if (node.type === "StringLiteral" && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === "TemplateLiteral" && nodes(node.expressions).length === 0) {
    const quasis = nodes(node.quasis);
    const quasiValue = quasis.length === 1 ? quasis[0]?.value : undefined;
    if (
      quasiValue !== null &&
      typeof quasiValue === "object" &&
      "cooked" in quasiValue &&
      typeof quasiValue.cooked === "string"
    ) {
      return quasiValue.cooked;
    }
  }
  return undefined;
}

function walk(node: SyntaxNode, visit: (node: SyntaxNode) => void): void {
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_AST_KEYS.has(key)) continue;
    if (isNode(value)) {
      walk(value, visit);
    } else if (Array.isArray(value)) {
      for (const child of value) if (isNode(child)) walk(child, visit);
    }
  }
}

function walkWithParent(
  node: SyntaxNode,
  parent: SyntaxNode | undefined,
  visit: (node: SyntaxNode, parent: SyntaxNode | undefined) => void,
): void {
  visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_AST_KEYS.has(key)) continue;
    if (isNode(value)) {
      walkWithParent(value, node, visit);
    } else if (Array.isArray(value)) {
      for (const child of value) {
        if (isNode(child)) walkWithParent(child, node, visit);
      }
    }
  }
}

function isLegacyImportAssertionSyntaxError(
  source: string,
  error: unknown,
): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as {
    readonly code?: unknown;
    readonly pos?: unknown;
    readonly reasonCode?: unknown;
  };
  const position = failure.pos;
  if (
    failure.code !== "BABEL_PARSER_SYNTAX_ERROR" ||
    failure.reasonCode !== "MissingSemicolon" ||
    typeof position !== "number" ||
    !/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))*assert(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))*\{/u.test(
      source.slice(position),
    )
  ) {
    return false;
  }

  try {
    const prefixFile = parse(source.slice(0, position), {
      createImportExpressions: true,
      plugins: ["typescript", "jsx"],
      sourceType: "module",
    }) as unknown as SyntaxNode;
    const program = isNode(prefixFile.program) ? prefixFile.program : undefined;
    const statements = nodes(program?.body);
    return statements[statements.length - 1]?.type === "ImportDeclaration";
  } catch {
    return false;
  }
}

function parseSource(source: string, label: string): SyntaxNode {
  try {
    return parse(source, {
      createImportExpressions: true,
      plugins: ["typescript", "jsx"],
      sourceType: "module",
    }) as unknown as SyntaxNode;
  } catch (error) {
    if (isLegacyImportAssertionSyntaxError(source, error)) {
      throw invalid(label, "must not use import attributes or assertions.");
    }
    throw invalid(label, "must be valid TSX module syntax.");
  }
}

function typeReferenceName(annotation: unknown): string | undefined {
  if (!isNode(annotation) || annotation.type !== "TSTypeAnnotation") {
    return undefined;
  }
  const typeAnnotation = annotation.typeAnnotation;
  if (!isNode(typeAnnotation) || typeAnnotation.type !== "TSTypeReference") {
    return undefined;
  }
  return identifierName(typeAnnotation.typeName);
}

function isCanonicalMount(programBody: readonly SyntaxNode[]): boolean {
  const defaults = programBody.filter(
    (statement) => statement.type === "ExportDefaultDeclaration",
  );
  if (defaults.length !== 1) return false;
  const declaration = defaults[0]?.declaration;
  if (
    !isNode(declaration) ||
    declaration.type !== "FunctionDeclaration" ||
    identifierName(declaration.id) !== "mount" ||
    declaration.async === true ||
    declaration.generator === true
  ) {
    return false;
  }
  const parameters = nodes(declaration.params);
  const canvas = parameters[0];
  return (
    parameters.length === 1 &&
    canvas?.type === "Identifier" &&
    canvas.name === "canvas" &&
    typeReferenceName(canvas.typeAnnotation) === "HTMLCanvasElement" &&
    typeReferenceName(declaration.returnType) === "CRCController"
  );
}

function objectHasProperty(object: unknown, name: string): boolean {
  if (!isNode(object) || object.type !== "ObjectExpression") return false;
  return nodes(object.properties).some(
    (property) =>
      property.type === "ObjectProperty" &&
      propertyName(property.key) === name,
  );
}

function objectPropertyValue(object: unknown, name: string): unknown {
  if (!isNode(object) || object.type !== "ObjectExpression") return undefined;
  const property = nodes(object.properties).find(
    (candidate) =>
      candidate.type === "ObjectProperty" && propertyName(candidate.key) === name,
  );
  return property?.value;
}

function isInspectableObject(value: unknown): value is SyntaxNode {
  if (!isNode(value) || value.type !== "ObjectExpression") return false;
  return nodes(value.properties).every(
    (property) =>
      property.type === "ObjectProperty" &&
      property.computed !== true &&
      propertyName(property.key) !== undefined,
  );
}

function bindingNames(pattern: unknown): readonly string[] {
  if (!isNode(pattern)) return [];
  if (pattern.type === "Identifier") {
    return typeof pattern.name === "string" ? [pattern.name] : [];
  }
  if (pattern.type === "RestElement") return bindingNames(pattern.argument);
  if (pattern.type === "AssignmentPattern") return bindingNames(pattern.left);
  if (pattern.type === "TSParameterProperty") {
    return bindingNames(pattern.parameter);
  }
  if (pattern.type === "ArrayPattern") {
    return nodes(pattern.elements).flatMap(bindingNames);
  }
  if (pattern.type === "ObjectPattern") {
    return nodes(pattern.properties).flatMap((property) => {
      if (property.type === "RestElement") return bindingNames(property.argument);
      return bindingNames(property.value);
    });
  }
  return [];
}

function declaresBindingNamed(
  node: SyntaxNode,
  importedNames: ReadonlySet<string>,
): boolean {
  const matches = (patterns: readonly unknown[]) =>
    patterns.some((pattern) =>
      bindingNames(pattern).some((name) => importedNames.has(name)),
    );

  if (FUNCTION_LIKE_BINDING_TYPES.has(node.type)) {
    return matches([node.id, ...nodes(node.params)]);
  }

  switch (node.type) {
    case "VariableDeclarator":
      return matches([node.id]);
    case "ClassDeclaration":
    case "ClassExpression":
      return matches([node.id]);
    case "CatchClause":
      return matches([node.param]);
    default:
      return false;
  }
}

function assignsBindingNamed(
  node: SyntaxNode,
  importedNames: ReadonlySet<string>,
): boolean {
  if (node.type === "AssignmentExpression") {
    return bindingNames(node.left).some((name) => importedNames.has(name));
  }
  return (
    node.type === "UpdateExpression" &&
    bindingNames(node.argument).some((name) => importedNames.has(name))
  );
}

function isNonComputedPropertyName(
  node: SyntaxNode,
  parent: SyntaxNode,
): boolean {
  if (parent.computed === true) return false;
  if (
    parent.type === "ObjectProperty" ||
    parent.type === "ObjectMethod" ||
    parent.type === "ClassProperty" ||
    parent.type === "ClassMethod" ||
    parent.type === "ClassAccessorProperty" ||
    parent.type === "TSPropertySignature" ||
    parent.type === "TSMethodSignature"
  ) {
    return parent.shorthand !== true && parent.key === node;
  }
  if (parent.type === "TSEnumMember") return parent.id === node;
  if (parent.type === "TSQualifiedName") return parent.right === node;
  if (
    parent.type === "MemberExpression" ||
    parent.type === "OptionalMemberExpression"
  ) {
    return parent.property === node;
  }
  return false;
}

function isDirectBindingDeclaration(
  node: SyntaxNode,
  parent: SyntaxNode,
): boolean {
  if (
    parent.type === "ImportSpecifier" ||
    parent.type === "ImportDefaultSpecifier" ||
    parent.type === "ImportNamespaceSpecifier"
  ) {
    return true;
  }
  if (parent.type === "VariableDeclarator") return parent.id === node;
  if (FUNCTION_LIKE_BINDING_TYPES.has(parent.type)) {
    return parent.id === node || nodes(parent.params).includes(node);
  }
  if (
    parent.type === "ClassDeclaration" ||
    parent.type === "ClassExpression" ||
    parent.type === "TSTypeAliasDeclaration" ||
    parent.type === "TSInterfaceDeclaration" ||
    parent.type === "TSModuleDeclaration"
  ) {
    return parent.id === node;
  }
  if (parent.type === "CatchClause") return parent.param === node;
  return false;
}

function isCommonJsExecutableReference(
  node: SyntaxNode,
  parent: SyntaxNode | undefined,
): boolean {
  const name = identifierName(node);
  if (!name || !COMMONJS_BINDING_NAMES.has(name) || !parent) return false;
  if (
    isDirectBindingDeclaration(node, parent) ||
    isNonComputedPropertyName(node, parent)
  ) {
    return false;
  }
  if (
    (parent.type === "LabeledStatement" ||
      parent.type === "BreakStatement" ||
      parent.type === "ContinueStatement") &&
    parent.label === node
  ) {
    return false;
  }
  return true;
}

function unwrapTransparentExpression(value: unknown): SyntaxNode | undefined {
  let node = isNode(value) ? value : undefined;
  while (node && TRANSPARENT_EXPRESSION_TYPES.has(node.type)) {
    node = isNode(node.expression) ? node.expression : undefined;
  }
  return node;
}

function staticMemberName(node: SyntaxNode): string | undefined {
  if (
    node.type !== "MemberExpression" &&
    node.type !== "OptionalMemberExpression"
  ) {
    return undefined;
  }
  if (node.computed !== true) return propertyName(node.property);
  const property = unwrapTransparentExpression(node.property);
  if (
    property?.type !== "StringLiteral" &&
    property?.type !== "TemplateLiteral"
  ) {
    return undefined;
  }
  return propertyName(property);
}

function isOrbitHandlersSpread(attribute: SyntaxNode): boolean {
  if (attribute.type !== "JSXSpreadAttribute") return false;
  const argument = unwrapTransparentExpression(attribute.argument);
  return (
    argument !== undefined &&
    (argument.type === "MemberExpression" ||
      argument.type === "OptionalMemberExpression") &&
    identifierName(argument.object) === "orbit" &&
    staticMemberName(argument) === "handlers"
  );
}

function knownGlobalAccessPath(value: unknown): readonly string[] | undefined {
  const node = unwrapTransparentExpression(value);
  if (!node) return undefined;

  const rootName = identifierName(node);
  if (rootName && COMMONJS_GLOBAL_NAMES.has(rootName)) return [rootName];
  if (
    node.type !== "MemberExpression" &&
    node.type !== "OptionalMemberExpression"
  ) {
    return undefined;
  }

  const objectPath = knownGlobalAccessPath(node.object);
  const memberName = staticMemberName(node);
  return objectPath && memberName ? [...objectPath, memberName] : undefined;
}

function isCommonJsGlobalAccess(node: SyntaxNode): boolean {
  if (
    node.type !== "MemberExpression" &&
    node.type !== "OptionalMemberExpression"
  ) {
    return false;
  }
  if (
    node.computed === true &&
    knownGlobalAccessPath(node.object) !== undefined &&
    staticMemberName(node) === undefined
  ) {
    return true;
  }
  const path = knownGlobalAccessPath(node);
  return (
    path !== undefined &&
    path.slice(1).some((name) => COMMONJS_BINDING_NAMES.has(name))
  );
}

function isApprovedCoreReference(
  node: SyntaxNode,
  parent: SyntaxNode | undefined,
  valueImports: ReadonlyMap<string, string>,
): boolean {
  if (!parent) return false;
  if (isDirectBindingDeclaration(node, parent)) return true;
  if (
    (parent.type === "CallExpression" ||
      parent.type === "OptionalCallExpression" ||
      parent.type === "NewExpression") &&
    parent.callee === node
  ) {
    return true;
  }
  if (
    (parent.type === "CallExpression" ||
      parent.type === "OptionalCallExpression" ||
      parent.type === "NewExpression") &&
    identifierName(parent.callee) !== undefined &&
    valueImports.get(identifierName(parent.callee) ?? "") === "createElement" &&
    nodes(parent.arguments)[0] === node
  ) {
    return true;
  }
  if (parent.type === "TaggedTemplateExpression" && parent.tag === node) {
    const name = identifierName(node);
    return name !== undefined && valueImports.get(name) === "createElement";
  }
  if (isNonComputedPropertyName(node, parent)) return true;
  return false;
}

function jsxAttribute(
  openingElement: SyntaxNode,
  name: string,
): SyntaxNode | undefined {
  return nodes(openingElement.attributes).find(
    (attribute) =>
      attribute.type === "JSXAttribute" && propertyName(attribute.name) === name,
  );
}

function jsxAttributeExpression(attribute: SyntaxNode | undefined): unknown {
  if (!attribute) return undefined;
  const value = attribute.value;
  if (!isNode(value) || value.type !== "JSXExpressionContainer") return undefined;
  return value.expression;
}

function declarationValue(statement: SyntaxNode): SyntaxNode {
  if (
    (statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration") &&
    isNode(statement.declaration)
  ) {
    return statement.declaration;
  }
  return statement;
}

function isRelativeModuleName(moduleName: string | undefined): boolean {
  return (
    moduleName === "." ||
    moduleName === ".." ||
    moduleName?.startsWith("./") === true ||
    moduleName?.startsWith("../") === true
  );
}

function moduleDeclarationBindingNames(id: unknown): readonly string[] {
  if (!isNode(id)) return [];
  if (id.type === "Identifier") return bindingNames(id);
  if (id.type === "TSQualifiedName") {
    return moduleDeclarationBindingNames(id.left);
  }
  // Ambient string-literal modules do not introduce a lexical binding with
  // their quoted name in the enclosing scope.
  return [];
}

function moduleDeclarationFinalBindingNames(id: unknown): readonly string[] {
  if (!isNode(id)) return [];
  if (id.type === "Identifier") return bindingNames(id);
  if (id.type === "TSQualifiedName") {
    return moduleDeclarationFinalBindingNames(id.right);
  }
  return [];
}

function moduleBlockSelfBindings(
  node: SyntaxNode,
  parent: SyntaxNode | undefined,
): readonly string[] {
  return node.type === "TSModuleBlock" && parent?.type === "TSModuleDeclaration"
    ? moduleDeclarationFinalBindingNames(parent.id)
    : [];
}

function directLexicalBindings(scope: SyntaxNode): readonly string[] {
  const statements =
    scope.type === "Program" ||
    scope.type === "BlockStatement" ||
    scope.type === "StaticBlock" ||
    scope.type === "TSModuleBlock"
      ? nodes(scope.body)
      : scope.type === "SwitchStatement"
        ? nodes(scope.cases).flatMap((switchCase) => nodes(switchCase.consequent))
        : [];
  return statements.flatMap((rawStatement) => {
    const statement = declarationValue(rawStatement);
    if (statement.type === "VariableDeclaration" && statement.kind !== "var") {
      return nodes(statement.declarations).flatMap((declaration) =>
        bindingNames(declaration.id)
      );
    }
    if (
      statement.type === "FunctionDeclaration" ||
      statement.type === "ClassDeclaration" ||
      statement.type === "TSEnumDeclaration"
    ) {
      return bindingNames(statement.id);
    }
    if (statement.type === "TSModuleDeclaration") {
      return moduleDeclarationBindingNames(statement.id);
    }
    return [];
  });
}

function functionVarBindings(functionNode: SyntaxNode): readonly string[] {
  const found: string[] = [];
  const visit = (node: SyntaxNode, root: boolean): void => {
    if (!root && FUNCTION_LIKE_BINDING_TYPES.has(node.type)) return;
    if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const declaration of nodes(node.declarations)) {
        found.push(...bindingNames(declaration.id));
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (SKIPPED_AST_KEYS.has(key)) continue;
      if (isNode(value)) {
        visit(value, false);
      } else if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) visit(child, false);
      }
    }
  };
  const body = isNode(functionNode.body) ? functionNode.body : undefined;
  if (body) visit(body, true);
  return found;
}

function localScopeBindings(node: SyntaxNode): readonly string[] {
  const bindings = [...directLexicalBindings(node)];
  if (FUNCTION_LIKE_BINDING_TYPES.has(node.type)) {
    bindings.push(
      ...bindingNames(node.id),
      ...nodes(node.params).flatMap(bindingNames),
      ...functionVarBindings(node),
    );
  }
  if (node.type === "CatchClause") {
    bindings.push(...bindingNames(node.param));
  }
  if (
    node.type === "ForStatement" ||
    node.type === "ForInStatement" ||
    node.type === "ForOfStatement"
  ) {
    const declaration = isNode(node.init) ? node.init :
      isNode(node.left) ? node.left : undefined;
    if (
      declaration?.type === "VariableDeclaration" &&
      declaration.kind !== "var"
    ) {
      for (const declarator of nodes(declaration.declarations)) {
        bindings.push(...bindingNames(declarator.id));
      }
    }
  }
  return bindings;
}

function collectBindingShadows(
  file: SyntaxNode,
  importedNames: ReadonlySet<string>,
): WeakMap<object, ReadonlySet<string>> {
  const shadows = new WeakMap<object, ReadonlySet<string>>();
  const visit = (
    node: SyntaxNode,
    inherited: ReadonlySet<string>,
    parent?: SyntaxNode,
  ): void => {
    const local = [
      ...localScopeBindings(node),
      ...moduleBlockSelfBindings(node, parent),
    ]
      .filter((name) => importedNames.has(name));
    const current = local.length > 0 ?
      new Set([...inherited, ...local]) :
      inherited;
    shadows.set(node, current);
    for (const [key, value] of Object.entries(node)) {
      if (SKIPPED_AST_KEYS.has(key)) continue;
      if (isNode(value)) {
        visit(value, current, node);
      } else if (Array.isArray(value)) {
        for (const child of value) {
          if (isNode(child)) visit(child, current, node);
        }
      }
    }
  };
  visit(file, new Set());
  return shadows;
}

function resolvedCoreValueName(
  value: unknown,
  valueImports: ReadonlyMap<string, string>,
  valueNamespaceBindings: ReadonlySet<string>,
  bindingShadows: WeakMap<object, ReadonlySet<string>>,
): string | undefined {
  const node = unwrapTransparentExpression(value);
  if (!node) return undefined;
  const localName = identifierName(node) ??
    (node.type === "JSXIdentifier" ? propertyName(node) : undefined);
  if (localName) {
    return bindingShadows.get(node)?.has(localName) ?
      undefined :
      valueImports.get(localName);
  }
  if (
    node.type === "MemberExpression" ||
    node.type === "OptionalMemberExpression"
  ) {
    const objectName = identifierName(node.object);
    if (
      !objectName ||
      !valueNamespaceBindings.has(objectName) ||
      bindingShadows.get(node)?.has(objectName)
    ) {
      return undefined;
    }
    return staticMemberName(node);
  }
  if (node.type === "JSXMemberExpression") {
    const objectName = propertyName(node.object);
    if (
      !objectName ||
      !valueNamespaceBindings.has(objectName) ||
      bindingShadows.get(node)?.has(objectName)
    ) {
      return undefined;
    }
    return propertyName(node.property);
  }
  return undefined;
}

function resolvedCoreNamespaceTypeName(
  value: unknown,
  namespaceBindings: ReadonlySet<string>,
  bindingShadows: WeakMap<object, ReadonlySet<string>>,
): string | undefined {
  if (!isNode(value) || value.type !== "TSQualifiedName") return undefined;
  const namespaceName = identifierName(value.left);
  return namespaceName &&
    namespaceBindings.has(namespaceName) &&
    !bindingShadows.get(value)?.has(namespaceName)
    ? propertyName(value.right)
    : undefined;
}

function inspectSource(source: string, label: string): SourceInspection {
  const file = parseSource(source, label);
  const program = isNode(file.program) ? file.program : undefined;
  const programBody = nodes(program?.body);
  const valueImports = new Map<string, string>();
  const namespaceBindings = new Set<string>();
  const coreNamespaceBindings = new Set<string>();
  const valueNamespaceBindings = new Set<string>();
  const packageImportModules = new Set<string>();
  let hasCoreValueImport = false;
  let hasPhysicsValueImport = false;
  let hasWebGLValueImport = false;
  let hasNamedValueCoreImport = false;
  let hasNamedValuePhysicsImport = false;
  let hasNamedValueWebGLImport = false;
  let hasOnlyApprovedImports = true;
  let hasOnlyScenarioImports = true;
  let hasForbiddenLearningModuleSyntax = false;
  let hasLegacyAuthoring = false;
  let hasLegacyTypes = false;
  let hasScenarioReExport = false;
  let hasImportAttributes = false;

  for (const statement of programBody) {
    if (statement.type !== "ImportDeclaration") {
      if (
        statement.type === "ExportNamedDeclaration" ||
        statement.type === "ExportAllDeclaration" ||
        statement.type === "TSExportAssignment" ||
        statement.type === "TSNamespaceExportDeclaration" ||
        statement.type === "TSImportEqualsDeclaration"
      ) {
        hasForbiddenLearningModuleSyntax = true;
      }
      continue;
    }
    const sourceNode = isNode(statement.source) ? statement.source : undefined;
    const moduleName =
      sourceNode?.type === "StringLiteral" && typeof sourceNode.value === "string"
        ? sourceNode.value
        : undefined;
    const specifiers = nodes(statement.specifiers);
    if (LEARNING_VALUE_MODULES.has(moduleName ?? "")) {
      packageImportModules.add(moduleName!);
    }
    const isTypeOnlyDeclaration =
      statement.importKind === "type" ||
      (specifiers.length > 0 && specifiers.every((specifier) =>
        specifier.type === "ImportSpecifier" &&
        specifier.importKind === "type"
      ));
    const isLocalTypeOnlyImport =
      isRelativeModuleName(moduleName) && isTypeOnlyDeclaration;
    if (
      nodes(statement.attributes).length > 0 ||
      nodes(statement.assertions).length > 0
    ) {
      hasImportAttributes = true;
    }
    if (
      !LEARNING_VALUE_MODULES.has(moduleName ?? "") ||
      statement.importKind === "type" ||
      specifiers.length === 0 ||
      nodes(statement.attributes).length > 0 ||
      nodes(statement.assertions).length > 0
    ) {
      hasOnlyApprovedImports = false;
    }
    const hasOnlyAllowedScenarioSpecifiers = specifiers.every((specifier) =>
      specifier.type === "ImportSpecifier" ||
      specifier.type === "ImportNamespaceSpecifier" ||
      (isLocalTypeOnlyImport && specifier.type === "ImportDefaultSpecifier")
    );
    if (
      (!LEARNING_VALUE_MODULES.has(moduleName ?? "") &&
        !isLocalTypeOnlyImport) ||
      specifiers.length === 0 ||
      nodes(statement.attributes).length > 0 ||
      nodes(statement.assertions).length > 0 ||
      !hasOnlyAllowedScenarioSpecifiers
    ) {
      hasOnlyScenarioImports = false;
    }

    for (const specifier of specifiers) {
      const localName = identifierName(specifier.local);
      if (specifier.type === "ImportNamespaceSpecifier") {
        if (localName && LEARNING_VALUE_MODULES.has(moduleName ?? "")) {
          namespaceBindings.add(localName);
          if (moduleName === CORE_MODULE) coreNamespaceBindings.add(localName);
          if (statement.importKind !== "type") {
            valueNamespaceBindings.add(localName);
            if (moduleName === CORE_MODULE) hasCoreValueImport = true;
            if (moduleName === PHYSICS_MODULE) hasPhysicsValueImport = true;
            if (moduleName === WEBGL_MODULE) hasWebGLValueImport = true;
          }
        }
        hasOnlyApprovedImports = false;
        continue;
      }
      if (specifier.type !== "ImportSpecifier") {
        hasOnlyApprovedImports = false;
        continue;
      }
      const importedName = identifierName(specifier.imported);
      if (!localName || !importedName) {
        hasOnlyApprovedImports = false;
        continue;
      }
      if (localName !== importedName) hasOnlyApprovedImports = false;
      if (!LEARNING_VALUE_MODULES.has(moduleName ?? "")) continue;
      const isTypeImport =
        statement.importKind === "type" || specifier.importKind === "type";
      if (moduleName === CORE_MODULE && LEGACY_TYPE_NAMES.has(importedName)) {
        hasLegacyTypes = true;
      }
      if (isTypeImport) continue;
      if (moduleName === CORE_MODULE) {
        hasCoreValueImport = true;
        hasNamedValueCoreImport = true;
      } else if (moduleName === PHYSICS_MODULE) {
        hasPhysicsValueImport = true;
        hasNamedValuePhysicsImport = true;
      } else {
        hasWebGLValueImport = true;
        hasNamedValueWebGLImport = true;
      }
      if (valueImports.has(localName)) hasOnlyApprovedImports = false;
      valueImports.set(localName, importedName);
      if (
        moduleName === CORE_MODULE &&
        LEGACY_AUTHORING_NAMES.has(importedName)
      ) {
        hasLegacyAuthoring = true;
      }
    }
  }

  let hasCreateElementCall = false;
  let hasBindingViolation = false;
  let hasCommonJsSyntax = false;
  let hasDirectComponentCall = false;
  let hasDynamicImportExpression = false;
  let hasExportAssignment = false;
  let hasImportEquals = false;
  let hasImportMeta = false;
  let hasInvalidCreateElementCallForm = false;
  let hasJsx = false;
  let hasLegacyLayerRender = false;
  let hasLegacyTextStyle = false;
  let hasNamespaceExport = false;
  let hasOrbitHandlersSpread = false;
  let hasTestScaffolding = false;
  let hasUninspectableProps = false;
  let hasUninspectableLegacySensitiveProps = false;
  let hasTypeImport = false;
  const importedValueNames = new Set(valueImports.keys());
  const bindingShadows = collectBindingShadows(
    file,
    new Set([...importedValueNames, ...namespaceBindings]),
  );
  const resolveCoreValue = (value: unknown) => resolvedCoreValueName(
    value,
    valueImports,
    valueNamespaceBindings,
    bindingShadows,
  );

  const inspectCreateElementArguments = (argumentsValue: unknown): void => {
    const args = nodes(argumentsValue);
    const componentName = resolveCoreValue(args[0]);
    const props = args[1];
    if (
      !props ||
      (props.type !== "NullLiteral" && !isInspectableObject(props))
    ) {
      hasUninspectableProps = true;
    }
    if (isInspectableObject(props)) {
      const style = objectPropertyValue(props, "style");
      if (style !== undefined && !isInspectableObject(style)) {
        hasUninspectableProps = true;
      }
    }
    if (componentName === "Text") {
      if (!isInspectableObject(props)) {
        hasUninspectableLegacySensitiveProps = true;
      }
      const style = objectPropertyValue(props, "style");
      if (style !== undefined && !isInspectableObject(style)) {
        hasUninspectableLegacySensitiveProps = true;
      }
      hasLegacyTextStyle =
        hasLegacyTextStyle ||
        objectHasProperty(props, "text") ||
        objectHasProperty(style, "text");
    }
    if (componentName === "Layer") {
      if (!isInspectableObject(props)) {
        hasUninspectableLegacySensitiveProps = true;
      }
      hasLegacyLayerRender =
        hasLegacyLayerRender || objectHasProperty(props, "render");
    }
  };

  walk(file, (node) => {
    if (
      node.type === "ExportAllDeclaration" ||
      (node.type === "ExportNamedDeclaration" && isNode(node.source))
    ) {
      hasScenarioReExport = true;
    }
    if (node.type === "TSExportAssignment") {
      hasExportAssignment = true;
      hasForbiddenLearningModuleSyntax = true;
    }
    if (node.type === "TSImportEqualsDeclaration") {
      hasImportEquals = true;
      hasForbiddenLearningModuleSyntax = true;
    }
    if (node.type === "TSNamespaceExportDeclaration") {
      hasNamespaceExport = true;
      hasForbiddenLearningModuleSyntax = true;
    }
    if (node.type === "JSXElement" || node.type === "JSXFragment") hasJsx = true;
    const invocationTarget =
      node.type === "TaggedTemplateExpression"
        ? node.tag
        : node.type === "CallExpression" ||
            node.type === "OptionalCallExpression" ||
            node.type === "NewExpression"
          ? node.callee
          : undefined;
    const invokedCoreName = resolveCoreValue(invocationTarget);
    if (
      invokedCoreName !== undefined &&
      DESCRIPTIVE_COMPONENT_EXPORTS.has(invokedCoreName)
    ) {
      hasDirectComponentCall = true;
    }
    if (invokedCoreName === "createElement") {
      hasCreateElementCall = true;
      if (node.type !== "CallExpression") {
        hasInvalidCreateElementCallForm = true;
      }
      if (node.type !== "TaggedTemplateExpression") {
        inspectCreateElementArguments(node.arguments);
      }
    }
    if (
      declaresBindingNamed(node, importedValueNames) ||
      assignsBindingNamed(node, importedValueNames)
    ) {
      hasBindingViolation = true;
    }
    if (node.type === "ImportExpression") {
      hasDynamicImportExpression = true;
    }
    if (node.type === "TSImportType") {
      hasTypeImport = true;
    }
    if (
      node.type === "MetaProperty" &&
      identifierName(node.meta) === "import" &&
      identifierName(node.property) === "meta"
    ) {
      hasForbiddenLearningModuleSyntax = true;
      hasImportMeta = true;
    }
    if (
      node.type === "CallExpression" &&
      isNode(node.callee) &&
      node.callee.type === "Import"
    ) {
      hasDynamicImportExpression = true;
    }

    const memberName = resolveCoreValue(node);
    if (memberName && LEGACY_AUTHORING_NAMES.has(memberName)) {
      hasLegacyAuthoring = true;
    }
    const namespaceTypeName = resolvedCoreNamespaceTypeName(
      node,
      coreNamespaceBindings,
      bindingShadows,
    );
    if (namespaceTypeName && LEGACY_TYPE_NAMES.has(namespaceTypeName)) {
      hasLegacyTypes = true;
    }
    if (node.type === "Identifier" && node.name === "SOURCE_ID") {
      hasTestScaffolding = true;
    }

    if (node.type === "JSXElement") {
      const opening = isNode(node.openingElement) ? node.openingElement : undefined;
      if (!opening) return;
      const componentName = resolveCoreValue(opening.name);
      const spreadAttributes = nodes(opening.attributes).filter(
        (attribute) => attribute.type === "JSXSpreadAttribute",
      );
      const orbitHandlerSpreads = spreadAttributes.filter(isOrbitHandlersSpread);
      if (
        spreadAttributes.length !== orbitHandlerSpreads.length ||
        (orbitHandlerSpreads.length > 0 && componentName !== "Group")
      ) {
        hasUninspectableProps = true;
      }
      if (orbitHandlerSpreads.length > 0 && componentName === "Group") {
        hasOrbitHandlersSpread = true;
      }
      const styleAttribute = jsxAttribute(opening, "style");
      const style = jsxAttributeExpression(styleAttribute);
      if (
        componentName !== undefined &&
        styleAttribute !== undefined &&
        !isInspectableObject(style)
      ) {
        hasUninspectableProps = true;
      }
      if (componentName === "Text") {
        if (
          nodes(opening.attributes).some(
            (attribute) => attribute.type === "JSXSpreadAttribute",
          ) ||
          (styleAttribute !== undefined && !isInspectableObject(style))
        ) {
          hasUninspectableLegacySensitiveProps = true;
        }
        hasLegacyTextStyle =
          hasLegacyTextStyle ||
          jsxAttribute(opening, "text") !== undefined ||
          objectHasProperty(style, "text");
      }
      if (componentName === "Layer") {
        if (
          nodes(opening.attributes).some(
            (attribute) => attribute.type === "JSXSpreadAttribute",
          )
        ) {
          hasUninspectableLegacySensitiveProps = true;
        }
        hasLegacyLayerRender =
          hasLegacyLayerRender || jsxAttribute(opening, "render") !== undefined;
      }
    }

    if (node.type !== "CallExpression") return;
    const calleeName = identifierName(node.callee);
    if (
      calleeName === "describe" ||
      calleeName === "expect" ||
      calleeName === "it" ||
      calleeName === "test"
    ) {
      hasTestScaffolding = true;
    }
    const importedCallee = calleeName ? valueImports.get(calleeName) : undefined;
    if (calleeName && LEGACY_AUTHORING_NAMES.has(importedCallee ?? "")) {
      hasLegacyAuthoring = true;
    }
    const memberCallee = resolveCoreValue(node.callee);
    if (memberCallee && LEGACY_AUTHORING_NAMES.has(memberCallee)) {
      hasLegacyAuthoring = true;
    }
  });

  walkWithParent(file, undefined, (node, parent) => {
    const name = identifierName(node);
    // Learning sources keep core bindings visibly direct. Rejecting every other
    // value position also rejects aliases and every lexical shadow without
    // guessing which same-named identifier a later call intended to use.
    if (
      name !== undefined &&
      importedValueNames.has(name) &&
      !isApprovedCoreReference(node, parent, valueImports)
    ) {
      hasBindingViolation = true;
    }
    if (
      isCommonJsExecutableReference(node, parent) ||
      isCommonJsGlobalAccess(node)
    ) {
      hasCommonJsSyntax = true;
    }
  });

  return {
    hasBindingViolation,
    hasCanonicalMount: isCanonicalMount(programBody),
    hasCommonJsSyntax,
    hasCoreValueImport,
    hasPhysicsValueImport,
    hasWebGLValueImport,
    hasCreateElementCall,
    hasDirectComponentCall,
    hasDynamicImportExpression,
    hasExportAssignment,
    hasForbiddenLearningModuleSyntax,
    hasImportAttributes,
    hasImportEquals,
    hasImportMeta,
    hasInvalidCreateElementCallForm,
    hasJsx,
    hasLegacyAuthoring,
    hasLegacyLayerRender,
    hasLegacyTextStyle,
    hasLegacyTypes,
    hasNamedValueCoreImport,
    hasNamedValuePhysicsImport,
    hasNamedValueWebGLImport,
    hasNamespaceExport,
    hasOnlyApprovedImports,
    hasOnlyScenarioImports,
    hasOrbitHandlersSpread,
    hasScenarioReExport,
    hasTestScaffolding,
    hasUninspectableProps,
    hasUninspectableLegacySensitiveProps,
    hasTypeImport,
    packageImportModules: [...packageImportModules].sort(),
  };
}

export function learningSourceContainsJsx(source: string): boolean {
  return inspectSource(source, "Learning source").hasJsx;
}

export function validateScenarioSourceText(
  source: string,
  label: string,
): void {
  const inspection = inspectSource(source, label);
  if (inspection.hasImportAttributes) {
    throw invalid(label, "must not use import attributes or assertions.");
  }
  if (inspection.hasDynamicImportExpression) {
    throw invalid(
      label,
      "must not use dynamic import expressions; use supported static imports.",
    );
  }
  if (inspection.hasTypeImport) {
    throw invalid(
      label,
      "must not use TypeScript import types; use static type-only imports.",
    );
  }
  if (inspection.hasImportMeta) {
    throw invalid(label, "must not use import.meta module access.");
  }
  if (inspection.hasImportEquals) {
    throw invalid(
      label,
      "must not use TypeScript import-equals declarations; use supported static imports.",
    );
  }
  if (inspection.hasExportAssignment) {
    throw invalid(label, "must not use TypeScript export assignments.");
  }
  if (inspection.hasNamespaceExport) {
    throw invalid(
      label,
      "must not use TypeScript export as namespace declarations.",
    );
  }
  if (inspection.hasCommonJsSyntax) {
    throw invalid(label, "must not use CommonJS module loading or exports.");
  }
  if (inspection.hasScenarioReExport) {
    throw invalid(
      label,
      "must not re-export local, external, @crc/core, or @crc/webgl modules.",
    );
  }
  if (!inspection.hasCoreValueImport || !inspection.hasOnlyScenarioImports) {
    throw invalid(
      label,
      "must use supported static imports: named or namespace imports from @crc/core and @crc/webgl, relative type-only imports, and at least one public @crc/core value.",
    );
  }
  if (inspection.hasLegacyTypes) {
    throw invalid(label, "imports obsolete component types.");
  }
  if (inspection.hasLegacyAuthoring) {
    throw invalid(label, "imports or calls legacy component authoring.");
  }
  if (inspection.hasDirectComponentCall) {
    throw invalid(
      label,
      "must construct descriptive CRC components with JSX or createElement, not direct calls.",
    );
  }
  if (inspection.hasLegacyTextStyle) {
    throw invalid(label, "uses the legacy Text style.text contract.");
  }
  if (inspection.hasLegacyLayerRender) {
    throw invalid(label, "uses the legacy Layer render prop.");
  }
  if (inspection.hasUninspectableLegacySensitiveProps) {
    throw invalid(
      label,
      "must use inspectable Text styles and inspectable Layer props so obsolete fields cannot be hidden.",
    );
  }
  if (!inspection.hasJsx) {
    throw invalid(label, "must use descriptive JSX.");
  }
}

export function validateLearningSourceText(
  source: string,
  contract: LearningSourceContract,
): void {
  const { authoring, label, sourcePath } = contract;
  const inspection = inspectSource(source, label);
  const isWebGLLesson =
    sourcePath === WEBGL_ISLAND_LEARNING_SOURCE_PATH ||
    sourcePath?.startsWith(WEBGL_LIGHTING_LEARNING_SOURCE_DIRECTORY) === true ||
    (sourcePath === undefined &&
      (label === "webgl-islands" ||
        label === 'Learning example "webgl-islands"'));
  const isPhysicsLesson =
    sourcePath === PHYSICS_LEARNING_SOURCE_PATH ||
    (sourcePath === undefined &&
      (label === "physics-2d" ||
        label === 'Learning example "physics-2d"'));
  const hasExactPackageImports = isWebGLLesson
    ? inspection.hasNamedValueCoreImport &&
      inspection.hasNamedValueWebGLImport &&
      !inspection.hasNamedValuePhysicsImport &&
      inspection.packageImportModules.length === 2
    : isPhysicsLesson
      ? inspection.hasNamedValueCoreImport &&
        inspection.hasNamedValuePhysicsImport &&
        !inspection.hasNamedValueWebGLImport &&
        inspection.packageImportModules.length === 2
      : inspection.hasNamedValueCoreImport &&
        !inspection.hasNamedValuePhysicsImport &&
        !inspection.hasNamedValueWebGLImport &&
        inspection.packageImportModules.length === 1;
  if (!inspection.hasOnlyApprovedImports || !hasExactPackageImports) {
    throw invalid(
      label,
      isWebGLLesson
        ? "must use direct, unaliased static named value imports from both @crc/core and @crc/webgl."
        : isPhysicsLesson
          ? "must use direct, unaliased static named value imports from both @crc/core and @crc/physics/2d."
          : "must use direct, unaliased static named imports only from @crc/core, including at least one value import.",
    );
  }
  if (
    inspection.hasDynamicImportExpression ||
    inspection.hasTypeImport ||
    inspection.hasForbiddenLearningModuleSyntax
  ) {
    throw invalid(
      label,
      "must not use dynamic imports, import.meta, import-equals, or named re-exports.",
    );
  }
  if (inspection.hasCommonJsSyntax) {
    throw invalid(label, "must not use CommonJS module loading or exports.");
  }
  if (!inspection.hasCanonicalMount) {
    throw invalid(label, "must export the canonical mount(canvas) contract.");
  }
  if (inspection.hasBindingViolation) {
    throw invalid(
      label,
      isWebGLLesson
        ? "must use direct @crc/core and @crc/webgl bindings without aliases, reassignment, or shadowing."
        : isPhysicsLesson
          ? "must use direct @crc/core and @crc/physics/2d bindings without aliases, reassignment, or shadowing."
          : "must use direct @crc/core bindings without aliases, reassignment, or shadowing.",
    );
  }
  if (inspection.hasTestScaffolding) {
    throw invalid(label, "contains test or source-marker scaffolding.");
  }
  if (inspection.hasLegacyAuthoring) {
    throw invalid(label, "imports or calls legacy component authoring.");
  }
  if (inspection.hasDirectComponentCall) {
    throw invalid(
      label,
      "must construct descriptive CRC components with JSX or createElement, not direct calls.",
    );
  }
  if (inspection.hasLegacyTextStyle) {
    throw invalid(label, "uses the legacy Text style.text contract.");
  }
  if (inspection.hasLegacyLayerRender) {
    throw invalid(label, "uses the legacy Layer render prop.");
  }
  if (
    inspection.hasUninspectableProps ||
    (inspection.hasOrbitHandlersSpread &&
      sourcePath?.startsWith(WEBGL_LIGHTING_LEARNING_SOURCE_DIRECTORY) !== true)
  ) {
    throw invalid(
      label,
      "must use inline object props and inline style objects without spreads.",
    );
  }

  if (authoring === "createElement") {
    if (!inspection.hasCreateElementCall || inspection.hasJsx) {
      throw invalid(label, "must use only createElement without JSX.");
    }
  } else if (authoring === "jsx") {
    if (!inspection.hasJsx || inspection.hasCreateElementCall) {
      throw invalid(label, "must use only JSX without createElement.");
    }
  } else {
    throw invalid(label, "must select a supported authoring mode.");
  }
  if (inspection.hasInvalidCreateElementCallForm) {
    throw invalid(
      label,
      "must invoke imported createElement with a normal CallExpression.",
    );
  }
}

const DIAGRAM_EDITOR_BASE_DECLARATIONS = [
  "NodeId",
  "DiagramNode",
  "DiagramEdge",
  "ViewTransform",
  "INITIAL_NODES",
  "EDGES",
  "INITIAL_VIEW",
  "WORKSPACE_TOP",
  "WORKSPACE_HEIGHT",
  "NODE_WIDTH",
  "NODE_HEIGHT",
  "NodeCard",
  "Connection",
  "DiagramEditor",
  "connectionPath",
  "arrowheadPath",
] as const;

function topLevelDeclarationNames(sourceFile: SyntaxNode): Set<string> {
  const program = isNode(sourceFile.program) ? sourceFile.program : undefined;
  const names = new Set<string>();
  for (const statement of nodes(program?.body)) {
    if (
      statement.type === "FunctionDeclaration" ||
      statement.type === "TSInterfaceDeclaration" ||
      statement.type === "TSTypeAliasDeclaration"
    ) {
      const name = identifierName(statement.id);
      if (name) names.add(name);
      continue;
    }
    if (statement.type !== "VariableDeclaration") continue;
    for (const declaration of nodes(statement.declarations)) {
      const name = identifierName(declaration.id);
      if (name) names.add(name);
    }
  }
  return names;
}

function topLevelFunction(
  sourceFile: SyntaxNode,
  name: string,
): SyntaxNode | undefined {
  const program = isNode(sourceFile.program) ? sourceFile.program : undefined;
  return nodes(program?.body).find(
    (statement) =>
      statement.type === "FunctionDeclaration" &&
      identifierName(statement.id) === name,
  );
}

function callsIdentifier(node: SyntaxNode | undefined, name: string): boolean {
  let found = false;
  if (!node) return found;
  walk(node, (candidate) => {
    if (
      candidate.type === "CallExpression" &&
      identifierName(candidate.callee) === name
    ) {
      found = true;
    }
  });
  return found;
}

function hasJsxEventProp(
  sourceFile: SyntaxNode,
  elementName: string,
  propName: string,
): boolean {
  let found = false;
  walk(sourceFile, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    if (propertyName(node.name) !== elementName) return;
    if (
      nodes(node.attributes).some(
        (attribute) =>
          attribute.type === "JSXAttribute" &&
          propertyName(attribute.name) === propName,
      )
    ) {
      found = true;
    }
  });
  return found;
}

function hasDuplicatedClickAndPointerDown(
  sourceFile: SyntaxNode | undefined,
): boolean {
  let found = false;
  if (!sourceFile) return found;
  walk(sourceFile, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    const names = new Set(
      nodes(node.attributes)
        .filter((attribute) => attribute.type === "JSXAttribute")
        .map((attribute) => propertyName(attribute.name)),
    );
    if (names.has("onClick") && names.has("onPointerDown")) found = true;
  });
  return found;
}

export function validateDiagramEditorTutorialSourceText(
  source: string,
  contract: Readonly<{ chapter: number; label: string }>,
): void {
  const { chapter, label } = contract;
  if (!Number.isInteger(chapter) || chapter < 4 || chapter > 12) {
    throw invalid(
      label,
      "must identify a diagram-editor chapter from 4 through 12.",
    );
  }
  const sourceFile = parseSource(source, label);
  const declarationNames = topLevelDeclarationNames(sourceFile);
  const required = [
    ...DIAGRAM_EDITOR_BASE_DECLARATIONS,
    ...(chapter >= 5 ? ["Toolbar", "Workspace", "StatusBar"] : []),
    ...(chapter >= 7 ? ["NodeDragSession", "rootToWorkspace"] : []),
    ...(chapter >= 8 ? ["PanSession", "zoomAroundPoint"] : []),
    ...(chapter >= 7 && chapter <= 10 ? ["NodePointerHandlers"] : []),
    ...(chapter >= 8 && chapter <= 10 ? ["GestureSession"] : []),
    ...(chapter === 12 ? ["GridLayer", "FocusRing", "updateNodePosition"] : []),
  ];
  const missing = required.filter((name) => !declarationNames.has(name));
  if (missing.length > 0) {
    throw invalid(
      label,
      `must preserve the cumulative diagram-editor vocabulary; missing ${missing.join(", ")}.`,
    );
  }

  const parallelVocabulary = [
    "Node",
    "Edge",
    "View",
    "Drag",
    "Pan",
    "Gesture",
    "NodeHandlers",
    "NODES",
    "WIDTH",
    "HEIGHT",
    "Card",
    "Status",
    "Editor",
    "toWorkspace",
    "zoomAround",
    "curve",
    "arrow",
  ].filter((name) => declarationNames.has(name));
  if (parallelVocabulary.length > 0) {
    throw invalid(
      label,
      `must not introduce parallel tutorial vocabulary: ${parallelVocabulary.join(", ")}.`,
    );
  }

  if (
    source.includes("crcEventListener") ||
    source.includes("crcWhenChanged")
  ) {
    throw invalid(
      label,
      "must use direct structural event props and component-owned teardown.",
    );
  }
  const wheelOwner =
    chapter === 8 ? "Group" : chapter >= 9 ? "Clip" : undefined;
  if (wheelOwner && !hasJsxEventProp(sourceFile, wheelOwner, "onWheel")) {
    throw invalid(label, `must put onWheel directly on ${wheelOwner}.`);
  }
  if (
    chapter >= 8 &&
    chapter <= 10 &&
    hasDuplicatedClickAndPointerDown(topLevelFunction(sourceFile, "Toolbar"))
  ) {
    throw invalid(label, "must not duplicate a click action on pointerdown.");
  }

  if (chapter >= 11) {
    const nodeCard = topLevelFunction(sourceFile, "NodeCard");
    const workspace = topLevelFunction(sourceFile, "Workspace");
    const editor = topLevelFunction(sourceFile, "DiagramEditor");
    if (
      !callsIdentifier(nodeCard, "crcRef") ||
      !callsIdentifier(nodeCard, "crcState") ||
      !callsIdentifier(workspace, "crcRef") ||
      !callsIdentifier(workspace, "crcState") ||
      callsIdentifier(editor, "crcRef")
    ) {
      throw invalid(
        label,
        "must keep drag ownership in NodeCard, pan ownership in Workspace, and no gesture ref in DiagramEditor.",
      );
    }
  }
}
