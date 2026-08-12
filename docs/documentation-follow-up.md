# Documentation renderer follow-up brief

CRC now has documentation-ready content, but this project deliberately did not build or publish a documentation site. A future renderer should be a presentation adapter over the scenario catalog, never a second scenario implementation.

## Inputs

- the validated catalog and generated scenario index;
- `documentation-candidate` metadata only for public teaching pages;
- lazy scenario definitions and their stable action IDs;
- the exact exercised `*.example.ts` source resolved by source ID/path/marker;
- stable `#/scenarios/<slug>` intent, migrated to an equivalent published URL without changing the slug;
- drawing, runtime/hook, mouse, and ownership contract prose.

## Required projections

- navigation by learning order and category;
- facets for API, concept, visibility, and maturity;
- one page per candidate with summary, readable live Canvas, controls, state, manual steps, expected observations, known limitations, and exact source;
- links from API/contract prose back to executable examples;
- responsive presentation and keyboard-accessible documentation chrome, without pretending the current Canvas API itself has keyboard semantics.

The initial candidate set is baseline smoke plus the five drawing lessons. Test laboratories remain visible in the internal gallery and generated complete index, but are not published as teaching pages by default.

## Non-negotiable boundaries

- Do not copy example code into Markdown, JSON metadata, or framework components. Render the validated source adapter output.
- Do not import playground presentation code into scenario definitions or vice versa.
- Do not change scenario IDs, slugs, action IDs, or source markers to satisfy a renderer preference.
- Do not expose test-only diagnostics, private runtime state, or fixture controls as public API guidance.
- Do not build search, versioning, analytics, publication, or a broad design system until the basic catalog projection proves maintainable.

## Proposed later sequence

1. Choose the renderer/navigation stack and URL mapping.
2. Render the generated catalog index and one baseline page.
3. Add the five drawing pages without duplicating source.
4. Link contract prose and API reference entries.
5. Add search/versioning/publication only after source identity and live-example isolation remain green in CI.
