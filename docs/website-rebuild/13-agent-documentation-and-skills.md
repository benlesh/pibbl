# Agent documentation and skills plan

The objective is that an agent can discover the relevant CRC capability, understand its exact contract, implement a complete integration, and verify the result using public documentation. Comprehensive content should be split into retrievable topics so an agent does not need the entire manual for one task.

This is a proposed publication contract. Paths below illustrate future URLs; they do not exist merely because they appear in this document. No skills have been published by this planning change.

## Discovery and retrieval

Publish real static HTML pages at ordinary paths, with the meaningful content in the initial response. Provide stable headings, ordinary crawlable links, canonical URLs, descriptive page titles, a sitemap, and an intentional robots policy. Search and live demos enhance pages but must not be required to discover or read them. Hash-only navigation should become a compatibility path rather than the canonical documentation address.

Recommend these public entry points, adjusted for the deployed site base path:

| Proposed resource                    | Role                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `/agents/`                           | Human-readable and machine-readable explanation of how to use CRC docs           |
| `/llms.txt`                          | Small map to the best topic indexes, current-version guidance, and skills        |
| `/reference/shapes/circle.md`        | Clean equivalent of a human reference page                                       |
| `/agents/reference/shapes/circle.md` | Detailed companion with edge cases, reasoning, and implementation guidance       |
| `/agents/catalog.json`               | Versioned inventory of public symbols, docs, recipes, examples, and skills       |
| `/agents/topics/textures.md`         | Targeted reading order for a capability                                          |
| `/agents/examples/physics-ink.md`    | Architecture and adaptation notes for an advanced example                        |
| `/skills/`                           | Discoverable catalog with scope, compatibility, source, and install instructions |

The JSON catalog is a CRC-defined format, not a universal agent standard. Give it a schema version, documentation build revision, runtime compatibility, stable IDs, typed relationships, and explicit absolute content URLs. Describe the schema on the agent start page. It lets tools inventory coverage without parsing navigation or executing a search UI.

The [llms.txt proposal](https://llmstxt.org/) describes a small Markdown entry point and links to detailed Markdown, including alternate-link discovery. Adopt it as an additional path; it is not a guarantee that all agents fetch it. Point from each HTML page to its Markdown equivalent and agent companion using ordinary links, and add appropriate HTML link metadata. Optional HTTP headers can supplement this on hosts that support them.

Do not require user-agent sniffing or content negotiation for access. Explicit URLs work on static hosting. A full-manual download can be offered later for offline use, but topic bundles and individual pages should be the primary reading units. Neither sitemap nor llms.txt replaces the other.

## Human page and detailed companion

The human reference prioritizes a short explanation, minimal example, essential contract, and clear navigation. A small “Agent reference” or “Read detailed guidance” link leads to the longer public companion. Keep the same facts available to any requester: do not hide instructions in CSS, HTML comments, or crawler-specific pages. People may inspect the detailed guidance whenever they want without seeing it expanded by default.

Generate the shared factual sections from the same records. Author deeper notes as related modules, rather than inventing a second signature/default table. A Markdown export must expand content-bearing custom components, tabs, snippets, and callouts into readable text. Raw MDX containing a custom demo tag is not a sufficient export.

## Detailed companion template

1. Identify the exact capability, import paths, compatible release, and source revision.
2. State when to use it, when to choose another supported capability, and explicit unsupported assumptions.
3. Include complete runnable source and required setup/assets; distinguish scaffolding from the teaching logic.
4. Explain coordinates, units, signals, update timing, identity, resource ownership, and teardown as applicable.
5. Explain the key decisions and what goes wrong with plausible alternatives.
6. Cover relevant edge cases: resize, empty data, repeated runs, removal, bad inputs, browser limits, and recovery.
7. Provide a bounded adaptation recipe and expected observable results.
8. Describe verification through public behavior, with geometry/state before visual assertions where appropriate.
9. Link prerequisites, exact API references, smaller examples, related recipes, and skills.

Do not pad every companion with irrelevant sections. Exhaustive means covering the important contract, not repeating boilerplate or internal implementation history. Do not expose private repository tests as an application dependency.

## Versioning and freshness

Every generated page and manifest should identify the documentation revision and compatible published CRC release. Separate current release, prerelease, and historical guidance. A local working-tree feature must not silently enter the stable public docs. Installed skills should describe how to select docs matching the consuming project's package version.

Validate that every manifest link resolves and every public export has an intentional reference destination. Confirm related snippets run, referenced imports exist in that release, and Markdown includes the same defaults and limitations as HTML. Remove stale names from current docs while retaining clearly labeled migrations.

## Skills versus reference

Documentation describes the library. A skill teaches an agent how to accomplish a class of work with it: choose a supported approach, read the right contracts, implement a small complete result, validate it, and handle typical failures. Skills should retrieve detailed references on demand instead of embedding a copy of the entire manual.

Use the portable [Agent Skills specification](https://agentskills.io/specification): a directory with a `SKILL.md` containing name/description metadata and procedural instructions, plus focused references and optional assets. Keep entry instructions compact and references directly discoverable. A portable file format does not imply universal client support; verify each advertised installation path.

## Proposed skill collection

| Skill                               | Job                                                                                        | Initial priority |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| CRC integration                     | Choose package entries, configure authoring, mount/update/dispose, fit an existing web app | First            |
| CRC application building            | Layout, signals, native HTML controls, interaction, focus and resource lifetimes           | Next             |
| CRC visualization                   | Scales, series, inspection, truthful effects, data changes and native controls             | First specialist |
| CRC textures and reaction diffusion | Select/configure resources, use fills, paint/stir, share and dispose correctly             | First specialist |
| CRC motion and physics              | Animation versus physics, supported commands, movement coupling, reset and cleanup         | Next             |
| CRC filters and paths               | Geometry manipulation, clips, ordered filters and hit-geometry invariants                  | Next             |
| CRC hero graphics                   | Page integration, tasteful effects, responsive behavior, reduced motion and fallbacks      | Next             |
| CRC Three integration               | Normal Three resources, rendering boundary, input bridge and explicit disposal             | Next             |

These are proposed scopes and labels, not yet installable names. Creating a new texture or reaction-diffusion recipe should first check the supported extension boundary. If it needs changes to CRC itself, say so and route that work separately; do not fabricate a public extension API.

Each skill needs activation criteria, prerequisites, version selection, reading order, a minimal end-to-end workflow, common failures, public verification steps, and example links. Its instructions should respect the user's project and task scope. Installing a skill must not silently opt an agent into unrelated setup, service accounts, or publishing.

## Distribution

Make the repository the canonical source, tagged with versions and a changelog. Publish browsable skill pages and downloadable complete skill directories on the website. Install commands should name the actual published source and be tested from a clean environment before display; this plan intentionally supplies no pretend CRC install command.

Evaluate [skills.sh](https://www.skills.sh/docs) as the first additional discovery channel: it documents a Git-backed skills installer and directory. Listing/discoverability and client installation should be verified at publication time, not promised now. Add client-specific plugin or marketplace packaging only where it improves the workflow and has a tested maintenance path. Keep the underlying guidance shared to prevent forks between Codex, Claude, and other clients.

A documentation MCP server may become useful for structured retrieval, but is optional later work. Plain HTTP, Markdown, and a catalog should be sufficient to use the documentation without installing a connector.

## Evidence that the system works

Test discovery from a single starting URL, not from a prepared prompt containing all the right API names. Give representative agents tasks such as rendering a specific shape, choosing a filter, using reaction-diffusion as a fill, connecting physics movement to a texture, or adapting a hero graphic. Require them to identify the compatible version, retrieve the relevant contract, use only public imports, run the result, and demonstrate cleanup.

Evaluate task correctness, invented APIs, missing lifecycle steps, stale references, unnecessary retrieval, and dead links. Record which clients and versions were tested. Include a case with an unsupported request to see whether guidance produces an accurate limitation rather than fictional code. No documentation format can guarantee every agent behaves correctly; these evaluations provide concrete evidence for improvement.
