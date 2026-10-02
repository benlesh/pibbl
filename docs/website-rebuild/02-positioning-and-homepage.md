# CRC positioning and homepage brief

Lead with what a developer can make, then show the small amount of code behind a convincing interaction. CRC's strongest proposed story is the combination of functional Canvas components, reactivity, motion, and composition with native HTML and ordinary Three.js resources.

## Proposed elevator pitch

> CRC is a component runtime for interactive Canvas experiences. Use familiar JSX and synchronous signals to compose drawing, animation, physics, and living textures, with native HTML controls and Three.js scenes where your application needs them.

Short candidate headline: **Make the web move.**

Supporting candidate: **Build expressive Canvas experiences with components, signals, and a shared animation lifecycle. Bring HTML controls and Three.js scenes into the composition.**

More explicit alternative headline: **Interactive Canvas, composed with components.**

The expressive headline needs the explanatory sentence beside it. Test whether a visitor can identify what CRC is without interacting with the hero. These are copy candidates, not selected brand language.

## Claims and their proof

| Proposed message             | Show it                                                    | Keep the claim honest                                                                |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Familiar component authoring | Small JSX scene and one reusable component                 | CRC is its own runtime; do not imply React compatibility                             |
| Reactive interaction         | A native slider changes a Canvas effect immediately        | Reads and declared inputs are explicit; this is not automatic deep observation       |
| Motion that composes         | A spring, physics body, and texture in a coordinated scene | Shared scheduling does not mean all subsystems use identical integration rules       |
| HTML where HTML helps        | A real text field or slider over Canvas artwork            | HTML hosts sit above Canvas; Canvas content does not gain automatic DOM semantics    |
| Bring ordinary Three.js      | A Three scene with CRC controls and a native inspector     | One external layer is a composited bitmap; no Canvas/Three subprimitive interleaving |
| Effects you can understand   | Open a small version of the effect in the playground       | Do not hide hundreds of lines behind a “ten lines” claim                             |

Avoid unsupported “fastest,” “zero overhead,” “fully accessible Canvas,” and “replaces CSS/React/Three” claims. Any future performance numbers need a reproducible workload and device context.

## Recommended signature concept

### Kinetic studio desk

A single carefully composed creative workbench: several draggable 2D objects sit over a living ink panel, with an HTML control card and a small Three.js artifact in its own region. Restrained typography and generous quiet space keep the page readable. The materials and lighting should feel intentional rather than like unrelated effect samples.

The visitor performs one obvious action: drag a puck through ink. Its motion disturbs the pattern. A native slider changes one parameter. An optional inspect action reveals the small bridge that sends committed body movement into the texture. A separate “Open the full scene” action opens the showcase.

The full scene demonstrates the combined ceiling; “How this works” links to focused examples for drag, physics, stirring, HTML controls, and Three composition. Users can reach those lessons without studying the hero implementation.

The scene must respect actual composition: HTML remains above Canvas; Three occupies one flattened layer; the reaction-diffusion field responds to motion but is not a physically accurate fluid. Keep HTML controls outside filtered Canvas groups. Use semantic HTML for the page's headline, navigation, and calls to action.

### Other directions worth exploring

- **Living specimen cabinet:** a small set of exquisite animated specimens, each illustrating one material or interaction. Easier to simplify for reduced motion and smaller screens. Risk: feels like an art portfolio unless the code connection is prominent.
- **Product atelier:** a fictional object configurator with a Three product, Canvas annotations and effects, and native controls. Strong application story. Risk: product imagery and asset work overshadow CRC's teaching value.

Explore these as compositions and storyboards first. Do not combine all three concepts into one homepage.

## Homepage content order

1. Pitch and signature interaction, with Explore examples and Open playground actions.
2. A tiny editable-looking code excerpt paired with its exact visible effect. The actual editor lives in the playground.
3. Three proofs: compose interaction, connect native controls, and combine rendering technologies. Each links to a focused example.
4. A curated gallery row spanning a practical application, a charming scene, a visualization, and a showcase.
5. A short “How CRC fits” section: Canvas runtime, public feature imports, optional Three adapter, HTML boundary, and where native HTML remains useful.
6. Getting started and API entry points.

The homepage is not the complete feature inventory. Its job is to make a visitor curious and confident enough to open a relevant example.

## Motion and performance direction

Prefer one active heavyweight scene. Pause work when offscreen or hidden, with explicit ownership of teardown. Provide a visible pause control and a polished reduced-motion/static presentation. Keep the pitch and navigation useful before the scene loads and when a browser lacks a required rendering capability.

On small screens, use a simplified composition with the same story and accessible native controls. Avoid scroll hijacking, forced introductions, cursor-only affordances, autoplay audio, and decorative motion beneath code or long text. Numeric performance budgets belong to a measured prototype, not an invented promise in this brief.

## Questions the concept must answer

Can a new visitor describe CRC after ten seconds? Can they predict what to touch? Is the effect delightful without becoming a distraction? Does the page reveal a short, understandable path to building it? Does it remain a useful page when motion is paused?
