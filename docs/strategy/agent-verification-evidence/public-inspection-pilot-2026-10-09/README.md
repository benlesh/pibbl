> **Historical status: Exploratory pilot artifact documenting the October 9, 2026 shipping decision.**

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

## Shipping assessment

**Ship the opt-in public inspection API.** Inspection enabled a correct diagnosis
and repair that ordinary agents missed in both repetitions. Four of the six
matched runs had a lower registered effort proxy, with a 19.72% median reduction.
That is useful evidence for this focused capability; it does not establish a
stable improvement across all chart tasks. The API remains opt-in, and ordinary
rendering excludes its modules.

The experiment's raw `thresholdStatus` remains `not-cleared`. That pre-registered
rule applied a 20% proxy cutoff and counted one inspection edit as an unexpected
clean-control regression. Independent replay showed the edit fixed a real
zoom-plus-focus clipping bug, so that penalty was misclassified. The owner has
accepted shipping despite the pilot's narrow sample and uncorrected raw status.
Keep the registered outcome unchanged as historical evidence.

### Cases with little or negative proxy savings

- `repeat-1/decision-01` was essentially flat: 46,062 ordinary versus 46,384
  inspection proxy tokens. Both agents found the stale-scale hover fault from
  source and browser evidence and made the same small repair; inspection added
  little for this straightforward case.
- `repeat-2/decision-03` used 48,987 inspection versus 30,498 ordinary proxy
  tokens. The ordinary agent correctly left the declared control unchanged; the
  inspection agent found and repaired the additional, real zoom-plus-focus clip
  bug. That extra defect coverage explains the added effort.
- The largest proxy reduction, 52.7% in `repeat-2/decision-01`, was almost flat
  in total processed tokens: 310,164 ordinary versus 309,956 inspection. Counting
  all input plus output tokens (including cached input) gives a **4.56% median
  paired reduction** across the six runs, not 19.72%. The 19.72% result is the
  uncached-input-plus-output proxy. Per-pair arithmetic is saved in
  `all-token-recalculation.json`.

The score was 100/100 in both conditions, so the 20-point agent review did not
separate them. The cases still show concrete inspection value, but efficiency
claims should name the token measure. This pilot is exploratory: three synthetic
cases, two repetitions, one model family, and procedurally blinded conditions.
The reusable runner now has a schema `/2` protocol that treats this as a latent
defect and adds a genuinely clean control; the saved `/1` protocol and results
remain unchanged. A larger corrected experiment would estimate how often the
added diagnostic coverage pays off; it is not a prerequisite for shipping this
opt-in API.

The live progress dashboard used for this run was <http://127.0.0.1:57013/>.
The immutable completed run is in `pilot-traces.tar.gz`; the registered protocol
and raw results remain saved alongside this report.

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
