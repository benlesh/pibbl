# Site organization proposal

Give each surface a clear job. Learn teaches concepts and workflows; API answers precise questions; Examples shows working results; Playground is the place to edit and run code. The homepage connects them through a clear product story.

The [October 4 architecture](12-documentation-architecture.md) refines the groups below into Start, Reference, Visual Catalogs, Guides, Examples, and Agents & Skills, with Home and Playground as separate destinations. It also makes static paths the recommended canonical documentation URLs, with old hash routes retained for compatibility.

## Primary navigation

| Surface    | User question                                 | Primary action                        |
| ---------- | --------------------------------------------- | ------------------------------------- |
| Home       | What can I make, and why CRC?                 | Explore examples                      |
| Learn      | How do I get started or understand a concept? | Follow a short guide                  |
| API        | What does this symbol accept and do?          | Read a contract and try a snippet     |
| Examples   | What does this look like in practice?         | Open a demo or its playground project |
| Playground | Can I change it and use it?                   | Edit, run, share, download            |

Use a compact global header on content pages. The full-page playground gets a compact application toolbar with a way back, rather than inheriting the documentation sidebar. Internal test labs remain available for development, outside the public navigation and search catalog.

## Recommended API taxonomy

Use capability groups as the main navigation. Within a group, put components, hooks, helpers, and related types together. Preserve a secondary alphabetical symbol index and search aliases for people who know the exact name. Each symbol has one canonical reference page; cross-links do not create duplicate documentation.

| Group                   | Scope and representative entries                                   |
| ----------------------- | ------------------------------------------------------------------ |
| Setup and authoring     | `crc`, JSX setup, `createElement`, elements, controller disposal   |
| Drawing and text        | Shapes, paths, images, `Text`, paint and geometry helpers          |
| Composition and effects | `Group`, `Clip`, `Layer`, transforms, filters                      |
| Layout and measurement  | Absolute, Overlay, Flow, Flex, Grid, measurement and allocation    |
| State and signals       | Hooks, `signal`, `computed`, explicit reads, reactions             |
| Animation               | Definitions, tracks, programs, `usePlayback`, `useAnimatedValue`   |
| Input and focus         | Pointer/keyboard events, event types, focus policies, targeting    |
| HTML integration        | `HtmlBox`, mount/update lifetime, overlay setup, native input      |
| Particles               | Canvas emitters, descriptors, systems, lifecycle                   |
| Textures                | Procedural materials, texture resources, reaction-diffusion        |
| Physics                 | 2D runtime, bodies, commands, queries, pure geometry               |
| Data visualization      | Scales, series, axes, inspection and hover composition             |
| External renderers      | `defineRenderLayer`, lifecycle and interaction types               |
| Three.js integration    | `defineThreeLayer`, picker, controls bridge and resource ownership |

Compiler exports and specialized testing helpers belong in a clearly labeled advanced reference section, still searchable. Pure 3D geometry needs an explicit label so readers do not infer a 3D physics runtime. Exact group membership should come from an export inventory before migration; this table is a proposed browsing model, not a complete symbol list.

Keep import paths visible on every API page. Capability groups must not invent packages: particles, textures, physics, and visualization are current `@crc/core` subpaths; `@crc/three` is an adapter package.

## Learn structure

Start with installation and the first scene. Then explain components and identity, signals, drawing/composition, input, motion, and ownership. Provide task guides for HTML controls, physics interactions, textures, visualization, and Three.js. Longer conceptual explanations belong here, linked from concise API reference pages.

Do not make a beginner read the complete scheduler contract before animating a circle. Explain the relevant lifecycle rule at the point it prevents a mistake; link to deeper material separately.

## Connected journeys

- Visitor: homepage ink interaction → focused ink example → playground → edit a parameter → share the result.
- API reader: `useAnimatedValue` reference → exact runnable snippet → playground with relevant lines selected → return to the same reference page.
- Application developer: gallery HTML filter control → live example → inspect source → download a complete runnable project.
- Returning user: direct playground URL → inspect shared source → Run → edit → copy a new snapshot link.

Back navigation should preserve the previous browsing context during the session. Replacing an edited project requires an explicit decision to discard or export changes. No background autosave is assumed.

## Search and gallery discovery

Keep site search build-time and local, indexing validated Learn/API content and public example metadata only. Search by symbol, use case, visual result, and common terms such as “native input,” “spring,” “ink,” and “chart tooltip.” Results should identify their content type and describe what opens.

The gallery has its own small set of combinable filters: topic, focused example/showcase, and difficulty. Add text search and a reset action. Default to a curated selection rather than exposing every tag at once. A filtered empty state should suggest clearing filters.

## Routes and migration

Logical destinations are Home, Learn, API, Examples, Example detail, and Playground. Use ordinary static paths as canonical documentation URLs under the October 4 direction; exact base-path and redirect configuration remain deployment decisions. The current site uses hash routes, including `#/examples/{group}/{slug}` and API routes split by components/functions/hooks/types.

Avoid changing URLs merely to match a new sidebar. Preserve existing links and anchors through aliases or redirects, including existing shared-code payloads. Maintain stable content IDs separately from display labels and navigation groups. Decide how old runtime versions and example revisions are handled before describing old links as durable.
