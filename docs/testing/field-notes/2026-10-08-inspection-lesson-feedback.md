> **Historical status: Feedback record for the October 8, 2026 inspection examples; the final shipping decision is recorded in the October 9 pilot report.**

# Inspection lessons — feedback revision, 2026-10-08

User feedback: the examples were too minimal and not compelling; standalone
inspection was confusing. This revision improves the three existing lessons,
without changing the accepted public API or adding a fourth capability.

## Observable teaching changes

- Standalone is an order-time lookup over three labeled simulated quotes.
  Buttons request 09:31, 09:36 and 09:39; a coral guide marks requested time and
  an outline identifies the selected observation. The result states requested
  time, recorded time, price, source row and minute difference. It explicitly
  says the value is nearest recorded data, without interpolation. Arrow keys
  change the requested time; Enter/Space activate buttons.
- Lazy inspection labels orders A/B and starts with zero requests. Click/tap
  selection runs two equal requests through the existing context and displays
  one measured execution. Enter performs an explicit time-10 request.
- Painted lookup labels contrasting overlapping orders and explains color
  ownership. Separate result lines show nearest Order A and painted Order B
  for the overlap; Enter exercises the same fixed logical point.

The new application tests were added and observed failing against the previous
lessons before editing production examples. Tests import and mount the exact
public learning programs, dispatch native input and assert rendered labels and
exact controller disposal. Standalone also measures actual text bounds.

## Fresh verification and browser evidence

Environment: bundled Node 24.19.0, pnpm 11.21.0, Playwright Chromium. Browser plugin
not available; regular Playwright follows the existing Studio verifier. The flow
under test is each Studio lesson → click/tap or keyboard action → visible typed
selection/execution/paint result.

- Full focused inspection run: **9 files, 28 tests passed** (includes the three
  new public-lesson checks). After the final label-spacing correction, the two
  public-lesson test files passed **3/3** again. Semantic assertions preceded
  screenshot inspection.
- `node tooling/verify-inspection-studio.mjs`: **8/8 example/viewport cases passed**,
  including exact selection, memo and overlap results, TypeScript editor status,
  keyboard repaint, and no runtime errors. Desktop viewport 1400×1000; touch
  mobile 390×844. Captures: `/tmp/pibbl-inspection-evidence/`.
- Root typecheck, focused ESLint, catalog validation/index generation and Studio
  docs/API/search/routes passed. No core runtime or package API changed; packed
  and aggregate results from the earlier hardening run are not presented as new
  verification for this presentation-only change.

| Browser check                                 | Result                                                            |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Intended routes and meaningful canvas content | Passed                                                            |
| TypeScript/framework error overlay            | None observed                                                     |
| Runtime console health                        | No page errors                                                    |
| Desktop/touch selection and keyboard result   | Passed                                                            |
| Screenshot readability                        | Reviewed all revised lessons; moved lazy A label clear of its dot |

The website's tiny API-registration programs remain separate code-focused
examples. Studio lessons now supply visible context rather than relying on the
reader to infer it from source. They still teach one operation each; the broader
workbench remains available for composition. Data remains deterministic
simulation, not an attributed market feed. No visual baseline was rewritten.

Milestone: revised slices ready for user feedback. The remaining financial design
proposal is still pending; candle and trading-time acceptance persists. Inspect:

- [Order-time lookup](http://127.0.0.1:5176/#/examples/composition/viz-recorded-inspection)
- [Lazy requests](http://127.0.0.1:5176/#/examples/composition/viz-lazy-inspection)
- [Painted overlap](http://127.0.0.1:5176/#/examples/composition/viz-painted-inspection)
