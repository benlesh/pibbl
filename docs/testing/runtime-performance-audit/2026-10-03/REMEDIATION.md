# Priority remediation — 2026-10-03

> **Historical status: Execution record for the user-authorized priority audit fixes.**

Production baseline: `690bb10a99246b6f5f57df9b0341774209905827`.
Audit baseline: `a86472e2c62eedf8a5f47141bcec9e624fe36566`.
This maintenance work does not advance a separate strategy initiative.
Unrelated dirty package consolidation/HtmlBox work remains untouched.
The fresh audit supersedes the earlier dirty-checkout measurements for this work.

## Dispositions

No fix below is yet merged into main or pushed. Focused acceptance and code review
are distinct from integration; the aggregate gate remains blocked.

| Issue                                   | Local disposition                                                   | Candidate / evidence                                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 initial texture publication failure | Fixed; reviewed; public failure probe passed                        | Ownership branch through `97ac3ac523fc3a8b768f3f59ff05763f52c2f2b0`; actual reaction-diffusion upload failure disposes simulation once and leaves zero roots, participants, and pending frames through eight subsequent frames                                                   |
| A11 stale texture owner retention       | Fixed; reviewed; root and Canvas reachability release verified      | Same branch; disposal clears owner even when callbacks throw; controlled repeated-GC before/after probe releases both root and Canvas while the stale public handle stays retained (JavaScript reachability only)                                                                |
| A02 physics handle retention            | Fixed; reviewed; 1,000-cycle public churn and rollback tests passed | `7ec1b751bf67516718a714b72a75ec3d0b2cee9d`, hardened as `8af54b75`; evict retired generations only after successful topology adoption and clear maps on disposal                                                                                                                 |
| A05 publication surfaces                | Fixed; reviewed; failure/resize tests passed                        | Ownership branch; incompatible spare released before replacement allocation; failed candidates released                                                                                                                                                                          |
| A06 render-layer surfaces               | Fixed; reviewed; normal/create/render/dispose failure cases passed  | `75185d85`; application cleanup observes original dimensions before CRC zeros its owned surface in finally                                                                                                                                                                       |
| A04 diffusion allocation pressure       | Mitigated for confirmed worst-case; reviewed and measured           | `b28a4865232153ee2da10b4aa873ee14c0afc2d1`; eliminate patterns only for exact 1:1 pixel-aligned unshadowed Rectangle stretch fills; other cases preserve their existing pixel path                                                                                               |
| A03 diffusion overload                  | Blocked on delivery-policy decision                                 | Existing contract delivers queued messages in the next eligible frame; spreading accepted FIFO work across frames changes that promise. User choice requested. Existing 8192-message cap is not a CPU-work bound                                                                 |
| A07 rendering / physics costs           | Profile-directed fixes reviewed and measured                        | `22cf9b62` removes repeated Canvas transform reads/multiplications; `88c5233ccca88d01d3b79452912473daf890e8c0` avoids presentation snapshots; rollback checkpoints remain intact                                                                                                 |
| A08 Three snapshot copies               | Deferred after independent contract review                          | Previous committed picker remains live during candidate construction. Deep geometry copies isolate arbitrary mutable input; no generation-release hook exists for safe pooling. Existing custom `pick` is the supported application-controlled route. No unsafe reuse introduced |
| A09 dynamic particle color cache        | Lower-priority follow-up                                            | Source risk, not reproduced in fresh audit; outside priority remediation acceptance                                                                                                                                                                                              |
| A10 palette LUT allocation              | Lower-priority follow-up                                            | Bounded 1 KiB per-raster opportunity; outside priority remediation acceptance                                                                                                                                                                                                    |

## Independent review reconciliation

- Texture ownership author: implementation agent. Independent code reviewer:
  baseline_review agent; independent public failure/resize/retention verification:
  orchestrator. Findings fixed: replacement allocation must release the old spare
  first; failed rasterization must retain dirty work; persistent failures must not
  spin forever; throwing old-state disposal must not leave a falsely live state;
  monkey patches must restore in finally. Final ownership candidate approved.
- Render-layer surface author: orchestrator. Implementation agent independently
  approved cleanup ordering. Four public failure-path cases fail before the fix
  and pass afterward; the broader render-layer suite also passes.
- Physics author: baseline_review agent. Orchestrator required topology-only
  eviction, live-handle identity, generation reuse, and failed-topology coverage.
  Those findings were fixed. Orchestrator independently reviewed and ran 44 files /
  377 tests covering physics and the transform change. Implementation agent also
  independently reviewed `88c5233c`: no blocker; identity checks and staged signal
  publication preserve rollback. Checkpoint snapshots are intentionally retained.
- Transform author: orchestrator. Baseline_review approved shared synchronous
  snapshots, identity inverse bypass, affine transform, world/filter/lineage
  semantics. Requested non-2D fallback regression was added in `1cdf42c9`, merged as `0559b523`; Chromium passed 7/7. Canvas accepts the legacy non-2D fallback, so an initial test assumption that it throws was corrected to match actual prior behavior.
- Texture paint author: implementation agent. Pixel experiments rejected general
  scaled drawImage replacement: transparent edges and DPR 2 differ from patterns.
  Baseline_review found nontransparent zero-offset shadows also need fallback.
  The guard and regression were added in `b28a4865`; targeted re-review approved.
  Author reports 19 related texture tests passing; independent final focused verification passed 31 tests across texture paint, fast-path, transform, and Studio shell suites.
- A08 independent reviewer verified retained-generation geometry tests and picker
  closure lifetime. Unsafe generic buffer pooling is not accepted as a fix.

## Integration blocker

The pristine `690bb10a` aggregate gate fails Markdown classification for twelve
existing `docs/website-rebuild` files. The narrow classification repair in
`64bbeb91` exposes the next baseline failure: texture contract semantic inventory
records 12 units while current source has 31. Raw capture files are excluded only
from formatting so their recorded hashes remain valid; runtime checks are unchanged.

Two independent provenance investigations found no legitimate existing approval
record for texture contract units 25–31 (WASM field clauses). The October 1 texture
implementation record supports earlier clauses but explicitly scopes its WASM
spike to tooling. Later shipping commits are evidence of implementation, not a
replacement for the exact approved-design mappings demanded by the gate. No
metadata was blindly regenerated and no aggregate requirement was waived. A separate
format failure was one missing blank line in `docs/site/api/types/filters.md`; the
blank line was restored without semantic changes.

The automation prompt explicitly makes an unrelated baseline gate failure an
integration blocker. The remediation remains unmerged until this is
resolved; clean local main was later fast-forwarded only to an already-published
upstream update (see below). A03 also remains incomplete pending the public delivery-policy choice.

## Verification and measurements

Environment: Node 24.15.0, pnpm 11.21.0, Playwright Chromium 151.0.7922.34,
macOS 26.6.2 arm64 / Apple M5 Max / 128 GiB. Timing probes are serialized;
forced-GC reachability is separate from natural memory measurements.

- Focused combined texture/render-layer verification: 22 files, 136 tests passed.
- Independent physics/transform verification: 44 files, 377 tests passed.
- Actual reaction-diffusion publication-failure probe: zero orphan scheduling,
  one simulation disposal. Correctness run timing is not used as performance data.
- Final `lint` passed (code and formatting).
- Independent final typecheck passed after test-only overload annotations were corrected in `2420a68a`. No production behavior changed in that correction.
- `trust:package` passed, including packed consumers, declarations, runtime identity, tree shaking, and 72 source/built texture WASM bundle-selection checks.
- `trust:lifecycle` passed: lifecycle 33 tests, structural performance 48 passed / 4 skipped, and 42 text tests.
- Built browser smoke passed 3/3; visual safeguard passed. No visual baselines changed.
- Full browser rerun executed 3,607 passing tests / 7 skipped; one Node-only file failed browser import. Pristine main reproduces that wrong-runner discovery failure. Correct runner already passes it in `trust:package`; exact-file discovery repair `a23890ae` was independently approved and merged as `6f505d04`. Final `test:ci` passed: 348 files, 3,607 tests; 3 files / 7 tests skipped. No runtime tests were excluded.
- The initial full run also had a transient Studio shell failure. It passed on pristine main, passed in the candidate's isolated check, and passed in the complete candidate rerun. No Studio behavior was changed or test weakened; both logs are preserved.
- 1,000 normal legacy and 1,000 recipe lifecycle cycles completed with balanced ownership. The 600-frame recipe resize run allocated 61 surfaces and zeroed all 61; the baseline zeroed only 3, leaving 58 nonzero.

| Matched workload                                                        |           Before |            After |
| ----------------------------------------------------------------------- | ---------------: | ---------------: |
| 10,000 positioned rectangles, median / p95                              | 118.8 / 125.3 ms |   56.7 / 64.7 ms |
| 50,000 positioned rectangles, median / p95                              | 680.1 / 750.7 ms | 355.5 / 390.5 ms |
| 10,000 static children in Group + moving sibling, median                |         123.9 ms |          54.0 ms |
| Same static children in explicit Layer, median                          |           3.9 ms |           3.7 ms |
| 1,000 moving physics bodies, median / p95                               |   30.5 / 33.8 ms |   19.3 / 22.5 ms |
| Physics handles after 1,000 public churn cycles, each map               |            1,000 |                0 |
| Physics handles after disposal, each map                                |            1,000 |                0 |
| Stale Texture retains disposed root / Canvas                            |        yes / yes |          no / no |
| Initial diffusion upload failure leaves participant / pending frame     |            1 / 1 |            0 / 0 |
| 512×512 natural five-minute fresh-browser peak sampled process-tree RSS |      1,063.1 MiB |        357.0 MiB |
| Same run final sampled RSS                                              |        564.4 MiB |        357.0 MiB |

The fresh natural comparison uses a separate cold browser on each side with the
same public scene, resolution, viewport, and five-minute duration. Samples occur
every 30 seconds; active work uses no forced GC. The after run's frame medians
remain about 4.5–4.6 ms. RSS sums process working sets and is not proof of native,
WASM, or GPU reclamation; post-disposal forced-GC samples are separately labeled.
The optimization applies to exact-size aligned stretch fills, not all diffusion
presentations. Scaled textures retain the pattern path and its allocation pressure.

Broad timings have 20 warmup frames and 30–240 measured frames as recorded per row.
They are scheduler CPU times, exclude presentation, and are descriptive same-host
measurements, not portable CI thresholds. Our own builds/tests were paused during
timings; unrelated existing development servers were left untouched.
The physics typed-array checkpoint copy counter remains 23,220,256 bytes / 60
frames: this fix removes presentation object/Map snapshots, not transaction
checkpoints. The large rendering improvements do not promise 60 FPS for 10,000
fully repainted positioned primitives.

The initial broad physics-retention row is rejected: the long-running Vite server
used a hot-reload `?t` URL for the public controller but the probe imported its
private module without that generation. Restarting the server and rerunning the
exact 1,000-cycle case passed with both maps 0→0→0 and zero live scheduler work.
Other public timing rows completed; the rejected private row is not treated as
successful evidence. The harness now reports case failures as incomplete.

Raw comparisons, exact executed probes, profiles, and logs live in
`results/remediation/`; original audit captures remain unchanged. Earlier
single-GC Canvas controls were inconclusive; repeated-GC v3 controls are the
accepted reachability evidence. Independent review approved those controls with
the explicit JavaScript-only limitation.

## Resumable state

Combined candidate branch: `codex/perf-verification-gate` in managed worktree
`runtime-perf-audit/crc`. Combined runtime commit before remaining verification:
`31d8417f09f6bc2bb76a96395735065bcf697108`.
Clean main integration checkout: managed `perf-verification/crc`.
Verified origin is `https://github.com/benlesh/crc.git`. It advanced during final
verification from `690bb10a` to `dc20f992a0a3902b431732c2fc039dc055eff962`
(`feat(textures): add interactive rain on glass`). Clean local main was fast-forwarded
to that already-published commit, as authorized. No remote write this turn.

The candidate incorporated upstream normally as
`467e74f952ae03da3deec18c3d180d51d2da68ec`, with no conflicts. Independent review
confirmed no changes to audited texture ownership/paint, transform, physics, or
synthetic workload source. The module graph gains an inactive rain export/catalog
entry, so the measurements remain attributed to their recorded `31d8417f` candidate;
they are not mislabeled as a new measurement of `467e74f9`.

After this merge, types, lint, and the complete package gate pass. Full browser
verification exposed two stale upstream catalog expectations (81 routes versus 82,
and missing rainDrops/displacement API tags). Author corrected the exact route,
order, browse membership, and API expectations in `b5861471`; orchestrator reviewed
that assertions were strengthened, not removed. Focused learning suite passed
231/231; merged as `1ad66ddd`. Final full browser suite passed **350 files / 3,614 tests**, with 3 files / 7 tests
skipped.
The exact aggregate gate on `467e74f9` remains blocked at texture contract inventory
**12 recorded versus 33 current units**. The earlier 12-versus-31 result is retained
as historical evidence, not reported as the latest gate output.

Next actions: obtain the A03 delivery-policy decision; reconcile the missing
approved-design provenance for the baseline texture contract; rerun the complete
aggregate gate on each proposed integration candidate before normal main merges
and non-force pushes. A08 remains an explicit contract-sensitive optimization
follow-up. No item blocked on those prerequisites is declared integrated or done.

Owned audit servers were stopped after verification. Managed worktrees and issue
branches are preserved for the blocked integration; unrelated work remains intact.

Final committed aggregate recheck: `b66260dc1eb79d492b8253b8b141708a4aea2826`
failed only as far as the first reported texture inventory assertion (12 ≠ 33);
no later aggregate stages are claimed passed by that command. Separately run
checks are listed above. This final evidence-only bookkeeping commit changes no
source or test behavior. Raw logs deliberately preserve original whitespace;
source edits pass whitespace checks. All original and remediation evidence hashes
were verified, and every manifest entry is tracked.
