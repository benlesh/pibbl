import assert from "node:assert/strict";

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

const behaviorRequirements = new Map([
  ["rect\0x", "defaults to `0`"],
  ["rect\0y", "defaults to `0`"],
  ["horizontalLine\0left", "defaults to `0`"],
  ["horizontalLine\0right", "defaults to the allocation width"],
  ["verticalLine\0top", "defaults to `0`"],
  ["verticalLine\0bottom", "defaults to the allocation height"],
  ["text\0text", "Numeric zero remains visible"],
  ["text\0x", "defaults to `0`"],
  ["text\0y", "defaults to `0`"],
  ["text\0lineHeight", "Defaults to `13`"],
  ["text\0wordWrap", "Defaults to `false`"],
  ["text\0overflow", 'Defaults to `"visible"`'],
  ["text\0font", 'Defaults to `"13px sans-serif"`'],
  ["text\0textBaseline", 'Defaults to `"top"`'],
  ["text\0textAlign", 'Defaults to `"left"`'],
  ["img\0x", "defaults to `0`"],
  ["img\0y", "defaults to `0`"],
  ["img\0width", "loaded natural width, otherwise `0`"],
  ["img\0height", "loaded natural height, otherwise `0`"],
  ["g\0rotate", "transform order is unchanged"],
  ["g\0rotateOrigin", "Defaults to `[0, 0]`"],
  ["g\0children", "scale, rotation, translation, skew"],
  ["clip\0fillRule", 'Defaults to `"nonzero"`'],
  ["layer\0width", "current logical Canvas allocation"],
  ["layer\0height", "current logical Canvas allocation"],
  ["layer\0render", "callback form is removed"],
]);

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
    const behavior = behaviorRequirements.get(identity);
    if (behavior) {
      assert.ok(
        row.behavior.includes(behavior),
        `Field-level migration ${requirement.component}.${requirement.field} lost ${JSON.stringify(behavior)}`,
      );
    }

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
