# Plan 003 style and layout field notes

## 2026-08-17 — P003-01 element style protocol

### Environment

- Node: `v26.7.0`
- pnpm: `11.21.0` selected through `corepack pnpm@11.21.0`
- Browser: Playwright Chromium through Vitest Browser Mode

### RED

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Result: exit 1; 2 test files failed, with 2 failed and 26 passed tests.

- The element-protocol test received neither descriptor `style` nor descriptor
  `key`; both were still nested in props.
- The layer render count remained 1 instead of 2 when only the root descriptor
  style changed, proving that its cache comparison ignored style.

The first draft of the layer test put style in the old props object, which made
the old shallow-props comparison invalidate accidentally. Before production
changes, the test was tightened to vary descriptor style while holding props
stable; that version produced the second expected RED failure above.

### GREEN

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; 2 test files and all 28 tests passed.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 0; `tsc --noEmit` reported no errors. This includes the public
package-consumer assertions for required style, reserved `key`/`style`
collisions, and the three-argument rendering context.

### Review-relevant observations

- Specified style is preserved by reference and exposed readonly to render;
  omitted style shares one frozen empty object.
- `SystemStyle` remains an optional-only, index-free public base. A closed
  structural schema check supports inline component-specific style shapes
  without TypeScript weak-type rejection or arbitrary excess properties.
- Existing visual props are intentionally unchanged in this protocol task;
  P003-02 begins their migration. No visual baseline was changed.

### Adversarial review round 1

Review found four important gaps: reserved names were checked only across the
intersection of union keys, required style fields were checked only across the
intersection of union keys, every component call cloned props even when no
metadata needed extraction, and the execution ledger advanced before its review
was clean. It also found that a raw `object` style constraint admitted arrays,
functions, dates, and other non-style values too broadly.

Fix RED commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

The browser command exited 1 with 1 failed and 27 passed tests because plain
props were equal but not reference-identical. Typecheck exited 1 with six unused
`@ts-expect-error` directives: partial-union `key`, partial-union `style`, a
disjoint required-style union, and array/function/date style schemas were all
incorrectly accepted.

Fix GREEN commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

The browser command exited 0 with both files and all 28 tests passing.
Typecheck exited 0 with no errors. Distributive union-key utilities now reject a
reserved name or require style when any union member demands it. A closed,
index-free structural style-schema validator retains the public
`SystemStyle.custom` capability while rejecting non-object, empty/broad-index,
array, function, date, and common built-in resource schemas. A no-extraction
fast path preserves the original props reference; inputs with an own `key` or
`style` still produce separated props.

P003-01 remains in progress pending clean adversarial re-review. P003-02 has not
started.

### Adversarial review round 2

Re-review found that round 1's finite non-plain-style blacklist was not a sound
definition of a style schema: unrelated resource and class types not named by
the blacklist could still pass the structural heuristic.

Fix RED command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 1 with three unused `@ts-expect-error` directives. `URL`, `Error`,
and `Blob` were all incorrectly accepted as component style schemas.

The heuristic was replaced with a positive base contract: every accepted style
type explicitly extends `SystemStyle` or intersects with it. `SystemStyle`
retains optional `custom` and has no index signature. Declared styles with
required members accept ordinary object inputs without spelling `custom`,
remain excess-property checked, and continue to participate in distributive
required-style logic. Unrelated resource/class types fail unless their declared
type deliberately opts in.

Fix GREEN commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Typecheck exited 0 with no errors. The focused browser command exited 0 with
both files and all 28 tests passing. P003-01 remains in progress pending clean
re-review, and P003-02 remains queued.

### Clean adversarial review closure

The final code re-review of the positive `SystemStyle` base contract was clean
with no remaining findings. Across the task, initial review found four Important
issues plus the broad style-shape concern, the first re-review found one
remaining Important blacklist issue, and the next code re-review accepted all
fixes.

Per the review workflow, this status-only closure marks P003-01 done, advances
P003-02 as the sole next step, synchronizes the board, and amends the same task
commit. No production or test file changed in this closure and no checks were
rerun; the immediately preceding fresh evidence remains clean workspace
typecheck and 28/28 focused browser tests. The final amended task commit is sent
for status-only re-review before P003-02 begins.
