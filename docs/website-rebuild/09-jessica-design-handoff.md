# Jessica design handoff

Jessica, this is a product and content brief for a new CRC website. Ben wants a complete rethink, but wants to settle the content rules and product surfaces separately from visual design. Your design exploration can use Claude Design or your preferred workflow; this pack does not prescribe tooling, colors, fonts, or an existing aesthetic.

## October 4 content direction

Ben has refined the priority: make CRC comprehensively documented for agents while retaining a concise visual reading experience for people. Design against the [updated documentation architecture](12-documentation-architecture.md), including separate shapes, filters, textures, and reaction-diffusion catalogs; advanced guides; and Agents & Skills. Detailed companion notes should have a small visible link rather than occupy the default page layout. The [platform recommendation](14-documentation-platform-options.md) proposes evaluating Astro/Starlight; it does not lock the visual identity or authorize implementation. Earlier navigation references below should be read in light of this update.

## What CRC is

CRC is a Canvas 2D component runtime with JSX authoring, synchronous signals, animation, layout, interaction, particles, physics, and procedural textures. It can compose native HTML controls and ordinary Three.js scenes through explicit integration boundaries. The website should make that range tangible while making the code approachable.

Ben's concern is that the current site feels disorganized and the examples do not consistently communicate CRC's appeal or explain themselves concisely. A better website should be immediately compelling and unusually easy to explore, understand, and experiment with.

## Decisions to preserve during design exploration

- Distinguish Home, Learn, API, Examples, and Playground.
- Keep API pages concise and useful, with readable snippets and Try in playground actions.
- Make the gallery screenshot-led, with names and both example-page and playground destinations.
- Make example pages feel like live demonstrations. They need a clear playground action and source access.
- Give the playground the full viewport, with a side-by-side code editor and preview on desktop and a usable narrow-screen alternative.
- Do not add accounts, cloud saves, feeds, or a database-backed project library.
- Treat focused teaching examples and larger showcases as different forms, with a visible route from a showcase to its small lessons.
- Keep the site's own navigation, copy, and editing controls in semantic HTML.

The capability-based API taxonomy and homepage copy are proposals, open to refinement. Do not mistake a document table for an intended visual layout.

## Creative freedom

Explore typography, color, composition, texture, motion character, navigation treatment, card framing, and how the website transitions between expressive demonstrations and calm reading. The visual identity should hold together across a spectacular homepage, a dense API reference, and a utilitarian editor.

Aim for memorable, deliberate, and readable. Give strong interactions room to breathe. A successful direction should be recognizably CRC even when the hero is paused. Avoid a collage of every visual effect, tiny low-contrast code, hover-only actions, and decorative motion competing with paragraphs.

## Runtime facts that affect art direction

HTML controls can be genuinely native, including text selection and editing. HtmlBox positions native HTML within an allocation, but all HTML hosts are above Canvas paint. HTML does not become part of a Canvas filter or shared blend silhouette, and its content does not automatically determine CRC layout size.

Three.js appears as one composited external layer. CRC can surround it with Canvas content; individual Canvas primitives cannot be interleaved among individual Three objects. Use normal Three scenes and resources rather than imagining a CRC-specific 3D JSX vocabulary.

Reaction-diffusion creates living patterns. Physics-driven stirring is a deliberate connection between systems, not a full fluid simulation. Canvas content does not automatically gain an accessibility tree; native controls and semantic page content remain important. Capability fallbacks and reduced-motion designs need intentional visual treatment.

These limits still leave plenty of room for an ambitious site. They simply keep concept images from implying impossible composition.

## Suggested exploration sequence

First produce two or three distinct directions for the same representative content: a homepage opening, a gallery section, an API page, and a playground shell. Keep the words and example concepts consistent enough to compare hierarchy and character rather than different products.

Then choose a direction with Ben and develop the full set of surfaces: homepage, Learn article, API reference, gallery with filters and empty state, focused example, showcase, and full-page playground. Include desktop and narrow-screen behavior. State intended interactions in annotations; a static mockup should not leave important behavior implicit.

Use screenshots of running examples when available. Until then, label thumbnails and scene imagery as concept placeholders. Do not present invented code or fabricated runtime screenshots as verified CRC output.

## Review artifacts to bring back

Bring a small set of concepts, an explanation of hierarchy and motion, responsive examples, a proposed type/color/spacing system, and an interaction/state inventory. Include loading, no results, errors, reduced motion, unsupported rendering, and oversized URL sharing. Keep these states visually consistent with the main experience.

For the homepage, storyboard the first interaction and the route to understandable code. For the playground, show what happens from clicking Open in playground through changing code and exporting it. The design needs to explain the journey as well as the resting screens.

## Prompt for initial visual exploration

> Design distinct visual directions for the CRC developer website using the attached planning pack. Treat it as product/content input, not a finished visual design. CRC is a component runtime for interactive Canvas experiences, with signals, animation, physics, living textures, native HTML boundaries, and ordinary Three.js scenes. Explore a memorable homepage, screenshot-led examples gallery, calm API reference, and full-page editor/preview playground as one coherent system. Preserve readable code, clear navigation, and visible playground actions. Do not add accounts or cloud saves. Keep placeholder scene imagery labeled as conceptual. Respect HTML-above-Canvas ordering and the single composited Three layer. Present a small number of genuinely different directions with desktop and narrow-screen examples, then explain the interaction and motion intent so Ben can choose a direction before implementation.

## Prompt for the signature scene

> Explore a tasteful kinetic studio desk for CRC: a living ink surface disturbed by a draggable 2D physics puck, a small native HTML control card, and a Three.js artifact in a distinct scene region. Make one interaction obvious and preserve quiet space for a headline and two calls to action. Show an idle state, the first gesture, a reduced-motion state, and a simplified mobile composition. HTML stays above Canvas; Three is one flattened layer; stirring is not a fluid solver. Show how the experience points to small understandable examples. Do not fill every region with motion or choose final implementation APIs.

## How to use the pack outside the repository

Start with the README, positioning, examples directives, playground brief, and this document. The first collection briefs supply specific demonstration content. The idea bank is inspiration, not a requirement to show 100 cards or create 100 mockups. Repository links in the evidence appendix are optional context; all essential design constraints are restated here.
