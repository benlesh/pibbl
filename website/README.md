# Pibbl documentation website

## Visual galleries

`gallery.mjs` selects public learning examples for the shape, texture,
reaction-diffusion, transition, PathGeometry, filter, and showcase galleries.
Each has static documentation, complete source, an interactive preview, and a
full-page experience. Previews autoplay unless reduced motion is requested.

Run `node --import tsx tooling/website-gallery-browser.mjs` from the repository
root with the website running to check every selected experience. The explicit
`--update-previews` flag captures new gallery images; inspect changed images
before accepting them. These previews are illustrations, not pixel baselines.

## Minimal API examples

`docs/site/minimal/<family>/registry.json` registers complete public-import
programs alongside their `.ts` or `.tsx` source. Each entry has an ID, title,
description, source filename, environment (`browser` or `typecheck`), exact
`{ name, importPath }` symbol claims, and usage notes. Closely related APIs and
their types may share one focused program. Use real options, callbacks, and
results to demonstrate types; unused imports and placeholder aliases do not
establish coverage.

Browser examples create their own HTML/Canvas host and release owned resources
on `pagehide`. They are bundled into isolated preview documents, with automatic
start, Stop, and full-page links. Pure computations can show results in native
HTML. Reserve `typecheck` for contracts that cannot execute meaningfully in a
browser. Text examples deploy the matching text engine, WASM, licensed font,
and font license.

The website build validates public import usage, requires a complete source for
every exported symbol, and strictly typechecks the programs. Coverage is per
exported name, not every overload or possible combination; re-exported names
share their canonical example. `/minimal-examples/` is the human index;
`/agents/coverage.json` maps exact public imports to source and documentation.
Both are discoverable through `/llms.txt`.

After changing programs, regenerate content and run the browser checks:

```sh
node --import tsx website/prepare-content.mjs
corepack pnpm@11.21.0 --filter @pibbl/website check:examples
node tooling/website-minimal-browser.mjs
```

Pass family names to the browser checker for a focused run, for example
`node tooling/website-minimal-browser.mjs paths layout`. It checks painted
pixels or meaningful HTML, runtime errors, and representative interactions.

Foundation: Astro + Starlight. Starlight supplies documentation navigation and readable static pages; Pibbl demos use public imports and the existing Pibbl TSX learning sources, with `createElement` in the small custom previews. See the [official setup](https://starlight.astro.build/manual-setup/) and [configuration](https://starlight.astro.build/reference/configuration/).

Public website and agent copy lives in `docs/site/website/**/*.mdx` (plain Markdown syntax). Existing API, guide, and tutorial Markdown is reused directly from `docs/site/api/` and `docs/site/learn/`; edit those canonical sources to update the website and development fixtures. `documentation.mjs` uses the existing public-document parser and TypeScript semantic export inventory, rewrites documentation links, and reports export destinations. `prepare-content.mjs` produces Starlight pages, clean Markdown counterparts, indexes, and source-expanded agent examples. Generated files are ignored. The `.mdx` extension keeps the older Studio Markdown collector unchanged. No plans or test labs enter this inventory. Starlight Pagefind is disabled; the website reuses the existing MiniSearch engine.

Run from the repository:

```sh
corepack pnpm@11.21.0 --filter @pibbl/website dev
```

The site defaults to port 4321. The existing editor now runs at `/playground/`
inside the documentation site, including shared-code hashes and tutorial
workbenches. No second public server is needed. The standalone Studio remains
available for development/test labs during migration. Restart the website after
changing authored documentation; source expansion runs at startup.

TypeScript resolves documented public exports to their declarations, signatures,
JSDoc parameters, returns, remarks, and related API links. Type properties and
methods have expandable details and their own source links. Source snapshots
come from the same compiler snapshot as the extracted details; GitHub links are
pinned to HEAD and included only if the file matches that commit.

The header search reuses the existing local MiniSearch index and ranking for
validated public Learn/API documents, generated JSDoc member details, and learning example metadata. It loads on
search intent and routes results within this website. Source snapshots, test
labs, internal plans, and repository-only documentation are excluded.

```sh
corepack pnpm@11.21.0 --filter @pibbl/website build
node --test tooling/website-slice.test.mjs tooling/website-documentation.test.mjs
node tooling/website-browser.mjs
node tooling/website-documentation-browser.mjs
node tooling/website-unified-browser.mjs
```

Run `corepack pnpm@11.21.0 test:website` from the repository root for a fresh website build followed by documentation, unified-playground, and all browser-ready minimal-example checks. This command is included in `trust:browser`; it starts an isolated preview on a free local port and closes it when checks finish or fail. The build retains the minimal-example coverage gate.

When running individual browser scripts directly, the browser check uses `PIBBL_WEBSITE_URL` if supplied. It captures screenshots in `/tmp`, not source control. Examples use built public packages; build `@pibbl/core`, `@pibbl/three`, and `@pibbl/text` first if their distributions are absent or stale. The website declares these dependencies so recursive workspace builds order them correctly.

Deploy `dist/` as static files with real 404 handling. Documentation and playground
links are same-site paths. Old root-hash documentation and shared-example URLs redirect within the website.
Deployment, redirects from any separately hosted legacy Studio origin, final canonical
origin/sitemap, base-path rollout, individual expansion of grouped APIs, and
visual design remain follow-up work. This preview does not replace
the deployed site.

The coverage JSON records reference and minimal-example destinations, not a claim of exhaustive behavior testing or freshly executed browser results. The documentation browser check parses every generated page to verify heading links and static images, then exercises no-JavaScript reference, agent, minimal-example, and Markdown reading paths. Agent topics distinguish recommended verification from executed evidence. New sources should use supported public imports, include host setup, and preserve canonical example ownership.

Jessica's shareable kit is `docs/website-rebuild/claude-design-kit/`; its source powers the actual button demo and is expanded into public recipe documentation. The generated archive is an explicit download, not search content.
