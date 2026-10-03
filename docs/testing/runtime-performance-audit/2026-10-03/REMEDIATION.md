# Priority remediation — 2026-10-03

> **Historical status: Execution record for the user-authorized priority audit fixes.**

Production baseline: `690bb10a99246b6f5f57df9b0341774209905827`.
Audit baseline: `a86472e2c62eedf8a5f47141bcec9e624fe36566`.
This maintenance work does not advance a separate strategy initiative.
Unrelated dirty package consolidation/HtmlBox work remains untouched.

| Slice                                             | State                   | Acceptance                                                                                                   |
| ------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| A01/A11 texture failure and stale owner retention | In progress             | Public failure/retention regressions; zero orphan work; stale handle semantics preserved; independent review |
| A02 physics handles                               | Next                    | Live churn caches bounded, stale generations inert, disposal empty                                           |
| A05/A06 surface release                           | Queued                  | Incompatible and disposed owned surfaces zeroed exactly, errors preserve cleanup                             |
| A04 allocation pressure                           | Queued                  | Profile and address demonstrated allocation source; matched natural before/after evidence                    |
| A03 diffusion overload                            | Policy decision pending | Bounded work without silent lost/reordered accepted input                                                    |
| A07/A08 major CPU/copy costs                      | Queued                  | Profile-directed improvement with semantic/generation safety and matched measurements                        |

Integration requires the aggregate trust gate and independent review. The baseline
first fails Markdown classification (12 website-rebuild documents); after narrow
classification repair it exposes a stale texture contract semantic inventory
(12 recorded versus 31 current units). These are prerequisite failures, not waived
checks. Exact approved-source reconciliation is in progress; no blind baseline
refresh or runtime integration is authorized by a passing focused suite alone.

Every completed slice will record candidate/review/verification/merge/remote SHAs
and reconciled findings here. Timing probes are serialized.
