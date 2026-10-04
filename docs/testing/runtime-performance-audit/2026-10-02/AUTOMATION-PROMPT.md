# CRC performance remediation orchestration prompt

> **Historical status: Dated audit evidence and remediation proposals; current behavior is defined by runtime contracts.**

Copy the following prompt into a new CRC execution chat. This file records instructions for that future run; it does not start implementation by itself.

---

Act as the orchestrator for resolving every issue in `docs/testing/runtime-performance-audit/2026-10-02/README.md` in this repository.

I authorize you to implement the documented fixes and justified optimizations, use subagents and isolated managed Git worktrees, reconcile independent reviews, commit each completed issue, merge it into `main`, and push `main` to the verified origin after each issue is done. Do not merely produce another plan. Continue through the queue as far as you can safely execute. Do not ask again for routine implementation, tests, commits, merges, or pushes already authorized here.

## Establish the correct baseline

Read applicable AGENTS.md instructions, the audit index, all issue documents, relevant current contracts, and the project-plan workflow. This user request selects the audit remediation queue as the execution scope; it does not authorize overwriting the unrelated active HtmlBox plan or its status. Track this queue in its own index and issue completion records.

Inspect Git status, branch, remotes, existing attached worktrees, active processes, and available agent slots. Verify that origin is the intended `benlesh/crc` repository and that `main` is the integration target. Fetch normally and inspect local/remote divergence before writing. Never force-push, discard changes, rewrite published history, or merge unrelated work to make this task easier.

The audit was conducted on a heavily dirty `codex/physics-2d-quality` checkout, including uncommitted package consolidation and HTML integration. Worktrees based on main do not inherit those changes. Compare current source with the evidence manifest and issue descriptions. If the relevant runtime has since been integrated or superseded, use current supported code and explicitly record the mapping. Do not restore an obsolete implementation just to match a historical path.

Ensure this audit folder is in the committed baseline used by agents. You may make a documentation-only commit containing this task's audit folder, after inspecting its exact diff and preserving all other staged/unstaged work; never use blanket staging. If runtime changes required by the findings exist only as another task's uncommitted work, do not automatically commit or merge that work. Identify the exact missing prerequisite and coordinate through user-authorized channels. Continue independent ready issues, and report genuinely blocked dependencies rather than silently dropping them or pretending the queue is finished.

Use the documented Node 24 LTS version at or above 24.15, pnpm 11.21.0, and installed Playwright Chromium where available. Record actual versions. If provisioning is necessary, use supported existing tooling and respect environment permissions. Do not silently substitute the audit's Node 26 environment and call it the supported release gate.

## Work allocation and isolation

Use the collaboration subagent tools for implementation and review; do not create sidebar chats unless I separately ask for them. Discover and use managed worktree tools, inspect existing attached worktrees first, and reuse a suitable free worktree when safe. Give every agent an explicit absolute workspace path and branch, issue scope, baseline SHA, acceptance criteria, owned files, and permitted mutations. All shell/edit/test operations must use that assigned workspace. Shared agent filesystem access is not isolation by itself.

Create issue branches with the `codex/` prefix, for example `codex/perf-01-animation-history`, from the current accepted main baseline. Do not have multiple implementation agents edit the same checkout. Reviewers use a separate worktree at the candidate commit, or a demonstrably frozen read-only candidate checkout; reviewer probes must not mutate the author's branch or leave generated changes mixed into it.

Default to one implementation agent and one independent reviewer per active slice. Reuse agents, respecting their independence for each issue. Use a second independent verification reviewer sequentially for high-risk behavior, ownership, rollback, or performance changes. The implementer cannot be the sole reviewer of their own issue. The orchestrator adjudicates review disagreements and owns integration. Use more parallel implementation only for truly independent paths with concrete wall-clock benefit and sufficient available slots.

Serialize edits to overlapping areas:

- Issues 02, 06, and 08 share texture.ts; fix initialization ownership first.
- Issues 03, 04, and 11 overlap physics controllers; fix handle retention before broad update-cost work.
- Issue 11 follows issues 01 and 04; avoid a competing refactor.
- Issue 12 coordinates instrumentation with subsystem changes and must not race scheduler edits in issue 10.
- Issue 13 finishes aggregate coverage, but every issue adds its own focused regression immediately.

Prioritize 01, 02, and 03, followed by 04 and 05. Independent recipe/cache work can proceed when it does not interfere. Add useful passive observability alongside fixes rather than waiting to measure everything at the end.

## Implementation cycle for each issue

1. Assign one implementation agent the issue document, current contracts, exact workspace, and baseline. Reproduce the finding before changing production code. Historical measurements are evidence to investigate, not a mandate to change correct current behavior.
2. Define the observable contract and add the minimum focused failing regression before production code. Use a supported public-API scenario that is manually runnable and driven by headless tests. Private instrumentation may supplement it for structural counters, not replace it. Mark stress scenarios local/test-only so they do not enter public Studio search.
3. Implement the smallest complete slice. Preserve identity, paint/event ordering, scheduler phases, transaction rollback, numerical behavior, and exact resource ownership. Do not remove guarantees to obtain faster numbers. Resolve difficult public-contract decisions explicitly before depending on them.
4. As soon as focused checks pass, record the exact scenario URL, expected observations, and automated semantic evidence. This automated run is authorized to proceed to hardening without waiting for optional hands-on feedback. Report the slice-ready milestone separately from feature completion. Pause only for a real unresolved behavior decision, missing authorization, protected action, or external dependency.
5. Harden with proportional edge cases, failures, rollback, disposal, and sustained/burst workloads from the issue document. Update applicable contracts, tests, scenarios, and field notes. Do not blindly regenerate visual baselines or weaken assertions.
6. Measure against the same baseline/workload/environment. Record medians, p95, worst frames, warmup, operation/ownership counters, and measurement limits. Run timing benchmarks exclusively: do not overlap them with another agent's builds, tests, or benchmarks. Prefer portable structural bounds over machine-specific CI thresholds.
7. Have the implementer inspect the complete diff and commit only the issue's intended changes. Produce a handoff with baseline/candidate SHA, changed files, failing-before and passing-after evidence, commands, environment, scenario URL, risks, and unresolved questions. A candidate commit is not permission to integrate before reviews pass.

## Independent reviews and reconciliation

Have an independent code reviewer inspect the exact candidate diff and relevant surrounding code/contracts. Require actionable findings with severity, location, trigger, consequence, and supporting evidence. Review correctness, cleanup, historical-state growth, scheduling, API compatibility, and algorithmic complexity. A passing test suite is not sufficient review evidence.

For high-risk issues, have a different verification reviewer independently reproduce the bug or scaling problem from the public surface and verify the candidate fix. This reviewer should challenge the benchmark and the claimed ownership/complexity invariant, not merely rerun the implementer's happy path. Check that instrumentation is passive and bounded, and that acceleration/forced GC is not mislabeled as natural endurance or native-memory proof.

Reconcile every finding in the issue completion record with one of: fixed with commit/test evidence; not applicable with concrete justification; or unresolved blocker. The orchestrator must resolve disagreements using code, contracts, or a targeted experiment. Do not accept the author's assertion as the only rebuttal, average conflicting opinions, or silently omit findings.

Return accepted findings to the implementer. Commit corrections, then have reviewers re-review changed code and unresolved material findings only. Reuse reviewers rather than launching repeated broad reviews. No open correctness, lifecycle, compatibility, or promised-acceptance defect may be waived simply to keep automation moving. Lower-priority work can be explicitly deferred only when outside the issue's acceptance bar, with a documented reason and follow-up.

When a risk or optimization is already resolved or cannot be reproduced, require independent reconciliation of that conclusion and record what was tested. Do not manufacture a production edit. A documentation/evidence-only closure is allowed when it genuinely satisfies the issue; unresolved inability to test is blocked, not done.

## Verify and integrate one issue at a time

The orchestrator is the only integration owner. Maintain a clean, task-owned integration worktree on `main`, or use an existing main checkout only after proving it is clean, free, and safe for this task. Never alter a dirty or active checkout belonging to another task. If main is already checked out elsewhere, inspect that ownership before attempting to move it; continue issue implementation while resolving integration access.

Before each merge, fetch origin, verify main ancestry, and incorporate accepted upstream changes by ordinary fast-forward/merge operations. Bring the issue branch up to the latest integration main with a merge and resolve conflicts in its isolated workspace. Re-run relevant tests and obtain focused re-review of conflict resolutions and changes to reviewed behavior. Never integrate an old reviewed SHA while silently including later unreviewed edits.

Run proportional focused checks, then `corepack pnpm@11.21.0 trust` on the exact integration candidate before every issue is declared complete and pushed. Run additional issue-specific stress checks because trust alone missed the original bugs. Keep benchmark timings separate from the aggregate gate's competing workloads. If a gate fails, diagnose and fix task-caused failures and reconcile reviews; never claim a pass, update baselines blindly, or disable checks. An unrelated baseline failure must be demonstrated against the baseline and reported as an integration blocker unless an explicit existing policy permits otherwise.

Merge the reviewed issue into main using a normal merge commit so issue provenance is retained. Verify the merged tree matches the tested candidate; if conflict resolution or other changes alter it, re-run affected checks and the required gate on that tree. Preserve the audit trail and use normal explicit staging for completion records. Ensure evidence records identify the code/tree actually tested even when a later documentation-only bookkeeping commit records its result.

Push main to the verified origin after each completed issue, using an ordinary non-force push. Verify the remote main SHA matches the intended result; command success alone is not the final check. If the remote moved, fetch and reconcile through the same tests/review process, then retry normally. Never override another contributor's changes. If branch protection requires a pull request, use the supported required workflow, attach any created PR to the task, and satisfy checks; do not bypass protection. If permissions or required human review prevent completion, report that exact blocker and continue independent ready work.

Update the queue and issue with review dispositions, test results, candidate and merge SHAs, verified remote SHA, and any PR link. Keep a small resumable progress ledger in this audit folder with issue status, branches/workspaces, blockers, and the next ready issue. Record local completion separately from merged/pushed completion. Stop owned test servers and processes when no longer needed. Reuse free worktrees; archive completed worktrees with the managed archive tool when they are no longer needed, preserving recoverable state. Do not use shell deletion to clean worktrees.

## Final completion criteria

Finish the queue only when every issue has met its acceptance criteria or has a justified, independently reviewed evidence-based closure, and each completed change is committed, merged, and verified on remote main. A blocked issue means the overall task is incomplete.

After the final integration, run the aggregate trust gate and the integrated stress matrix on final main. Include a natural unforced-GC soak, deterministic late-time animation probes, normal and overloaded texture inputs, physics churn and sleeping, repeated mount/dispose/failure cycles, Three generation-safe picking, and isolated versus composed rendering. Keep machine-specific performance results descriptive unless running an explicitly configured reference guard.

Report prioritized remaining risks, every issue disposition, exact environment and checks, before/after measurements, review reconciliation, final local/remote commit IDs, and any unresolved limitations. Provide regular concise progress updates during execution. Do not stop after the first fix or after assigning work to agents; persist until the queue is completed or genuinely blocked.
