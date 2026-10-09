# Animation handoff

parts/ contains three solid primary shapes, the final cutout bowl, nine independent bubble SVGs, and the outlined wordmark. The shape/bubble SVGs share a 350 × 350 viewBox and a (35,35) translation. Source/destination bubble coordinates and pivots in animation-parts.json are LOCAL coordinates, before that translation.

The production kit adds clear space: its horizontal composition places the icon at (35,41) and the wordmark at (350,79), with a 940 × 370 viewBox. To reconstruct the production lockup, use its placements from source/identity.json rather than the earlier horizontalWordmarkOrigin recorded in the animation manifest. The animation parts are self-contained assets; for individual transforms, animate a wrapper around each path or parse the recorded local geometry.

Start with the solid bowl. At release, expand the five circular cutouts while moving the corresponding bubbles from their source to destination positions. The other four dots are accent reveals. Two departing bubbles transition from violet to coral/green; preserve their final specified colors. Keep the approved final arrangement fixed across runs.

Planned sequence: tumble loop → settle into P → release bubbles → hold. Timing, easing, loading-state transitions and reduced-motion behavior remain implementation work.

## Approved executable loader

The final SVG custom element lives in [loader/](loader/README.md). Its [private demo](loader/demo.html), [Pibbl port handoff](loader/PIBBL-PORT.md), and [GIF exports](gif/) supplement these editable parts. The loader uses a 640×450 motion stage and normalized local shapes; these static parts retain their original 350×350 coordinate system. Do not apply one set of origins to the other. The old timing suggestions above are historical: shipped defaults are 11,000ms looping, 1,600ms formation, 450ms release with 30ms stagger. No Pibbl documentation/catalog integration is intended.
