# Three.js full pivot implementation plan

> Execute continuously in thin, observable slices. Use one implementation
> agent and one review agent at most. Preserve unrelated changes in the main
> checkout until final integration.

## Task 1: remove coupled runtime packages

- Add focused manifest/export tests that state the surviving particles and
  physics entries.
- Remove `@crc/particles/webgl` source, tests, exports, peers, and build input.
- Remove the renderer-coupled `@crc/physics/3d` entry, runtime, presentation,
  browser tests, and peers while retaining `/3d/geometry` and its pure tests.
- Delete `packages/webgl` and remove workspace aliases/configuration.
- Regenerate the lockfile and prove surviving packages build and typecheck.

## Task 2: replace public examples and website content

- Add a small `three-layer` example with a CRC background target, visible
  Three blocker, registered Three target, empty-pixel miss policy, and focus.
- Keep and polish `three-instancing` as the advanced showcase.
- Remove the WebGL lesson directory, WebGL labs, GLB gallery, 3D particles, and
  WebGL physics scenarios and their deterministic fixtures.
- Replace the WebGL section/catalog metadata with Three.js entries.
- Replace public guides and API pages with `defineRenderLayer()` and
  `defineThreeLayer()` guidance; remove unsupported API pages and cross-links.
- Regenerate the scenario index.

## Task 3: migrate Studio and distribution verification

- Remove old runtime modules, declarations, aliases, source/built maps, and
  sandbox allowlist entries.
- Make `@crc/three`, `three`, and supported addons authoritative in source and
  built Studio modes.
- Rewrite packed consumer verification around surviving packages, one Three
  identity, Bundler/NodeNext declarations, and rejection of removed entries.
- Remove WebGL friend verification and old visual/lifecycle/performance routes.

## Task 4: update current contracts and repository context

- Supersede active WebGL contracts with the generic render-layer/Three
  lifecycle; remove current claims for renderer-coupled particles and physics.
- Update README, AGENTS context, package descriptions, public indexes, strategy
  references, documentation validation, and preservation mappings.
- Add a machine check that rejects legacy package specifiers in active trees.

## Task 5: harden and integrate

- Run focused typecheck, scenario, docs, package, browser, and lifecycle checks
  while fixing failures.
- Inspect the live Studio routes and interaction behavior.
- Run `corepack pnpm@11.21.0 trust` in the documented environment.
- Request a final review of changed code and resolve material findings.
- Commit the pivot branch, merge it locally into `main` without losing
  unrelated user work, commit any explicitly requested remaining changes, and
  push `main`.

