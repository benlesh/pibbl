# First-slice field note — 2026-10-03

The standalone page was inspected in the Codex in-app browser. A checked-in
Playwright Chromium regression additionally drives the same page; it is automated
integration evidence, not a substitute Studio scenario. Native concept dimensions
are 1672 × 940; narrow layout is checked at 390 × 844.

## Focused evidence

- Five node-runner assertions cover delayed/routed capacity, purchase rejection,
  delayed investigation, disconnected read replicas, and irregular trimmed-frame
  anchoring. Each contract was established with a failing check before its fix.
- Browser regression checks absence of navigation, pause, purchase accounting,
  explicit routes, construction delay, recovery, retirement, restart, mobile
  overflow, and instructions. No uncaught browser errors after fixes.
- Game-scoped TypeScript, targeted ESLint, formatting, and the dedicated production build are
  checked for this slice. The aggregate trust gate is deferred until feedback and
  public Sprite hardening; this is not a full feature-completion claim.

## Findings and fixes

An initial reaction attempted to write a signal from its setup callback, which
CRC correctly rejects. The map already observes the scheduler-owned clock, so
that redundant write was removed. Construction uses fixed simulation steps.

Default contain fitting and manually assumed fill coordinates disagreed. The
page now declares its logical viewport/fitting explicitly, and pointer conversion
uses that same mapping. Narrow layout keeps the map's logical aspect ratio.

An unconnected read replica initially increased aggregate database capacity.
A focused failing check exposed this; only routed database capacity now counts.

Browser testing was restarted after a development hot reload interrupted the
first run. The subsequent uninterrupted run passed. The local server and headless
browser require process/network sandbox permission on this host.

## Concept comparison

Both the saved concept and implementation screenshots were visually inspected.

| Point             | Result                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Page composition  | Full-screen business HUD, incident strip, central map, right inspector, bottom build tray; no Studio navigation |
| Palette           | Navy blueprint field, teal flow, warm overload, red offline state                                               |
| Artwork           | Dedicated transparent isometric machine atlas; no screenshot used as a fake interactive background              |
| Typography        | Space Grotesk hierarchy across metrics, controls, cards, and map labels                                         |
| Motion/state      | Live traffic, pressure-driven fire, broken machinery, construction progress; pause is functional                |
| Controls          | Purchases, routes, investigation, retirement, speed, pan/zoom, and instructions change actual state             |
| Responsive layout | Inspector stacks below map, tray scrolls, speed controls remain accessible                                      |

Intentional first-slice differences: fewer scenery props, simpler construction
art/effects, actual simulated metrics instead of concept numbers, a practical
routing selector, and a scrollable inspector when height is constrained. This
preserves the approved visual direction but is not pixel-identical final art.

Environment: model checks and production build ran on Node 24.15.0; browser
regression used installed Playwright Chromium with the default Node 26.9.0 launcher.
The repository-wide typecheck encountered an unrelated concurrent texture test:
`packages/core/test/features/textures/rain-drops.test.tsx:48` supplies
`condensation`, which is absent from `RainDropsOptions`. That file was not changed
by this task. The game has a separate typecheck configuration.
