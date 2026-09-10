# Foundation static-gate repair report

## Change

- File: `packages/core/src/lib/signals/graph.ts`
- Replaced the unused `false` initializer for `changed` with a definite boolean declaration. The variable is assigned by both the successful computation result and the error path before its later observer-notification check.

## Evidence

- Before: `corepack pnpm@11.21.0 lint:code` failed with `no-useless-assignment` at `packages/core/src/lib/signals/graph.ts:227:9`.
- After: `corepack pnpm@11.21.0 lint:code` passed.
- Focused browser tests: `corepack pnpm@11.21.0 vitest run packages/core/src/lib/signals/graph.test.ts packages/core/src/lib/signals/render-consumer.test.ts --browser.headless --browser.ui=false` passed (2 files, 36 tests).
- `corepack pnpm@11.21.0 typecheck` passed.
- `git diff --check` passed.

## Self-review

The one-line change retains all graph behavior: `changed` still receives its value on every normal or caught-error path, and no lint suppression, public API, or unrelated logic changed.

## Commit

- `fix(core): satisfy signal graph lint`
