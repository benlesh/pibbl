# Playground product brief

The playground should feel like a small, purposeful browser IDE: a full-page workspace for editing a complete Pibbl example beside its running preview. Its primary loop is load, inspect, change, run, share or download. The initial product has no database, accounts, or automatic persistence.

## Workspace layout

Use the available viewport. A compact toolbar contains project title, example picker, Run, Stop, Reset, Share URL, Download ZIP, and a return link. The editor and preview sit side by side with a resizable divider. A small file list or tabs appear when the project needs multiple files. Diagnostics and console output are collapsible, with errors visible when they block the preview.

Provide keyboard-operable resizing or equivalent pane-size controls. At narrow widths, use explicit Code and Preview tabs, preserve editor state, and keep Run and export accessible. Preview sizing should let users distinguish the example's logical layout from the available pane size; device presets can follow after the primary loop works.

## Loading examples and snippets

Every gallery card, detail page, and runnable API snippet opens a specific project. Preserve its title, origin link, source, dependencies, assets, and initial configuration. API actions may select the lines corresponding to the displayed excerpt. Do not load a larger unrelated showcase when the reader asked to try one small operation.

Initial built-in examples can run automatically. For a shared URL containing arbitrary code, recommend showing the source and asking the recipient to press Run before execution. This is a proposed trust distinction, not an account or sharing permission flow.

Loading a different project or resetting an edited project must offer a chance to keep editing or export first. Keep code through compilation/runtime errors. Explain plainly that unexported edits can be lost when the tab closes or reloads; do not label in-memory state “saved.”

## Run and recovery behavior

Run replaces the previous preview and releases its resources. Stop stops the preview while retaining source. A compilation failure identifies the file and location. A runtime failure displays an actionable message and preserves the workspace. If the old preview remains visible, clearly mark it as the last successful run so it cannot be mistaken for current code.

Provide a reset path after a failed run. Preview isolation should separate user code from site UI and storage. Test infinite loops and resource exhaustion explicitly; an iframe alone does not guarantee a responsive host. Choose the isolation/recovery design during the technical spike instead of promising containment the implementation cannot provide.

An optional auto-run mode can follow once restart, cleanup, and error behavior are reliable. Avoid evaluating incomplete edits on every keystroke by default.

## Projects and supported scope

Recommend a small project format with named TS/TSX, HTML, CSS, and declared local assets, plus metadata for entrypoint and compatible runtime/dependency versions. Keep a single-file default for focused examples. The format must be sufficient for every example selected for launch, including native HTML and Three scenes.

Start with a supported dependency set aligned with Pibbl examples. Arbitrary npm installation, server code, terminals, secrets, cloud assets, and collaborative editing are outside the initial scope. An asset-heavy showcase must still have a complete playable project and ZIP; its canonical built-in link can load bundled assets without putting them all into a URL.

## URL sharing

A share link is a snapshot of code, not an identifier for a server-saved project. Generate a versioned, compressed project payload in the fragment so a static host can serve it without a database. This does not make the link private: anyone who has it can inspect the code. Do not encourage sharing secrets or personal data.

Existing code already implements compressed, versioned single-source sharing with a 16,000-character ceiling. Treat that as migration input, not a proven safe limit for all browsers, messaging systems, or future multifile projects.

Before copying a URL, measure the complete encoded URL. Establish and test a conservative product limit across the supported browser and sharing paths. Add bounded decode/decompression, file count, source size, and asset size validation before execution. A compressed size limit alone does not bound decoded size.

If too large, keep the project intact, explain that it exceeds the sharing limit, and offer Download ZIP. Do not truncate code, silently omit assets, create a broken link, or describe an unchanged example link as a saved edit. Distinguish “Copy example link” from “Share edited project” when that difference matters.

Preserve old `v1` links or provide an explicit compatible recovery path. An unknown payload version, corrupt data, missing dependency, or unsupported runtime should show an explanatory recovery state. Do not silently substitute the original example and claim the shared project loaded.

A payload should record its format version and intended runtime/dependency versions. Pinning metadata is not enough to guarantee replay: the site also needs a way to supply those versions. Decide whether the product promises exact historical replay, best-effort migration, or downloadable recovery, and state the actual policy.

## ZIP downloads

Recommend a ZIP available for every project, not just oversized ones. It contains the actual current files, assets permitted for redistribution, a package manifest with compatible pinned versions, build configuration, and a short README with installation and run instructions. Include licenses/attribution where assets require them. Do not package repository-internal imports or site-only helpers.

The downloaded project must run outside the website. Verify it in a clean directory using the documented environment. If external assets cannot be included, disclose the limitation and provide an explicit setup step; prefer self-contained assets for the launch collection.

ZIP import is a separate possible feature. A download that runs locally satisfies the initial escape hatch without committing to project upload or browser storage.

## States the design must show

Design loaded and unmodified; edited; running; stopped; compile error; runtime error; missing browser capability; malformed shared URL; oversized share; copy succeeded/failed; ZIP export progress/failure; and unsaved replacement. These states should use ordinary language and preserve the user's code.

## First implementation slice

Later, start with one small public example in the full-page editor/preview layout. Demonstrate edit → Run → new preview → share → reopen, plus a runnable ZIP. Add native HTML and a Three showcase next to prove the same project model covers the collection. Do not promise “all examples load” until each published example passes that path.
