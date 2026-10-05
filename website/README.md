# CRC documentation website

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
corepack pnpm@11.21.0 --filter @crc/website check:examples
node tooling/website-minimal-browser.mjs
```

Pass family names to the browser checker for a focused run, for example
`node tooling/website-minimal-browser.mjs paths layout`. It checks painted
pixels or meaningful HTML, runtime errors, and representative interactions.

Foundation: Astro + Starlight. Starlight supplies documentation navigation and readable static pages; CRC demos use public imports and the existing CRC TSX learning sources, with `createElement` in the small custom previews. See the [official setup](https://starlight.astro.build/manual-setup/) and [configuration](https://starlight.astro.build/reference/configuration/).

Public website and agent copy lives in `docs/site/website/**/*.mdx` (plain Markdown syntax). Existing API, guide, and tutorial Markdown is reused directly from `docs/site/api/` and `docs/site/learn/`; edit those canonical sources to update both sites. `documentation.mjs` uses the existing public-document parser and TypeScript semantic export inventory, rewrites documentation links, and reports export destinations. `prepare-content.mjs` produces Starlight pages, clean Markdown counterparts, indexes, and source-expanded agent examples. Generated files are ignored. The `.mdx` extension keeps the older Studio Markdown collector unchanged. No plans or test labs enter this inventory. Search is deferred; Starlight Pagefind is disabled and existing Studio MiniSearch is unchanged.

Run from the repository:

```sh
corepack pnpm@11.21.0 --filter @crc/website dev
corepack pnpm@11.21.0 playground
```

The site defaults to port 4321 and its configured editor URL to `http://localhost:5173/`. Set `CRC_PLAYGROUND_URL` if the second server uses another URL. Restart the website after changing authored documentation; source expansion runs at startup.

```sh
corepack pnpm@11.21.0 --filter @crc/website build
node --test tooling/website-slice.test.mjs tooling/website-documentation.test.mjs
node tooling/website-browser.mjs
node tooling/website-documentation-browser.mjs
```

The browser check uses `CRC_WEBSITE_URL` if supplied. It captures screenshots in `/tmp`, not source control. Examples use built public packages; build `@crc/core`, `@crc/three`, and `@crc/text` first if their distributions are absent or stale. The website declares these dependencies so recursive workspace builds order them correctly.

Deploy `dist/` as static files with real 404 handling. Before deployment, configure the hosted Studio URL and its reciprocal `VITE_CRC_WEBSITE_URL`. Studio documentation hashes redirect to the website; examples and tutorial workbenches remain in Studio. Deployment, final canonical origin/sitemap, base-path rollout, individual expansion of grouped APIs, website search, and visual design remain follow-up work. This preview does not replace the deployed site.

The coverage JSON records reference and minimal-example destinations, not a claim of exhaustive behavior testing or freshly executed browser results. The documentation browser check parses every generated page to verify heading links and static images, then exercises no-JavaScript reference, agent, minimal-example, and Markdown reading paths. Agent topics distinguish recommended verification from executed evidence. New sources should use supported public imports, include host setup, and preserve canonical example ownership.

Jessica's shareable kit is `docs/website-rebuild/claude-design-kit/`; its source powers the actual button demo and is expanded into public recipe documentation. The generated archive is an explicit download, not search content.
