# 2D physics quality decision record

> **Historical status: IMPLEMENTATION DECISION RECORD.** This dated record
> captures the scope authorized on 2026-09-29 and the implementation decisions
> made while repairing the shipped 2D physics runtime. Current behavior is
> governed by `docs/design/physics-2d-contract.md`.

## Authorization and scope

The user directed Pibbl to fix all observed 2D physics quality problems and to
review performance and the algorithm. That authorizes corrective implementation,
public composition and testing improvements, and a documented evidence plan. It
does not state that the user selected a particular third-party engine.

## Engine decision

The implementation compared the existing solver with maintained public engines
and selected bundled Rapier 2D compat 0.21.0 for public rigid-body integration
and solid contacts. This is an implementation judgment based on the comparison,
license compatibility, lifecycle fit, and observable quality evidence; it is not
presented as an explicit user choice. Pibbl remains responsible for authoring,
identity, scheduling, commands, observation, rollback, and teardown.
The bundled ES module initializes its embedded WASM before imports resolve, with
no external fetch or engine-owned animation loop.

## Units and scheduling

Public coordinates remain logical Canvas units and public angles remain degrees.
The adapter uses a documented 100 logical-units-per-meter conversion and exposes
finite failures rather than silently accepting unsafe engine values. Gravity,
fixed steps, catch-up bounds, solver iteration budgets, sleeping, command
admission, and transaction rollback remain owned by the one Pibbl realm scheduler.
The default gravity is `[0, 0]`; the default fixed step is `1000 / 60` ms with
four accepted catch-up steps, linear interpolation, and sleeping enabled.
A frame-end kinematic target is divided evenly over its accepted catch-up ticks,
so a passenger has the same simulated result at equivalent 30 Hz and 60 Hz host
cadences.
The legacy-named reactive solver budgets map to the engine's solver and internal
PGS iterations, with defaults 4 and 1 and an inclusive 1–32 range.
Begin admits commands, Advance runs fixed steps, Commit publishes an accepted
transaction, and Complete delivers callbacks. A failed candidate restores the
engine and Pibbl state without partial publication.

## Collision quality and composition

Native colliders serve simple convex leaves while Pibbl retains decomposition and
pure geometry contracts for compound or approximate shapes. CCD is opt-in and
uses bounded additional steps for fast opposing dynamic bodies; sensors stay
discrete and fast trigger authors use explicit casts. Dynamic-body ownership and
a creation-only local-space world boundary preserve simulation values while its
parent moves or scales.
That finite, invertible local-space boundary requires a keyed remount when its
space changes. Queries retain authoritative coordinates while rendering and
pointer targeting use presentation geometry; public body poses remain authored
origins while engine mass properties use the center of mass.
Transient solid CCD impacts remain available to callbacks even if the bodies
separate before the tick ends, with their end event in the next tick; discrete
sensor timing does not change.

## Observation and agentic testing

Public inspection exposes immutable JSON-safe body, collider, contact, sleep,
failure, and presentation observations without stepping. The debug component is
read-only. A supported isolated manual host-frame testing harness lets tests
drive public Pibbl compositions, observe state, reset without rewinding time, and
restore the previous scheduler driver on disposal or failed reset. Reproducible
reports retain exact frames, actions, and observations.
`inspectPhysics2D(world)` returns deeply frozen current identity, pose, center
of mass, velocity, bounds, contact, revision, tick, and failed-frame data
without scheduling a step. `PhysicsDebug2D` does not register pointer targets.
`inspectPhysics2D(body)` returns that exact currently bound body's frozen
observation; unbound and stale handles return `undefined` without selecting a
different dynamic body.
For a surviving physics generation, callback delivery reads the latest committed
inline handler; a removed handler is suppressed rather than retained by an
earlier render.

## Performance evidence

Performance work removes full-world scans from per-body presentation, keeps
sleeping and stationary kinematic worlds idle, and records raw-engine versus Pibbl
adapter comparisons with explicit transaction and rendering caveats. Structural
complexity and resource ownership tests are the correctness gate; one machine's
timing is diagnostic evidence rather than a universal threshold.
