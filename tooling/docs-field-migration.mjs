import assert from "node:assert/strict";
import { parse } from "@babel/parser";

export const LEGACY_FIELD_TYPE_COMMIT =
  "3d74fc034820adcc407199e07ebf74bcb1f58970";

const finalComponents = new Map([
  ["rect", "Rectangle"],
  ["path", "Path"],
  ["line", "Line"],
  ["horizontalLine", "HorizontalLine"],
  ["verticalLine", "VerticalLine"],
  ["svgPath", "SvgPath"],
  ["text", "Text"],
  ["img", "Image"],
  ["g", "Group"],
  ["clip", "Clip"],
  ["layer", "Layer"],
]);

const renamedFields = new Map([
  ["fillStyle", "fill"],
  ["strokeStyle", "stroke"],
  ["lineWidth", "strokeWidth"],
  ["alpha", "opacity"],
  ["path", "d"],
  ["left", "x1"],
  ["right", "x2"],
  ["top", "y1"],
  ["bottom", "y2"],
  ["maxWidth", "width"],
  ["maxHeight", "height"],
  ["wordWrap", "wrap"],
  ["overflow", "fit"],
  ["rotate", "rotationDegrees"],
  ["rotateOrigin", "rotationOrigin"],
]);

const componentSpecificRenames = new Map([
  ["g\0x", "translateX"],
  ["g\0y", "translateY"],
]);

const expandedBaselineFields = new Map([
  // The reviewed baseline's Text row says "paint/cursor fields". These are
  // the exact shared top-level fields named by the surrounding migration rows.
  ["text", ["fillStyle", "strokeStyle", "lineWidth", "alpha", "cursor"]],
]);

const expectedBehaviorByIdentity = new Map([
  ["rect\0x", "Optional; defaults to `0`"],
  ["rect\0y", "Optional; defaults to `0`"],
  ["rect\0width", "Required"],
  ["rect\0height", "Required"],
  ["rect\0fillStyle", "Same fill value"],
  ["rect\0strokeStyle", "Same stroke value"],
  ["rect\0lineWidth", "Same stroke width"],
  ["rect\0alpha", "Multiplies the current Canvas alpha"],
  ["rect\0cursor", "Same cursor value"],
  ["rect\0alignToPixelGrid", "Omission preserves exact input geometry"],
  ["path\0path", "Required `Path2D`"],
  ["path\0fillStyle", "Same fill value"],
  ["path\0strokeStyle", "Same stroke value"],
  ["path\0lineWidth", "Same stroke width"],
  ["path\0alpha", "Multiplies the current Canvas alpha"],
  ["path\0cursor", "Same cursor value"],
  [
    "path\0lineInteractionWidth",
    "Defaults to `style.strokeWidth`, then `0`",
  ],
  ["line\0coords", "Required ordered polyline coordinates"],
  ["line\0strokeStyle", "Same stroke value"],
  ["line\0lineWidth", "Same stroke width"],
  ["line\0cursor", "Same cursor value"],
  [
    "line\0lineInteractionWidth",
    "Defaults to `style.strokeWidth`, then `0`",
  ],
  ["horizontalLine\0y", "Required"],
  ["horizontalLine\0left", "Optional; defaults to `0`"],
  [
    "horizontalLine\0right",
    "Optional; defaults to the allocation width",
  ],
  ["horizontalLine\0strokeStyle", "Same stroke value"],
  ["horizontalLine\0lineWidth", "Same stroke width"],
  ["horizontalLine\0cursor", "Same cursor value"],
  [
    "horizontalLine\0alignToPixelGrid",
    "Omission preserves exact input geometry",
  ],
  [
    "horizontalLine\0lineInteractionWidth",
    "Defaults to `style.strokeWidth`, then `0`",
  ],
  ["verticalLine\0x", "Required"],
  ["verticalLine\0top", "Optional; defaults to `0`"],
  [
    "verticalLine\0bottom",
    "Optional; defaults to the allocation height",
  ],
  ["verticalLine\0strokeStyle", "Same stroke value"],
  ["verticalLine\0lineWidth", "Same stroke width"],
  ["verticalLine\0cursor", "Same cursor value"],
  [
    "verticalLine\0alignToPixelGrid",
    "Omission preserves exact input geometry",
  ],
  [
    "verticalLine\0lineInteractionWidth",
    "Defaults to `style.strokeWidth`, then `0`",
  ],
  ["svgPath\0d", "Required string path data"],
  ["svgPath\0fillStyle", "Same fill value"],
  ["svgPath\0strokeStyle", "Same stroke value"],
  ["svgPath\0lineWidth", "Same stroke width"],
  ["svgPath\0alpha", "Multiplies the current Canvas alpha"],
  ["svgPath\0cursor", "Same cursor value"],
  [
    "text\0text",
    "Numeric zero remains visible; empty values add no content",
  ],
  ["text\0x", "Optional; defaults to `0`"],
  ["text\0y", "Optional; defaults to `0`"],
  ["text\0maxWidth", "Optional text box width"],
  ["text\0maxHeight", "Optional text box height"],
  ["text\0lineHeight", "Defaults to `13`"],
  ["text\0wordWrap", "Defaults to `false`"],
  ["text\0overflow", 'Defaults to `"visible"`'],
  ["text\0font", 'Defaults to `"13px sans-serif"`'],
  ["text\0textBaseline", 'Defaults to `"top"`'],
  ["text\0textAlign", 'Defaults to `"left"`'],
  ["text\0fillStyle", "Same fill value"],
  ["text\0strokeStyle", "Same stroke value"],
  ["text\0lineWidth", "Defaults to `0` when omitted"],
  ["text\0alpha", "Multiplies the current Canvas alpha"],
  ["text\0cursor", "Same cursor value"],
  ["img\0src", "Required"],
  ["img\0x", "Optional; defaults to `0`"],
  ["img\0y", "Optional; defaults to `0`"],
  [
    "img\0width",
    "Omission uses loaded natural width, otherwise `0`",
  ],
  [
    "img\0height",
    "Omission uses loaded natural height, otherwise `0`",
  ],
  ["img\0strokeStyle", "Same border stroke value"],
  ["img\0lineWidth", "Same border width"],
  ["img\0alpha", "Multiplies the current Canvas alpha"],
  ["img\0cursor", "Same cursor value"],
  ["img\0alignToPixelGrid", "Omission preserves exact input geometry"],
  ["g\0scaleX", "Defaults to `1`"],
  ["g\0scaleY", "Defaults to `1`"],
  ["g\0rotate", "Clockwise degrees; transform order is unchanged"],
  ["g\0rotateOrigin", "Defaults to `[0, 0]`"],
  ["g\0x", "Defaults to `0`"],
  ["g\0y", "Defaults to `0`"],
  ["g\0skewX", "Defaults to `0`"],
  ["g\0skewY", "Defaults to `0`"],
  [
    "g\0children",
    "Transform order remains scale, rotation, translation, skew",
  ],
  ["clip\0path", "Required `Path2D`"],
  ["clip\0fillRule", 'Defaults to `"nonzero"`'],
  ["clip\0children", "Children retain source order"],
  [
    "layer\0width",
    "Omission uses the current logical Canvas allocation",
  ],
  [
    "layer\0height",
    "Omission uses the current logical Canvas allocation",
  ],
  [
    "layer\0render",
    "render element/descriptor prop removed; children retained",
  ],
]);

const legacyComponentInterfaces = new Map([
  ["rect", "RectProps"],
  ["path", "PathProps"],
  ["line", "LineProps"],
  ["horizontalLine", "HorizontalLineProps"],
  ["verticalLine", "VerticalLineProps"],
  ["svgPath", "SvgPathProps"],
  ["text", "TextProps"],
  ["img", "ImgProps"],
  ["g", "GProps"],
  ["clip", "ClipProps"],
  ["layer", "LayerProps"],
]);

const currentStyleInterfaces = new Map([
  ["Rectangle", "RectStyle"],
  ["Path", "PathStyle"],
  ["Line", "LineStyle"],
  ["HorizontalLine", "HorizontalLineStyle"],
  ["VerticalLine", "VerticalLineStyle"],
  ["SvgPath", "SvgPathStyle"],
  ["Text", "TextStyle"],
  ["Image", "ImgStyle"],
  ["Group", "GStyle"],
  ["Clip", "ClipStyle"],
  ["Layer", "LayerStyle"],
]);

const currentChildrenInterfaces = new Map([
  ["Text", "TextProps"],
  ["Group", "GroupProps"],
  ["Clip", "ClipProps"],
  ["Layer", "LayerProps"],
]);

const legacySharedFieldInterfaces = new Map([
  ["fillStyle", "FillStyleProps"],
  ["strokeStyle", "StrokeStyleProps"],
  ["lineWidth", "StrokeStyleProps"],
  ["alpha", "AlphaProps"],
  ["cursor", "CursorStyleProps"],
]);

const currentSharedFieldInterfaces = new Map([
  ["fill", "PaintStyle"],
  ["stroke", "PaintStyle"],
  ["strokeWidth", "PaintStyle"],
  ["opacity", "PaintStyle"],
  ["cursor", "CursorStyle"],
]);

const legacyRequiredIdentities = new Set([
  "rect\0x",
  "rect\0y",
  "rect\0width",
  "rect\0height",
  "path\0path",
  "line\0coords",
  "horizontalLine\0y",
  "verticalLine\0x",
  "svgPath\0d",
  "text\0text",
  "text\0x",
  "text\0y",
  "img\0src",
  "img\0x",
  "img\0y",
  "g\0children",
  "clip\0path",
  "clip\0children",
  "layer\0render",
]);

const currentRequiredIdentities = new Set([
  "rect\0width",
  "rect\0height",
  "path\0path",
  "line\0coords",
  "horizontalLine\0y",
  "verticalLine\0x",
  "svgPath\0d",
  "img\0src",
  "g\0children",
  "clip\0path",
  "clip\0children",
  "layer\0render",
]);

function interfaceProperties(sources, label) {
  const interfaces = new Map();
  for (const [path, source] of sources) {
    for (const statement of parse(source, {
      sourceFilename: path,
      sourceType: "module",
      plugins: ["typescript"],
    }).program.body) {
      const declaration =
        statement.type === "ExportNamedDeclaration"
          ? statement.declaration
          : statement;
      if (declaration?.type !== "TSInterfaceDeclaration") continue;
      const properties = interfaces.get(declaration.id.name) ?? new Map();
      for (const member of declaration.body.body) {
        if (member.type !== "TSPropertySignature") continue;
        const name =
          member.key.type === "Identifier"
            ? member.key.name
            : member.key.type === "StringLiteral"
              ? member.key.value
              : undefined;
        if (!name) continue;
        const annotation = member.typeAnnotation?.typeAnnotation;
        const typeName =
          annotation?.type === "TSTypeReference" &&
          annotation.typeName.type === "Identifier"
            ? annotation.typeName.name
            : undefined;
        const property = {
          optional: Boolean(member.optional),
          typeName,
        };
        const previous = properties.get(name);
        if (previous) {
          assert.deepEqual(
            property,
            previous,
            `${label} source conflicts on ${declaration.id.name}.${name}`,
          );
        } else {
          properties.set(name, property);
        }
      }
      interfaces.set(declaration.id.name, properties);
    }
  }
  return interfaces;
}

function propertyEvidence(interfaces, interfaceName, field, label) {
  const interfaceFields = interfaces.get(interfaceName);
  assert.ok(interfaceFields, `${label} source is missing ${interfaceName}`);
  const property = interfaceFields.get(field);
  assert.ok(
    property,
    `${label} source is missing ${interfaceName}.${field}`,
  );
  return property;
}

function currentFieldDeclaration(requirement) {
  if (requirement.replacement === "children") {
    return [
      currentChildrenInterfaces.get(requirement.finalComponent),
      "children",
    ];
  }
  const field = requirement.replacement.slice("style.".length);
  if (field === "width" || field === "height") {
    return [
      requirement.finalComponent === "Rectangle" ? "RectStyle" : "BoxStyle",
      field,
    ];
  }
  const sharedInterface = currentSharedFieldInterfaces.get(field);
  if (
    sharedInterface &&
    (requirement.finalComponent !== "Image" ||
      sharedInterface === "CursorStyle")
  ) {
    return [sharedInterface, field];
  }
  return [currentStyleInterfaces.get(requirement.finalComponent), field];
}

function assertFieldSourceTypes({
  requirements,
  legacyTypeSources,
  currentTypeSources,
}) {
  const currentInterfaces = interfaceProperties(
    currentTypeSources,
    "Current field",
  );
  const legacyInterfaces = legacyTypeSources
    ? interfaceProperties(legacyTypeSources, "Legacy field")
    : undefined;

  for (const [identity, requirement] of requirements) {
    const [currentInterface, currentField] =
      currentFieldDeclaration(requirement);
    const currentProperty = propertyEvidence(
      currentInterfaces,
      currentInterface,
      currentField,
      "Current field",
    );
    assert.equal(
      currentProperty.optional,
      !currentRequiredIdentities.has(identity),
      `Current source requiredness disagrees with ${requirement.component}.${requirement.field}`,
    );

    if (!legacyInterfaces) continue;
    const legacyInterface =
      legacySharedFieldInterfaces.get(requirement.field) ??
      legacyComponentInterfaces.get(requirement.component);
    const legacyProperty = propertyEvidence(
      legacyInterfaces,
      legacyInterface,
      requirement.field,
      "Legacy field",
    );
    assert.equal(
      legacyProperty.optional,
      !legacyRequiredIdentities.has(identity),
      `Legacy source requiredness disagrees with ${requirement.component}.${requirement.field}`,
    );
    if (identity === "layer\0render") {
      assert.equal(
        legacyProperty.typeName,
        "CompEl",
        "Legacy Layer.render must be an element/descriptor prop",
      );
    }
  }
}

function cells(row) {
  const trimmed = row.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function codeValues(cell) {
  return [...cell.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
}

function normalizedField(field) {
  return field.endsWith("?") ? field.slice(0, -1) : field;
}

function markdownSection(source, heading) {
  const startMarker = `## ${heading}`;
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing ${JSON.stringify(startMarker)}`);
  const next = source.indexOf("\n## ", start + startMarker.length);
  return source.slice(start, next === -1 ? undefined : next);
}

function expectedReplacement(component, field) {
  if (
    field === "children" ||
    (component === "text" && field === "text") ||
    (component === "layer" && field === "render")
  ) {
    return "children";
  }
  const renamed =
    componentSpecificRenames.get(`${component}\0${field}`) ??
    renamedFields.get(field) ??
    field;
  return `style.${renamed}`;
}

function baselineRequirements(baselineStyleUnits) {
  const requirements = new Map();
  for (const unit of baselineStyleUnits) {
    if (
      unit.kind !== "table" ||
      unit.section !== "Style-only built-in migration"
    ) {
      continue;
    }
    const row = cells(unit.text);
    const component = codeValues(row[0] ?? "")[0];
    if (!finalComponents.has(component)) continue;
    const fields = codeValues(row[1] ?? "").map(normalizedField);
    fields.push(...(expandedBaselineFields.get(component) ?? []));
    for (const field of fields) {
      const identity = `${component}\0${field}`;
      assert.ok(
        !requirements.has(identity),
        `Reviewed baseline repeats field-level migration ${component}.${field}`,
      );
      requirements.set(identity, {
        component,
        field,
        finalComponent: finalComponents.get(component),
        replacement: expectedReplacement(component, field),
      });
    }
  }
  assert.equal(
    requirements.size,
    85,
    "Reviewed baseline field-level migration inventory changed; review the derivation",
  );
  return requirements;
}

function migrationRows(migrationSource) {
  const section = markdownSection(
    migrationSource,
    "Field-level style and structure replacements",
  );
  const rows = new Map();
  for (const line of section.split("\n")) {
    const row = cells(line);
    if (row.length !== 4) continue;
    const component = codeValues(row[0])[0];
    const field = codeValues(row[1]).at(-1);
    if (!finalComponents.has(component) || !field) continue;
    const identity = `${component}\0${field}`;
    assert.ok(
      !rows.has(identity),
      `Field-level migration matrix repeats ${component}.${field}`,
    );
    rows.set(identity, {
      finalCodes: codeValues(row[2]),
      behavior: row[3],
    });
  }
  return rows;
}

function finalStyleRows(currentStyleSource) {
  const section = markdownSection(
    currentStyleSource,
    "Style-only built-in migration",
  );
  const rows = new Map();
  for (const line of section.split("\n")) {
    const row = cells(line);
    if (row.length !== 4) continue;
    const component = codeValues(row[0])[0];
    if (![...finalComponents.values()].includes(component)) continue;
    rows.set(component, {
      styleCodes: new Set(
        codeValues(row[1]).map((value) => value.replace(/:\s*.+$/u, "")),
      ),
      programCodes: new Set(codeValues(row[3])),
    });
  }
  return rows;
}

export function assertFieldMigrationCompleteness({
  baselineStyleUnits,
  currentStyleSource,
  currentTypeSources,
  legacyTypeSources,
  migrationSource,
}) {
  const requirements = baselineRequirements(baselineStyleUnits);
  const migrations = migrationRows(migrationSource);
  const finalRows = finalStyleRows(currentStyleSource);

  assert.equal(
    migrations.size,
    requirements.size,
    "Field-level migration matrix must contain exactly one row for every reviewed baseline field",
  );
  assert.equal(
    expectedBehaviorByIdentity.size,
    requirements.size,
    "Expected behavior/default inventory must cover every published field migration",
  );
  assertFieldSourceTypes({
    requirements,
    legacyTypeSources,
    currentTypeSources,
  });
  for (const [identity, requirement] of requirements) {
    const row = migrations.get(identity);
    assert.ok(
      row,
      `Field-level migration matrix is missing ${requirement.component}.${requirement.field}`,
    );
    assert.deepEqual(
      row.finalCodes,
      [requirement.finalComponent, requirement.replacement],
      `Field-level migration ${requirement.component}.${requirement.field} has the wrong final replacement`,
    );
    assert.equal(
      row.behavior,
      expectedBehaviorByIdentity.get(identity),
      `Field-level migration ${requirement.component}.${requirement.field} has the wrong final behavior`,
    );

    const finalRow = finalRows.get(requirement.finalComponent);
    assert.ok(
      finalRow,
      `Normative final field table is missing ${requirement.finalComponent}`,
    );
    const finalCodes =
      requirement.replacement === "children"
        ? finalRow.programCodes
        : finalRow.styleCodes;
    assert.ok(
      finalCodes.has(requirement.replacement),
      `Normative final field table is missing ${requirement.finalComponent} ${requirement.replacement}`,
    );
  }

  return { fieldMigrationCount: requirements.size };
}
