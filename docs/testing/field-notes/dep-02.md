# DEP-02 field note — foundational toolchain modernization

Date: 2026-08-11

## Scenario and risk

DEP-02 changed package-manager, compiler, lint, and formatting foundations while the `baseline-smoke` public scenario had to remain behaviorally and visually unchanged. The highest risks were hidden peer incompatibilities, lost TypeScript checks, and broad formatting churn masquerading as migration work.

## Manual and headless method

- Manual source and built galleries were exercised in Codex in-app Chromium on macOS under Node 24.19.0 and pnpm 11.21.0.
- Both modes passed mount at revision/clicks `0/0`, update to revision `1`, Canvas click at scenario coordinate `(100, 100)`, and reset to `0/0`.
- The shared headless scenario validated source identity, mounted, updated, clicked with real browser input, reset, disposed, and compared against the reviewed image.
- Ten independent focused launches passed; the full suite passed 71 tests with 4 known skips.

## Visual strategy and controls

The DEP-01 viewport, device scale, locale, timezone, color profile, reduced motion, Canvas dimensions, semantic pixel probes, glyph masks, and baseline were retained. No baseline changed. Source and built actual PNGs were byte-identical.

## Surprising findings and browser differences

- TypeScript 7 support required architecture rather than a peer override: both typescript-eslint and unbuild depended on the removed programmatic compiler API.
- Babel parses current TypeScript syntax for ESLint, but its scope model does not understand TypeScript's type namespace. TypeScript therefore owns undefined, unused, and semantic checks.
- pnpm 11 rejects unreviewed dependency build scripts; esbuild must be allowed explicitly.
- Prettier-on-code would have reformatted 47 files and buried the migration in unrelated churn.
- Node 24.12 was below the resolved lint graph's engine floor; all final evidence used Node 24.19.0.

## Flakes and stabilization

- Ten isolated smoke launches were stable.
- Competing standalone Chromium launches can contend for macOS Mach ports; sequential browser gates passed and no retry was added.
- Scenario actions await CRC's render-settling boundary; no timing sleeps were introduced.

## Failed or rejected approaches

- Rejected TypeScript 5.9 as a silent permanent exception after the user chose the TypeScript 7 path.
- Rejected ignoring peer ranges or disabling TypeScript validation.
- Rejected Babel scope-based unused/undefined rules for TypeScript because they produced type-space false positives.
- Rejected a repository-wide code-format change during a dependency migration.
- Rejected retaining `vue-tsc`, Antfu, or dead helpers without a live consumer.

## Helper and tooling friction

- Compiler ownership and lint ownership need an explicit boundary when a parser can parse syntax but cannot model its type namespace.
- Dependency migration checks should include resolved engines, peers, install scripts, direct/transitive ownership, and CI drift.
- Browser gates should serialize standalone local runners while preserving file-level parallelism inside one runner.

Candidate tools:

1. a dependency verifier for engine floors, peers, approved build scripts, stale direct dependencies, and CI/package-manager drift;
2. a local browser-gate command that serializes standalone Chromium runs and keeps their evidence paths distinct.

## Decisions and follow-ups

- Node 24.15.0 and pnpm 11.21.0 are the supported foundations.
- TypeScript 7.0.2 is the compiler; no typescript-eslint or unbuild package remains in the graph.
- TypeScript owns TypeScript semantic/unused checks; ESLint owns version-independent code rules; Prettier owns non-code formatting.
- A code-wide formatting policy remains a separate optional migration, not a hidden DEP-02 side effect.
