# Preserve the reading paths

| Destination     | Reader's task                       | Relationships to preserve                                                                  |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Start           | Install and produce one result      | Build with Pibbl; Add Pibbl to your site; first scene; lifecycle                           |
| Reference       | Look up a specific public API       | Capability groups; alphabetical index; types; example; limitations                         |
| Visual Catalogs | Choose a visual building block      | Actual output; code; exact reference; runnable example                                     |
| Guides          | Understand and combine capabilities | Foundations; HTML recipes; advanced composition; prerequisites                             |
| Examples        | Run and adapt complete work         | Focused versus advanced; HTML integration versus Pibbl application; full source; companion |
| Agents & Skills | Retrieve precise instructions       | Markdown counterpart; llms.txt; topic reading order; version policy                        |
| Playground      | Edit and run source                 | Existing working editor; direct example links; public imports                              |

## One example, several discovery paths

The living button appears in the reaction-diffusion catalog and Examples, but both link to the same recipe. The recipe links to `reactionDiffusion`, `useTexture`, `pibbl`, and a detailed agent companion. Its source is maintained once in `native-button/` and expanded into the published Markdown and HTML by the website build. Do not create another undocumented copy for a showcase card.

The shape and filter pages answer what a building block looks like; the reference answers its exact contract. The guide explains how several building blocks cooperate. Keep these roles distinct even if the design changes navigation placement.

## Content that must survive redesign

Use ordinary crawlable URLs, one clear page heading, meaningful heading order, visible source links, readable code, and semantic navigation. Meaningful copy must be in initial HTML. Keep the clean Markdown alternate links discoverable. Static fallbacks and descriptions must explain the visual even without a live demo.

The reference now reuses the existing public API documents and has capability and alphabetical indexes. Export destinations are checked, but some families share grouped pages and not every example has been freshly executed. Do not equate link coverage with exhaustive explanation. No installable Pibbl skill ships yet. Keep that status honest. Preserve links into the existing Studio rather than implying its editor has already been migrated.

All public authored copy for this slice lives under `docs/site/website/`. Existing public Studio documentation remains under `docs/site/learn/` and `docs/site/api/`. Planning documents, this design kit's editorial instructions, and test labs do not belong in public search. The kit is an explicit download, not an automatically indexed documentation tree.
