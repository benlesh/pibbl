# Delivery and review plan

Separate the content rewrite, product rebuilding, and visual redesign so a good-looking prototype does not conceal unresolved organization or teaching problems. This sequence is a recommendation for future work; the present deliverable is the planning pack only.

## Milestone 1 Content direction

Discuss the audience, pitch, API organization, example types, and playground scope. Revise the directives until they are useful instructions for another author. Select three representative examples and one representative API page. Decide what belongs in Learn versus reference.

Ready when Ben can explain the job of each site surface and an author can produce a sample page or example without inventing its structure. No runtime implementation or complete gallery inventory is required to reach this point.

## Milestone 2 Representative content

Rewrite one API page around a real snippet. Simplify one small example. Extract one HTML/Canvas lesson. Storyboard the combined showcase and prototype only its riskiest visible interaction if authorized.

Use hands-on feedback to judge concision and appeal. The test is whether the small example makes its idea obvious and the larger scene has a compelling reason to exist. Do not rewrite the entire catalog before checking these representatives.

## Milestone 3 Visual direction

Jessica explores the representative surfaces using the handoff. Agree on one direction, then develop a visual system and responsive states. Keep content requirements stable enough to evaluate design, while allowing evidence to improve them.

Ready when homepage, reference, gallery, example detail, and playground work as a family, and behavior is clear in both normal and failure states. Static mockups do not by themselves verify runtime feasibility.

## Milestone 4 First runnable product slice

When implementation is authorized, start with one gallery card → live example → full-page playground → edit/run → URL share/reopen → ZIP download. Add one API snippet entry into the same project path. Use focused failing public-behavior tests before production changes under the repository rules.

Report **Slice ready for feedback** with an exact running URL and specific things to inspect. Do not report feature completion at this stage. Follow with the HTML and Three representatives to validate the project model. Avoid building an elaborate editor platform before the first loop works.

## Milestone 5 Content migration and hardening

After experiential feedback, migrate the chosen launch collection and API pages. Map old routes and anchors to stable destinations, preserve or recover old share links, and regenerate gallery screenshots deliberately. Keep test laboratories separate from the learning catalog.

Then run proportional documentation, export, source/build, package-consumer, browser, accessibility, ownership, and visual checks. Use the repository aggregate trust gate when the completed implementation scope warrants it. Report fresh commands and results rather than borrowing historical test totals.

**Feature complete** means the accepted behaviors are implemented, documented, reviewed, and verified, with all published examples opening correctly in the playground and exported projects running independently.

## Acceptance matrix for the future site

| Surface           | Observable evidence                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| Homepage          | A visitor identifies CRC, completes one interaction, reaches a relevant example; page remains useful without motion |
| API               | Reader finds a symbol, import, contract, exact runnable snippet, and related type; no undocumented export is lost   |
| Gallery           | Actual screenshots; card and playground actions work with mouse and keyboard; filters and empty state work          |
| Example           | Teaching point, gesture, edit prompt, source, and playground project agree                                          |
| Playground        | Built-in and edited projects run; errors preserve code; Stop releases preview resources                             |
| Sharing           | A valid link restores the intended snapshot; malformed/oversized/version-mismatched input has a clear recovery path |
| ZIP               | Download includes the current project and runs outside the website in the documented environment                    |
| Migration         | Existing routes, anchors, and shared-code links have verified outcomes                                              |
| Responsive access | Narrow screens, keyboard paths, zoom, motion preferences, and rendering fallbacks have deliberate behavior          |

## Inventory worksheet for later migration

For each current page/example, record its stable ID, current route, teaching goal, source, dependencies, screenshot state, decision, proposed destination, and verification status. Decisions are keep, simplify, split, remake, merge with a clear destination, or retain only in the internal lab.

Do not bulk-delete long examples. Do not publish lab diagnostics as gallery content simply because they already run. Keep the old catalog usable while a smaller new collection is evaluated.

## Feedback prompts

Ask a reader to find the API for a task without naming the symbol. Ask them to explain an example before opening its code. Ask them to make the suggested edit and share it. Ask a designer to describe the homepage with motion paused. Record where they hesitate; those observations are more actionable than whether they “like” a layout.

No new telemetry service is needed for this stage. Start with direct observation and explicit feedback. Establish measurable performance budgets against actual prototypes and target devices rather than making speculative speed claims.
