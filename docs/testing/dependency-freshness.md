# Dependency freshness closure

Date: 2026-08-11

## Final direct graph

`pnpm outdated -r --format json` returned `{}` after the DEP-04 cleanup. Every remaining direct dependency has a live repository purpose and is at the registry's stable latest release observed on this date.

| Concern                 | Final package/version                                                       | Purpose                                                                  |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Compiler                | TypeScript 7.0.2                                                            | Workspace checking and declaration emit.                                 |
| JavaScript bundle       | esbuild 0.28.2                                                              | Package ESM bundles and source maps.                                     |
| App bundle              | Vite 8.2.1                                                                  | Gallery source/built development and production builds.                  |
| Browser tests           | Vitest 4.1.10, `@vitest/browser-playwright` 4.1.10, Playwright 1.62.1       | Browser runner and Chromium provider.                                    |
| Lint                    | ESLint 10.8.1, `@eslint/js` 10.0.1, Babel parser/core 8.0.1, globals 17.9.0 | Version-independent code linting with current TypeScript syntax parsing. |
| Formatting              | Prettier 3.9.6                                                              | Markdown, CSS, JSON, and YAML checks.                                    |
| Runtime types           | `@types/node` 26.2.0                                                        | Tooling/config type declarations.                                        |
| Release/build utilities | bumpp 12.2.0, rimraf 6.1.3, tsx 4.23.12                                     | Versioning, package cleanup, and Vite's optional current transform peer. |

Unused direct utilities, the Antfu/typescript-eslint lint graph, `@vitest/ui`, unbuild, vite-tsconfig-paths, Rollup/plugins, and 18 unconsumed catalog entries were removed instead of upgraded.

## Lockfile and security

- `pnpm install --frozen-lockfile --strict-peer-dependencies`: pass.
- `pnpm dedupe --check`: pass after applying deduplication.
- `pnpm audit --json`: zero advisories at every severity.
- Deprecated transitive warnings: none during the final install.
- Resolved direct graph: 318 development entries including optional dependencies.

Two narrow supply-chain decisions are explicit:

- `tsx@4.23.12` is declared directly to satisfy Vite's optional peer with the current esbuild line instead of pnpm auto-installing stale `tsx@4.19.2`/esbuild 0.23.1.
- `defu` is overridden to `^6.1.7` because latest bumpp's upstream `unconfig` range otherwise selected a vulnerable 6.1.4. The override stays within the upstream semver range and is covered by release-tool loading plus the full repository gate.

## CI tools

- `actions/checkout@v7`
- `pnpm/setup@v2` reading `packageManager`, installing Node 24, and caching the pnpm store
- `actions/upload-artifact@v7`, including custom screenshots and Vitest 4 attachments

Moving major tags remain consistent with the repository's current action policy. Immutable SHA pinning is deferred as a separate all-actions security policy rather than applied inconsistently to one workflow.
