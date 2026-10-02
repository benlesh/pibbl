# 2D physics contract

CRC owns authoring, identity, scheduling, commands, observation, and cleanup.
Rapier 2D compat **0.21.0** owns rigid-body integration and solid contact solving.
There is one supported runtime engine and one CRC realm clock. Pure geometry
entries do not initialize WebAssembly or require a renderer.

## Loading, units, and numerical policy

`@crc/core/physics/2d` is an ES module with top-level await. Its embedded WASM
initializes before imports resolve; no external WASM fetch or engine animation
loop is created. Applications use ordinary static imports or await dynamic
imports. Studio loads its bundled runtime as a module before mounting the scene.

Positions, shapes, bounds, targets, queries and contact points use logical Canvas
units. Velocities use units/second, forces use mass × units/second², and public
angles use degrees. Timesteps use milliseconds. Internally 100 logical units
map to one engine meter; torque and inertia scale by 10,000. Rapier stores
single-precision values: use tolerances for simulated results. Values that
cannot survive the engine's numeric range fail with an actionable error.

Default gravity is `[0, 0]`; a screen-space falling scene typically uses
`[0, 600]`. Default step is `1000 / 60` ms, catch-up budget is four steps,
interpolation is linear and sleeping is enabled. Elapsed time beyond the
catch-up budget is discarded, never integrated as one giant step.

A frame-end kinematic target interpolates evenly over every accepted catch-up
tick, rather than jumping at the first tick. A moving passenger therefore has
the same simulated result for equivalent 30 Hz and 60 Hz host-frame cadences.

The existing solver option names remain accepted: `velocityIterations` maps to
Rapier's solver iterations (default **4**); `positionIterations` maps to internal
PGS iterations (default **1**). Both accept integers 1–32 and are reactive.
These are numerical budgets, not promises of the former solver's trajectories.
The old private solver remains a regression/comparison reference; public worlds
always instantiate Rapier.

Circle, box, capsule, segment and convex polygon leaves use native engine
colliders. Concave shapes retain CRC's convex decomposition. Ellipses and
rounded corners use convex polygons with at most 0.01 logical-unit chord error;
more than 4096 samples is rejected before allocation. Pure geometry queries
retain the original mathematical shapes, so contact response may differ within
that approximation. Explicit simpler collision geometry can reduce cost.

CCD is opt-in per dynamic body. Rapier's continuous collision processing is
supplemented by bounded substeps because opposing CCD dynamic bodies can
otherwise cross. The bound considers linear/angular velocity, acceleration,
and the smallest convex-leaf width (minimum 0.01 units). More than 64 substeps
rejects and rolls back that frame; reduce speed, step size, or use thicker
collision geometry. This is a bounded robustness measure, not a proof against
all pathological rotating or degenerate geometry. Sensors are discrete overlaps
at fixed-tick boundaries, not swept triggers. Use explicit casts for fast
sensor detection.

Transient solid CCD impacts remain in the contact lifecycle for callbacks even
when the bodies have separated by the end of that tick; their end event arrives
on the next tick. Discrete sensor contact timing remains unchanged.

## Composition and ownership

`PhysicsWorld2D` owns one world until its component unmounts. Stable keyed body
attachments keep their identities across rerenders. New authored positions set
initial dynamic poses; use commands to move a running dynamic body. Static
geometry follows authored placement. Kinematic targets own kinematic movement.
Do not animate and simulate the same dynamic transform simultaneously.

`space="root"` preserves root-logical simulation coordinates. Creation-only
`space="local"` creates a simulation coordinate boundary at the world component.
Moving or scaling its parent changes the view without changing poses, velocities,
gravity or body generations. Body transforms inside the simulation still follow
the existing rigid-transform restrictions. The boundary must be finite and
invertible; changing `space` requires a keyed remount.

Root pointer coordinates remain unchanged. Convert with `toPhysicsPoint2D`
before a local query/teleport/target update; `fromPhysicsPoint2D` performs the
reverse conversion. Queries use authoritative simulation coordinates. Rendering
and pointer targeting use interpolated presentation geometry. A body's public
pose is its authored origin, while integration and mass properties use its
center of mass. Changing collider density updates COM-relative engine offsets
without moving the authored collision geometry.

Begin accepts commands; Advance computes fixed steps; Commit publishes state;
Complete delivers callbacks. Callback commands enter a later frame. A failed
candidate restores both CRC storage and the engine snapshot and publishes no
partial simulation state. Other worlds may continue. Explicit disposal frees
engine resources, signal observers, handles and scheduler registrations.

For a surviving body or collider generation, Complete reads the latest committed
inline callback. Removing a callback suppresses later delivery for that
generation; stale callbacks are never retained solely because a prior render
registered them.

Stationary kinematic worlds and sleeping dynamic worlds request no frames.
Target signal changes, topology changes and commands wake work as needed.
Passive participation can observe animation writes within the same shared frame
without creating an idle animation loop.

## Observation and testing

`inspectPhysics2D(world)` returns deeply frozen JSON-safe observations of current
identity, authoritative and presentation poses, COM, velocities, mass, bounds,
contacts, sleep state, revision, tick and failed-frame diagnostics. String tags
become labels; arbitrary application objects are not serialized. Observation
neither steps nor schedules the simulation. It is not a persistence format.
`inspectPhysics2D(body)` returns the corresponding deeply frozen body
observation without selecting another body; an unbound or stale handle returns
`undefined`.

`PhysicsDebug2D` draws authoritative bounds, mass centers and contact normals
without registering pointer targets or mutating physics. Linear interpolation
can make its authoritative bounds slightly lead the displayed body between ticks.

`@crc/core/physics/2d/testing` provides an isolated browser harness using the existing
realm scheduler. It rejects a realm containing a live CRC root. `flush()`
delivers one pending frame at current time; `advanceFrames(n, ms)` delivers up to
n pending host frames; `act()` performs an action then flushes once. These are
host frames, not guaranteed fixed ticks. `observe()` is read-only. `reset()`
disposes/remounts the root factory without rewinding host time; external caller
state is the caller's responsibility. `dispose()` restores the previous driver
and preserves the caller-owned Canvas.

For reproducible reports, record engine version, world configuration, initial
scene/seed, exact host frame times, actions and observations. Assert finite
state, geometry, contact lifecycle and cleanup before screenshot comparisons.

## Performance evidence

Use `tooling/physics-comparison/benchmark.mjs` for machine-recorded comparisons.
Distinguish raw engines from the CRC adapter: transactional snapshots, public
state publication and Canvas rendering have real costs. Do not turn one machine's
p95 into a universal CI requirement. Structural tests protect O(1) per-body reads,
idle scheduling and owned-resource cleanup. Debug snapshots/overlays intentionally
allocate and are opt-in diagnostics, not per-body rendering dependencies.
