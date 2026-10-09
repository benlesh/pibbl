# Reproduce the approved loading animation in Pibbl

This handoff belongs to the logo kit, not Pibbl documentation. The SVG component is the current working delivery. A Pibbl version has not been implemented or verified. Start by sharing the existing pure motion score rather than reinterpreting its keyframes.

## The little troupe

**Violet** is the playful, supportive instigator. It invites green onto its flat edge, carries it through a rolling ride, then gives it a forward hoist. Its curved edge gives it a distinctive way to rock and roll. It laughs first after green's undignified landing.

**Green** is earnest and game for anything. Its flat sides make it a steady platform and useful partner. It crouches before pushing away, rotates clockwise to ride the ramp on its back, slides off, lands flat, then joins the laughter. Later it works with violet to catch coral.

**Coral** is eager and increasingly bold. It prepares the ramp, watches the joke, joins the giggles, then builds courage through three progressively higher hops. Its big leap and little airborne flip earn the coordinated pyramid catch. The point faces up on the pyramid and dismount.

No faces or limbs: personality comes from anticipation, timing, reciprocal responses and shape-specific contact. The satisfying moments are the exact magnetic seam, a curved edge carrying weight, a smooth airborne arc into back-first contact, the bonk followed by contagious laughter, increasingly ambitious hops, the catch's shared compression, and a gentle return that closes without a snap.

## Approved score at normal speed

Times are seconds in the 11-second loop. Internal story coordinates are progress × 1.1, so a story coordinate of .08 means 0.8 seconds, not 8% of the final loop.

| Time    | Acting / physical relationship                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------- |
| 0–0.8   | Nearby shapes settle; violet rocks an invitation, green responds with a small lean                      |
| 0.8–1.8 | Green crouches, extends on takeoff, follows a gravity arc and lands on violet's flat side               |
| 1.8–2.5 | Coral hops into the ramp position while green remains attached                                          |
| 2.5–3.2 | Violet rolls on the curve carrying green; exact flat-edge contact persists                              |
| 3.2–3.9 | Violet crouches and jumps toward coral; attached green compresses for its own push-off                  |
| 3.9–4.5 | Green follows one continuous flight, rotating clockwise onto its back; violet completes its own arc     |
| 4.5–5.1 | Green slides down coral's ramp to its edge                                                              |
| 5.1–5.6 | Green pivots over the edge, falls flat and settles                                                      |
| 5.6–6.8 | Violet compresses in giggles; green joins around 5.9, coral around 6.25; amplitudes stay subtle         |
| 6.8–7.2 | Hold a breath after the laugh; avoid rushing the next gag                                               |
| 7.2–8.0 | Coral's three hops rise 12, 28, 55 units, with increasing airtime and effort                            |
| 8.0–9.1 | Coral launches high, with a 26° partial flip; green and violet scoot and compress beneath it            |
| 9.1–9.5 | Point-up pyramid lands; base compresses together and moves coral's support by the same amount           |
| 9.5–11  | Coral dismounts via a gravity arc, green yields, violet rolls home; landing compression and shared rest |

Ready does not interrupt midflight. Safe checkpoints are story coordinates `.08,.18,.25,.32,.39,.45,.51,.56,.68,.72,.80,.91,.95`, divided by 1.1, plus 1. The captured checkpoint poses feed `finishChoreography(from,t)`. Preserve the special route that lifts coral clear when it sits above green. Formation parks pieces with clearance before seating green, coral, then violet. After 1,600ms, the P is exact; the 450ms bubble release is staggered by 30ms across nine bubbles (690ms total). No shadow or visible floor is part of the release.

## Geometry and coordinate truth

The saved identity is authoritative for paths and palette. `identity.mjs` is a bundled snapshot of `../../source/identity.json`. Colors: coral #FF735E, Kelly green #159447, soft violet #8B5CCB. Do not replace the bowl with a semicircle: its exact approved cubic silhouette supplies the rolling support.

Original paths:

```text
Coral:  M0 0H128L0 140Z
Green:  M0 140H124V280H0Z
Violet: M128 0H148C192 0 228 31 228 70C228 109 192 140 148 140H128Z
```

Normalize green with local translation (0,-140), violet with (-128,0), coral unchanged. The normalized boxes are 128×140, 124×140 and 100×140. Scale the complete 640×450 composition for a responsive canvas; the invisible floor is y=390. Final origins are coral (200,110), green (200,250), violet (328,110), all rotation 0 and scales 1. Bubble coordinates are relative to (200,110), independent of the normalized violet origin.

Each sampled pose is `{x,y,rotation,sx,sy}`. Preserve **translate → scale → rotate**, equivalently `T × S × R` applied to local points (rotation first, then world-axis scaling, then translation). SVG rotations are clockwise degrees in downward-y coordinates. Match this explicitly in Pibbl; don't assume a single Group's style transform has the same order. Nest groups or apply a verified equivalent matrix. Verify against `worldPoint()` with off-axis points and nonuniform scale. Put the local path normalization inside the motion transform.

`collision.mjs` computes projection extrema for the actual cubic, not just a rectangle. Touching is permitted; intersecting interiors are forbidden. Magnetic docking derives green from violet so the whole 140-unit flat seam remains exact. Squash stretches the perpendicular extent while retaining the actual supporting edge. Rolling integrates the curved outline's changing floor support to avoid sliding. Floor pivots keep a selected contact point fixed. When two bases compress under coral, update the supported coral together.

## Gravity and effort

For airborne motion, the shape's reference center follows:

```text
centerX = lerp(startCenterX,endCenterX,u)
centerY = lerp(startCenterY,endCenterY,u) - 4*height*u*(1-u)
```

Thus horizontal velocity is constant and downward acceleration is constant within a flight. Compute rotated/stretched center offset and subtract it to recover the shape origin. Moving the origin on an arc while rotating around a corner gives a visibly wrong mass trajectory. Reference centers are triangle (128/3,140/3), rectangle (62,70), bowl (42,70). The bowl reference is art-directed, not an exact physical centroid.

Gravity is chosen per encounter; this is choreographed contact animation, not one rigid-body simulation with a universal g. Preserve the approved functions and their arc heights. Avoid ease-in-out position tweens for flight, midair direction changes, or rotating to the landing pose in a separate final step. Compress before launch, extend while lifting, settle in the air, compress at impact, then recover. Don't uniformly squash about the origin: it breaks floor/partner contact. Increasing hop height needs increasing airtime. Static holds are part of the rhythm.

## Bubble release

Reuse `bloom(time)` from `playback.mjs`. The first five bubbles originate inside violet and leave corresponding growing cutouts. Four accent bubbles begin near their final destinations. Cubic ease-out drives radius and travel; a small sine arc lifts each particle. The source bubbles transition from violet to their final colors with smoothstep. Accents fade in. At completion, write exact saved destination coordinates and radii; do not leave tiny floating-point sine offsets. Nine destinations are organically distributed and include green and coral. Preserve the approved arrangement; do not procedurally randomize it each loop.

SVG uses a luminance mask. For Canvas/Pibbl, ensure holes erase **only violet**, not earlier pieces or the whole canvas. One option is a verified compound path with an even-odd fill; another is a privately isolated layer with supported compositing. Confirm the current public drawing/Clip/Layer contracts before choosing. Do not assume an SVG mask can be passed directly to Pibbl. Render the final bubble circles above the three pieces in source paint order.

## Pibbl implementation path

1. Keep `motion.mjs`, `collision.mjs`, identity and bubble math pure and unchanged. Share these modules with the SVG reference wherever possible. No DOM measurements or Pibbl internals are needed.
2. Read current `docs/design/animation-contract.md`, `drawing-components-contract.md`, `style-system-contract.md`, and `signals-and-scheduling-contract.md`, plus the public signals-and-animation guide. They are inputs to the port; do not publish this study into them.
3. Use public `defineAnimation` for a seekable numeric time/progress sampler, `useSignal` for state and `usePlayback` for lifecycle. Compose supported immutable programs and safe transitions. Verify exact current signatures/types before writing the adapter.
4. Let Pibbl own the scheduler. Do not copy the custom element's requestAnimationFrame or launch a second loop. Implement pause, restart, completion and disposal through public controls. Completion snapshots must be taken at a checkpoint, not at an arbitrary air pose.
5. Render three paths with the verified transform order, then the release cutouts and particles. The first slice should reproduce one full loop and Ready via a small private brand preview outside documentation catalogs.
6. Run the same pure semantic tests, then compare both renderers at every beat boundary, peak, seam, ramp contact and catch. Add renderer-level public API evidence for transforms and cutouts. Inspect video at normal speed as well as frame-by-frame.
7. Verify reduced motion, pause/ready, restart, multiple mounts and exact disposal. Only consider making Pibbl the primary version after visual equivalence, startup/bundle cost and lifecycle behavior are accepted. Keep this lightweight web component as a portable fallback for sites that don't load Pibbl.

## Acceptance checklist and lessons learned

The user-approved priorities are: fast playful pacing; **no overlap ever**; a compact starting group; natural gravity; anchored compression and extension; use of flat edges for support and the curve for rolling; clockwise green flight onto its back; a pause after shared laughter; successively higher coral hops; an exact coordinated catch; and a relaxed loop return. Timing/paths must agree across artifacts.

Earlier versions failed when shapes simply spun independently, flew on eased diagonal segments, intersected through pose changes, lacked takeoff effort, or rushed the last half-second to their starting positions. Preserve the 1.5-second return and shared rest. Life comes from cause and response: one initiates, another accepts/helpfully moves, all react to the outcome. More random motion does not solve this.

Tests shipped beside this guide cover exact curve support, finite poses, magnetic seams, floor clearance, sampled no-overlap, ballistic centers, effort, personality beats, final identity, and loop closure. These are numerical sample checks, not a proof for every continuous instant. Preserve them when editing, and expand adaptive checks around any changed contacts. Human review of the approved acting remains the final visual reference.
