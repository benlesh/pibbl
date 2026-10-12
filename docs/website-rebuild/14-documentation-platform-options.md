# Documentation platform recommendation

Recommendation researched October 4, 2026: evaluate Astro with Starlight first. Use it as the documentation foundation, with custom visual catalog pages and a separately owned playground. This is a proposed technical direction for a small proof, not a migration approval or completed compatibility assessment.

## Options against Pibbl needs

| Option                      | Documented foundation                                                                                                   | Pibbl-specific assessment                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro and Starlight         | Documentation navigation, typography, code highlighting, Markdown/MDX, customization; Astro prerenders pages by default | Preferred candidate for a static documentation core and custom Canvas demonstrations; Pibbl mounting, Markdown companions and catalog generation need explicit work |
| Docusaurus                  | Static HTML per route, React/MDX customization, documentation versioning                                                | Strong alternative if built-in versioning and React-based site development matter most; keep site React and Pibbl JSX execution separate                            |
| Mintlify                    | Hosted documentation with Markdown URLs, llms.txt and skill discovery features                                          | Worth evaluating if managed publishing becomes the priority; test custom galleries and full-page playground integration before choosing it                          |
| Entirely custom static site | We would own every route, template, index and content build step                                                        | Maximum control, but more documentation infrastructure to maintain; current organization problems suggest avoiding this as the starting point                       |

The assessments are recommendations based on Pibbl's needs, not measured performance rankings. Platform features come from [Starlight](https://starlight.astro.build/), [Astro rendering documentation](https://docs.astro.build/en/guides/on-demand-rendering/), [Docusaurus introduction](https://docusaurus.io/docs), and [Mintlify's agent documentation](https://www.mintlify.com/docs/ai-native). Do not infer pricing, platform limits, or availability of a particular paid feature from this table; verify those before selection.

## Why start with Starlight

The documentation shell is largely a solved problem. Starlight provides an existing foundation for reading and navigating docs while permitting customization. Pibbl can supply browser-mounted interactive examples within those pages. The visual catalogs, homepage, and playground can have purpose-built layouts while sharing design tokens and links.

This recommendation does not mean Pibbl runs on the server or that Astro/MDX can compile Pibbl JSX without configuration. Keep runnable Pibbl projects compiled with Pibbl's own JSX settings and mount them through an explicit client boundary. Do not let the documentation framework consume Pibbl example code as its own component language. The integration proof must test source imports, browser-only initialization, build output and teardown.

Use Starlight's extension points deliberately rather than forking its whole theme. Its [component override documentation](https://starlight.astro.build/guides/overriding-components/) describes replacing or wrapping parts of the interface. Whether that is enough for Jessica's selected design should be tested on representative pages.

## Requirements independent of platform

- Readable initial HTML and normal URLs for every public document.
- Human pages, clean Markdown, detailed companions, and a catalog from shared content records.
- Coverage of every public API and direct links to compatible examples.
- Shape, filter, texture, and reaction-diffusion catalogs with static fallbacks and optional interactivity.
- Local build-time search over reviewed public content; no accidental index of internal plans or labs.
- Full-page playground entry and complete runnable source from every published example.
- Stable URLs, old hash-link handling, release compatibility, and genuine 404 responses.
- Cohesive visual design with readable code and accessible navigation.

Any platform choice must satisfy these requirements. A built-in AI chat widget is not a substitute for externally retrievable documentation.

## Short decision proof

Build a representative page family only after implementation is authorized: a shape reference, a filter comparison, a texture/reaction-diffusion entry, one advanced guide, and one showcase detail. Include Markdown export, a small catalog, and a working playground link. Inspect the raw HTTP responses as well as the browser view. Test whether the platform can deliver the required visual identity without replacing its entire documentation foundation.

Preserve current MiniSearch constraints in the proof or explicitly propose a reviewed search migration; do not silently accept a template's default indexing scope. Verify a legacy hash link, base-path deployment, asset paths, and JSX isolation. Distinguish built-in features from Pibbl-specific work and assess maintenance effort before choosing the platform for the full migration.

The next milestone is an agreed content schema and representative page model. That gives Jessica a clear design target and gives implementation a small, testable scope.
