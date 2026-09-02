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
  readonly hasCreateElementCall: boolean;
  readonly hasDynamicImport: boolean;
  readonly hasJsx: boolean;
  readonly hasLegacyAuthoring: boolean;
  readonly hasLegacyLayerRender: boolean;
  readonly hasLegacyTextStyle: boolean;
  readonly hasNamedValueCoreImport: boolean;
  readonly hasOnlyApprovedImports: boolean;
  readonly hasCanonicalMount: boolean;
  readonly hasTestScaffolding: boolean;
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
  if (!isNode(value)) return undefined;
  if (
    (value.type === "Identifier" || value.type === "JSXIdentifier") &&
    typeof value.name === "string"
  ) {
    return value.name;
  }
  if (value.type === "StringLiteral" && typeof value.value === "string") {
    return value.value;
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
      (property.type === "ObjectProperty" || property.type === "ObjectMethod") &&
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
  let hasLegacyAuthoring = false;

  for (const statement of programBody) {
    if (statement.type !== "ImportDeclaration") continue;
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
        if (localName) namespaceBindings.add(localName);
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
      if (specifier.importKind === "type") continue;
      hasNamedValueCoreImport = moduleName === "@crc/core";
      if (valueImports.has(localName)) hasOnlyApprovedImports = false;
      valueImports.set(localName, importedName);
      if (
        LEGACY_AUTHORING_NAMES.has(importedName) ||
        LEGACY_AUTHORING_NAMES.has(localName)
      ) {
        hasLegacyAuthoring = true;
      }
    }
  }

  let hasCreateElementCall = false;
  let hasDynamicImport = false;
  let hasJsx = false;
  let hasLegacyLayerRender = false;
  let hasLegacyTextStyle = false;
  let hasTestScaffolding = false;

  walk(file, (node) => {
    if (node.type === "JSXElement" || node.type === "JSXFragment") hasJsx = true;
    if (node.type === "ImportExpression" || node.type === "TSImportType") {
      hasDynamicImport = true;
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
      const localName = propertyName(opening.name);
      const componentName =
        (localName ? valueImports.get(localName) : undefined) ??
        resolvedMemberName(opening.name, namespaceBindings);
      if (componentName === "Text") {
        const style = jsxAttributeExpression(jsxAttribute(opening, "style"));
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
    if (importedCallee !== "createElement") return;
    hasCreateElementCall = true;
    const args = nodes(node.arguments);
    const componentLocalName = identifierName(args[0]);
    const componentName =
      (componentLocalName ? valueImports.get(componentLocalName) : undefined) ??
      resolvedMemberName(args[0], namespaceBindings);
    const props = args[1];
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
  });

  return {
    hasCanonicalMount: isCanonicalMount(programBody),
    hasCreateElementCall,
    hasDynamicImport,
    hasJsx,
    hasLegacyAuthoring,
    hasLegacyLayerRender,
    hasLegacyTextStyle,
    hasNamedValueCoreImport,
    hasOnlyApprovedImports,
    hasTestScaffolding,
  };
}

export function learningSourceContainsJsx(source: string): boolean {
  return inspectSource(source, "Learning source").hasJsx;
}

export function validateLearningSourceText(
  source: string,
  contract: LearningSourceContract,
): void {
  const { authoring, label } = contract;
  const inspection = inspectSource(source, label);
  if (
    !inspection.hasNamedValueCoreImport ||
    !inspection.hasOnlyApprovedImports ||
    inspection.hasDynamicImport
  ) {
    throw invalid(
      label,
      "must use static named imports only from @crc/core, including at least one value import.",
    );
  }
  if (!inspection.hasCanonicalMount) {
    throw invalid(label, "must export the canonical mount(canvas) contract.");
  }
  if (inspection.hasTestScaffolding) {
    throw invalid(label, "contains test or source-marker scaffolding.");
  }
  if (inspection.hasLegacyAuthoring) {
    throw invalid(label, "imports or calls legacy component authoring.");
  }
  if (inspection.hasLegacyTextStyle) {
    throw invalid(label, "uses the legacy Text style.text contract.");
  }
  if (inspection.hasLegacyLayerRender) {
    throw invalid(label, "uses the legacy Layer render prop.");
  }

  if (authoring === "createElement") {
    if (!inspection.hasCreateElementCall || inspection.hasJsx) {
      throw invalid(label, "must use only createElement without JSX.");
    }
  } else if (authoring !== "jsx" || !inspection.hasJsx) {
    throw invalid(label, "must contain descriptive JSX.");
  }
}
