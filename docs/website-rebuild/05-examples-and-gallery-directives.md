# Examples and gallery directives

An example earns its place by teaching something recognizable and showing a result someone wants to make. The gallery should offer both approachable lessons and ambitious proof of CRC's range, with an obvious way to move from either into the playground.

## Three distinct content forms

| Form            | Purpose                           | Suggested code budget                   | Presentation                                                     |
| --------------- | --------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| API snippet     | Demonstrate one API operation     | 5–25 meaningful lines in the excerpt    | Inside reference; exact runnable counterpart                     |
| Focused example | Teach one compositional idea      | Usually 30–100 meaningful lines in full | Live result, short explanation, source, playground               |
| Showcase        | Demonstrate a complete experience | No arbitrary line cap                   | Live experience, short architecture map, small companion lessons |

Budgets are proposals. Clarity takes priority over hitting a number. Do not minify code, collapse descriptive names, or hide teaching logic in utilities to qualify. Setup may be separated into clearly visible files, but the complete project must remain inspectable and downloadable.

## Instructions for an example author

Write the teaching sentence before code: “This example shows how to ___ by ___.” Identify the exact lines that deliver it. Choose one visible interaction and one suggested code change. A visitor should see the main result quickly and predict how that edit will affect it.

Give the scene a coherent miniature art direction: a limited palette, deliberate spacing, and one memorable visual idea. A rectangle can teach spring motion by behaving like a satisfying sliding switch; it does not need to remain an anonymous blue box. Avoid surrounding a tiny concept with a dashboard of switches and diagnostic text.

Use public package entries, ordinary application code, explicit cleanup, and predictable initial state. Keep assets local or clearly declared and licensed. Use native HTML for text editing and complex forms when that better serves the experience. Treat that HTML as part of the example, not hidden site scaffolding.

Every example should state what CRC contributes and what comes from application logic, HTML, Three.js, or another declared dependency. A game is not evidence that CRC provides a game engine. A shader is not automatically a CRC feature.

## Splitting a large example

Keep the compelling full scene as a showcase if it merits one. Extract small companion examples that each preserve a complete idea through the public API.

For example, a large responsive chart can become: one line and scale; one responsive allocation; one hover marker; one native filter control; and the complete dashboard. A living-material panel can become: one static texture; one painted reaction-diffusion surface; one stirring gesture; and the full material studio.

Do not require readers to assemble five partial snippets before any of them runs. The small versions must each work independently. Do not remove exhaustive test fixtures merely because they are unsuitable gallery content.

## Gallery behavior

Each card shows a real screenshot, a name, a short outcome description, and a visible Open in playground action. The main image/title opens the example detail page. Implement these as separate accessible targets, not nested clickable controls. Do not reveal the playground action only on hover.

Use curated ordering and restrained labels. Filter by topic, focused example/showcase, and difficulty. Support keyboard navigation and visible focus. Prefer static screenshots initially; optional hover motion must have a static fallback and respect reduced motion. Avoid running dozens of canvases in a scrolling gallery.

A detail page presents the live example prominently, followed by what it teaches, one interaction prompt, one edit prompt, source access, related APIs, and Open in playground. Show dependencies and capability requirements when relevant. Showcases additionally link to focused companion examples. Keep the primary playground action visible without scrolling through a lesson.

## Proposed content record

Record a stable ID and slug, title, one-sentence outcome, type, topic tags, difficulty, teaching sentence, public API symbols, canonical project entry, files/assets/dependencies, screenshot and capture recipe, interaction prompt, edit prompt, related examples, accessibility notes, capability requirements, and editorial status.

Keep presentation metadata separate from test scenario metadata. Learning content and deterministic test fixtures may share supported behavior, but tests do not become gallery entries automatically.

## Screenshot direction

Capture a purposeful state at a known viewport, seed, and simulation time or scripted action. Use the same framing family across cards, with deliberate crops rather than unreadable full-page thumbnails. The image should show the actual running example; do not substitute concept art for a product screenshot.

Capture the browser region when HTML participates, because a Canvas export omits HTML. Avoid unreadable text, half-loaded assets, default diagnostic overlays, and blank initial frames. Record the capture recipe so code changes can produce consistent replacements. Describe the outcome in accessible text without duplicating every decorative detail.

## Selection and retirement

Every featured example must have a teaching purpose, visual quality, a working playground path, and an honest complexity label. Prefer a smaller excellent launch collection over publishing the entire idea bank at once.

Audit current examples as keep, simplify, split, remake, or keep only in the test lab. Preserve old URLs with a useful destination. Boring but necessary reference coverage can remain accessible without occupying a featured gallery slot.

## Acceptance questions

Can someone explain the point after one interaction? Is the relevant code easy to find? Is the edit prompt achievable without understanding unrelated machinery? Does the screenshot match the live result? Does Open in playground preserve the complete experience? Can users pause motion, operate relevant controls with a keyboard, and understand fallback states?

## Catalogs and agent companions

In addition to the complete-example gallery, provide distinct catalogs for shapes, filters, textures, and reaction-diffusion as defined in the [updated architecture](12-documentation-architecture.md). Each entry pairs comparable visual output with a short source excerpt, reference links, and playground access. Every advanced example also has a public, explicitly linked Markdown companion explaining architecture, safe adaptations, limitations, and validation; keep that depth out of the default human page layout.
