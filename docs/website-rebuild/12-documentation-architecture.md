# Documentation architecture for people and agents

Direction updated October 4, 2026. Ben wants comprehensive agent guidance, approachable human documentation, individually documented components, growing visual catalogs, advanced composition guides, and installable skills. This document refines the earlier navigation proposal. It is a planning decision record, not an implementation or a platform commitment.

## Organize around the reader task

Use six content sections, with Home and Playground as separate destinations. These are information groups; the exact desktop header and mobile navigation remain design work.

| Section         | Purpose                                         | Contents                                                                                                   |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Start           | Get a correct first result                      | Installation, JSX and non-JSX setup, first scene, ownership, browser requirements                          |
| Reference       | Understand an individual public API             | Capability groups, every public component/function/hook, discoverable related types, imports and contracts |
| Visual Catalogs | Compare individual visual building blocks       | Shapes, filters, textures, reaction-diffusion recipes                                                      |
| Guides          | Build combinations correctly                    | Foundations, recipes, advanced composition, troubleshooting                                                |
| Examples        | Experience and modify complete work             | Focused demos and advanced showcases, complete source and playground                                       |
| Agents & Skills | Retrieve precise guidance and install workflows | Agent start page, topic indexes, detailed companions, skills catalog, version policy                       |

Learn remains the conceptual role of Start and Guides; its existing URLs can have aliases. API remains the role of Reference. Do not lose these old entry points during migration. Avoid one giant sidebar that mixes every API, lesson, recipe, showcase, and skill into one list.

## Two adoption paths

Offer **Build with Pibbl** and **Add Pibbl to your site** as clear entry points on Home and Start. The latter is a dedicated Guides section for enhancing ordinary HTML buttons, forms, images, hero regions, and data views. Keep one reference and one example catalog, with adoption-path tags and direct cross-links. See [HTML integration patterns and ideas](15-add-pibbl-to-your-site.md).

## Reference organization and coverage

Within Reference, keep capability groups: authoring; drawing and text; composition and effects; layout and measurement; signals and state; animation; input and focus; HTML; particles; textures; physics; visualization; external renderers; Three.js. Preserve an alphabetical symbol index. Types should be reachable from their owning APIs and the index without duplicating their full definition everywhere.

Every public component needs an individual landing page with a stable ID, supported import, purpose, minimal complete use, meaningful props/defaults, update/ownership behavior, limitations, related types, and relevant playground entry. Other public exports need an individual entry or an explicit anchor in a deliberately grouped reference. Compiler and testing entries remain documented but clearly labeled.

Generate an export-to-document coverage report from the current package surface. A missing public entry is a content gap; a pretty gallery is not complete reference coverage. Validate callable snippets against declarations and public runtime behavior. Code examples must use the current `useAnimatedValue` name rather than the former `useTransition` name.

## Visual catalogs

Each catalog has a consistent comparison layout and a page for each entry. Cards include an actual preview, a name, a brief explanation, a short code excerpt, and a simple interaction where useful. Provide static screenshots and source text before JavaScript loads. Open full reference and Open in playground are distinct actions.

### Shapes

Show all supported shapes using comparable scale, fill, and stroke. Each detail page provides one or two meaningful controls: radius for a circle, points for a star, or angle for an arc. Put complex path operations in their own reference and guide links. Shape entries reuse the canonical component example instead of maintaining a second disconnected snippet.

Human question: “Which shape should I use, and what does its code look like?” Agent companion: dimensions, coordinate conventions, defaults, signal acceptance, hit geometry, and tested complete source.

### Filters

Use a shared test image or scene and a before/after presentation so users can compare filters honestly. Include parameter units, defaults, order sensitivity, composition boundaries, browser/backend requirements, and known cost considerations. Keep data labels legible. A combined filter recipe belongs in Guides and links back to each constituent filter.

Human question: “What changes visually?” Agent companion: pixel-only effects versus logical geometry, ordering, supported inputs, allocation/ownership rules, and verification cases.

### Textures

Compare supported material and texture recipes with a consistent swatch, seed, and display size. Show fill and stroke use where supported, resource sharing, palette settings, resolution versus display size, and whether the source is static or animated. A one-control material study should not open a large settings dashboard.

Human question: “Which surface fits this scene?” Agent companion: resource creation, sharing limits, updates, deterministic seeds, lifetime, and a complete application example.

### Reaction diffusion

Give living patterns a distinct catalog even though they belong to the texture system technically. Organize by supported preset or clearly labeled application recipe, visual behavior, interaction, and cost. Include seed, simulation resolution, pause/reset behavior, brush/stir settings, and a purposeful thumbnail captured at a known state.

Do not imply every palette is a new simulation algorithm, or that a custom recipe means Pibbl exposes arbitrary equation authoring. Distinguish configuring existing generators, composing application behavior, and genuinely new runtime extensions. Use “reaction-diffusion” in technical copy, with “reactive diffusion” as a search alias for the user's terminology.

## Advanced guides

Publish Guides with Foundations, Recipes, and Advanced groupings. Each guide begins with a specific outcome and prerequisites, then a minimal runnable composition, a causal explanation, complete source, pitfalls, validation, and links to deeper agent notes. These initial topics are priorities, not permission to invent new capabilities:

| Guide                                   | Main relationship to explain                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Use reaction-diffusion as a shape fill  | Texture resource, paint placement, shape geometry, lifetime                                        |
| Make a texture respond to physics       | Committed body motion mapped into texture messages; coordinate conversion and teleport handling    |
| Compose advanced filters                | Order, nesting, capture boundaries, logical geometry, supported execution modes                    |
| Manipulate and animate paths            | Geometry construction, compatible changes, transforms, sampling and clipping constraints           |
| Share a texture across a composition    | One owner, valid sharing scope, updates and disposal                                               |
| Build an interactive chart with effects | Scales and truthful marks, inspection, decorative effects, native controls                         |
| Build a hero graphic                    | Page-owned semantics, responsive allocation, motion preferences, interaction, fallback and cleanup |
| Combine HTML, Canvas, and Three         | Explicit rendering boundaries, resource ownership, focus and input                                 |

“Respond to physics” must state exactly what is coupled. Stirring a field from body motion does not establish physical fluid simulation or bidirectional forces. Document and prove any richer claim separately.

## Complete examples

Advanced examples have a gallery card, a live full experience, a complete editable project, and an agent companion. The visible page explains the experience briefly; the companion explains its architecture, file map, public imports, data flow, ownership, safe changes, common errors, tests, and limitations.

Every example page links both to its companion and to the playground. Every companion links back to the exact example and its full source. A showcase also links to small independently runnable examples for its constituent ideas. Gallery screenshots must include native HTML when it participates.

## Cohesive presentation

Use one typography, spacing, color, code, navigation, and interaction system across the site. Reuse documentation components for parameter tables, runnable snippets, callouts, related material, and agent links. Give galleries a common card family while allowing appropriate comparison layouts. The playground shares the identity while using the full viewport. Jessica can explore the homepage and signature scene without redesigning every documentation primitive from scratch.

The visual result must never be the only source of the lesson. Captions, code, parameter descriptions, and expected outcomes should be intelligible in a plain text fetch.

## One connected content model

Keep one authored contract and one canonical runnable source per example, with optional deeper explanatory modules. Produce human pages, Markdown exports, catalogs, and skill references from those shared records. This is not two independent documentation trees maintained by copying prose.

Recommended record fields: stable ID, kind, title, summary, capability, symbols/import paths, compatible Pibbl version, status, prerequisites, human URL, Markdown URL, detailed companion URL, example/source IDs, related guides and skills, and verification evidence. Gallery entries add screenshot/capture metadata and controls. Recipe IDs must not masquerade as public API symbols.

Keep public content under the established `docs/site/` publication boundary when implementation begins, or explicitly revise that boundary and its tooling in the approved migration. This planning folder and private test labs remain excluded. The static public agent catalog includes only reviewed public content. Retain the existing local human-search boundary until a reviewed schema change adds new public content kinds; never broaden it to all repository Markdown.

## Smallest useful proof

When authorized, implement one shape, one filter, one texture, and one reaction-diffusion recipe through the shared page model. Add the reaction-diffusion fill guide and one showcase companion. Demonstrate normal HTTP retrieval of HTML, Markdown, and catalog records with JavaScript disabled, plus the live playground path. Then ask an agent to build the fill example using only the published documentation. Use the result to fix organization before migrating the entire library.
