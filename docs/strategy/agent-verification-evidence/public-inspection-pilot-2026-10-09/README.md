# Public inspection decision pilot — October 9, 2026

The registered pilot tested the shipping `@pibbl/core/viz/inspection` source
against ordinary application source and browser evidence. Six matched pairs
were run: three applications twice, with the arm order reversed in repetition
two. Codex `gpt-5.6-sol` low effort repaired and reviewed all trials. Each total
uses 80 points of deterministic checks and 20 points from a separately run
agent review. All trial traces, source, initial baselines, browser observations,
review reasons and runtime receipts are in `pilot-traces.tar.gz`.

## Registered outcome

All 12 trials completed without being blocked. Each arm passed all six repairs;
mean weighted score was 100/100 in both conditions and mean review was 20/20.
All six scored matched pairs had usable token measurements.

| Case | Repeat | Ordinary uncached-token proxy | Inspection uncached-token proxy | Inspection reduction |
| --- | ---: | ---: | ---: | ---: |
| decision-01 | 1 | 46,062 | 46,384 | −0.7% |
| decision-02 | 1 | 38,508 | 26,001 | 32.5% |
| decision-03 | 1 | 45,167 | 38,531 | 14.7% |
| decision-03 | 2 | 30,498 | 48,987 | −60.6% |
| decision-02 | 2 | 44,671 | 33,618 | 24.7% |
| decision-01 | 2 | 66,708 | 31,556 | 52.7% |

The registered median paired reduction was **19.72%**, just below the 20% target.
The effort measure is uncached input tokens plus output tokens from repair
traces. It is a compute-use proxy, not money or wall-clock cost. Paired results
vary substantially; this is not statistical evidence of a stable 20% saving.

The recorded protocol result is `not-cleared`: its clean-control check counted
one inspection edit and zero ordinary edits. The only counted edit is shown in
the trial sources and traces. Independent playback confirmed it fixes real
behavior: after zoom then focus, native pointer input at root `(340,210)` makes
the purported clean-control app select `a`, although all three rendered anchors
are outside the focused clip. The public inspection repair checks captured
`insideClips` and correctly returns no visible hit. This matches the declared
nearest-visible-anchor behavior.

Therefore the protocol's clean-control assumption is false for `decision-03`.
Its clean-edit penalty should not be interpreted as an unnecessary regression;
the pilot discovered an additional interaction bug beyond its original
oracle. The ordinary arm missed that bug in both runs, while inspection found
and repaired it in repetition two. This is concrete evidence of inspection
value, though one discovery in two repetitions is too little to estimate a
reliable success-rate improvement. The pilot's deterministic grader did not
assert the combined zoom-plus-focus behavior, so its perfect trial scores do
not establish full contract correctness.

## Decision

**Hold the shipping decision.** Inspection enabled a correct diagnosis and repair
that ordinary tooling missed in this pilot, and two of three paired scenarios
used fewer token proxies with inspection. However, the median effort reduction
fell short of the registered threshold, case results were variable, and the
review score did not distinguish the conditions. This pilot is positive evidence
that inspection can help diagnose a composed scale-plus-clip problem; it does
not show consistent enough value to ship a broad API on its own.

The clean-control classification makes the recorded threshold result
inconclusive as written. It should be corrected before another decision run: add
an independent deterministic check for zoom plus focus, treat that case as a
latent-defect scenario, and add a genuinely correct untouched control. Then
repeat across more fresh contexts and compare the actual public API using the
same registered effort measure. Keep the production bundle boundary checks in
the evaluation; this pilot matched runtime exports in both conditions, so it
measured API usability rather than ordinary-package bundle-size impact.

The live progress dashboard used for this run was <http://127.0.0.1:57013/>.
The immutable completed run is in `pilot-traces.tar.gz`; the registered protocol
and final results are saved next to this report. The raw result field
`thresholdStatus` remains `not-cleared` because the predeclared program did not
know the clean control contained a real contract failure. Do not overwrite it;
use this explanation when interpreting it.

## Bundle boundary

Fresh Node 24.15 verification passed:

```sh
node tooling/verify-inspection-bundles.mjs
```

It confirms the ordinary rendering entry excludes inspection modules, and the
nearest-x consumer bundle remains 832 bytes without optional inspection
capabilities. This is structural tree-shaking evidence; it is not a measurement
of meaningful application performance overhead when the opt-in inspection API
is actively used. The paired agent trial loaded identical runtime exports in
both arms, so it isolates API use and does not estimate ordinary consumer bundle
delta.
