# DEP-02 foundational toolchain upgrade notes

> **Historical status: COMPLETED DEPENDENCY RECORD.** Versions and results are a dated snapshot, not the current verification result.

Date: 2026-08-11

Status: complete.

## Selected toolchain

| Concern                |                          Before |                    Final | Repository adaptation                                                                                 |
| ---------------------- | ------------------------------: | -----------------------: | ----------------------------------------------------------------------------------------------------- |
| Node.js                |            local 24.12.0; CI 22 | Node 24 LTS, `>=24.15.0` | CI uses `pnpm/setup@v2` with `runtime: node@24`; evidence ran on 24.19.0.                             |
| pnpm                   | 9.13.2 plus a direct dependency |                  11.21.0 | The exact `packageManager` declaration is authoritative; CI and local frozen installs use it.         |
| TypeScript             |                           5.6.3 |                    7.0.2 | Removed the incompatible typescript-eslint and unbuild consumers; CLI owns checking and declarations. |
| Node declarations      |                          22.9.0 |                   26.2.0 | Latest declarations pass the Node 24 runtime and package checks.                                      |
| ESLint                 |                          9.15.0 |                   10.8.1 | Flat config now uses Babel 8 only as a syntax parser for TypeScript.                                  |
| TypeScript lint parser | typescript-eslint through Antfu |                     none | TypeScript owns semantic, undefined, and unused checks; ESLint owns version-independent code rules.   |
| Formatting             |    Antfu + eslint-plugin-format |       Prettier 3.9.6 CLI | Direct checks cover Markdown, CSS, JSON, and YAML; generated lockfiles are excluded.                  |

## Removed dependencies

- `@antfu/eslint-config` and `eslint-plugin-format`: their typescript-eslint chain did not support TypeScript 7.
- `@antfu/utils`: no repository consumer.
- direct `pnpm`: redundant with `packageManager`.
- `vue-tsc`: no Vue single-file components; `tsc --noEmit` covers the workspace.
- typescript-eslint: absent from the resolved graph.
- `unbuild`: removed at the user's direction because TypeScript 7 no longer provides its programmatic compiler API. DEP-03 records the replacement package build.

## Breaking changes and adaptations

### pnpm 11 and Node 24

- `allowBuilds` permits esbuild's required native-binary install and explicitly declines MSW's informational postinstall.
- `pnpm/setup@v2` reads the exact package manager, installs Node 24, caches the pnpm store, and leaves the frozen install explicit.
- The supported Node floor is 24.15.0 because Babel 8 and the original resolved lint graph require a newer Node 24 patch than the first 24.x LTS release.

### TypeScript 7 without typescript-eslint

- TypeScript 7.0.2 typechecks every workspace source and emits declarations through the CLI.
- Babel 8's ESLint parser accepts current TypeScript syntax without using TypeScript's programmatic API.
- Compiler-owned ESLint core rules are disabled only for TypeScript files; `noUnusedLocals` and `noUnusedParameters` preserve unused-symbol coverage in the compiler.
- Production relative specifiers use explicit `.js` extensions so emitted declarations resolve under both Bundler and NodeNext.
- `isolatedModules` guards the transform assumptions shared by TypeScript and esbuild.

### Formatting boundary

Applying Prettier to code would have changed 47 of 71 code files (about 2,000 lines) and obscured the dependency migration. DEP-02 therefore uses ESLint for code correctness and direct Prettier checks for repository prose/config/styles. A future code-format migration, if desired, should be a dedicated mechanical change.

## Final evidence

All final commands ran on macOS with Node 24.19.0 and pnpm 11.21.0.

| Evidence                         | Result                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- |
| Frozen install with strict peers | Pass; package-manager supply-chain policy passed.                           |
| TypeScript                       | 7.0.2; workspace typecheck passed.                                          |
| Forbidden graph checks           | `pnpm why @typescript-eslint/parser` and `pnpm why unbuild` returned empty. |
| Lint and formatting              | Pass.                                                                       |
| Package and gallery builds       | Pass.                                                                       |
| Source and built smoke           | Pass against the same scenario and visual baseline.                         |
| Focused repeatability            | Ten independent Chromium runs passed without retries.                       |
| Full browser suite               | 10 files; 71 passed and 4 skipped.                                          |
| Manual gallery                   | Source and built modes passed mount, update, coordinate click, and reset.   |
| Visual parity                    | Source and built actual images were byte-identical (`ffcfdf8f…c0eccb3`).    |

The temporary TypeScript 5.9 proposal was superseded by the user's explicit decision to remove the incompatible lint/build consumers and proceed with TypeScript 7.
