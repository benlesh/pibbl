# CRC documentation website

Foundation: Astro + Starlight. Starlight supplies documentation navigation and readable static pages; CRC demos are client-only modules using public imports and `createElement`, avoiding JSX compiler collisions. See the [official setup](https://starlight.astro.build/manual-setup/) and [configuration](https://starlight.astro.build/reference/configuration/).

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

The browser check uses `CRC_WEBSITE_URL` if supplied. It captures screenshots in `/tmp`, not source control. This slice uses the workspace's built public `@crc/core` package; build core first if its distribution is absent or stale.

Deploy `dist/` as static files with real 404 handling. Before deployment, configure the hosted Studio URL; deployment, final canonical origin/sitemap, base-path rollout, legacy hash redirects, individual expansion of grouped APIs, search migration, and visual design remain follow-up work. The old Studio is preserved, so its original hash URLs still work at its own address. This preview does not replace that deployed site.

The coverage JSON is an export-to-document check, not a claim of complete prose or freshly executed snippets. The documentation browser check parses every generated page to verify heading links and static images, then exercises a no-JavaScript reference-to-agent-to-Markdown journey. Agent topics distinguish recommended verification from executed evidence. New sources should use supported public imports, include host setup, and preserve canonical example ownership.

Jessica's shareable kit is `docs/website-rebuild/claude-design-kit/`; its source powers the actual button demo and is expanded into public recipe documentation. The generated archive is an explicit download, not search content.
