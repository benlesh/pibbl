# DEP-02 field note — foundational toolchain modernization

Date: 2026-08-11

## Scenario and risk

DEP-02 moves package-manager, language, type, lint, and formatting foundations while requiring the DEP-01 public smoke scenario to remain behaviorally and visually unchanged. The main risks were silent peer incompatibilities, package-manager policy changes, and fixing broad product code merely to satisfy new defaults.

## Manual and headless method

- Shared scenario: `baseline-smoke`, loaded through the lazy catalog and exact executable source contract.
- Manual environment: Codex in-app Chromium on macOS, served by Vite under Node 24.19.0 and pnpm 11.21.0.
- Manual path completed: mount at revision/clicks `0/0`, update to revision `1`, click Canvas coordinate `(100, 100)` to reach clicks `1`, and reset to `0/0`. Browser logs contained only Vite connection debug entries.
- Headless method: the same catalog entry was loaded, source identity validated, mounted, updated, clicked with browser input, reset, disposed, and compared to the approved DEP-01 image.
- Repeatability: ten independent focused Chromium runs passed without retries. The full committed suite passed 71 tests with 4 known skips.

## Visual strategy and controls

DEP-02 deliberately reused the DEP-01 viewport, device scale, locale, timezone, color profile, motion, Canvas dimensions, pixel probes, glyph masks, and reviewed expected image. No baseline update was needed. Exact comparison outside the documented text masks remained green, proving that the foundational tooling did not change visible scenario output.

## Surprising findings and browser differences

- pnpm 11 treats unapproved dependency build scripts as an installation error. `esbuild` must be permitted for its binary install; MSW's informational postinstall can be explicitly denied.
- The latest Antfu graph raised the Node floor after the initial inventory. Several resolved lint packages require Node 24.15 or newer, so local Node 24.12 produced a useful engine warning and was upgraded to Node 24.19 for evidence.
- Antfu 9's pnpm rules proposed `shellEmulator`, `trustPolicy`, and immediate deletion of catalog entries reserved for later compatibility clusters. These are policy/topology changes, not necessary lint migrations, so the rules are narrowly disabled for the workspace file.
- The latest Node declarations model Node 26 while the runtime target is Node 24. This satisfies the latest-dependency rule but may permit future accidental use of a Node 26-only API; runtime and integration tests remain the guard until the policy is revisited.
- TypeScript 7 is a genuine upstream incompatibility rather than ordinary migration work: it removes the compiler API current typescript-eslint needs, and latest unbuild still requires TypeScript 5.9.

## Flakes and stabilization

- Ten isolated smoke launches were stable.
- Running the focused and full Playwright suites concurrently caused both Chromium launches to fail macOS Mach-port registration. Sequential launches passed immediately. Browser evidence is therefore parallelized at the test-file level inside one runner, not by starting competing local Chromium runners.
- No timing sleeps or retries were added to application tests; scenario actions continue to await the CRC render-settling boundary.

## Failed or rejected approaches

- Rejected forcing TypeScript 7, ignoring peers, or disabling TypeScript linting. Strict peer checks show no supported TypeScript 7 intersection.
- Rejected retaining `vue-tsc` in a repository with no Vue source.
- Rejected upgrading dead direct packages merely to make an outdated report smaller; unused declarations were removed.
- Rejected adding pnpm runtime settings only because the new lint preset prefers them.
- Rejected deleting DEP-03/DEP-04 catalog entries during DEP-02; compatibility clusters remain attributable.
- Rejected a direct Prettier declaration with no direct consumer; the active formatting plugin owns the current transitive formatter.

## Helper and tooling friction

- A package-manager upgrade can change install security semantics independently of package versions; the trusted-build decision needs explicit review evidence.
- Current-version engine requirements must be checked after resolution, not only from direct package manifests.
- Browser suites on macOS should share one runner when possible; concurrent standalone Chromium launches can fail for environmental reasons unrelated to tests.

Candidate reusable test tools, deferred until another dependency batch confirms the pattern:

1. a dependency-migration verifier that reports resolved engine floors, peer health, direct-versus-transitive ownership, approved build scripts, and CI/package-manager drift;
2. a local browser-gate runner that serializes standalone Chromium suites while preserving the runner's internal test-file parallelism.

## Decisions and follow-ups

- Node 24.15.0 is the supported floor; CI's `node@24` resolves a current compatible LTS patch.
- pnpm 11.21.0 is authoritative through `packageManager`; CI reads it rather than requesting `latest`.
- Formatting-only source changes and narrow lint overrides preserve runtime behavior and later dependency-batch ownership.
- TypeScript 5.9.3 is the newest supported peer intersection, but it cannot be selected or DEP-02 marked done until the user approves the documented temporary exception. Recheck the exception in DEP-04.
- After approval, update TypeScript, rerun the complete evidence table, record the final results here and in the plan, then advance the marker to DEP-03.
