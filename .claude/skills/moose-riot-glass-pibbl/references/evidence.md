# Evidence

A composition is not finished when it renders. This is how you make it inspectable, how you
judge it, and what you are allowed to claim.

## Make it runnable first

Follow the repository's vertical-slice sequencing: get the smallest end-to-end thing
visible, hand over the URL, take feedback, _then_ harden. Do not build the edge-case matrix
before anyone has looked at the scene.

A Studio example is two files' worth of work. The module:

```tsx
// packages/scenarios/src/learning/<section>/<slug>.example.tsx
import { pibbl, type PibblController } from "@pibbl/core";

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <SceneRoot />);
}
```

The path is conventional, not free: the "view source" link is derived as
`packages/scenarios/src/learning/${section}/${slug}.example.tsx`, so the file must live
exactly there. Then register it in `packages/scenarios/src/learning-catalog.ts` with
`slug`, `title`, `shortTitle`, `section`, `order`, `summary`, `api`, exactly two
`objectives`, `prompts`, `canvas`, `related` (slugs that must exist), and
`load: () => import(...)`. `validateLearningExampleCatalog` enforces the shape.

The URL is `#/examples/<browseGroup>/<slug>` — a `composition` section browses as
`composition`. Keep learning examples separate from the deterministic test-lab catalog in
`catalog.ts`; both should exercise the same public behaviour, and neither should impersonate
the other.

Then tell the person the exact URL and **what to look at** — the primary target, the
revelation through each pane, and the one thing you are unsure about. "It's done" without a
URL is not a handover.

## Build both themes, or it is not built

Light and dark are both required, and neither is the priority. A screen is not
theme-complete until both are implemented and _looked at_. Dark is not an inversion: in
light the instrument reads as a lens over paper, in dark as illumination over depth.

Capture the same populated scene at **desktop and 390×844**, in **both modes**:

| What           | Why it is on the list                                                   |
| -------------- | ----------------------------------------------------------------------- |
| Rest           | The declared reading order either holds or it doesn't.                  |
| Hover / focus  | Emphasis must move locally and give itself back.                        |
| Selected       | One moving lens, and still correct after keyboard navigation.           |
| Busy           | Loops belong to unresolved work and must stop when it resolves.         |
| Empty          | Explains the state and offers a useful next place.                      |
| Unknown        | The hardest one. Must not read as zero, healthy, or a confident number. |
| Optics off     | `filter: []` and solid tints — hierarchy must survive.                  |
| Reduced motion | State, selection, focus and meaning survive without movement.           |
| Overlay open   | Reading plane protected, parent visible as context, one scrim.          |

Populated means populated. An empty backdrop behind a pane proves nothing about a pane whose
whole job is revelation, and an empty chart is not an explanation of missing evidence. Use
fictional or anonymized data freely — but data that does not behave like real information is
not acceptable evidence.

For Unknown specifically: withhold the dependent totals, trend claims and recommendations
while preserving independently supported facts, and give the explanation and the
evidence-repair action a clear hierarchy. Distinguish unknown from zero, stale and busy.

## Judge four things separately

Score each with visible evidence on a 1/3/5 scale and keep the disagreements — do not
collapse them into one quality number.

| Dimension     | 1                                                            | 3                                                      | 5                                                              |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| **Purpose**   | The intended decision or understanding is unsupported.       | Achievable with extra interpretation or searching.     | Necessary meaning, evidence and next step are clear.           |
| **Beauty**    | Harsh, generic, or effect-heavy treatment obscures the work. | Pleasant but uneven rhythm, type, light or colour.     | Distinctive, elevated, intentional, with useful delight.       |
| **Cohesion**  | Competing accents and nested effects fragment the scene.     | A family is visible but one region or state breaks it. | Frames, light, boundaries, spacing and states are coordinated. |
| **Usability** | Hidden evidence, unreadable content, or broken interaction.  | Usable with a real narrow, reading or state cost.      | Readable evidence, clear controls, coherent response.          |

Then run the brand gate **independently** and report pass / fail / unverified without
averaging it into the above: immutable foundation and role ramps intact, roles actually
mapped to meaning, accent still ink, focus and selection observation only, the instrument
gradient not spent on a fill, the neutral still warm, no pane that reveals nothing, no role
hue spent decoratively, particles that encode something, the moose outline untouched. Known
drift is a fail even when other states are unverified. Never edit the palette to make the
audit pass.

## What evidence can and cannot establish

Keep functional assertions separate from aesthetic judgment. A passing overflow test does not
prove the eye goes to the right place, and a beautiful capture of a closed dialog proves
nothing about Escape handling.

- **A screenshot cannot certify motion.** Use timed captures before, during and after the
  event, or assert computed state. Verify the animation you claimed actually runs — a
  remounted chart entrance is not an animated data morph.
- **A token value cannot certify contrast.** Measure against the final composited pixels,
  including the pane tint, the brightest specular and the hover state. 4.5:1 small, 3:1 large.
- **A filename cannot certify a theme.** Verify the rendered theme, including inside
  `Layer`s and overlays.
- **Semantic state first.** Assert geometry and state before adding pixel comparison, and use
  exact screenshots only where they add information, with narrow documented masks for
  platform-sensitive content.
- **Never rewrite a visual baseline to make a check pass.** Inspect expected, actual and diff,
  and record why an intentional change is correct.

## Verification proportional to the change

Use focused checks while iterating. The repository's aggregate gate is
`corepack pnpm@11.21.0 trust` on Node 24.15+ with pnpm 11.21.0 and Playwright Chromium; run
it when the change warrants it, not as a reflex between tweaks. Report the command, the
environment and fresh output — never a result quoted from documentation, and label older
evidence with its date.

Three facts worth checking early, because they are cheap and they invalidate everything
downstream: the webfonts actually loaded (a fallback silently changes every measurement), the
`Text` `font` is set explicitly rather than inheriting the `13px sans-serif` default, and
every decorative optic carries `pointerEvents="none"`.

## Ask someone who hasn't read the brief

Before revealing the intent, ask an independent reader of an unlabeled capture:

- What do you notice first? Does it match the declared primary target?
- What memorable visual idea does this express? What does it explain?
- What feels generic, or competes without helping?
- Can you tell what to do next from what's visible?
- Which control changes scope, data or identity — predicted before operating it?

Then diagnose before revising. Purpose losing means reconsider the first target or the
composition. Beauty losing means tune proportion, light, type and colour while preserving the
relationships. Cohesion losing means repair the surface family or boundary ownership.
Usability losing means repair legibility, layout or state behaviour.

Log complaint → diagnosis → rule revision → fresh output → observed result. Promote a finding
to reusable guidance only when its causal explanation transfers to another purpose; keep
fixture-specific fixes in the scene. Retain a baseline win and anything the losing direction
did better — a rule should explain a tradeoff, not erase it. Preserve unresolved
disagreements, and never report subjective quality as an objective pass rate.
