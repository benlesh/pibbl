# Dependency inventory and modernization batches

Audited on 2026-08-11 for DEP-01. Registry versions are the stable `latest` tags observed during the audit. Workspace packages (`@crc/core`, `@crc/types`, and private `@crc/scenarios`) are not third-party dependencies.

## Final modernization outcome

DEP-02 through DEP-04 completed the inventory on 2026-08-11. `pnpm outdated -r --format json` now returns `{}`; the lockfile is deduplicated, strict-peer clean, and audit-clean. TypeScript 7.0.2 is supported by removing the typescript-eslint and unbuild consumers. Vite 8.2.1, Vitest 4.1.10, Playwright 1.62.1, and the remaining direct tools are at their registry-latest releases. See [DEP-02 upgrade notes](./dep-02-upgrade-notes.md), [DEP-03 upgrade notes](./dep-03-upgrade-notes.md), and [dependency freshness closure](./dependency-freshness.md).

The tables below preserve the initial DEP-01 audit and cluster assignments as historical evidence; their proposed TypeScript 5.9 exception was superseded by the user's TypeScript 7 architecture decision.

## Initial toolchain decision (superseded where noted)

- Target Node.js 24 LTS with `engines.node` set to `>=24.15.0`.
- Target pnpm 11.21.0 through the root `packageManager` declaration; remove the redundant direct `pnpm` development dependency.
- Align local instructions and every CI job to those declarations.
- TypeScript 7.0.2 is registry-latest but is externally blocked: the latest typescript-eslint parser supports TypeScript `<6.1.0`, while `unbuild@3.6.1` declares `typescript@^5.9.2`. TypeScript 5.9.3 is the newest common supported release. Retaining it requires the explicit exception described in the active plan and must be rechecked in DEP-04.

The initial Node floor was `24.11.0`, the first Node 24 LTS patch. The resolved Antfu 9 graph raised it to `24.15.0`: `eslint-plugin-command@4`, `@es-joy/jsdoccomment`, and `jsdoc-type-pratt-parser` declare `^22.22.2 || >=24.15.0`. Node recommends Active or Maintenance LTS releases for general use. Relevant upstream references: [Node releases](https://nodejs.org/en/about/previous-releases), [typescript-eslint supported versions](https://typescript-eslint.io/users/dependency-versions/), [Vitest browser setup](https://main.vitest.dev/guide/browser/), and [Vite 8 migration](https://vite.dev/guide/migration.html).

## Used direct dependencies

| Package                | Locked | Latest | Disposition and owner                                                |
| ---------------------- | -----: | -----: | -------------------------------------------------------------------- |
| `@antfu/eslint-config` |  3.9.1 |  9.3.0 | Upgrade in DEP-02; imported by `eslint.config.mjs`.                  |
| `@types/node`          | 22.9.0 | 26.2.0 | Upgrade in DEP-02; selected by `tsconfig.json`.                      |
| `eslint`               | 9.15.0 | 10.8.1 | Upgrade in DEP-02; root lint runner.                                 |
| `eslint-plugin-format` |  0.1.2 |  2.0.1 | Upgrade in DEP-02; used by Antfu formatters.                         |
| `prettier`             |  3.3.3 |  3.9.6 | Upgrade in DEP-02; formatting implementation.                        |
| `typescript`           |  5.6.3 |  7.0.2 | DEP-02 external blocker; 5.9.3 is the newest supported intersection. |
| `unbuild`              |  2.0.0 |  3.6.1 | Upgrade in DEP-03; both packages build with it.                      |
| `vite`                 | 5.4.11 |  8.2.1 | Upgrade in DEP-03; gallery and runner-facing configuration.          |
| `vite-tsconfig-paths`  |  5.1.2 |  6.1.1 | Upgrade in DEP-03; reevaluate against Vite 8 built-in path support.  |
| `@antfu/ni`            | 0.23.0 | 30.5.0 | Upgrade in DEP-04; `nr build` in publish lifecycle scripts.          |
| `bumpp`                |  9.8.1 | 12.2.0 | Upgrade in DEP-04; release script.                                   |
| `@vitest/browser`      |  2.1.8 | 4.1.10 | Upgrade with the exact Vitest browser cluster in DEP-04.             |
| `@vitest/ui`           |  2.1.8 | 4.1.10 | Upgrade with the exact Vitest browser cluster in DEP-04.             |
| `playwright`           | 1.49.0 | 1.62.1 | Upgrade in DEP-04; browser provider and CI installation.             |
| `vitest`               |  2.1.8 | 4.1.10 | Upgrade in DEP-04; tests and root configuration.                     |

Vitest 4 requires adding `@vitest/browser-playwright@4.1.10` and migrating the provider configuration to `playwright()` with explicit browser instances.

## Installed direct dependencies to remove

These packages are installed at the root but have no live repository consumer. Removal belongs to the named compatibility batch so a regression stays attributable.

| Cluster | Package                       | Locked |  Latest | Evidence / disposition                                                   |
| ------- | ----------------------------- | -----: | ------: | ------------------------------------------------------------------------ |
| DEP-02  | `@antfu/utils`                | 0.7.10 |   9.3.0 | No imports; remove.                                                      |
| DEP-02  | `pnpm`                        | 9.13.2 | 11.21.0 | Redundant with `packageManager`; remove direct dependency.               |
| DEP-02  | `vue-tsc`                     | 2.1.10 |   3.3.9 | No Vue/SFC source; replace typecheck script with `tsc --noEmit`.         |
| DEP-03  | `@rollup/plugin-alias`        |  5.1.1 |   6.0.0 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `@rollup/plugin-commonjs`     | 28.0.1 |  29.0.3 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `@rollup/plugin-json`         |  6.1.0 |   6.1.0 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `@rollup/plugin-node-resolve` | 15.3.0 |  16.0.3 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `@rollup/plugin-replace`      |  6.0.1 |   6.0.3 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `@rollup/plugin-terser`       |  0.4.4 |   1.0.0 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `rollup`                      | 4.27.2 |  4.62.4 | No script invokes the committed Rollup config; remove.                   |
| DEP-03  | `rollup-plugin-copy`          |  3.5.0 |   3.5.0 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `rollup-plugin-dts`           |  6.1.1 |   6.5.1 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `rollup-plugin-esbuild`       |  6.1.1 |   6.2.1 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `rollup-plugin-typescript2`   | 0.36.0 |  0.37.0 | Only used by unreachable Rollup config; remove.                          |
| DEP-03  | `fs-extra`                    | 11.2.0 |  11.4.0 | Only used by unreachable Rollup config; remove.                          |
| DEP-04  | `diff-match-patch-es`         |  0.1.1 |   2.0.1 | No imports; remove.                                                      |
| DEP-04  | `esno`                        |  4.8.0 |   4.8.0 | No scripts/imports; remove.                                              |
| DEP-04  | `jiti`                        |  2.4.0 |   2.7.0 | No direct use; optional ESLint peer does not require direct declaration. |
| DEP-04  | `jsonc-parser`                |  3.3.1 |   3.3.1 | No imports; remove.                                                      |
| DEP-04  | `picocolors`                  |  1.1.1 |   1.1.1 | No imports; remove.                                                      |
| DEP-04  | `rimraf`                      |  6.0.1 |   6.1.3 | No scripts/imports; remove.                                              |
| DEP-04  | `taze`                        | 0.18.0 |  20.0.1 | No scripts/imports; remove.                                              |

`packages/core/rollup.config.mjs` is not reachable from any manifest script: package builds call `unbuild`. DEP-03 removes the config with its direct-only dependency graph before upgrading the live build tools.

## Catalog-only entries to remove

These entries have no manifest consumer, lockfile resolution, or repository import.

| Cluster | Catalog entry                | Declared | Latest |
| ------- | ---------------------------- | -------: | -----: |
| DEP-03  | `@iconify-json/carbon`       |    1.2.4 | 1.2.25 |
| DEP-03  | `@iconify-json/codicon`      |    1.2.3 | 1.2.69 |
| DEP-03  | `@iconify-json/ph`           |    1.2.1 |  1.2.2 |
| DEP-03  | `@iconify-json/svg-spinners` |    1.2.1 |  1.2.4 |
| DEP-03  | `@unocss/reset`              |   0.64.1 | 66.7.5 |
| DEP-03  | `@vueuse/core`               |   11.2.0 | 14.4.0 |
| DEP-03  | `floating-vue`               |    5.2.2 |  5.2.2 |
| DEP-03  | `fuse.js`                    |    7.0.0 |  7.5.0 |
| DEP-03  | `monaco-editor-core`         |   0.52.0 | 0.56.0 |
| DEP-03  | `pinia`                      |    2.2.6 |  4.0.2 |
| DEP-03  | `twoslash`                   |   0.2.12 |  0.3.9 |
| DEP-03  | `twoslash-vue`               |   0.2.12 |  0.3.9 |
| DEP-03  | `unocss`                     |   0.64.1 | 66.7.5 |
| DEP-03  | `unplugin-vue-components`    |   0.27.4 | 32.1.0 |
| DEP-03  | `vitepress`                  |    1.5.0 |  1.6.4 |
| DEP-03  | `vitepress-plugin-mermaid`   |   2.0.17 | 2.0.17 |
| DEP-03  | `vue`                        |   3.5.12 | 3.5.41 |
| DEP-04  | `simple-git-hooks`           |   2.11.1 | 2.13.1 |
| DEP-04  | stale catalog `vitest`       |    2.0.5 | 4.1.10 |

Workspace globs for `packages/*/playground`, `examples/*`, and `docs` currently match no package manifests. They are recorded for cleanup when the affected package/build topology is changed.

## CI-installed tooling

| Current declaration                  | Target                                                                 | Cluster |
| ------------------------------------ | ---------------------------------------------------------------------- | ------- |
| `actions/checkout@v4`                | `actions/checkout@v7.0.1`                                              | DEP-02  |
| `pnpm/action-setup@v2` with `latest` | `pnpm/setup@v2.0.2`, reading `packageManager`                          | DEP-02  |
| `actions/setup-node@v4`, Node 22     | Node 24 through the selected setup path; otherwise `setup-node@v7.0.0` | DEP-02  |
| `actions/upload-artifact@v4`         | `actions/upload-artifact@v7.0.1`                                       | DEP-04  |
| Playwright Chromium install          | Keep; revision follows Playwright 1.62.1                               | DEP-04  |

## Freshness, audit, and deprecation baseline

- `pnpm outdated -r --format json`: 32 outdated direct dependencies.
- `pnpm audit --json`: 115 development-tool findings — 4 critical, 56 high, 49 moderate, and 6 low.
- `pnpm audit --prod --json`: zero findings; CRC has no third-party production dependency.
- Critical chains include Vitest 2 execution/access-control advisories and vulnerable `tar` through old `bumpp`.
- High tool chains include Playwright certificate verification, pnpm lock/path/command injection, Rollup arbitrary file write, and Vite server/file-access advisories.
- Deprecated transitive nodes: `glob@7.2.3` and `inflight@1.0.6` through unused `rollup-plugin-copy`; `glob@8.1.0` and `inflight@1.0.6` through `unbuild@2.0.0`.
- Registry metadata reported no selected latest direct package as deprecated.

Audit, peer health, deprecations, transitive constraints, and current direct versions are rechecked independently at DEP-04; a clean `outdated` result is not treated as a security claim.
