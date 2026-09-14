# Diagram editor tutorial delivery field note

> **Historical status: IMPLEMENTATION FIELD NOTE.** Results are dated evidence for
> the named candidate and environment, not current API guidance or reusable
> test totals.

Delivery verification date: 2026-09-14

## Scope and environment

Final verification covered the diagram-editor tutorial candidate at
`29e421e94d7c8ceac670201a1945bdd182242f3d`; this note is committed separately
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
Share, Chapter 12 teardown to a guide, and the 390×844 narrow layout.

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

| Artifact                                       | Dimensions | SHA-256                                                            | Disposition                                                                                                                                                 |
| ---------------------------------------------- | ---------: | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio-diagram-editor-landing.expected.png`   |  1280×2503 | `1d20193067d4bb47e6b8d914ea9643b4c74c08c429a0cee9b6edffa386d1c706` | Updated after review: the tutorial-first landing and current Studio geometry are intentional.                                                               |
| `studio-diagram-editor-finished.expected.png`  |    874×547 | `77f6e7e0ae632d94d2d98da8137d441ddfc25b3d07bef199c7faac598c6f8b6a` | Retained: the finished live editor frame matched exactly.                                                                                                   |
| `studio-search-open.expected.png`              |  1280×1071 | `1f6bbbe04ba8249f481f5847881daa4797b671ffc66045e110dea39b5268ac0d` | Replaced only with explicit user authorization. The modal UI is unchanged; the intentionally changed dimmed background is the tutorial-first Learn landing. |
| `tutorials/diagram-editor/finished-editor.png` |    960×600 | `3e809bc6bd63346404d330a48b5f2687bbe1786d9e8a72d61c632c81f528c702` | Retained; the teaser check reported zero differing pixels.                                                                                                  |

The Studio visual run reported: `Matched diagram-editor teaser at 960×600 with
zero differing pixels.` and `Matched 8 CRC studio visual baselines.` No other
existing visual baseline was updated.

## Aggregate trust evidence

The final pre-record aggregate command was:

```sh
env PATH=/Users/benlesh/.local/share/fnm/node-versions/v24.15.0/installation/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin corepack pnpm@11.21.0 trust
```

It exited zero at implementation revision
`29e421e94d7c8ceac670201a1945bdd182242f3d`. Fresh results included:

- scenario validation: 53 lessons, 12 tutorial snapshots, and 20 test labs;
- documentation: 12 guides, 151 current/migration files, 74 historical/work
  records, 77 values, 175 types, 27 acceptance rows, 199 parsed snippets, 8
  extracted TypeScript programs, 66 compiler-checked API examples, 800 current
  semantic units, 14 current normative contracts, 107 mapped post-baseline
  units, 53 direct evidence mappings, 85 baseline-derived field migrations,
  149 presentation sources, and 944 RED mutation probes;
- complete browser suite: 179 files, 2,393 passed and 2 skipped tests of 2,395;
- packed Bundler and NodeNext consumer, declarations, runtime exports, blocked
  deep-import and no-source checks: passed; optimized focus output was
  162,540 bytes without focus and 186,461 with focus;
- Studio documentation acceptance, visual safeguard recovery, the eight Studio
  baselines, and built-package smoke: passed; and
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

Self-review found no tutorial contamination of the Test Lab catalog and no
baseline update beyond the inspected landing plus the explicitly authorized
search-open replacement. The isolated worktree did not modify
`docs/strategy/particle-effects-research.md` or include the unrelated main
checkout particle-effects work. The remaining limitation is the narrowly
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
