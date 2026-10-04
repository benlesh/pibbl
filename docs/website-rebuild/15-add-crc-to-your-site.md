# Add CRC to your site

Direction added October 4, 2026. CRC has two distinct adoption paths: build an application whose visual surface is centered on CRC, or add selected CRC capabilities to an existing HTML application. Make both paths explicit in the website, examples, agent guidance, and skills.

This document proposes an integration section and a collection of recipes. It does not introduce a new runtime API, promise a ready-made widget library, or implement the examples below.

## Two clear entry points

| Entry point          | Reader intent                                                   | Typical result                                                                               |
| -------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Build with CRC       | Use CRC as the main interactive drawing and composition surface | A visual editor, Canvas dashboard, game, diagram tool, or interactive scene                  |
| Add CRC to your site | Keep an existing site and enhance a particular region           | A native button with a living background, a plasma form surround, a product image transition |

Both use the same public runtime and reference. The difference is who owns the application structure. An HTML page can own layout, navigation, text, forms, and accessibility while CRC owns one bounded visual region. A CRC-centered application can instead use HtmlBox to allocate native controls within its composition.

The homepage and Start page should present these two entry points early. Avoid making an HTML developer work through a complete Canvas application tutorial before adding one decorative effect.

## Where the section belongs

Create a prominent **Add CRC to your site** section within Guides, linked directly from Start, the homepage, and relevant visual catalogs. Organize its landing page by use case: buttons and controls; forms and feedback; images and galleries; commerce and heroes; content and navigation; embedded data views.

Each recipe is also discoverable in Examples with an **HTML integration** tag. A complementary **CRC application** tag identifies Canvas-centered work; some examples legitimately carry both. Keep the advanced showcase label as a separate measure of complexity. Do not maintain duplicate example projects for different discovery paths.

A button background should link to its reaction-diffusion recipe, texture API, integration guide, and agent companion. The catalog answers “what effect is this?” The integration guide answers “how do I put it into my existing button?”

## Three integration patterns

### Decorative Canvas behind native HTML

A positioned HTML wrapper contains a Canvas layer and native content above it. HTML owns the meaningful control, label, focus behavior, layout, and state. CRC renders the effect. A decorative canvas is excluded from the accessibility tree and does not intercept pointer input. The native control remains useful when the effect is unavailable.

For a button, keep the native button as the single interactive target. The canvas can be a sibling visual layer within a wrapper, with its geometry matched to the button. Hover, focus, pressed, and disabled state can update CRC signals through a small application-owned bridge. Do not forward synthetic clicks or invent a second Canvas button on top of it.

This is the default teaching pattern for effects in existing HTML. HtmlBox is not required merely because HTML and Canvas appear together on a page.

### Interactive Canvas beside native controls

CRC owns a deliberately interactive visual region, such as an image comparison view or a small chart. Native HTML owns surrounding inputs, captions, buttons, and status. The host passes data and commands through a small explicit interface; CRC reports relevant selection or interaction state back.

Keep the interaction's ownership unambiguous. A pointer-driven reveal may need its own Canvas events, while a native range control provides an equivalent way to choose the reveal position. Explain exactly which region receives pointer input and how coordinates map into the canvas.

### Native HTML inside a CRC allocation

Use HtmlBox when CRC should own the native control's placement within a CRC composition. Document its explicit overlay setup and lifecycle. Hosts remain above Canvas; this does not allow arbitrary HTML to join a Canvas filter or be painted between individual Canvas primitives. Native content does not automatically determine CRC intrinsic layout size.

Keep this pattern distinct from adding an effect behind an existing DOM form. The two directions of integration solve different problems.

## Recipe page contract

Start with the ordinary HTML result and state what CRC adds. Show a small before/after preview, the minimal HTML and CSS host, the CRC implementation, and the explicit connection between them. Mark any framework-specific wrapper as application integration code, not an exported CRC feature.

Every recipe should include:

- The native structure and behavior that remain owned by the host page.
- The effect's public imports, required assets, and compatible CRC version.
- A compact mount/update/dispose boundary, with listener and observer cleanup.
- Sizing, clipping, layering, pixel density, and pointer-coordinate rules relevant to this host.
- The input bridge, including native hover/focus/disabled or application data changes.
- A static or CSS fallback, reduced-motion behavior, and pause/offscreen strategy where appropriate.
- A complete project in the playground and a downloadable example that works without site-only helpers.
- A short human explanation and a detailed agent companion with adaptation and verification steps.

Show plain HTML and TypeScript first. Add framework guides for requested ecosystems later using their actual lifecycle conventions; do not assume a React component tree can render CRC JSX. The documentation site's own framework is not a prerequisite for using CRC.

## Integration quality rules

Use CRC where it adds visual behavior worth its integration cost. A basic color transition may be better expressed in CSS; a living texture or coordinated particle scene provides a clearer CRC demonstration. Explain that choice so agents do not insert a rendering runtime into every control indiscriminately.

Size the canvas from its host and use the documented responsive surface behavior. Do not recreate the root for every hover or value change. Dispose the mount and application-owned listeners/observers when the host is removed, including route changes and repeated mount cycles. Avoid duplicate animation loops; CRC effects should use CRC scheduling. The host may observe page visibility or intersection to control whether an effect advances.

Keep native text, validation, links, and focus indicators readable. Respect disabled states, touch input, keyboard use, and reduced motion. A decorative canvas should not announce content already represented in HTML. Informative Canvas views need an appropriate semantic summary or alternative.

Do not allocate an unbounded simulation per card in a large product grid. Start with one visible enhanced region and measure representative multi-instance use. Choose sharing or limiting strategies only within documented resource ownership boundaries. State cost qualitatively until measured.

Image examples need an explicit asset-loading and failure policy. Preserve useful images/captions while assets load; handle aspect ratio, resize, interrupted transitions, and rapid navigation. If pixel access or export is required, document the applicable image-origin restrictions. Do not imply CRC can capture and distort arbitrary live DOM as a texture.

## Proposed integration idea bank

These are original editorial concepts, not implemented components. Priority A means a strong first candidate, B means a useful follow-on, and C means an ambitious composition requiring a feasibility spike. Effort S is a focused recipe, M a composed example, and L a larger showcase; these are estimates, not time commitments. Score usefulness and visual impact more formally only when selecting a release collection.

### Buttons and controls

| Idea                    | What remains native                             | What CRC adds                                           | Priority and effort |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------- | ------------------- |
| Living ink button       | Button label, activation, focus, disabled state | Reaction-diffusion background responding to focus/hover | A · S               |
| Particle success button | Submit action and success status                | One bounded celebration after actual success            | A · S               |
| Electric call to action | Link or button semantics                        | A restrained electrical surround on hover/focus         | B · M               |
| Liquid progress button  | Operation state and accessible progress text    | A clipped animated fill reflecting real progress        | A · M               |
| Constellation toggle    | Native checkbox or switch                       | A small star scene changes with checked state           | B · S               |
| Texture swatch selector | Radio group and names                           | Animated material previews for selected swatches        | B · M               |

### Forms and feedback

| Idea                       | What remains native                        | What CRC adds                                                    | Priority and effort |
| -------------------------- | ------------------------------------------ | ---------------------------------------------------------------- | ------------------- |
| Plasma form surround       | Labels, inputs, validation, submit         | Electrical activity around the form's outer boundary             | A · M               |
| Growing signup garden      | Form values and submission outcome         | A few illustrative plants respond to completion state            | B · M               |
| Ink validation accent      | Textual errors and valid/invalid semantics | A restrained accent near the field that changed                  | B · S               |
| Search constellation       | Search input and result list               | Decorative points cohere as results arrive                       | B · M               |
| Upload image reveal        | File input, progress, cancel, errors       | A staged reveal of the successfully loaded image                 | B · M               |
| Donation celebration panel | Amount selection and payment flow          | A short visual celebration driven by confirmed application state | C · M               |

### Images and galleries

| Idea                    | What remains native                         | What CRC adds                                       | Priority and effort |
| ----------------------- | ------------------------------------------- | --------------------------------------------------- | ------------------- |
| Ink image reveal        | Image meaning, caption, destination         | A living mask reveals the picture                   | A · M               |
| Editorial image wipe    | Image list, captions, next/previous buttons | A path-based transition between images              | A · M               |
| Before and after lens   | Labels and a native range control           | A movable clipped comparison region                 | A · M               |
| Material image frame    | Image and caption                           | A subtle animated paper, marble, or cellular border | B · S               |
| Contact sheet spotlight | Linked thumbnails and keyboard focus        | A restrained effect around the selected thumbnail   | B · M               |
| Filmstrip scrubber      | Native range control and frame description  | Smooth presentation of a bounded image sequence     | B · M               |
| Distortion image viewer | Image description, control panel, reset     | A supported filter applied to image pixels          | B · M               |
| Particle image arrival  | Image caption and destination               | An authored particle overlay around image reveal    | C · L               |

### Commerce and hero regions

| Idea                             | What remains native                      | What CRC adds                                           | Priority and effort |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------- |
| Store hero image rotator         | Headline, links, slide controls, pause   | Deliberate image transitions with masks and effects     | A · L               |
| Living product backdrop          | Product details and purchase controls    | Reaction-diffusion behind a product image               | A · M               |
| Product variant material preview | Swatch controls and selected variant     | Material changes synchronized to the product choice     | B · M               |
| Seasonal campaign scene          | Campaign copy and call to action         | A small weather or particle composition                 | B · M               |
| Product comparison reveal        | Comparison labels and selection controls | A clipped visual comparison between two assets          | B · M               |
| Physics product display          | Product links and details                | A bounded arrangement of draggable illustrated objects  | C · L               |
| Three product pedestal           | Native description and controls          | Ordinary Three product rendering inside CRC composition | C · L               |
| Scroll-linked art panel          | Document scrolling, sections, headings   | Host scroll progress drives a bounded visual transition | C · M               |

### Content and navigation

| Idea                        | What remains native                 | What CRC adds                                   | Priority and effort |
| --------------------------- | ----------------------------------- | ----------------------------------------------- | ------------------- |
| Reading progress trail      | Article content and scrolling       | A small animated path follows host progress     | B · S               |
| Focused navigation ornament | Links, navigation order, focus ring | One animated ornament tracks the active item    | B · M               |
| Event ticket artwork        | Event details and ticket link       | A living texture in the illustration region     | B · S               |
| Profile card scene          | Name, biography, links              | A tiny personalized animated illustration       | B · M               |
| Empty-state companion       | Explanation and recovery action     | A small robot or scene reacts to the action     | A · S               |
| Section divider artwork     | Heading hierarchy and page flow     | Restrained path or material motion in a divider | B · S               |

### Embedded data and utilities

| Idea                              | What remains native                             | What CRC adds                                      | Priority and effort |
| --------------------------------- | ----------------------------------------------- | -------------------------------------------------- | ------------------- |
| Sparkline in a table              | Table semantics, values, sorting                | Compact graphical trends in selected cells         | A · M               |
| Native filters and a Canvas chart | Form controls and data summary                  | Interactive plotting and inspection                | A · M               |
| Image annotation panel            | Note editor, save controls, list of annotations | Drawn selection geometry over an image             | B · M               |
| Delivery route illustration       | Textual delivery status and timestamps          | A small route scene tied to real application state | B · M               |
| Resource usage meter              | Numeric values and accessible status            | A legible animated gauge                           | B · S               |
| Timeline preview in a form        | Date/time inputs and validation                 | A visual representation of the selected interval   | B · M               |

## Recommended first collection

Start with the **living ink button**, **plasma form surround**, **ink image reveal**, and **store hero image rotator**. Together they directly answer Ben's examples and prove four distinct integration problems: native control state, native form structure, image/asset handling, and multi-item transitions.

Build the button first, with one effect and one small host bridge. Make it work by pointer and keyboard, respect disabled/reduced-motion states, and survive removal/remount. Then reuse the documented integration approach, without prematurely inventing a general effect-wrapper library.

For the rotator, begin with two local images and one transition. Establish next/previous, pause, loading failure, and rapid-navigation behavior before adding a menu of spectacular transitions. Native content and slide state remain authoritative even if the visual effect is stopped. Additional transitions should be separate recipes linked from the full rotator showcase.

## Agent guidance and skill scope

Give these recipes their own topic index and companion category. Extend the planned CRC integration skill with an explicit decision: is the agent building a CRC-centered surface, or enhancing an existing HTML application? In the latter case it should inspect the host's lifecycle, preserve native semantics, choose the smallest useful CRC region, and read the matching recipe before changing the app.

The skill should identify the native state owner, Canvas owner, event bridge, geometry boundary, resource lifetime, and fallback. It should avoid suggesting a rewrite of the host application merely to add an effect. Framework-specific lifecycle notes should be referenced modules, kept current and tested separately.

Evaluate agent performance by asking it to add a living background to an existing native button without changing its submission or keyboard behavior. A visually convincing screenshot is insufficient if it breaks the original control or leaks effects during navigation.
