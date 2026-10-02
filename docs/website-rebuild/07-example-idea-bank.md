# Prioritized example idea bank

These 100 candidates are an editorial backlog, not a commitment to build 100 examples. Scores are subjective planning judgments. They estimate usefulness and visual impact, not measured demand or implementation feasibility. A visually strong application often needs more code than a focused teaching example; label it honestly and give it a small companion.

## How to read the priorities

Usefulness and wow factor are scored from 1 to 5. Usefulness means transferable learning or application value; wow means a clear visual payoff from a screenshot and brief interaction. Effort is S for a focused example, M for a composed example, and L for a showcase or technical spike. These are relative estimates, not time promises.

A means a first-wave candidate: useful, compelling, and relatively direct. B means a follow-on candidate or a deliberate larger investment. C means an ambitious experiment to validate before scheduling. Within each category, the list is ordered editorially; the tier is the cross-category priority. A does not mean every candidate belongs in the first release. Select a balanced collection using the [first collection briefs](08-first-collection-briefs.md).

CRC supplies the primitives and boundaries; application logic supplies games, graph editors, semantic data models, and custom path behavior. HTML uses native controls or the current HtmlBox boundary. Three ideas use ordinary Three resources in one external layer. Asset-heavy, effect-heavy, or game ideas need a feasibility check before publication. No candidate authorizes a new runtime API.

## Small interactions and standalone CRC

| ID   | Candidate           | Use | Wow | Effort | Visible result                           | Teaching point                                       | Tier |
| ---- | ------------------- | --- | --- | ------ | ---------------------------------------- | ---------------------------------------------------- | ---- |
| E001 | Spring switch       | 5   | 3   | S      | A tactile sliding switch                 | A signal target drives one spring transition         | A    |
| E002 | Magnetic dock       | 4   | 4   | M      | Icons grow as a pointer approaches       | Derive nearby scales from one pointer signal         | B    |
| E003 | Spotlight reveal    | 4   | 4   | S      | A moving aperture reveals a poster       | Compose clipping with pointer coordinates            | A    |
| E004 | Path follower       | 4   | 4   | S      | A tiny courier follows a curved route    | Place and orient content along a path                | B    |
| E005 | Elastic range dial  | 4   | 4   | M      | A draggable dial settles into position   | Pointer capture and bounded value mapping            | B    |
| E006 | Layered paper cards | 4   | 4   | S      | Cards lift and cast restrained shadows   | Group transforms and pixel-only filters              | A    |
| E007 | Shape morph study   | 3   | 4   | M      | A badge smoothly changes outline         | Animate compatible application-defined path geometry | B    |
| E008 | Focus constellation | 5   | 3   | M      | Keyboard focus moves among glowing nodes | Visible focus and directional navigation             | B    |
| E009 | Particle stamp      | 4   | 4   | S      | A click releases one deliberate burst    | Trigger and clean up a Canvas particle effect        | A    |
| E010 | Signal color mixer  | 5   | 3   | S      | Three values mix a live color field      | Computed values derive presentation                  | A    |

## HTML and Canvas combinations

| ID   | Candidate                     | Use | Wow | Effort | Visible result                                | Teaching point                                           | Tier |
| ---- | ----------------------------- | --- | --- | ------ | --------------------------------------------- | -------------------------------------------------------- | ---- |
| E011 | Native slider and living ink  | 5   | 5   | S      | A real slider changes an ink surface          | Native input writes a shared signal                      | A    |
| E012 | Editable name badge           | 5   | 4   | S      | Typed text appears on an animated badge       | Use a native input beside Canvas output                  | A    |
| E013 | Searchable star map           | 4   | 4   | M      | Search focuses a labeled star                 | HTML search coordinates a Canvas selection               | B    |
| E014 | Annotation composer           | 5   | 4   | M      | Edit a note attached to a Canvas point        | Allocate a native editor using HtmlBox                   | B    |
| E015 | Accessible chart filter       | 5   | 4   | M      | Native selects filter plotted data            | Keep form semantics native and chart state shared        | A    |
| E016 | Color palette workbench       | 5   | 4   | M      | Native color inputs restyle an illustration   | Synchronize HTML controls and Canvas fills               | B    |
| E017 | Recipe timer garden           | 4   | 4   | M      | Native timer fields control growing flowers   | Separate form editing from animated presentation         | B    |
| E018 | Physics labels                | 4   | 5   | M      | Native editable labels travel with 2D bodies  | Project HTML through allocated transforms above Canvas   | B    |
| E019 | Clipped native inspector      | 4   | 3   | M      | A small inspector follows a transformed panel | Demonstrate supported geometry clips and HTML allocation | B    |
| E020 | HTML and Canvas keyboard tour | 5   | 3   | M      | Tab moves through native and Canvas controls  | Teach mixed focus ownership without duplicate activation | A    |

## Games and playful systems

| ID   | Candidate            | Use | Wow | Effort | Visible result                                 | Teaching point                                            | Tier |
| ---- | -------------------- | --- | --- | ------ | ---------------------------------------------- | --------------------------------------------------------- | ---- |
| E021 | Pocket pinball       | 4   | 5   | L      | A compact physics toy with two flippers        | Combine 2D collisions with player commands                | B    |
| E022 | Breakout postcard    | 4   | 4   | M      | A small paddle game with tasteful trails       | Input, collision response, and a readable game state      | B    |
| E023 | Stack the stones     | 4   | 5   | M      | Balance a small pile of rounded shapes         | Rigid body placement and reset                            | A    |
| E024 | Tiny air hockey      | 3   | 4   | M      | One puck and two paddles                       | Pointer capture drives a physical interaction             | B    |
| E025 | Marble maze          | 4   | 4   | M      | Guide a marble around a short maze             | Bounded controls influence a 2D physics world             | B    |
| E026 | Constellation puzzle | 4   | 4   | M      | Connect stars into a target shape              | Application puzzle state and path feedback                | B    |
| E027 | Firefly catcher      | 3   | 4   | M      | Catch lights with a moving lantern             | Canvas particles plus explicit hit targets                | B    |
| E028 | Orbit timing game    | 3   | 4   | M      | Release a satellite at the right moment        | Analytic animation and event-driven state                 | C    |
| E029 | Mini factory sorter  | 4   | 5   | L      | Sort falling parcels into bins                 | Body events connect physics to application rules          | C    |
| E030 | Word tile tumble     | 4   | 4   | L      | Native text entry creates falling letter tiles | Bridge HTML input and 2D bodies; keep game logic explicit | C    |

## Dashboards and useful tools

| ID   | Candidate                  | Use | Wow | Effort | Visible result                                      | Teaching point                                            | Tier |
| ---- | -------------------------- | --- | --- | ------ | --------------------------------------------------- | --------------------------------------------------------- | ---- |
| E031 | Live instrument panel      | 5   | 4   | M      | Gauges respond to a small deterministic feed        | Signals animate a readable data display                   | A    |
| E032 | Timeline scrubber          | 5   | 4   | M      | Scrub a short animated sequence                     | Seek an animation program from native controls            | A    |
| E033 | Node connection editor     | 5   | 4   | L      | Drag nodes with curved connections                  | Pointer capture, transforms, and application graph state  | B    |
| E034 | Floor plan selector        | 5   | 3   | M      | Select rooms in a compact plan                      | Paths and geometry-based targeting                        | B    |
| E035 | Energy flow dashboard      | 5   | 5   | L      | Particles show flow between measured nodes          | Keep encoded quantities readable under decorative effects | B    |
| E036 | Audio style meter          | 3   | 4   | M      | Bars and restrained glow react to synthetic samples | Animate sampled data without requiring a microphone       | B    |
| E037 | Task progress garden       | 4   | 4   | M      | Completed tasks add leaves and flowers              | Map semantic state to a reusable animated component       | B    |
| E038 | Transport control panel    | 4   | 4   | M      | Native toggles control a small route simulation     | Coordinate HTML controls with Canvas state                | B    |
| E039 | Mini diagram inspector     | 5   | 3   | M      | Select a shape and edit its numeric properties      | Native fields update a selected Canvas element            | B    |
| E040 | Simulation comparison desk | 4   | 4   | L      | Two parameter sets run beside shared controls       | Explicit ownership of multiple simulations                | C    |

## Data visualization with expressive effects

| ID   | Candidate                     | Use | Wow | Effort | Visible result                                  | Teaching point                                            | Tier |
| ---- | ----------------------------- | --- | --- | ------ | ----------------------------------------------- | --------------------------------------------------------- | ---- |
| E041 | One line and one hover marker | 5   | 4   | S      | A crisp chart reveals a selected value          | Scale, series, and one inspection rule                    | A    |
| E042 | Constellation scatterplot     | 5   | 5   | M      | Selected points glow while labels stay readable | Point inspection with selective visual emphasis           | A    |
| E043 | Rainfall bars                 | 4   | 4   | M      | Drops settle above readable bars                | Separate decorative particles from data marks             | B    |
| E044 | River of transactions         | 4   | 5   | L      | Moving marks flow along labeled routes          | Explain whether speed or count carries the data           | C    |
| E045 | Heatmap lantern               | 4   | 4   | M      | A pointer reveals detail over a grid            | Map domain cells and use a clipped highlight              | B    |
| E046 | Spring ranked bars            | 5   | 4   | M      | Values transition between two rankings          | Animate display values and explicit application positions | B    |
| E047 | Glowing uncertainty band      | 5   | 4   | M      | A soft band surrounds a crisp estimate          | Use effects without shifting the encoded interval         | B    |
| E048 | Linked chart and table        | 5   | 4   | L      | HTML rows and Canvas points share selection     | One signal coordinates native and drawn views             | B    |
| E049 | Small multiples spotlight     | 5   | 4   | M      | Hover emphasizes one chart among several        | Reuse chart components with shared scales                 | B    |
| E050 | Data lens comparison          | 5   | 5   | L      | Compare datasets through a movable lens         | Clip two renderings while preserving honest axes          | C    |

## Fictional product pages and campaigns

| ID   | Candidate                      | Use | Wow | Effort | Visible result                                     | Teaching point                                           | Tier |
| ---- | ------------------------------ | --- | --- | ------ | -------------------------------------------------- | -------------------------------------------------------- | ---- |
| E051 | Living ink stationery          | 4   | 5   | M      | A paper product page with a living print           | Native page content plus a clipped procedural surface    | A    |
| E052 | Sneaker orbit configurator     | 4   | 5   | L      | A 3D shoe with Canvas annotations                  | Ordinary Three model plus CRC overlay and native choices | C    |
| E053 | Perfume particle trail         | 3   | 5   | M      | A fictional bottle emits a restrained ribbon       | Use Canvas particles as decorative composition           | B    |
| E054 | Ceramic color studio           | 5   | 5   | L      | Change a 3D vessel color with real controls        | Signals update normal Three material resources           | B    |
| E055 | Tea label reveal               | 4   | 4   | M      | Reveal artwork through a brush-shaped mask         | Teach clipping independently of product copy             | B    |
| E056 | Audio device launch            | 3   | 4   | M      | A product illustration pulses with synthetic sound | Coordinate illustrative motion and semantic HTML         | B    |
| E057 | Outdoor equipment weather card | 4   | 4   | M      | Rain and wind animate around an illustrated pack   | Layer independent effects around static product content  | B    |
| E058 | Interactive festival poster    | 4   | 5   | M      | Type and ink respond to a playful gesture          | Compose Canvas text with living textures                 | B    |
| E059 | Jewelry constellation          | 3   | 5   | L      | A Three object sits amid Canvas star accents       | Respect the flattened external renderer boundary         | C    |
| E060 | Furniture swatch page          | 5   | 4   | M      | Native swatches change a procedural material panel | Separate texture settings from the purchasing UI         | B    |

## Cute scenes and tiny worlds

| ID   | Candidate           | Use | Wow | Effort | Visible result                                | Teaching point                                         | Tier |
| ---- | ------------------- | --- | --- | ------ | --------------------------------------------- | ------------------------------------------------------ | ---- |
| E061 | Rainy window cat    | 3   | 5   | M      | A sleepy cat watches procedural rain          | Layer reusable illustration components and motion      | A    |
| E062 | Pocket terrarium    | 4   | 5   | M      | Plants sway around drifting motes             | Compose several modest animations with one scene owner | B    |
| E063 | Sleepy robot        | 4   | 4   | S      | A robot wakes when focused or activated       | One state change drives a small expression             | A    |
| E064 | Firefly jar         | 3   | 5   | M      | Lights drift within a shaped glass outline    | Particle clipping and restrained glow                  | B    |
| E065 | Koi pond postcard   | 3   | 5   | L      | Fish traces disturb a stylized water surface  | Application motion drives a procedural response        | C    |
| E066 | Train in a teacup   | 3   | 5   | M      | A tiny train circles an illustrated cup       | Path-following and repeatable animation                | B    |
| E067 | Weather village     | 4   | 5   | L      | Choose sun, rain, or snow for a tiny street   | Native selection coordinates several effects           | C    |
| E068 | Paper ocean         | 3   | 4   | M      | Layered curves sway beneath a small boat      | Analytic animation of simple path geometry             | B    |
| E069 | Moon gardener       | 3   | 4   | M      | Click to plant gently growing flowers         | Keyed components own growth lifetimes                  | B    |
| E070 | Little mail courier | 4   | 4   | M      | A character carries a note between two points | Sequence motion and a completion milestone             | B    |

## Textures physics and material studies

| ID   | Candidate              | Use | Wow | Effort | Visible result                              | Teaching point                                               | Tier |
| ---- | ---------------------- | --- | --- | ------ | ------------------------------------------- | ------------------------------------------------------------ | ---- |
| E071 | Paint living ink       | 5   | 5   | S      | Touch a surface to seed a pattern           | One reaction-diffusion resource and a brush                  | A    |
| E072 | Stir existing ink      | 5   | 5   | M      | Drag to move the current pattern            | Send explicit stirring messages in texture coordinates       | A    |
| E073 | Physics ink puck       | 5   | 5   | M      | A moving body disturbs a living surface     | Map committed body movement into texture messages            | A    |
| E074 | Marble palette cards   | 4   | 4   | S      | One seed produces several color treatments  | Share a texture and change palette presentation              | B    |
| E075 | Paper grain comparison | 4   | 3   | S      | Compare two small textured panels           | Choose resolution independently of display size              | B    |
| E076 | Cellular material dial | 4   | 4   | S      | One native control changes a material       | Update a texture parameter without hidden machinery          | B    |
| E077 | Plasma globe study     | 3   | 5   | L      | A focused electrical scene reacts to touch  | Extract one interaction from the larger existing scene       | B    |
| E078 | Underwater postcard    | 4   | 5   | M      | An illustration distorts like shallow water | Demonstrate supported pixel effects with stable hit geometry | B    |
| E079 | Physics stamp press    | 4   | 5   | L      | Falling shapes trigger a color impression   | Body events affect a separate visual surface                 | C    |
| E080 | Growing artwork reveal | 4   | 5   | M      | An image emerges through an evolving mask   | Explain texture-driven reveal composition                    | B    |

## Three.js and external renderer compositions

| ID   | Candidate                       | Use | Wow | Effort | Visible result                                     | Teaching point                                           | Tier |
| ---- | ------------------------------- | --- | --- | ------ | -------------------------------------------------- | -------------------------------------------------------- | ---- |
| E081 | Three scene with CRC controls   | 5   | 5   | M      | A simple 3D object and a crisp 2D control          | One persistent Three layer within CRC composition        | A    |
| E082 | Three loading splash            | 5   | 4   | M      | A Canvas progress scene covers a loading model     | Reflect real loader progress and own teardown            | B    |
| E083 | Native Three inspector          | 5   | 4   | M      | Native inputs edit a lit cube                      | Keep normal Three resources and native editing semantics | A    |
| E084 | Instanced garden                | 4   | 5   | L      | Many Three plants share an interactive view        | Use ordinary Three instancing within one layer           | B    |
| E085 | 3D scene with Canvas minimap    | 4   | 5   | L      | A 2D map tracks a camera in a 3D scene             | Share application state across rendering boundaries      | C    |
| E086 | Orbit lesson overlay            | 5   | 4   | M      | Annotations explain a camera move                  | Coordinate CRC-routed controls and Canvas guidance       | B    |
| E087 | Postprocessing comparison       | 4   | 5   | L      | A split view compares ordinary Three effects       | Application-owned effects remain inside external layers  | C    |
| E088 | Gallery plinth                  | 4   | 5   | L      | A rotating object with native information controls | Maintain distinct 3D, Canvas, and HTML ownership         | B    |
| E089 | Canvas HUD for a 3D game mockup | 5   | 5   | L      | A small arena with gauges and a pause panel        | CRC composes the HUD; application owns game logic        | C    |
| E090 | Renderer boundary lesson        | 5   | 3   | M      | Click across a Three object and Canvas overlay     | Show target, block, and miss arbitration visibly         | B    |

## Ambitious combined showcases

| ID   | Candidate                 | Use | Wow | Effort | Visible result                                                      | Teaching point                                                | Tier |
| ---- | ------------------------- | --- | --- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------- | ---- |
| E091 | Kinetic studio desk       | 5   | 5   | L      | Drag a puck through ink beside native controls and a 3D artifact    | A curated combination with focused companion lessons          | B    |
| E092 | Living specimen cabinet   | 4   | 5   | L      | Explore a small cabinet of animated materials                       | Reuse compositional boundaries across specimens               | B    |
| E093 | Creative instrument       | 4   | 5   | L      | Native controls perform a visual composition                        | Coordinate signals, motion, textures, and particles           | C    |
| E094 | Museum installation guide | 5   | 5   | L      | An interactive exhibit map reveals 3D artifacts                     | Blend useful navigation with deliberate visual transitions    | C    |
| E095 | Weather command center    | 5   | 5   | L      | Charts and a miniature scene share synthetic weather data           | Keep data truth separate from atmospheric decoration          | C    |
| E096 | Interactive album sleeve  | 3   | 5   | L      | A fictional album opens into a living visual world                  | Compose materials and user-controlled transitions             | C    |
| E097 | Tiny factory dashboard    | 5   | 5   | L      | Physics parcels feed readable production charts                     | Connect simulation events to HTML and Canvas reporting        | C    |
| E098 | Product atelier           | 5   | 5   | L      | Customize a Three object with a Canvas presentation layer           | Prove a realistic mixed-rendering application                 | B    |
| E099 | Ocean observatory         | 4   | 5   | L      | A fictional instrument room combines charts and an underwater scene | One shared application model powers different representations | C    |
| E100 | Playable CRC postcard     | 4   | 5   | L      | A small personalized scene with editable native text                | A complete portable project worth sharing                     | C    |

## Producing more ideas without repeating the gallery

Combine one useful task, one interaction, one visual treatment, and one explicit CRC concept. For example: select a data point + native filtering + restrained glow + shared signal selection; or customize a product + drag + living material + texture parameter updates.

Rotate useful tasks such as compare, select, edit, inspect, navigate, configure, explain, or play. Rotate interactions such as pointer capture, keyboard focus, native text input, a slider, seek, or reset. Rotate visual treatments such as paper, ink, glass-like highlights, stars, botanical illustration, architectural lines, or bold editorial color. Keep the API concept singular for focused examples.

Do not publish palette swaps as separate lessons unless the behavior or learning goal changes. For every new candidate, answer: why CRC, what does the visitor do, what code do they learn, and what smaller lesson can a showcase reveal?

## Selection rules

First reject candidates that depend on unsupported contracts without an explicit spike. Then choose for usefulness, visible payoff, and collection diversity. Prefer S/M work when two ideas prove the same thing. Reserve space for one genuinely ambitious showcase, and remove weaker duplicates instead of constantly growing the featured grid.

Before promoting a candidate, write its one-sentence lesson, identify public imports, and sketch its thumbnail. If the thumbnail needs a paragraph to explain it or the lesson needs three unrelated concepts, revise the brief.
