# Diagram editor tutorial delivery field note

> **Historical status: IMPLEMENTATION FIELD NOTE.** Results are dated evidence for
> the named candidate and environment, not current API guidance or reusable
> test totals.

Delivery verification date: 2026-09-14

## Scope and environment

Final verification covered the diagram-editor tutorial candidate at
`d495dbb6ab87cd2717daaef125b4f67fe460e90b`; this note is committed separately
after that verified implementation revision.

- Darwin `25.6.0`, arm64
- Node.js `v24.15.0`; pnpm `11.21.0`
- Playwright `1.62.1`; Playwright Chromium `151.0.7922.34`, headless

The commands used the repository's required Node 24.15.0 PATH and
`corepack pnpm@11.21.0` throughout.

## Acceptance and category boundaries

The real Studio acceptance opened the Learn landing and all twelve ordered
chapters: Canvas scene, first node, connect nodes, reusable node, editor
chrome, selection, dragging, pan and zoom, viewport and Layer, filters,
keyboard interaction, and finished editor. Every chapter supplied one
script-only preview frame, reached `Live · changes run automatically`, and
preserved the expected previous/next links. It additionally covered Reset and
Share, truthful Clipboard API rejection and fallback success/failure, Chapter
12 teardown to a guide, and the 390×844 narrow layout.

Catalog validation reported 53 lessons, 12 tutorial snapshots, and 20 test
labs. Tutorial snapshots remain a tutorial-only catalog: the scenario-source
adapter explicitly excludes `packages/scenarios/src/tutorials/**/*.example.tsx`
from Test Lab source discovery, so they do not leak into Examples, MiniSearch,
or the Test Lab catalog. The public search acceptance remained limited to
Learn, API, and Examples.

## RED recovery

The first aggregate runs exposed four real integration boundaries:

- the scenario-catalog test assumed every scenario source was a Test Lab;
  tutorial snapshots are intentionally a separate catalog, so the source
  adapter now excludes them;
- offscreen tutorial previews could have their requestAnimationFrame work
  throttled after a long suite; acceptance now validates one script-only frame,
  scrolls it into view, then waits for its Live state;
- the isolated browser rejected Clipboard API writes; Share now falls back to
  the existing copy mechanism instead of failing silently; and
- teardown incorrectly required every Monaco editor to disappear even when the
  destination guide creates its own editor. It now records and requires the
  source-backed workbench editor to detach.

The final visual recovery found two more presentation-readiness facts. Learn
and search-open now wait for the canonical diagram-editor link in rendered
Markdown, not a generic heading. Chromium can produce a background-only
returned full-page screenshot buffer for the canvas-backed Test Lab after SPA
navigation. The visual verifier therefore resets that route to scroll top,
discards one scoped compositor-prime buffer, and reads the following
file-backed normal capture for the unchanged strict pixel comparison. It does
not retry mismatches, alter application state, apply to other routes, or update
the Test Lab baseline.

## Visual evidence

Expected, actual, and diff artifacts were inspected before baseline changes.
The tutorial visual routes and teaser passed exact comparison with no mask:

| Artifact                                       | Dimensions | SHA-256                                                            | Final-wave disposition                                                                                                            |
| ---------------------------------------------- | ---------: | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `studio-diagram-editor-landing.expected.png`   |  1280×2503 | `e526f7ea4b3b23dff03d0c1f2a8ce3e51a76c7cc69812e380beaaeb2c6e0f74b` | Updated after inspection; its 26,661 changed pixels are confined to the corrected teaser region.                                  |
| `studio-diagram-editor-finished.expected.png`  |    874×546 | `7cb5ed2b52e12b13c69bba2944b050cb020dc29a515c059191143555c3c98747` | Updated after inspection for Ship at workspace y=210 and the rerouted connectors; Chromium also removed one capture-height pixel. |
| `tutorials/diagram-editor/finished-editor.png` |    960×600 | `0ec41c5517b1bcf4f4cb9ca71c15194571cb45da2823cd6b70027dc20b77d895` | Updated after inspection; 33,833 changed pixels cover only Ship's old/new positions and affected connectors.                      |
| `studio-search-open.expected.png`              |  1280×1071 | `1f6bbbe04ba8249f481f5847881daa4797b671ffc66045e110dea39b5268ac0d` | Untouched in the final wave; it retains the earlier explicitly authorized baseline.                                               |
| `studio-test-lab.expected.png`                 |  1280×1326 | `275e4398fa0525e97f0f22b69536a74527f9f9bbace951ebd1d0fabcb1d12722` | Untouched in the final wave.                                                                                                      |

The landing diff bounds were `[779, 661]..[1101, 897]`; the teaser diff bounds
were `[498, 146]..[868, 417]`. The old 874×547 and new 874×546 finished-frame
captures necessarily produced a full-frame byte diff, so both full images were
inspected directly: the new composition preserves every card, label, grid,
status region, and connector, with only the intended Ship move and connector
routing change. Search-open, Test Lab, and every unrelated baseline remained
byte-identical.

The Studio visual run reported: `Matched diagram-editor teaser at 960×600 with
zero differing pixels.` and `Matched 8 Pibbl studio visual baselines.` No other
existing visual baseline was updated.

## Aggregate trust evidence

The final pre-record aggregate command was:

```sh
env PATH=/Users/benlesh/.local/share/fnm/node-versions/v24.15.0/installation/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin corepack pnpm@11.21.0 trust
```

It exited zero at implementation revision
`d495dbb6ab87cd2717daaef125b4f67fe460e90b`. Fresh results included:

- scenario validation: 53 lessons, 12 tutorial snapshots, and 20 test labs;
- documentation: 12 guides, 151 current/migration files, 74 historical/work
  records, 77 values, 175 types, 27 acceptance rows, 202 parsed snippets, 8
  extracted TypeScript programs, 66 compiler-checked API examples, 667
  pre-Task-14 and 800 current semantic units across 12 baseline-snapshotted and
  14 current normative contracts, 107 mapped post-baseline units, 53 direct
  evidence mappings, 85 baseline-derived field migrations, 149 presentation
  sources, and 944 RED mutation probes;
- Studio API coverage: 77 core values, 176 core types, 9 WebGL values, and 23
  WebGL types; declaration verification covered exact export-name parity and
  198 structural types against source and built packages;
- complete browser suite: 179 files, 2,401 passed and 2 skipped tests of 2,403;
- packed Bundler and NodeNext consumer, declarations, runtime exports, blocked
  deep-import and no-source checks: passed; optimized focus output was
  162,540 bytes without focus and 186,461 with focus;
- Studio documentation acceptance, visual safeguard recovery, the eight Studio
  baselines, and built-package smoke: passed. The isolated acceptance build
  preserved `playground/dist` at SHA-256
  `495be6903cdd61233749c41881156b4887f8969088c5498ddf60f256be5a46d7`;
- lifecycle: 7 files and 33 tests passed; structural performance: 6 files with
  35 passed and 2 skipped tests of 37.

The two skipped structural-performance tests are the opt-in wall-clock checks;
they are intentionally outside the default correctness gate. Vite also emitted
existing native-config import-extension and large-chunk/ineffective-dynamic-
import warnings. Neither warning changed the zero exit status. Chromium visual
identity remains environment-specific; this run's exact environment is recorded
above.

## Final-review closure

The implementation commits before this field record are:

- `df2d3173396a0d7ee99fb3dff39a7565c96b93e9` — acceptance and inventory;
- `3f754fc`, `3a487dd`, and `6716e07` — catalog, visible-workbench, Share, and
  teardown recoveries;
- `0aa94464eed9d3a50753f8ad87fb1508085db39a` — mobile-drawer shortcut guard;
- `556314226f0fbbba32b623b08ade43d76432a25b` — visual capture readiness.
- `29e421e94d7c8ceac670201a1945bdd182242f3d` — decoded public-asset
  containment and per-chapter serialized relationship acceptance.
- `d495dbb6ab87cd2717daaef125b4f67fe460e90b` — final broad-review
  corrections and focused evidence.

Self-review found no tutorial contamination of the Test Lab catalog. Earlier
work updated the inspected landing plus the explicitly authorized search-open
baseline; the final wave updated only the teaser, landing, and finished-editor
baselines affected by corrected canonical geometry. The isolated worktree did
not modify `docs/strategy/particle-effects-research.md` or include the unrelated
main checkout particle-effects work. The remaining limitation is the narrowly
documented Chromium Test Lab compositor behavior above; it is contained to the
visual verifier and leaves the strict baseline comparison intact.

## Correction-round verification

Independent review found that decoded root-relative public links could resolve
outside `playground/public`. The new minimal `/../../package.json` mutation
probe first failed because the previous resolver accepted the escaped target.
The resolver now canonicalizes the decoded path, normalizes separator input,
and rejects every path whose relative result escapes the public asset root; the
documentation check passed with all 944 RED probes afterward. No existing
baseline changed in this correction round.

The Studio acceptance now obtains the generated browser documentation payload
and, for all twelve real diagram-editor chapter routes, asserts that its actual
serialized `chapter` equals the canonical numeric position and its
`chapterCount` equals 12. Existing rendered heading, workbench, and pagination
assertions remain in place. The focused Studio acceptance and the complete
trust gate passed on the revision recorded above.

## Final broad-review correction

The grouped correction wave restored the Chapter 4–12 cumulative vocabulary
and all four canonical coordinates, including Ship at workspace y=210. It
returned Chapters 8–12 to direct supported Group/Clip wheel props and brought
the Studio declarations into structural-event parity with source and built
packages. Chapters 11–12 now keep drag refs and cursor state in each `NodeCard`,
while `Workspace` owns pan state; public-runtime evidence removes a captured
target before pointer-up and observes no ghost loss, movement, or cursor.

Capture-loss and pointer-up fallback evidence are separate. A handler-level
`lostpointercapture` before pointer-up clears the Chapter 7 application session;
the separate CDP case records zero native loss events after direct release and
proves pointer-up still terminates ownership. Clipboard acceptance rejects the
Clipboard API, verifies the exact copied URL through the fallback, and checks
false and throwing fallback results, cleanup, truthful status, and absence of
unhandled page errors.

Focused RED began with 36 tutorial tests: 33 passed and 3 failed on the
eleven-entry catalog, leaked `Path2D.moveTo`, and stale Ship geometry. The
strict structural consumer separately failed all eight container event props
with TS2322, and the clipboard acceptance timed out waiting for the required
failure state. Focused GREEN finished with 70 tutorial/share tests, exact
declaration parity and structural compilation, scenario/catalog validation,
typecheck, lint, Studio documentation acceptance, teaser zero-diff, and two
targeted Studio baseline matches before the complete trust run above.
