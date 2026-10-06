# Native state machines

> **Historical status: Design record retained as implementation evidence; current code and public contracts define shipped behavior.**

Status: approved API direction from the 2026-10-05 conversation. Not a shipped
contract. Performance and bundle-size requirements below are acceptance criteria,
not measured results.

## Approved scope

Implement native flat machines with typed context, events, input, guarded
transitions, actions, entry/exit behavior, and state-owned cancelable tasks.
No XState dependency. Hierarchy, parallel state regions, history states, and
persistence are deferred. Multiple tasks may run concurrently within one state.

Public authoring uses `defineMachine`, `assign`, and `fromCallback`. Explicit
ownership uses `createMachine`, `start`, `send`, and terminal idempotent `stop`.
`useMachine` supplies mount ownership. Actors expose a readonly `snapshot`
signal containing state value, context, status, matching, and failure information.
Ordinary computed signals select snapshot fields. Context is immutable ordinary
data, not a collection of externally writable signals.

Transitions support target shorthand, guarded alternatives (first passing guard
wins), action-only handling, and explicit self-reentry. A same-state transition
preserves owned work unless `reenter: true`. Local handlers shadow machine-level
handlers even when none of their guards pass. An empty handler consumes an event.
Unhandled events do nothing.

Events execute serially; nested sends queue rather than reenter. Choose a
transition against the previous snapshot, exit/cancel previous work, execute
transition actions in order, enter the new state, publish one coherent snapshot,
then start invoked work. Actions see preceding assignments. Effects cannot be
rolled back. Unexpected action/guard failures terminate and clean up the actor;
invocation failures may take an explicit `onError` transition.

Each state entry owns a fresh invocation identity. Leaving aborts tasks and runs
callback cleanup. Late results cannot affect later entries into the same state.
Cancellation does not trigger task completion/error transitions. Task callbacks
receive their initial context, initiating event, input, abort signal, and send.

The optional `playAnimation` task adapter owns one playback and uses the existing
Pibbl scheduler. Finite programs complete; loops last until cancellation. No
second animation clock. Ordinary sprite frame and physics signals remain outside
machine context; frame advancement does not cause machine transitions.

## Lightweight implementation requirements

- Separate ESM entry points for machines and animation integration:
  `@pibbl/core/machines` and `@pibbl/core/machines/animation`. Keep definitions,
  actor execution, mount hooks, callback adapters, and animation adapters in
  separate internal modules so unused exports can be eliminated. Mirror the
  supported public package facade when adding exports.
- The standalone actor graph must not reach the Canvas renderer, physics,
  sprite loaders, animation engine, or mount hooks. Import narrow signal modules,
  never the root barrel. The hook adds mount ownership; the animation adapter adds
  playback dependencies only when used.
- No import-time registration, global actor registry, injected default adapters,
  eager timers, or eager actor creation. Preserve the existing side-effect-free
  package declaration with genuinely side-effect-free module initialization.
- No mandatory runtime dependency. Type machinery erases from output. Avoid
  runtime schema libraries, proxies, deep cloning, and deep equality checks.
- Normalize reusable definitions once, not once per actor or event. Dispatch by
  current state and event type; scan only that event's ordered guard alternatives.
  Do not scan the full graph, unrelated actors, or unrelated invocations.
- Idle machines schedule no work. No frame subscription for general machines.
  Only invoked work that actually needs frames participates in the existing
  scheduler.
- Use a queue with a head index or equivalent amortized constant-time dequeue;
  avoid array shifting and recursive dispatch. Release consumed event references.
- Ignore unhandled events without creating snapshots or notifying subscribers.
  Preserve snapshot identity for unchanged observable state. Publish at most one
  snapshot for a completed transition, regardless of assignment count. Preserve
  serial event ordering rather than silently coalescing distinct events.
- Allocate task ownership/cancellation machinery only when invoking tasks. Release
  listeners, queues, closures, and owned resources on exit, failure, and stop.
  Prefer simple allocation discipline over object pools unless measurement proves
  pooling worthwhile; public snapshots must never be mutated or recycled.

## Evidence and delivery

### Documentation and JSDoc requirements

State machines are a general-purpose framework capability, not an animation
feature. Give them an independent Learn area, API coverage, and runnable examples
under `docs/site/`, integrated with public navigation and local Studio search.
Keep animation coordination as an integration guide that links both concepts.
Do not require sprite or animation knowledge to learn machines.

Document every new public export, type, member, option, and callback with useful
JSDoc as it is implemented. Explain behavior, defaults, input/output types where
prose helps, lifecycle/ownership, cancellation, errors, and timing where relevant;
avoid comments that merely repeat names. Include short examples for authoring
entry points. Preserve JSDoc in generated declarations and Studio editor types.
Document nonobvious internal invariants beside their implementation as well.

Public learning coverage includes definitions versus actors; events, actions,
guards, and context; signal snapshots and computed selections; mount and explicit
ownership; async/callback tasks, cancellation, and error handling; and animation
integration. Include a minimal non-animation example such as a loading/retry flow,
alongside the game's character/session examples. Document supported flat-state
semantics and deferred capabilities without implying XState compatibility.

Sprites retain their own Learn/API area and minimal frame/clip demonstration.
Animation documentation covers playback and composition independently, linking to
machines for state-dependent coordination. The complete game demonstrates how
these capabilities compose, and does not substitute for their focused guides.
Keep API reference, runnable examples, declarations, and implemented contracts in
agreement; avoid publishing proposed behavior as already available.

Start test-first with one public machine driving a sprite signal, demonstrate it
in the game, and obtain experiential feedback before broad hardening. Character
locomotion and session lifecycle have separate owners. Physics sends contact and
airborne events; the machine does not integrate physics. Session context tracks
score/coins/lives, including every crossed 100-coin threshold. Death animation
completion never implicitly revives a character.

Verify tree shaking against packed ESM output, not just source exports. Consumer
fixtures cover: an application importing no machines, definition-only use, a
standalone signal-backed actor, the mount hook, and animation integration. Inspect
retained module graphs as well as minified and gzip sizes. Compare against a
baseline importing shared dependencies so incremental costs remain clear. Unused
machines must add no retained machine code; standalone use must exclude the
renderer and animation adapters. Check both supported package facades.

Focused structural evidence covers no idle scheduling, no notifications for
ignored events, selected-signal equality suppression, nonrecursive reentrant sends,
one publication per transition, stale task completion rejection, and exact cleanup.
Measure dispatch workloads separately for ignored events, context updates, guarded
transitions, nested sends, and task replacement, varying actor and graph counts.
Report throughput, allocation evidence, environment, and bundle sizes honestly.
Do not impose arbitrary timing thresholds in ordinary CI or claim zero allocation.
Establish explicit size regression budgets from the first measured useful slice;
bundle exclusions and idle-work requirements apply from the first implementation.
