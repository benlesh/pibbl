# Animation handoff

parts/ contains three solid primary shapes, the final cutout bowl, nine independent bubble SVGs, and the outlined wordmark. The shape/bubble SVGs share a 350 × 350 viewBox and a (35,35) translation. Source/destination bubble coordinates and pivots in animation-parts.json are LOCAL coordinates, before that translation.

The production kit adds clear space: its horizontal composition places the icon at (35,41) and the wordmark at (350,79), with a 940 × 370 viewBox. To reconstruct the production lockup, use its placements from source/identity.json rather than the earlier horizontalWordmarkOrigin recorded in the animation manifest. The animation parts are self-contained assets; for individual transforms, animate a wrapper around each path or parse the recorded local geometry.

Start with the solid bowl. At release, expand the five circular cutouts while moving the corresponding bubbles from their source to destination positions. The other four dots are accent reveals. Two departing bubbles transition from violet to coral/green; preserve their final specified colors. Keep the approved final arrangement fixed across runs.

Planned sequence: tumble loop → settle into P → release bubbles → hold. Timing, easing, loading-state transitions and reduced-motion behavior remain implementation work.
