import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  API,
  DiagnosticCategory,
  ModuleKind,
  SymbolFlags,
  type CompilerOptions,
  type Symbol as TypeScriptSymbol,
} from "typescript/unstable/sync";

import type { PublicDocFrontmatter } from "./model";

export interface PublicApiEntryPoint {
  readonly values: readonly string[];
  readonly types: readonly string[];
  /** Compiler-only exports that belong to the API overview when documented. */
  readonly overview: readonly string[];
}

export type PublicApiInventory = Readonly<
  Record<string, PublicApiEntryPoint>
> & {
  readonly root: PublicApiEntryPoint;
};

export interface ApiCoveragePage {
  readonly route?: string;
  readonly frontmatter: Pick<PublicDocFrontmatter, "id" | "symbols">;
}

export interface ApiCoverageDestination {
  readonly id: string;
  readonly route: string;
}

export interface ApiCoverageDuplicate {
  readonly symbol: string;
  readonly firstPageId: string;
  readonly duplicatePageId: string;
}

export interface ApiCoverage {
  readonly values: ReadonlyMap<string, ApiCoverageDestination>;
  readonly types: ReadonlyMap<string, ApiCoverageDestination>;
  readonly overview: ReadonlyMap<string, ApiCoverageDestination>;
  readonly missingValues: readonly string[];
  readonly missingTypes: readonly string[];
  readonly unknownSymbols: readonly string[];
  readonly duplicateSymbols: readonly ApiCoverageDuplicate[];
  readonly duplicateValues: readonly string[];
  readonly duplicateTypes: readonly string[];
}

export const crcPublicCompilerOptions: CompilerOptions = {
  target: 99,
  jsx: 4, // react-jsx; the native TypeScript API does not export JsxEmit.
  jsxImportSource: "@crc/core",
};

export const crcPublicEntryPaths = {
  root: fileURLToPath(
    new URL("../../packages/core/src/index.ts", import.meta.url),
  ),
  text: fileURLToPath(new URL("../../packages/text/src/index.ts", import.meta.url)),
  viz: fileURLToPath(
    new URL("../../packages/viz/src/index.ts", import.meta.url),
  ),
  three: fileURLToPath(
    new URL("../../packages/three/src/index.ts", import.meta.url),
  ),
  particles: fileURLToPath(
    new URL("../../packages/particles/src/index.ts", import.meta.url),
  ),
  types: fileURLToPath(
    new URL("../../packages/core/src/types.ts", import.meta.url),
  ),
  jsxRuntime: fileURLToPath(
    new URL("../../packages/core/src/jsx-runtime.ts", import.meta.url),
  ),
  jsxDevRuntime: fileURLToPath(
    new URL("../../packages/core/src/jsx-dev-runtime.ts", import.meta.url),
  ),
} as const;

export const crcPhysicsEntryPaths = {
  root: fileURLToPath(
    new URL("../../packages/physics/src/2d.ts", import.meta.url),
  ),
  physics2dGeometry: fileURLToPath(
    new URL("../../packages/physics/src/2d-geometry.ts", import.meta.url),
  ),
  physics3dGeometry: fileURLToPath(
    new URL("../../packages/physics/src/3d-geometry.ts", import.meta.url),
  ),
} as const;

/** Exact public entries rendered by the Studio API reference. */
export const crcStudioPublicEntryPaths = {
  ...crcPublicEntryPaths,
  physics2d: crcPhysicsEntryPaths.root,
  physics2dTesting: fileURLToPath(
    new URL("../../packages/physics/src/2d-testing.ts", import.meta.url),
  ),
  physics3dGeometry: crcPhysicsEntryPaths.physics3dGeometry,
} as const;

const compilerOverviewSymbols = new Set(["jsx", "jsxs", "jsxDEV", "JSX"]);

/**
 * Discovers an entry point's public exports from TypeScript's semantic program.
 * This deliberately follows aliases and never tries to parse export declarations
 * with source-text heuristics.
 */
export async function collectPublicExports(
  entryPaths: Readonly<Record<string, string>>,
  compilerOptions: CompilerOptions,
): Promise<PublicApiInventory> {
  if (entryPaths.root === undefined) {
    throw new Error('Public API inventory requires a "root" entry point.');
  }

  const configuration = await createCompilerConfiguration(
    entryPaths,
    compilerOptions,
  );
  const api = new API({ cwd: process.cwd() });
  try {
    const snapshot = api.updateSnapshot({
      openProjects: [configuration.path],
    });
    try {
      assertNoCompilerErrors(snapshot, Object.values(entryPaths));
      const entries = Object.fromEntries(
        Object.entries(entryPaths).map(([entryPoint, path]) => [
          entryPoint,
          collectEntryPointExports(snapshot, path),
        ]),
      );
      return entries as PublicApiInventory;
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
    await rm(configuration.directory, { force: true, recursive: true });
  }
}

export function analyzeApiCoverage(
  inventory: PublicApiInventory,
  pages: readonly ApiCoveragePage[],
): ApiCoverage {
  const knownValues = new Set(
    Object.values(inventory).flatMap((entry) => entry.values),
  );
  const knownTypes = new Set(
    Object.values(inventory).flatMap((entry) => entry.types),
  );
  const knownOverview = new Set(
    Object.values(inventory).flatMap((entry) => entry.overview),
  );
  const knownSymbols = new Set([
    ...knownValues,
    ...knownTypes,
    ...knownOverview,
  ]);
  const values = new Map<string, ApiCoverageDestination>();
  const types = new Map<string, ApiCoverageDestination>();
  const overview = new Map<string, ApiCoverageDestination>();
  const assignments = new Map<string, ApiCoverageDestination>();
  const unknownSymbols = new Set<string>();
  const duplicateSymbols: ApiCoverageDuplicate[] = [];

  for (const page of pages) {
    const destination = {
      id: page.frontmatter.id,
      route: page.route ?? "",
    };
    for (const symbol of page.frontmatter.symbols ?? []) {
      if (!knownSymbols.has(symbol)) {
        unknownSymbols.add(symbol);
        continue;
      }

      const existing = assignments.get(symbol);
      if (existing !== undefined && existing.id !== destination.id) {
        duplicateSymbols.push({
          symbol,
          firstPageId: existing.id,
          duplicatePageId: destination.id,
        });
        continue;
      }
      assignments.set(symbol, destination);

      if (knownValues.has(symbol)) values.set(symbol, destination);
      if (knownTypes.has(symbol)) types.set(symbol, destination);
      if (knownOverview.has(symbol)) overview.set(symbol, destination);
    }
  }

  const missingValues = sorted(
    [...knownValues].filter((symbol) => !values.has(symbol)),
  );
  const missingTypes = sorted(
    [...knownTypes].filter((symbol) => !types.has(symbol)),
  );
  const sortedDuplicates = [...duplicateSymbols].sort(compareDuplicates);

  return {
    values,
    types,
    overview,
    missingValues,
    missingTypes,
    unknownSymbols: sorted([...unknownSymbols]),
    duplicateSymbols: sortedDuplicates,
    duplicateValues: sorted(
      sortedDuplicates
        .map(({ symbol }) => symbol)
        .filter((symbol) => knownValues.has(symbol)),
    ),
    duplicateTypes: sorted(
      sortedDuplicates
        .map(({ symbol }) => symbol)
        .filter((symbol) => knownTypes.has(symbol)),
    ),
  };
}

export function validateApiCoverage(
  inventory: PublicApiInventory,
  pages: readonly ApiCoveragePage[],
): ApiCoverage {
  const coverage = analyzeApiCoverage(inventory, pages);
  const problems = [
    coverage.duplicateSymbols.length === 0
      ? undefined
      : `Duplicate documented symbols: ${coverage.duplicateSymbols
          .map(
            ({ symbol, firstPageId, duplicatePageId }) =>
              `${symbol} is assigned to both ${firstPageId} and ${duplicatePageId}`,
          )
          .join("; ")}.`,
    coverage.missingValues.length + coverage.missingTypes.length === 0
      ? undefined
      : `Undocumented public exports: ${sorted([
          ...coverage.missingValues,
          ...coverage.missingTypes,
        ]).join(", ")}.`,
    coverage.unknownSymbols.length === 0
      ? undefined
      : `Unknown documented symbols: ${coverage.unknownSymbols.join(", ")}.`,
  ].filter((problem): problem is string => problem !== undefined);

  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
  return coverage;
}

function collectEntryPointExports(
  snapshot: ReturnType<API["updateSnapshot"]>,
  path: string,
): PublicApiEntryPoint {
  const project = snapshot.getDefaultProjectForFile(path);
  if (project === undefined) {
    throw new Error(
      `Could not load public API project for entry point: ${path}`,
    );
  }
  const { program, checker } = project;
  const sourceFile = program.getSourceFile(path);
  if (sourceFile === undefined) {
    throw new Error(`Could not load public API entry point: ${path}`);
  }
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) {
    throw new Error(`Could not inspect public API entry point: ${path}`);
  }

  const values = new Set<string>();
  const types = new Set<string>();
  const overview = new Set<string>();

  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const name = exported.name;
    if (compilerOverviewSymbols.has(name)) {
      overview.add(name);
      continue;
    }

    const resolved = isAlias(exported)
      ? checker.getAliasedSymbol(exported)
      : exported;
    if ((resolved.flags & SymbolFlags.Value) !== 0) values.add(name);
    if ((resolved.flags & SymbolFlags.Type) !== 0) types.add(name);
  }

  return {
    values: sorted([...values]),
    types: sorted([...types]),
    overview: sorted([...overview]),
  };
}

function isAlias(symbol: TypeScriptSymbol): boolean {
  return (symbol.flags & SymbolFlags.Alias) !== 0;
}

function sorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareNames);
}

function compareDuplicates(
  left: ApiCoverageDuplicate,
  right: ApiCoverageDuplicate,
): number {
  return (
    compareNames(left.symbol, right.symbol) ||
    compareNames(left.firstPageId, right.firstPageId) ||
    compareNames(left.duplicatePageId, right.duplicatePageId)
  );
}

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function createCompilerConfiguration(
  entryPaths: Readonly<Record<string, string>>,
  compilerOptions: CompilerOptions,
): Promise<{ readonly directory: string; readonly path: string }> {
  const directory = await mkdtemp(join(tmpdir(), "crc-studio-docs-"));
  const path = join(directory, "tsconfig.json");
  await writeFile(
    path,
    `${JSON.stringify(
      {
        compilerOptions: compilerOptionsForConfig(compilerOptions),
        files: Object.values(entryPaths),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return { directory, path };
}

function compilerOptionsForConfig(
  compilerOptions: CompilerOptions,
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    ...compilerOptions,
    noEmit: true,
  };
  delete options.project;
  options.module = configEnum(compilerOptions.module, moduleKindNames);
  options.moduleResolution = configEnum(
    compilerOptions.moduleResolution,
    moduleResolutionKindNames,
  );
  options.target = configEnum(compilerOptions.target, scriptTargetNames);
  options.jsx = configEnum(compilerOptions.jsx, jsxEmitNames);
  return withoutUndefined(options);
}

function configEnum(
  value: number | undefined,
  names: Readonly<Record<number, string>>,
): number | string | undefined {
  return value === undefined ? undefined : (names[value] ?? value);
}

function withoutUndefined(
  values: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function assertNoCompilerErrors(
  snapshot: ReturnType<API["updateSnapshot"]>,
  entryPaths: readonly string[],
): void {
  const diagnostics = entryPaths.flatMap((path) => {
    const project = snapshot.getDefaultProjectForFile(path);
    if (project === undefined) {
      return [`Could not load public API project for entry point: ${path}`];
    }
    return [
      ...project.program.getProgramDiagnostics(),
      ...project.program.getSyntacticDiagnostics(),
      ...project.program.getBindDiagnostics(),
      ...project.program.getSemanticDiagnostics(),
    ]
      .filter(({ category }) => category === DiagnosticCategory.Error)
      .map(({ fileName, text }) => `${fileName ?? path}: ${text}`);
  });
  if (diagnostics.length > 0) throw new Error(diagnostics.join("\n"));
}

const moduleKindNames: Readonly<Record<number, string>> = {
  [ModuleKind.None]: "none",
  [ModuleKind.CommonJS]: "commonjs",
  [ModuleKind.AMD]: "amd",
  [ModuleKind.UMD]: "umd",
  [ModuleKind.System]: "system",
  [ModuleKind.ES2015]: "es2015",
  [ModuleKind.ES2020]: "es2020",
  [ModuleKind.ES2022]: "es2022",
  [ModuleKind.ESNext]: "esnext",
  [ModuleKind.Node16]: "node16",
  [ModuleKind.Node18]: "node18",
  [ModuleKind.Node20]: "node20",
  [ModuleKind.NodeNext]: "nodenext",
  [ModuleKind.Preserve]: "preserve",
};

const moduleResolutionKindNames: Readonly<Record<number, string>> = {
  0: "classic",
  1: "classic",
  2: "node10",
  3: "node16",
  99: "nodenext",
  100: "bundler",
};

const scriptTargetNames: Readonly<Record<number, string>> = {
  2: "es2015",
  3: "es2016",
  4: "es2017",
  5: "es2018",
  6: "es2019",
  7: "es2020",
  8: "es2021",
  9: "es2022",
  10: "es2023",
  11: "es2024",
  12: "es2025",
  99: "esnext",
  100: "json",
};

const jsxEmitNames: Readonly<Record<number, string>> = {
  0: "none",
  1: "preserve",
  2: "react-native",
  3: "react",
  4: "react-jsx",
  5: "react-jsxdev",
};
