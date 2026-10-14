> Archived exploration. The approved study 08 is packaged in `../pibbl-big-bubbles/animation/loader/`. This folder is a private brand study, not Pibbl docs or a Pibbl runtime example.

# Pibbl contact motion study

Open `index.html` through the brand preview server. This is the first SVG implementation of the contact storyboard, ready for motion feedback rather than a finished loader release.

The default 11-second loop includes an invitation, platform landing, connected curved-edge ride, ramp landing and slide, floor pivot, recovery, contagious giggles, a pause, three escalating preparation hops, a high flip, a pyramid catch, and reset. Ready waits only until the current encounter ends, then gathers the pieces and seats coral and violet around the green stem. The approved nine bubbles finish the mark. The floor guide is optional.

## Shared motion contract

`motion.mjs` has no DOM, SVG, browser clock, or Pibbl dependencies. `choreography(progress)` returns three normalized rigid transforms in coral / green / violet order. Progress is one loop, [0, 1]. `finishChoreography(from, progress)` samples the completion motion from an explicit snapshot. The normalized shape outlines are triangle 128×140, green rectangle 124×140, violet bowl 100×140. The bowl is the approved original cubic outline, not an approximate circle.

Each transform is `{ x, y, rotation, sx, sy }`: translation, world-axis scale, then clockwise rotation in degrees about the local origin. Subtle squash and stretch is anchored to the supporting edge; the resting and final proportions remain unchanged. The original kit's green path needs a local (0, -140) offset; its violet path needs (-128, 0). All three retain their approved proportions. World coordinates use a 640×450 view, with the planning floor at y=390. Final triangle origin is (200,110), rectangle (200,250), and bowl (328,110). Bubble coordinates remain relative to the final triangle origin.

Magnetic attachment derives green's transform from violet's transform so their entire 140-pixel seam stays exact. Rolling uses the bowl's outline support height to integrate floor travel. Floor pivots use explicit local contact points. Green and violet form the pyramid base before coral lands point-up. Their catch compression moves coral’s supporting edge by the same amount. Outlines are sampled at startup; no SVG measurements or physics engine are required. The acting is deliberately choreographed, not simulated rigid-body dynamics.

## Future Pibbl renderer

Keep this score. Use Pibbl's public `defineAnimation` seekable sampler to drive a progress signal and `usePlayback` for lifecycle and timing. Sample the shared score inside the drawing component and apply its transforms to Groups around the same paths. Let Pibbl own the frame scheduling; do not bring over the SVG preview's requestAnimationFrame loop. Ready, pause, restart, reduced motion, and the bubble phase belong to an explicit playback controller. Port the bubble release calculation from the SVG preview without changing the identity coordinates or colors.

The runtime and its public APIs have not been changed in this study. The port has not been implemented or verified yet.

## Focused verification

Run `node motion.test.mjs`, `node contact-motion.test.mjs`, and `node no-overlap.test.mjs` here. These check floor penetration, curved support, magnetic seam alignment, finite seeking, loop closure, and exact final P coordinates. Browser inspection is still necessary for the acting, contacts between unrelated pieces during transitions, and timing. `collision.mjs` evaluates exact cubic projection extrema, including squash and stretch. The overlap suite samples the full loop at 5,001 points and every completion checkpoint at 501 points; touching edges are permitted. The same score and transform order must be preserved in the Pibbl port.

Airborne motion is sampled through each shape’s center, with constant horizontal velocity and constant downward acceleration per flight. Rotation and muscle stretch preserve that center trajectory. Green’s toss is a single flight to the ramp; violet follows one complete jump through the release. Increasing preparation hops get increasing airtime. Gravity is art-directed per encounter; this is not a rigid-body simulation with one shared physical gravity constant.

The story retains its existing beat durations; the return now occupies 1.5 seconds rather than 0.5. Coral dismounts point-up into a compact home group; green yields as violet rolls away without sliding its ground contact. Landing compression is followed by a shared rest.
