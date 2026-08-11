# DEP-02 foundational toolchain upgrade notes

Date: 2026-08-11

Status: implementation and evidence complete except for the user-approved TypeScript 5.9.3 freshness exception.

## Selected toolchain

| Concern           |                                    Before |                 Selected | Adaptation                                                                                         |
| ----------------- | ----------------------------------------: | -----------------------: | -------------------------------------------------------------------------------------------------- |
| Node.js           |                      local 24.12.0; CI 22 | Node 24 LTS, `>=24.15.0` | CI uses `runtime: node@24`; local evidence ran on 24.19.0.                                         |
| pnpm              | 9.13.2 plus a redundant direct dependency |                  11.21.0 | `packageManager` is authoritative; the direct dependency was removed.                              |
| TypeScript        |                                     5.6.3 |   5.9.3 pending approval | TypeScript 7.0.2 is outside current typescript-eslint and unbuild peer ranges.                     |
| Node declarations |                                    22.9.0 |                   26.2.0 | Latest declarations typecheck the current repository; runtime compatibility still targets Node 24. |
| ESLint            |                                    9.15.0 |                   10.8.1 | Existing flat configuration remains valid.                                                         |
| Antfu config      |                                     3.9.1 |                    9.3.0 | Adopted new formatting rules and scoped unrelated pnpm opinions.                                   |
| Format plugin     |                                     0.1.2 |                    2.0.1 | Continues to provide CSS and Markdown formatting through ESLint.                                   |
| Prettier          |                              direct 3.3.3 |         transitive 3.9.6 | Removed the redundant direct declaration; `eslint-plugin-format` owns the formatter dependency.    |

## Removed dependencies

- `@antfu/utils`: no repository import or configuration consumer.
- direct `pnpm`: redundant with the exact root `packageManager` declaration.
- `vue-tsc`: the repository has no Vue single-file components; `tsc --noEmit` covers the TypeScript workspace.
- direct `prettier`: no CLI script or configuration consumes it directly; the active format plugin supplies it.

## Breaking changes and repository adaptations

### pnpm 11

- A fresh install rejects unreviewed lifecycle scripts. `allowBuilds` permits `esbuild`, whose postinstall installs its native binary, and explicitly denies MSW's informational postinstall.
- The pnpm version now comes only from `packageManager`; CI does not request an unpinned `latest` version.
- `pnpm/setup@v2` installs both pnpm and the Node 24 runtime. `install: false` preserves the explicit frozen-lockfile install step and avoids a duplicate install.
- Root dependency versions that Antfu's pnpm rules require to use the catalog were centralized without advancing the DEP-03/DEP-04 compatibility clusters.

### Node 24 floor

The DEP-01 inventory initially selected Node 24.11.0. The resolved Antfu 9 graph superseded that provisional floor: `eslint-plugin-command@4`, `@es-joy/jsdoccomment`, and `jsdoc-type-pratt-parser` require `^22.22.2 || >=24.15.0`. The root engine is therefore `>=24.15.0`; current evidence used Node 24.19.0.

### ESLint 10 and Antfu 9

- The existing `antfu()` flat configuration loads without an API migration.
- New indentation, trailing-comma, and type-import rules required formatting-only source changes.
- Leading `|` and `&` operators remain the repository convention through a narrow `operator-linebreak` override.
- `pnpm/yaml-enforce-settings` is disabled for `pnpm-workspace.yaml`; adopting `shellEmulator` or `trustPolicy` would change package-manager behavior outside a lint migration.
- `pnpm/yaml-no-unused-catalog-item` is disabled for the workspace file until DEP-03 and DEP-04 remove their intentionally staged unused catalog entries.

### TypeScript 7 external blocker

TypeScript 7.0.2 removes the programmatic compiler API used by current tooling. The latest typescript-eslint packages accept TypeScript `>=4.8.4 <6.1.0`, while `unbuild@3.6.1` accepts `^5.9.2`. TypeScript 5.9.3 is the newest published intersection.

Forcing TypeScript 7 fails strict peer checks and is not a supported upgrade. DEP-02 therefore requires the plan's explicit user approval to retain 5.9.3 temporarily, with registry tags and peer ranges rechecked in DEP-04. Sources: [Microsoft's TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [typescript-eslint dependency support](https://typescript-eslint.io/users/dependency-versions/), and [unbuild 3.6.1 manifest](https://raw.githubusercontent.com/unjs/unbuild/v3.6.1/package.json).

## Evidence captured before the TypeScript decision

All commands below ran on macOS with Node 24.19.0 and pnpm 11.21.0. They currently exercise TypeScript 5.6.3; the same gate must be repeated after the approved move to 5.9.3.

| Evidence                      | Result                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Fresh frozen-lockfile install | Pass; pnpm supply-chain policy verified 865 lock entries.                           |
| Peer dependency check         | Pass; no peer dependency issues found.                                              |
| ESLint without cache          | Pass.                                                                               |
| `tsc --noEmit`                | Pass.                                                                               |
| Package build                 | Pass for `@crc/types` and `@crc/core`.                                              |
| Gallery production build      | Pass; 53 modules transformed.                                                       |
| Focused smoke/visual test     | Pass.                                                                               |
| Focused repeatability         | Ten independent runs passed without retries.                                        |
| Committed browser suite       | 10 files; 71 passed and 4 skipped.                                                  |
| Manual gallery path           | Pass: mount, update, coordinate click, and reset; no warning/error console entries. |
| Visual parity                 | Exact comparison remained unchanged outside the established glyph-only masks.       |
| Formatter ownership           | One Prettier version, 3.9.6, owned by `eslint-plugin-format`.                       |

The first attempt to run two Playwright browser suites concurrently failed because both Chromium processes competed for the macOS sandbox's Mach-port registration. Sequential execution through the approved browser boundary passed; this was runner contention, not a CRC or dependency regression.
