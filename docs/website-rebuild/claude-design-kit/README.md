# CRC integration kit for Jessica

Start with [the pasteable prompt](01-starting-prompt.md), then give Claude Design this entire folder. The goal is a redesigned site that uses real CRC effects while preserving useful documentation and native interaction.

This is a local-checkout integration kit, dated October 4, 2026. Package metadata says `@crc/core` 0.0.1; that number alone does not establish published npm compatibility. The runnable site records the base revision used to generate its documentation. Verify the actual package before applying this kit to another project.

## Read in order

1. [Starting prompt](01-starting-prompt.md)
2. [Site structure and content relationships](02-site-structure.md)
3. [Verified capability map and limits](03-capability-map.md)
4. [Native button recipe](native-button/README.md), including all four source files
5. [From concept to implementation](04-implementation-and-review.md)
6. [Prioritized roadmap](05-roadmap.md)

The button is the first implemented recipe. Plasma forms, image reveals, and a store hero rotator are unimplemented concepts awaiting feedback. Do not present their proposed visuals as shipped CRC output.

The website builds a downloadable archive of this folder at `/claude-design-kit.tar.gz`. Share the folder or archive together, not only the starting prompt. The recipe has no private repository-helper imports. Its `package.json` intentionally needs a matching runtime package; use the packing instructions in its README for exact local compatibility.

## Local review

From the repository, run `corepack pnpm@11.21.0 --filter @crc/website dev` and `corepack pnpm@11.21.0 playground` in separate terminals. The usual addresses are `http://localhost:4321/` and `http://localhost:5173/`; use the actual addresses printed by the servers. Set `CRC_PLAYGROUND_URL` before starting/building the website if the editor uses another address.

Content is generated at server startup. Restart the website after changing authored Markdown or source files that are expanded into documentation. Live demo JavaScript still uses the normal development reload path.
