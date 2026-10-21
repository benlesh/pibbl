import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { transformSync } from "esbuild";
import { learningExampleCatalog } from "../packages/scenarios/src/learning-catalog.ts";
import { tutorialSnapshotCatalog } from "../packages/scenarios/src/tutorial-catalog.ts";
import { toRunnableScript } from "../playground/src/sandbox-module.ts";

test("every learning example and tutorial exports named components without a mount entry", () => {
  const paths = globSync(
    "packages/scenarios/src/{learning,tutorials}/**/*.example.tsx",
  );
  assert.ok(paths.length > 0);
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const { program } = parse(source, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    assert.equal(
      program.body.some((node) => node.type === "ExportDefaultDeclaration"),
      false,
      path,
    );
    assert.ok(
      program.body.some(
        (node) =>
          node.type === "ExportNamedDeclaration" &&
          node.declaration?.type === "FunctionDeclaration",
      ),
      path,
    );
  }
});

test("every catalog entry compiles its selected named component for Studio", () => {
  for (const entry of [...learningExampleCatalog, ...tutorialSnapshotCatalog]) {
    assert.ok(entry.source.exportName, entry.slug);
    const code = transformSync(readFileSync(entry.source.path, "utf8"), {
      sourcefile: entry.source.path,
      loader: "tsx",
      format: "esm",
      jsx: "automatic",
      jsxImportSource: "@pibbl/core",
    }).code;
    assert.doesNotThrow(
      () =>
        toRunnableScript(code, {
          exportName: entry.source.exportName,
        }),
      entry.slug,
    );
  }
});
