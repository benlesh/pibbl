import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const CONTRACT_BASELINE_COMMIT =
  "0040d65cc4007aefc2ae61ef0c5b833166c38441";
export const CONTRACT_TRANSLATION_RECORD =
  "docs/superpowers/specs/2026-09-01-jsx-component-authoring-design.md";

// Updated only after the complete baseline, translation allowlist, additions,
// and evidence map receive review together.
const REVIEWED_MANIFEST_SHA256 =
  "e583d0f47a2c5d69a7a2869a5a9bb3457be4a20cc6c17c9ab5ae1a6799f883fa";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeContractText(value) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function isHeading(line) {
  return line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/u);
}

function isFence(line) {
  return /^\s*```/u.test(line);
}

function isListItem(line) {
  return /^\s*(?:[-+*]|\d+[.)])\s+/u.test(line);
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/u.test(line);
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?$/u.test(
    line,
  );
}

function isHorizontalRule(line) {
  return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(line);
}

function semanticUnitId(prefix, index) {
  return `${prefix}${String(index + 1).padStart(4, "0")}`;
}

/**
 * Extracts every meaningful Markdown block while keeping prose, list items,
 * table rows, and fenced code in distinct channels. Whitespace and wrapping
 * normalize; words, punctuation, order, and block kind do not.
 */
function contractUnitRecords(source, prefix) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const records = [];
  let section = "(preamble)";

  const add = (kind, value, startLine, endLine) => {
    const text = normalizeContractText(value);
    if (text === "") return;
    records.push({
      unit: {
        id: semanticUnitId(prefix, records.length),
        kind,
        section,
        text,
      },
      startLine,
      endLine,
    });
  };

  for (let cursor = 0; cursor < lines.length; ) {
    const startLine = cursor;
    const line = lines[cursor];
    const heading = isHeading(line);
    if (heading) {
      section = normalizeContractText(heading[2]);
      cursor += 1;
      continue;
    }
    if (/^\s*<!--/u.test(line)) {
      while (cursor < lines.length && !/-->\s*$/u.test(lines[cursor])) {
        cursor += 1;
      }
      cursor += 1;
      continue;
    }
    if (isFence(line)) {
      const language = line.trim().slice(3).trim();
      const body = [];
      cursor += 1;
      while (cursor < lines.length && !/^\s*```\s*$/u.test(lines[cursor])) {
        body.push(lines[cursor]);
        cursor += 1;
      }
      assert.ok(cursor < lines.length, `Unclosed Markdown fence in ${section}`);
      cursor += 1;
      add("code", `${language}\n${body.join("\n")}`, startLine, cursor);
      continue;
    }
    if (line.trim() === "" || isHorizontalRule(line) || isTableSeparator(line)) {
      cursor += 1;
      continue;
    }
    if (isTableRow(line)) {
      add("table", line, startLine, cursor + 1);
      cursor += 1;
      continue;
    }
    if (isListItem(line)) {
      const body = [line];
      cursor += 1;
      while (
        cursor < lines.length &&
        lines[cursor].trim() !== "" &&
        !isHeading(lines[cursor]) &&
        !isFence(lines[cursor]) &&
        !isListItem(lines[cursor]) &&
        !isTableRow(lines[cursor]) &&
        !isTableSeparator(lines[cursor])
      ) {
        body.push(lines[cursor]);
        cursor += 1;
      }
      add("list", body.join("\n"), startLine, cursor);
      continue;
    }

    const body = [line];
    cursor += 1;
    while (
      cursor < lines.length &&
      lines[cursor].trim() !== "" &&
      !isHeading(lines[cursor]) &&
      !isFence(lines[cursor]) &&
      !isListItem(lines[cursor]) &&
      !isTableRow(lines[cursor]) &&
      !isTableSeparator(lines[cursor]) &&
      !isHorizontalRule(lines[cursor])
    ) {
      body.push(lines[cursor]);
      cursor += 1;
    }
    add("prose", body.join("\n"), startLine, cursor);
  }

  return records;
}

export function extractContractUnits(source, prefix) {
  return contractUnitRecords(source, prefix).map(({ unit }) => unit);
}

/** Replaces one exact extracted block for adversarial mutation probes. */
export function replaceContractUnit(source, prefix, id, replacement) {
  const normalizedSource = source.replaceAll("\r\n", "\n");
  const record = contractUnitRecords(normalizedSource, prefix).find(
    ({ unit }) => unit.id === id,
  );
  assert.ok(record, `Unknown semantic unit ${id}`);
  const lines = normalizedSource.split("\n");
  const replacementLines = replacement === "" ? [] : replacement.split("\n");
  lines.splice(
    record.startLine,
    record.endLine - record.startLine,
    ...replacementLines,
  );
  return lines.join("\n");
}

function unitKey(unit) {
  return `${unit.kind}\0${unit.text}`;
}

function unmatchedUnitIds(baselineUnits, currentUnits) {
  const availableCurrent = new Map();
  for (const unit of currentUnits) {
    const key = unitKey(unit);
    const ids = availableCurrent.get(key) ?? [];
    ids.push(unit.id);
    availableCurrent.set(key, ids);
  }
  const unmatchedBaseline = [];
  const matchedCurrent = new Set();
  for (const unit of baselineUnits) {
    const ids = availableCurrent.get(unitKey(unit));
    const currentId = ids?.shift();
    if (currentId) matchedCurrent.add(currentId);
    else unmatchedBaseline.push(unit.id);
  }
  return {
    baseline: unmatchedBaseline,
    current: currentUnits
      .filter((unit) => !matchedCurrent.has(unit.id))
      .map((unit) => unit.id),
  };
}

function exactTextInKind(units, kind, text) {
  const normalized = normalizeContractText(text);
  return units.some(
    (unit) => unit.kind === kind && unit.text.includes(normalized),
  );
}

function assertExactObjectKeys(value, expected, label) {
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expected].sort(),
    `${label} uses unsupported or missing fields`,
  );
}

export function assertContractPreservationBaseline({
  manifest,
  expectedContractPaths,
  baselineSources,
  currentSources,
  translationRecordSource,
  translationRecordBaselineSource,
  evidenceSources,
  trackedEvidencePaths,
  reviewedManifestSha256 = REVIEWED_MANIFEST_SHA256,
}) {
  assertExactObjectKeys(
    manifest,
    [
      "version",
      "sourceCommit",
      "translationRecord",
      "translationRule",
      "contracts",
      "translations",
      "additions",
      "evidenceMappings",
    ],
    "Contract-preservation manifest",
  );
  assert.equal(manifest.version, 1, "Unsupported contract baseline version");
  assert.equal(
    manifest.sourceCommit,
    CONTRACT_BASELINE_COMMIT,
    "Contract baseline must identify the reviewed pre-Task-14 commit",
  );
  assert.deepEqual(
    Object.keys(manifest.translationRecord ?? {}).sort(),
    ["path", "sourceSha256"],
    "JSX translation-record provenance uses unsupported or missing fields",
  );
  assert.equal(
    manifest.translationRecord.path,
    CONTRACT_TRANSLATION_RECORD,
    "Approved JSX translation-record path changed",
  );
  assert.match(
    manifest.translationRecord.sourceSha256,
    /^[a-f0-9]{64}$/u,
    "Approved JSX translation-record baseline digest is malformed",
  );
  if (translationRecordBaselineSource !== undefined) {
    assert.equal(
      manifest.translationRecord.sourceSha256,
      sha256(translationRecordBaselineSource),
      `Approved JSX translation-record digest does not match ${manifest.sourceCommit}`,
    );
  }
  assert.match(
    manifest.translationRule,
    /Preserve shipped semantics while translating/u,
    "Contract baseline must state the approved translation boundary",
  );

  assert.deepEqual(
    manifest.contracts.map(({ path }) => path).sort(),
    [...expectedContractPaths].sort(),
    "Contract baseline must cover every normative contract exactly once",
  );

  const contractsByPath = new Map();
  let baselineUnitCount = 0;
  let currentUnitCount = 0;
  const assertSnapshotUnits = (units, prefix, label) => {
    assert.ok(Array.isArray(units) && units.length > 0, `${label} is empty`);
    for (const [index, unit] of units.entries()) {
      assertExactObjectKeys(unit, ["id", "kind", "section", "text"], `${label} unit`);
      assert.equal(
        unit.id,
        semanticUnitId(prefix, index),
        `${label} has a missing, reordered, or malformed semantic unit id`,
      );
      assert.ok(
        ["prose", "list", "table", "code"].includes(unit.kind),
        `${label} has an unsupported semantic unit kind`,
      );
      assert.ok(
        typeof unit.section === "string" && unit.section !== "",
        `${label} has an empty section provenance`,
      );
      assert.equal(
        unit.text,
        normalizeContractText(unit.text),
        `${label} has non-normalized or empty semantic text`,
      );
      assert.notEqual(unit.text, "", `${label} has empty semantic text`);
    }
  };
  for (const contract of manifest.contracts) {
    assertExactObjectKeys(
      contract,
      ["path", "sourceSha256", "baselineUnits", "currentUnits"],
      `Contract snapshot ${contract.path ?? "<unknown>"}`,
    );
    assert.ok(!contractsByPath.has(contract.path), `Duplicate contract ${contract.path}`);
    const baselineSource = baselineSources?.get(contract.path);
    const currentSource = currentSources.get(contract.path);
    assert.equal(
      typeof currentSource,
      "string",
      `Missing current normative contract ${contract.path}`,
    );
    assert.match(
      contract.sourceSha256,
      /^[a-f0-9]{64}$/u,
      `${contract.path} baseline source digest is malformed`,
    );
    assertSnapshotUnits(contract.baselineUnits, "b", `${contract.path} baseline snapshot`);
    assertSnapshotUnits(contract.currentUnits, "c", `${contract.path} current snapshot`);
    if (baselineSources !== undefined) {
      assert.equal(
        typeof baselineSource,
        "string",
        `Missing ${manifest.sourceCommit} source for ${contract.path}`,
      );
      assert.equal(
        contract.sourceSha256,
        sha256(baselineSource),
        `${contract.path} baseline source digest does not match ${manifest.sourceCommit}`,
      );
      const extractedBaselineUnits = extractContractUnits(baselineSource, "b");
      assert.equal(
        sha256(JSON.stringify(contract.baselineUnits)),
        sha256(JSON.stringify(extractedBaselineUnits)),
        `${contract.path} baseline snapshot is incomplete or not derived from ${manifest.sourceCommit}`,
      );
      assert.deepEqual(
        contract.baselineUnits,
        extractedBaselineUnits,
        `${contract.path} baseline snapshot is incomplete or not derived from ${manifest.sourceCommit}`,
      );
    }
    const extractedCurrentUnits = extractContractUnits(currentSource, "c");
    assert.equal(
      sha256(JSON.stringify(extractedCurrentUnits)),
      sha256(JSON.stringify(contract.currentUnits)),
      `${contract.path} differs from its reviewed complete semantic snapshot`,
    );
    assert.deepEqual(
      extractedCurrentUnits,
      contract.currentUnits,
      `${contract.path} differs from its reviewed complete semantic snapshot`,
    );
    const ids = [...contract.baselineUnits, ...contract.currentUnits].map(
      ({ id }) => id,
    );
    assert.equal(
      new Set(ids.map((id) => `${contract.path}\0${id}`)).size,
      ids.length,
      `${contract.path} repeats a semantic unit id`,
    );
    contractsByPath.set(contract.path, contract);
    baselineUnitCount += contract.baselineUnits.length;
    currentUnitCount += contract.currentUnits.length;
  }

  const translatedBaseline = new Set();
  const translatedCurrent = new Set();
  const addedCurrent = new Set();
  const approvals = extractContractUnits(translationRecordSource, "a");
  const assertApproval = (entry, label) => {
    assertExactObjectKeys(entry.approval ?? {}, ["kind", "text"], `${label} approval`);
    assert.ok(
      ["prose", "list", "table"].includes(entry.approval.kind) &&
        exactTextInKind(approvals, entry.approval.kind, entry.approval.text),
      `${label} lacks exact prose/list/table approval in the JSX design record`,
    );
  };
  const resolveUnit = (path, side, id, label) => {
    const contract = contractsByPath.get(path);
    assert.ok(contract, `${label} references unknown contract ${path}`);
    const units = side === "baseline" ? contract.baselineUnits : contract.currentUnits;
    const unit = units.find((candidate) => candidate.id === id);
    assert.ok(unit, `${label} references unknown ${side} unit ${path}#${id}`);
    return unit;
  };

  for (const translation of manifest.translations) {
    const label = `Translation ${translation.id ?? "<unknown>"}`;
    assertExactObjectKeys(
      translation,
      ["id", "path", "baselineIds", "currentIds", "reason", "approval"],
      label,
    );
    assert.match(translation.id, /^[a-z0-9-]+$/u, `${label} has an invalid id`);
    assert.ok(
      typeof translation.reason === "string" && translation.reason.length >= 24,
      `${label} needs a specific human-readable reason`,
    );
    assert.ok(
      Array.isArray(translation.baselineIds) && translation.baselineIds.length > 0,
      `${label} must map at least one changed baseline unit`,
    );
    assert.ok(
      Array.isArray(translation.currentIds) && translation.currentIds.length > 0,
      `${label} must map to exact current prose/table/list/code`,
    );
    assertApproval(translation, label);
    for (const id of translation.baselineIds) {
      resolveUnit(translation.path, "baseline", id, label);
      const identity = `${translation.path}\0${id}`;
      assert.ok(!translatedBaseline.has(identity), `${label} repeats baseline unit ${id}`);
      translatedBaseline.add(identity);
    }
    for (const id of translation.currentIds) {
      resolveUnit(translation.path, "current", id, label);
      const identity = `${translation.path}\0${id}`;
      assert.ok(!translatedCurrent.has(identity), `${label} repeats current unit ${id}`);
      translatedCurrent.add(identity);
    }
  }

  for (const addition of manifest.additions) {
    const label = `Addition ${addition.id ?? "<unknown>"}`;
    assertExactObjectKeys(
      addition,
      ["id", "path", "currentIds", "reason", "approval"],
      label,
    );
    assert.match(addition.id, /^[a-z0-9-]+$/u, `${label} has an invalid id`);
    assert.ok(
      typeof addition.reason === "string" && addition.reason.length >= 24,
      `${label} needs a specific human-readable reason`,
    );
    assert.ok(
      Array.isArray(addition.currentIds) && addition.currentIds.length > 0,
      `${label} must identify exact current units`,
    );
    assertApproval(addition, label);
    for (const id of addition.currentIds) {
      resolveUnit(addition.path, "current", id, label);
      const identity = `${addition.path}\0${id}`;
      assert.ok(
        !translatedCurrent.has(identity) && !addedCurrent.has(identity),
        `${label} repeats current unit ${id}`,
      );
      addedCurrent.add(identity);
    }
  }

  for (const contract of manifest.contracts) {
    const unmatched = unmatchedUnitIds(
      contract.baselineUnits,
      contract.currentUnits,
    );
    assert.deepEqual(
      [...translatedBaseline]
        .filter((identity) => identity.startsWith(`${contract.path}\0`))
        .map((identity) => identity.slice(contract.path.length + 1))
        .sort(),
      [...unmatched.baseline].sort(),
      `${contract.path} changed baseline clauses lack a narrow JSX-era translation mapping`,
    );
    assert.deepEqual(
      [...translatedCurrent, ...addedCurrent]
        .filter((identity) => identity.startsWith(`${contract.path}\0`))
        .map((identity) => identity.slice(contract.path.length + 1))
        .sort(),
      [...unmatched.current].sort(),
      `${contract.path} changed current clauses are not classified as translations or approved additions`,
    );
  }

  const sourceEvidence = new Set();
  const testEvidence = new Set();
  const mappedClaims = new Set();
  for (const mapping of manifest.evidenceMappings) {
    const label = `Evidence ${mapping.id ?? "<unknown>"}`;
    assertExactObjectKeys(
      mapping,
      ["id", "contract", "claim", "source", "test"],
      label,
    );
    assert.match(mapping.id, /^[a-z0-9-]+$/u, `${label} has an invalid id`);
    const contract = contractsByPath.get(mapping.contract);
    assert.ok(contract, `${label} references unknown contract ${mapping.contract}`);
    assertExactObjectKeys(mapping.claim ?? {}, ["kind", "text"], `${label} claim`);
    assert.ok(
      ["prose", "list", "table"].includes(mapping.claim.kind) &&
        exactTextInKind(
          contract.currentUnits,
          mapping.claim.kind,
          mapping.claim.text,
        ),
      `${label} claim is not exact contiguous current contract prose`,
    );
    const claimIdentity = `${mapping.contract}\0${mapping.claim.kind}\0${normalizeContractText(mapping.claim.text)}`;
    assert.ok(!mappedClaims.has(claimIdentity), `${label} repeats another evidence claim`);
    mappedClaims.add(claimIdentity);

    for (const role of ["source", "test"]) {
      const evidence = mapping[role];
      assertExactObjectKeys(evidence ?? {}, ["path", "marker"], `${label} ${role}`);
      if (role === "source") {
        assert.match(
          evidence.path,
          /^packages\/core\/src\/.*\.[cm]?[jt]sx?$/u,
          `${label} implementation evidence must be runtime source`,
        );
        assert.doesNotMatch(
          evidence.path,
          /\.test\.[cm]?[jt]sx?$/u,
          `${label} implementation evidence cannot be a test`,
        );
      } else {
        assert.match(
          evidence.path,
          /^packages\/core\/(?:src|test)\/.*\.test\.[cm]?[jt]sx?$/u,
          `${label} executable evidence must be a core test`,
        );
      }
      assert.ok(
        trackedEvidencePaths.has(evidence.path),
        `${label} references missing ${role} evidence ${evidence.path}`,
      );
      const evidenceSource = evidenceSources.get(evidence.path);
      assert.equal(
        typeof evidenceSource,
        "string",
        `${label} could not read ${role} evidence ${evidence.path}`,
      );
      assert.ok(
        evidence.marker.length >= 12 && evidenceSource.includes(evidence.marker),
        `${label} ${role} evidence lacks its exact reviewed marker`,
      );
      const identity = `${evidence.path}\0${evidence.marker}`;
      const seen = role === "source" ? sourceEvidence : testEvidence;
      assert.ok(
        !seen.has(identity),
        `${label} reuses identical generic ${role} evidence for a different semantic claim`,
      );
      seen.add(identity);
    }
  }

  const digest = sha256(JSON.stringify(manifest));
  assert.equal(
    digest,
    reviewedManifestSha256,
    "Contract-preservation manifest differs from the fixed reviewed snapshot, translation allowlist, or evidence map",
  );

  return {
    baselineUnitCount,
    currentUnitCount,
    evidenceMappingCount: manifest.evidenceMappings.length,
    provenanceVerified: baselineSources !== undefined,
  };
}
