# CRC website rebuild planning pack

Draft for Ben Lesh and Jessica Sachs · Updated October 4, 2026

This pack separates the website rebuild into content strategy, product behavior, and visual design. It is meant to be read in the repository or shared as one folder. It proposes a clearer website and much stronger demonstrations of CRC, without starting implementation or choosing the site's visual identity.

The starting problem is Ben's assessment: the current website feels disorganized, many examples are uninteresting, and some compelling examples bury their point in too much code. The response should improve what the site says and teaches before deciding how it looks.

## October 4 direction

Prioritize comprehensive agent guidance alongside concise human pages. Add separate shapes, filters, textures, and reaction-diffusion catalogs; advanced composition guides; directly retrievable Markdown companions; a versioned public content catalog; and discoverable installable skills. Start with the [updated documentation architecture](12-documentation-architecture.md), [agent documentation and skills plan](13-agent-documentation-and-skills.md), and [platform recommendation](14-documentation-platform-options.md). These refine the earlier navigation proposals. Platform selection and implementation remain pending.

## Start here

| Document                                                                 | What it helps decide                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [Brief and decisions](01-brief-and-decisions.md)                         | Requirements, recommendations, open questions, and scope                  |
| [Positioning and homepage](02-positioning-and-homepage.md)               | CRC's pitch, proof, and an ambitious interactive homepage concept         |
| [Site organization](03-site-organization.md)                             | Navigation, API taxonomy, search, and user journeys                       |
| [API documentation directives](04-api-documentation-directives.md)       | Repeatable instructions for clear, accurate reference pages               |
| [Examples and gallery directives](05-examples-and-gallery-directives.md) | Concise teaching examples, richer showcases, and screenshot-led discovery |
| [Playground product brief](06-playground-product-brief.md)               | Full-page editing, previews, URL sharing, and project downloads           |
| [Example idea bank](07-example-idea-bank.md)                             | 100 prioritized ideas across applications, games, effects, and scenes     |
| [First collection briefs](08-first-collection-briefs.md)                 | Twelve concrete candidates with teaching and presentation constraints     |
| [Jessica design handoff](09-jessica-design-handoff.md)                   | A portable brief and prompts for a separate visual design phase           |
| [Delivery and review](10-delivery-and-review.md)                         | Content-first milestones, migration, and evaluation                       |
| [Repository evidence](11-repository-evidence.md)                         | Current foundations, limitations, and source locations                    |

For a quick design handoff, read this page, the positioning document, the examples directives, the playground brief, and Jessica's handoff. For content work, start with site organization and the API and example directives.

## Status and authority

Ben's explicit requirements are identified in the brief. Other choices are recommendations or candidates for discussion. The word “must” in a proposed directive describes the intended future editorial standard; it does not approve a runtime change or turn this folder into an executable project plan.

Current public code and implemented contracts remain authoritative. This pack is outside `docs/site/`, so it is planning material rather than public documentation or public search content. The repository has substantial concurrent changes; evidence here describes the inspected working tree on October 2, 2026, not a claim about a published release or a freshly verified build.

## Sharing the pack

Zip the entire `docs/website-rebuild/` folder. All planning documents link to each other using relative paths and remain readable outside the repository. The repository evidence appendix contains optional links outside this folder; those require the checkout. The design brief includes the capability constraints Jessica needs without requiring those links.

No credentials, account setup, design-tool subscription, external assets, or running development server are required to read this pack. No source files need to accompany the ZIP for the initial design conversation. Share example source separately when moving from concepts to runnable prototypes.

## Recommended first discussion

Agree on the pitch and the distinction between snippets, focused examples, and showcases. Then choose three representative pieces: a tiny interaction, an HTML and Canvas application, and an ambitious combined-effects scene. Use those to test content structure before designing the full site.
