# Website brief and decisions

The website should make CRC understandable quickly, demonstrate why someone would choose it, and make experimentation one click away. Content rewrite, product restructuring, and visual redesign are separate workstreams with explicit handoffs.

## Requirements from Ben

- Create a full-page playground with editor and preview side by side, like an IDE. Every public example can load into it.
- Explore shareable code in URLs without a database or persistence service. Provide a downloadable project ZIP when URL sharing is impractical.
- Keep API reference focused on basic API information, useful snippets, and Try in playground actions.
- Organize the API clearly; propose a navigable structure rather than only rearranging the current list.
- Create a gallery of example screenshots and names. A card opens the example; both card and example page offer Open in playground.
- Completely rethink the homepage pitch and presentation. It should tastefully demonstrate HTML, Canvas, physics, reaction-diffusion, and broader CRC capabilities.
- Develop a large idea bank, prioritizing usefulness and visual impact across small lessons, games, HTML combinations, dashboards, visualization, product pages, scenes, and WebGL compositions.
- Keep the planning pack together in the repository so Jessica can work there or receive a ZIP. Visual design may use her Claude Design workflow later.

“Reaction-diffusion” is the technical term used here for the living-pattern effect described in the request as reactive diffusion.

## Additional requirements from October 4

Make agent discovery and comprehensive task guidance central. Document every public component; provide dedicated shape, filter, texture, and reaction-diffusion catalogs; connect advanced examples to playground projects and detailed agent companions; add advanced composition guides and a discoverable skills collection. Keep human pages concise while detailed public guidance is accessible through explicit links. Evaluate an established documentation platform. See the [updated architecture](12-documentation-architecture.md).

## Recommended product decisions

| Decision           | Recommendation                                                     | Why                                                                                    |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Public sections    | Home, Learn, API, Examples, Playground                             | Each has one recognizable job                                                          |
| API navigation     | Group by capability; retain symbol index and symbol search         | Readers think “animation” before “function versus hook”                                |
| Example types      | Focused examples and showcases                                     | A tiny teaching contract and a complete art-directed scene need different expectations |
| Authoring default  | TypeScript and CRC JSX                                             | Matches current learning sources; preserve a clear non-JSX guide                       |
| Gallery order      | Curated useful and visually strong work first                      | Avoid an alphabetical wall of primitives                                               |
| Example pages      | Preview first, short explanation, source access, playground action | Browsing should not require entering an IDE                                            |
| Playground storage | Memory while editing; explicit URL or ZIP export                   | Honors no persistence; makes the loss boundary understandable                          |
| Homepage structure | One signature scene plus a few focused demonstrations              | Gives the strongest work space and protects readability                                |
| Teaching ownership | One canonical runnable project per example or snippet              | Reduces differences between displayed and runnable code                                |

These recommendations are not approved implementation choices. In particular, project file format, URL encoding, routing, and runtime version retention need a later technical design.

## Questions for the next conversation

These do not block this planning pack.

1. Who should feel addressed first: frontend developers adding expressive interactions, creative developers, or application/tool builders? The October 4 direction prioritizes agents implementing CRC correctly while retaining a clear human reading path; refine the human audience within that constraint.
2. Should the main invitation be “Explore examples” or “Open playground”? Recommend examples for first-time visitors and a persistent playground link for returning developers.
3. How much editor scope belongs in the first release? Recommend enough editable TSX, HTML, CSS, and local assets to run the chosen launch examples, without a terminal or arbitrary package installation.
4. Should URL projects replay against a pinned runtime indefinitely? Recommend a clearly stated compatibility policy before promising durable snapshots.
5. Which signature scene deserves a prototype: kinetic studio desk, living specimen cabinet, or interactive product atelier? The positioning document explains the candidates.
6. What typography, palette, and visual references does Jessica want to explore? Leave these open until the product and content hierarchy are agreed.

## Explicit scope boundaries

This phase produces documentation and candidate directions. It does not replace the site, rewrite examples, ship a new playground, choose a visual system, or authorize new CRC APIs. No accounts, database, cloud saves, project feed, or collaboration backend are proposed for the initial playground.

ZIP import, arbitrary dependencies, additional editor themes, and advanced workspace features may be useful later. They should not delay the core path from example to editable preview to portable output.
