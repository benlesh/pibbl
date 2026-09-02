import { parse } from "@babel/parser";

export type LearningSourceAuthoring = "jsx" | "createElement";

export interface LearningSourceContract {
  readonly authoring: LearningSourceAuthoring;
  readonly label: string;
}

interface SyntaxNode {
  readonly type: string;
  readonly [key: string]: unknown;
}

interface SourceInspection {
  readonly hasBindingViolation: boolean;
  readonly hasCommonJsSyntax: boolean;
  readonly hasCreateElementCall: boolean;
  readonly hasDirectComponentCall: boolean;
  readonly hasDynamicImport: boolean;
  readonly hasForbiddenModuleSyntax: boolean;
  readonly hasInvalidCreateElementCallForm: boolean;
  readonly hasJsx: boolean;
  readonly hasLegacyAuthoring: boolean;
  readonly hasLegacyLayerRender: boolean;
  readonly hasLegacyTextStyle: boolean;
  readonly hasNamedValueCoreImport: boolean;
  readonly hasOnlyApprovedImports: boolean;
  readonly hasCanonicalMount: boolean;
  readonly hasTestScaffolding: boolean;
  readonly hasUninspectableProps: boolean;
}

const LEGACY_AUTHORING_NAMES = new Set([
  "defineComp",
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
  "withFocusManagement",
  "withKeyboardNavigation",
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

function parseSource(source: string, label: string): SyntaxNode {
  try {
    return parse(source, {
      createImportExpressions: true,
      plugins: ["typescript", "jsx"],
      sourceType: "module",
    }) as unknown as SyntaxNode;
  } catch {
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

function resolvedMemberName(
  value: unknown,
  namespaceBindings: ReadonlySet<string>,
): string | undefined {
  if (!isNode(value)) return undefined;
  if (value.type === "MemberExpression" || value.type === "OptionalMemberExpression") {
    const object = identifierName(value.object);
    if (!object || !namespaceBindings.has(object)) return undefined;
    return propertyName(value.property);
  }
  if (value.type === "JSXMemberExpression") {
    const object = propertyName(value.object);
    if (!object || !namespaceBindings.has(object)) return undefined;
    return propertyName(value.property);
  }
  return undefined;
}

function inspectSource(source: string, label: string): SourceInspection {
  const file = parseSource(source, label);
  const program = isNode(file.program) ? file.program : undefined;
  const programBody = nodes(program?.body);
  const valueImports = new Map<string, string>();
  const namespaceBindings = new Set<string>();
  let hasNamedValueCoreImport = false;
  let hasOnlyApprovedImports = true;
  let hasForbiddenModuleSyntax = false;
  let hasLegacyAuthoring = false;

  for (const statement of programBody) {
    if (statement.type !== "ImportDeclaration") {
      if (
        statement.type === "ExportNamedDeclaration" ||
        statement.type === "ExportAllDeclaration" ||
        statement.type === "TSExportAssignment" ||
        statement.type === "TSNamespaceExportDeclaration" ||
        statement.type === "TSImportEqualsDeclaration"
      ) {
        hasForbiddenModuleSyntax = true;
      }
      continue;
    }
    const sourceNode = isNode(statement.source) ? statement.source : undefined;
    const moduleName =
      sourceNode?.type === "StringLiteral" && typeof sourceNode.value === "string"
        ? sourceNode.value
        : undefined;
    const specifiers = nodes(statement.specifiers);
    if (
      moduleName !== "@crc/core" ||
      statement.importKind === "type" ||
      specifiers.length === 0 ||
      nodes(statement.attributes).length > 0 ||
      nodes(statement.assertions).length > 0
    ) {
      hasOnlyApprovedImports = false;
    }

    for (const specifier of specifiers) {
      const localName = identifierName(specifier.local);
      if (specifier.type === "ImportNamespaceSpecifier") {
        if (localName && moduleName === "@crc/core") {
          namespaceBindings.add(localName);
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
      if (specifier.importKind === "type") continue;
      if (moduleName !== "@crc/core") continue;
      hasNamedValueCoreImport = true;
      if (valueImports.has(localName)) hasOnlyApprovedImports = false;
      valueImports.set(localName, importedName);
      if (LEGACY_AUTHORING_NAMES.has(importedName)) {
        hasLegacyAuthoring = true;
      }
    }
  }

  let hasCreateElementCall = false;
  let hasBindingViolation = false;
  let hasCommonJsSyntax = false;
  let hasDirectComponentCall = false;
  let hasDynamicImport = false;
  let hasInvalidCreateElementCallForm = false;
  let hasJsx = false;
  let hasLegacyLayerRender = false;
  let hasLegacyTextStyle = false;
  let hasTestScaffolding = false;
  let hasUninspectableProps = false;
  const importedValueNames = new Set(valueImports.keys());

  const inspectCreateElementArguments = (argumentsValue: unknown): void => {
    const args = nodes(argumentsValue);
    const componentLocalName = identifierName(args[0]);
    const componentName =
      (componentLocalName ? valueImports.get(componentLocalName) : undefined) ??
      resolvedMemberName(args[0], namespaceBindings);
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
      hasLegacyTextStyle =
        hasLegacyTextStyle ||
        objectHasProperty(props, "text") ||
        objectHasProperty(objectPropertyValue(props, "style"), "text");
    }
    if (componentName === "Layer") {
      hasLegacyLayerRender =
        hasLegacyLayerRender || objectHasProperty(props, "render");
    }
  };

  walk(file, (node) => {
    if (node.type === "JSXElement" || node.type === "JSXFragment") hasJsx = true;
    const invocationTarget =
      node.type === "TaggedTemplateExpression"
        ? node.tag
        : node.type === "CallExpression" ||
            node.type === "OptionalCallExpression" ||
            node.type === "NewExpression"
          ? node.callee
          : undefined;
    const invocationLocalName = identifierName(invocationTarget);
    const invokedCoreName = invocationLocalName
      ? valueImports.get(invocationLocalName)
      : undefined;
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
    if (node.type === "ImportExpression" || node.type === "TSImportType") {
      hasDynamicImport = true;
    }
    if (
      node.type === "MetaProperty" &&
      identifierName(node.meta) === "import" &&
      identifierName(node.property) === "meta"
    ) {
      hasForbiddenModuleSyntax = true;
    }
    if (
      node.type === "CallExpression" &&
      isNode(node.callee) &&
      node.callee.type === "Import"
    ) {
      hasDynamicImport = true;
    }

    const memberName = resolvedMemberName(node, namespaceBindings);
    if (memberName && LEGACY_AUTHORING_NAMES.has(memberName)) {
      hasLegacyAuthoring = true;
    }
    if (node.type === "Identifier" && node.name === "SOURCE_ID") {
      hasTestScaffolding = true;
    }

    if (node.type === "JSXElement") {
      const opening = isNode(node.openingElement) ? node.openingElement : undefined;
      if (!opening) return;
      if (
        nodes(opening.attributes).some(
          (attribute) => attribute.type === "JSXSpreadAttribute",
        )
      ) {
        hasUninspectableProps = true;
      }
      const localName = propertyName(opening.name);
      const componentName =
        (localName ? valueImports.get(localName) : undefined) ??
        resolvedMemberName(opening.name, namespaceBindings);
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
        hasLegacyTextStyle =
          hasLegacyTextStyle ||
          jsxAttribute(opening, "text") !== undefined ||
          objectHasProperty(style, "text");
      }
      if (componentName === "Layer") {
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
    const memberCallee = resolvedMemberName(node.callee, namespaceBindings);
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
    hasCreateElementCall,
    hasDirectComponentCall,
    hasDynamicImport,
    hasForbiddenModuleSyntax,
    hasInvalidCreateElementCallForm,
    hasJsx,
    hasLegacyAuthoring,
    hasLegacyLayerRender,
    hasLegacyTextStyle,
    hasNamedValueCoreImport,
    hasOnlyApprovedImports,
    hasTestScaffolding,
    hasUninspectableProps,
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
  if (!inspection.hasNamedValueCoreImport) {
    throw invalid(label, "must import public values from @crc/core.");
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
  if (!inspection.hasJsx) {
    throw invalid(label, "must use descriptive JSX.");
  }
}

export function validateLearningSourceText(
  source: string,
  contract: LearningSourceContract,
): void {
  const { authoring, label } = contract;
  const inspection = inspectSource(source, label);
  if (
    !inspection.hasNamedValueCoreImport ||
    !inspection.hasOnlyApprovedImports
  ) {
    throw invalid(
      label,
      "must use direct, unaliased static named imports only from @crc/core, including at least one value import.",
    );
  }
  if (inspection.hasDynamicImport || inspection.hasForbiddenModuleSyntax) {
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
      "must use direct @crc/core bindings without aliases, reassignment, or shadowing.",
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
  if (inspection.hasUninspectableProps) {
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
