# JSX component authoring delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for the named revision and environment, not current API guidance or reusable test totals.

Date: 2026-09-04

## Scope and environment

Task 15 verification started from clean commit
`d19d80d307979b4d2584a9460494c841204455ec`. The only product artifacts changed
during closure were five individually reviewed Studio baselines recorded below.

- macOS 26.6.2 (25G83), arm64
- Node.js `v26.7.0`; pnpm `11.21.0`; Vitest `4.1.10`
- Playwright Chrome for Testing `151.0.7922.34`, arm64
- Studio port `4175`; occupied port 4174 was not disturbed

Node 24.15.0 or newer on the Node 24 LTS line remains canonical. The available
Node 26.7.0 environment passed every gate, but does not replace a Node 24 run
when release policy requires one.

## Fresh focused results

| Command                                                                      | Exit | Result                                                                                                                                                 |     Wall |
| ---------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------: |
| `corepack pnpm@11.21.0 scenarios:check`                                      |    0 | 42 lessons; 16 labs                                                                                                                                    |  0.513 s |
| `corepack pnpm@11.21.0 typecheck`                                            |    0 | no diagnostics                                                                                                                                         |  0.317 s |
| `corepack pnpm@11.21.0 lint`                                                 |    0 | ESLint/Prettier clean                                                                                                                                  |  1.660 s |
| `corepack pnpm@11.21.0 build`                                                |    0 | workspace packages built                                                                                                                               |  0.572 s |
| `corepack pnpm@11.21.0 playground:build`                                     |    0 | source Studio and 112-type declaration parity                                                                                                          |  1.882 s |
| `corepack pnpm@11.21.0 playground:build:built`                               |    0 | built-package Studio and declaration parity                                                                                                            |  2.461 s |
| `corepack pnpm@11.21.0 test:package-consumer:packed`                         |    0 | Bundler, NodeNext, declarations, compiler entries, deep-import rejection, no-source output, and focus elimination passed; 111,125 versus 134,769 bytes |  1.846 s |
| `corepack pnpm@11.21.0 test:ci`                                              |    0 | 84 files; 1,175 passed and 2 skipped of 1,177; Vitest 21.61 s                                                                                          | 21.890 s |
| `PIBBL_STUDIO_PREVIEW_PORT=4175 corepack pnpm@11.21.0 test:visual-safeguard` |    0 | drill rejected, baseline bytes preserved, green recovered                                                                                              |  3.240 s |
| `PIBBL_STUDIO_PREVIEW_PORT=4175 corepack pnpm@11.21.0 test:studio-visual`    |    0 | 5 baselines matched                                                                                                                                    |  4.250 s |
| `corepack pnpm@11.21.0 test:smoke:built`                                     |    0 | 1/1 passed; Vitest 650 ms                                                                                                                              |  1.534 s |
| `corepack pnpm@11.21.0 test:lifecycle`                                       |    0 | 2 files; 14/14 passed; Vitest 9.69 s                                                                                                                   |  9.911 s |
| `corepack pnpm@11.21.0 test:performance`                                     |    0 | 9 passed and 2 opt-in skips of 11; Vitest 1.49 s                                                                                                       |  1.710 s |

Initial sandbox runs could not open the `tsx` IPC socket or bind local browser
ports and exited 1 without an assertion failure. The identical commands were
rerun promptly with local-process approval; the table records those passes.

## Aggregate result

```sh
/usr/bin/time -p env PIBBL_STUDIO_PREVIEW_PORT=4175 corepack pnpm@11.21.0 trust
```

Exit 0 in 56.40 seconds (`user` 69.88 s; `sys` 15.47 s). The fresh run passed
42 lessons and 16 labs; 741 documentation RED probes; exact source/built Studio
types and builds; packed consumers; 84 browser files with 1,175 passed and 2
skipped tests of 1,177 in 21.41 seconds; the visual safeguard; 5 Studio
baselines; 1 built smoke test in 635 ms; 14 lifecycle tests in 9.68 seconds;
and 9 structural-performance passes plus 2 opt-in skips in 1.47 seconds. Older
265/294-test totals were not reused.

### Release-blocker `createElement` type follow-up

A final release-blocker pass started from clean commit
`ddc78df4dfd13856712db18a84e84a90157722b4`. The public `createElement`
signature now derives each variadic child argument from the target component's
declared `children` contract without changing runtime construction. Focused
public authoring tests passed 2 files and 19 tests; root typecheck, the curated
Studio declaration verifier, direct Bundler and NodeNext package consumers, 741
documentation RED probes, and lint/format all exited 0.

The one requested aggregate command,
`env PIBBL_STUDIO_PREVIEW_PORT=4175 corepack pnpm@11.21.0 trust`, exited 0 in
52.31 seconds. It passed 42 lessons and 16 labs; exact source/built Studio types
and builds; packed consumers; 84 browser files with 1,176 passed and 2 skipped
tests of 1,178 in 21.44 seconds; the visual safeguard; 5 Studio baselines; 1
built smoke test in 646 ms; 14 lifecycle tests in 9.69 seconds; and 9
structural-performance passes plus 2 opt-in skips in 1.47 seconds. The expected
Vite chunk-size and ineffective-dynamic-import warnings remained unchanged.

Review then found that repeating a custom scalar child remained unsound because
the runtime delivers multiple variadic children as an array. Starting from
clean commit `5d4e178c8272689e5f54dc9f84fab0729f376dbb`, the signature was
tightened to distinguish zero, one, and multiple child arguments and the Studio
declaration/parity fixture was updated with the same rule. Focused public tests
again passed 2 files and 19 tests; root typecheck and Studio parity exited 0.
The single follow-up aggregate command exited 0 in 53.67 seconds: 84 browser
files passed with 1,176 passed and 2 skipped tests of 1,178 in 21.48 seconds;
the visual safeguard and 5 Studio baselines matched; 1 built smoke test passed
in 638 ms; 14 lifecycle tests passed in 9.68 seconds; and 9 structural-
performance tests passed with 2 opt-in skips in 1.47 seconds. Runtime code and
the expected Vite warnings remained unchanged.

## Automated acceptance

A narrow production-Studio Playwright probe exited 0 in 10.339 seconds. Each
of six routes had one script-only sandbox, `Live` status, zero diagnostics, an
editor mutation that replaced the preview, and a documented Canvas/keyboard
interaction that changed the Canvas image:

- getting started: `4b2b64c6` to `9d2d2285`;
- dedicated non-JSX: `e3d56e1f` to `72451322`;
- `Text` interpolation/zero: `c31090d3` to `b0272eda`;
- arbitrary `Grid` interpolation: `76654d77` to `f5365a0e`;
- multi-child `Layer`: `af840654` to `c554b26f`; and
- focus/keyboard: `551da0d1` to `f4b76ad7`.

Focused public tests also passed exact Text zero/state interpolation, recursive
Grid children/keyed placement, Layer array/iterable materialization and source
order, non-JSX mount/focus/lifecycle, and directional focus ownership.

A temporary esbuild consumer using a React stub runtime produced the expected
root diagnostic:

```text
Pibbl received a React element. This file is using the React JSX runtime.
Set jsxImportSource to "@pibbl/core" or add /** @jsxImportSource @pibbl/core */.
Received by Pibbl root.
```

The focused development-runtime case retained
`ResultsGrid at results.pibbl.tsx:44:9`. The packed gate compiled
`mixed-runtime/react-host.tsx`, which mounts a typed Pibbl scene from a React-host
file through aliased `createPibblElement`.

## Visual inspection and baseline reconciliation

Expected, actual, and emitted diff artifacts were opened at native detail.
The `dep-03` source/built triplets showed only the deliberate safeguard drill;
the command preserved baseline bytes and recovered green. Every expected/actual
pair under `tfc-05`, `tfc-06`, and `tfc-09` was visually unchanged and
byte-identical; emitted diffs were inspected. No runtime baseline changed.

Five stale pre-pivot Studio baselines were reviewed at original detail and
authorized one at a time. Canvas output was unchanged; only the intended
`Without JSX` entry, numbering/navigation, JSX/descriptive vocabulary, copy,
and test-lab `.tsx` path changed.

| Baseline                        | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `studio-landing.expected.png`   | `bce7aa4e81bbf534f0ee4fd5851b259eca3e56a44c8a16760d9b6e78267b02d7` | `109c74a53246bb000deac7691ea339257eaa1b4a708acbaefdd737faa4096b97` |
| `studio-primitive.expected.png` | `60351533641cccfa82172d4efe9bcc1858cac935b2e47735b0deaadad9707321` | `d8384ef1f3c832cc1cad98e16de7ee52ca6112df279e213f587a7e87f3ae178d` |
| `studio-mouse.expected.png`     | `eb94cd15a0b256b45dbb71ad4e87eb02e814138b0ef9b84d901530bfef24940f` | `3bc934f180245d4ea9ade4080c7d8197a7d9857dee05d0a7d72f63213c900ec1` |
| `studio-advanced.expected.png`  | `50bd01008b1bfb118fed1926fb9d209f168bc0defb358923e6f59f47746598d4` | `37cca51642741ce6e65afb22391ce3ce41337167e63b2ecc5aa35b0b820b599b` |
| `studio-test-lab.expected.png`  | `a64e5b115a2ec15a6075ae0da60ad278122b7a759c4d15ab63126f802a02064b` | `ed62621673089498784b4e420516ae699147cfd4e532c2fd744b0ecef692138b` |

The final five expected/actual files were byte-identical. The Studio suite and
safeguard both passed again. No other checked-in baseline was rewritten.

## Accepted limitations and non-goals

Two verifier-hardening residuals are accepted scope decisions, not product
defects. Task 12 does not explicitly reject every triple-slash `reference lib`,
`types`, or `path` directive in the Studio declaration comparator; all checked
parity/type probes pass, and the user ended that verifier-only work. Task 14
found 11 accepted coordinated evidence-pair swaps among 1,128 mutations when a
candidate digest was also recomputed; checked-in digests reject ordinary swaps,
the current mappings were independently relevant, and the user stopped further
hardening after a diminishing-returns decision.

Approved non-goals remain React reconciliation/hooks/classes, lowercase JSX
intrinsics, the classic transform, async/Promise/Suspense/server components,
compiler plugins, generated DOM/accessibility semantics, retained scene graphs,
style cascade/inheritance/selectors, compatibility aliases, hidden editing,
rich text, margin/scrolling, Grid auto placement/advanced intrinsic sizing,
reverse/reordered Flexbox, workers/WebGL, public virtualization, and
library-owned image CORS policy.
