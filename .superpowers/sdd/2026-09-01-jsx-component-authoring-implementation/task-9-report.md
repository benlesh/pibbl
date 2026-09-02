# Task 9 report — Studio CRC TSX compilation and execution

## Result

Task 9 is implemented and ready to commit.

- Workspace: `/private/tmp/crc-jsx-component-authoring`
- Branch: `codex/jsx-component-authoring`
- Required start: `d7fc36fa8cdf`
- Runtime: Node `v26.7.0`, pnpm `11.21.0`
- R8 variance: Node 26 is noncanonical versus the documented Node 24 LTS
  line. Node 24 was not available in this workspace.
- Review mode: self-review only, because Task 9 explicitly prohibited
  subagents and reviewers.

The Studio now checks and emits `.tsx` with the automatic CRC JSX runtime,
loads declarations for the root and both compiler-runtime entries, rewrites
only the three allowed emitted module imports, and runs them through one
Studio-private `CRC_CORE` bridge. The public `@crc/core` root continues not to
export `jsx`, `jsxs`, or `jsxDEV`.

## Implementation

### Monaco and Studio declarations

- Lesson and testing models now use `.tsx` URIs with
  `JsxEmit.ReactJSX`, `jsxImportSource: "@crc/core"`, and ESNext modules.
  Monaco syntax and semantic diagnostics remain enabled.
- The curated declaration bundle is split by exact Studio markers into three
  virtual libraries: `@crc/core`, `@crc/core/jsx-runtime`, and
  `@crc/core/jsx-dev-runtime`.
- The root declaration exposes branded CRC elements, components, nodes,
  Fragment, public JSX component values, text children, events, styles, and
  the existing transitional lowercase API needed by the current `.ts`
  lessons. Compiler constructors exist only in the two runtime declarations.
- Declaration parsing rejects missing, duplicate, or unknown module sections.
- The verifier compiles a complete `.tsx` consumer with a plain component,
  Fragment, mapped list, conditional child, `Text` interpolation, style, event,
  and one default `mount(canvas)` export. A foreign JSX runtime fixture must
  produce a real branded-node incompatibility diagnostic.

### Studio-only runtime bridge

- Added `tooling/crc-studio-runtime-entry.ts`, which re-exports the public root
  plus `jsx`/`jsxs` and `jsxDEV` from the two compiler-only runtime entries.
- The Studio bundler resolves exactly those three package entry points to
  source files in source mode and built `.mjs` files in built mode.
- The verifier executes both generated IIFEs and requires the root API and all
  three compiler functions. It also compares their complete export-key sets,
  so source and built modes cannot silently drift.
- `import.meta.env.DEV` is defined as false for this IIFE-only bridge, avoiding
  an inapplicable esbuild `import.meta` warning without changing package code.

### Sandbox import contract

- Extracted a pure `toRunnableScript` helper so emitted-module rewriting has
  focused browser tests without importing the DOM-backed runner.
- Named static imports are accepted only from `@crc/core`,
  `@crc/core/jsx-runtime`, and `@crc/core/jsx-dev-runtime`.
- All allowed imports become one `CRC_CORE` destructuring declaration. Emitted
  aliases use valid object syntax, for example `jsx as _jsx` becomes
  `jsx: _jsx`.
- Root and runtime imports combine without dropping bindings. Default,
  namespace, dynamic, external, and private/fourth-subpath imports are rejected.
- The transformed module must contain exactly one
  `export default function mount(canvas)` declaration; renamed, missing, and
  duplicate mounts are rejected.

### Temporary mixed source discovery

- Learning and test-lab raw source discovery includes both `.example.ts` and
  `.example.tsx`; learning sources remain excluded from deterministic scenario
  discovery in both forms.
- Catalog discovery and both catalog validators temporarily accept either
  extension. Tests prove an otherwise canonical entry remains valid after its
  source path is changed to `.tsx`.
- No example was migrated and the existing `language: 'ts'` catalog contract
  remains in place. Tasks 10–11 own migration and Task 12 owns removal of the
  `.ts` allowance.

## TDD and investigation evidence

### RED

Tests and verifier assertions were added before production behavior.

- `node tooling/verify-studio-types.mjs` failed with TypeScript syntax
  diagnostics because the verifier compiled JSX as `consumer.ts` without an
  automatic JSX runtime.
- The sandbox test for emitted aliases failed because the old root-only regular
  expression retained `jsx as _jsx` instead of producing an object binding and
  could not combine runtime and root imports.
- Learning and scenario catalog tests rejected `.example.tsx` paths at the
  existing extension validators.
- The executable Studio runtime verifier reported:

  ```text
  CRC Studio source runtime is missing compiler export "jsx"
  ```

The initial sandbox test harness also showed that importing the DOM-backed
runner was the wrong unit boundary. Moving only the pure transformation into
its own module made the RED exercise the existing rewrite behavior directly.

### Iteration diagnostics

- The first exact-entry esbuild resolver used a JavaScript Unicode regular
  expression flag that Go's regular-expression engine does not accept.
  Removing only that unsupported flag preserved the exact pattern and made the
  bridge verifier pass.
- The first full typecheck found `monaco.languages.typescript.IExtraLib` is not
  a public type in this Monaco version. The declaration parser now returns the
  equivalent local structural type accepted by `addExtraLib`.
- Sandboxed Vitest/browser startup and the TypeScript scenario checker initially
  hit local IPC/listener `EPERM` restrictions. The same commands passed when
  run with the required execution permission; neither was a product failure.

## Final verification

All evidence below ran on the final implementation unless otherwise noted.

### Studio compiler and focused tests

```sh
node tooling/verify-studio-types.mjs
```

```text
CRC Studio declarations passed strict TSX, compiler-runtime, event-family, generic, layout, and surface checks.
```

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/share-code.test.ts \
  packages/core/test/learning-examples.test.ts \
  packages/core/test/scenario-catalog.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  3 passed (3)
Tests       85 passed (85)
Duration    20.65s
```

### Studio source and built modes

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
Source mode: 1304 modules transformed; built in 870ms
Built mode: 1205 modules transformed; built in 881ms
```

Both commands reran the Studio declaration/runtime verifier successfully. The
built-mode command also rebuilt all workspace packages successfully. The two
Vite builds retained only existing ineffective-dynamic-import and large-chunk
warnings.

### Type, lint, and catalog gates

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 scenarios:check
git diff --check
```

```text
tsc --noEmit: passed
ESLint and Prettier: passed
Scenario catalog: 41 lessons, 16 test labs, and docs/scenario-index.md validated
git diff --check: no output
```

### Source and built browser smoke

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/browser.test.ts \
  packages/core/test/smoke-scenario.test.ts \
  --browser.headless --browser.ui=false

corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/browser.test.ts \
  packages/core/test/smoke-scenario.test.ts \
  --browser.headless --browser.ui=false --mode built
```

Each mode passed `2` files and `3` tests. The browser contract additionally
proved the root package omits compiler constructors while both runtime entries
remain executable.

### Package consumers

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
```

The source consumer passed workspace build, strict Bundler and NodeNext
compilation, runtime exports, and package-boundary checks. The packed consumer
passed declarations, runtime exports, blocked deep imports, no-source checks,
and optimized focus elimination. It reported the focus marker absent without
focus and present with focus: `113966` no-focus bytes versus `137630`
with-focus bytes.

## Self-review and concerns

- The Studio bridge is private tooling only; no package manifest or root source
  export was changed. Both type-level and browser-level tests reject compiler
  constructors on the root package.
- Source and built bridge surfaces are compared by exact key set, not only a
  small export sample.
- The sandbox allowlist is exact and all unsupported module forms fail closed.
  Its parser deliberately targets TypeScript's emitted static-import shape,
  including terminating semicolons.
- No `.example.ts` file was renamed or rewritten. The mixed extension support
  is explicitly transitional through Tasks 10–12.
- Task 8's focus-specific transitional lessons and private lifecycle files were
  preserved. This task changed only discovery around them.
- `playground/vite.config.ts` needed no edit because the existing runtime-source
  plugin already owns source/built selection; the bridge and exact resolvers
  fit that boundary.
- The additional scenario catalog source/test edits were required to make the
  specified mixed `.ts`/`.tsx` transition executable in both catalogs.
- Fresh evidence is Node 26.7.0 only. Node 24 LTS remains unverified under R8.
