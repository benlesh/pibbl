# API documentation directives

Draft editorial standard for the rewrite. Reference pages should answer a developer's immediate question with correct imports, a short contract, and code they can run. They should not repeat a tutorial, a showcase, or the internal architecture document.

## Instructions for a documentation author

Read the current public export, declaration, relevant implementation, tests, and implemented contract before writing. Confirm the import path. Do not infer behavior from a historical design or an example that happens to work. Document user-observable behavior, with lifecycle and ownership rules where they affect correct use.

Start with the symbol and a one-sentence description in plain language. Show a minimal useful snippet near the top. Use the same terminology as nearby pages. Prefer direct descriptions such as “Changes the target value” over feature praise.

## Page template

1. **Name and purpose.** What this symbol does and when to use it.
2. **Import and signature.** Supported package entry; relevant generic parameters only when useful.
3. **Minimal example.** One operation with a visible or inspectable result and a Try in playground link.
4. **Parameters or props.** Type, required/optional status, default, accepted values, units, and signal support where applicable.
5. **Return value or rendered result.** What the caller receives or what appears.
6. **Behavior that matters.** Updates, identity, errors, ownership, cleanup, and limitations relevant to this API.
7. **Related material.** A few precise API links, a conceptual guide, and a focused example when available.

Omit empty sections. For simple helpers, the entire page can be short. For lifecycle APIs such as `defineRenderLayer`, the behavior section must be long enough to prevent incorrect resource ownership. Concision must not remove the contract.

## Snippet standard

Target roughly 5–25 meaningful lines for the visible idea. This is an editorial target, not a linter threshold. Count honestly: a hidden custom helper containing the concept is still part of the example's complexity.

Every Try in playground action opens an exact runnable counterpart with imports, setup, required files/assets, and cleanup. The page may display an excerpt, but must label it as an excerpt and let readers see the complete source. Do not imply an excerpt alone can be pasted into an empty file and run.

Use named snippet IDs and one source of truth for the rendered code and runnable project. Give multiple snippets on a page distinct actions that open the corresponding example, rather than routing all buttons to a generic lesson.

Use actual supported public APIs. Avoid repository aliases, private helpers, lab harnesses, imaginary configuration, and stale package names. Choose a simple visible outcome instead of an event log unless the event log is what the API teaches. Types and nonvisual helpers can use a small inspector or console result; they do not need artificial animation.

## Reference details that must be explicit

- Distinguish omitted, zero, empty, and default values when behavior differs.
- State coordinate spaces and units for positions, time, angles, and texture brushes.
- Identify which inputs accept signals. Do not imply all nested data unwraps automatically.
- Say which owner creates, updates, and disposes a resource.
- Explain when a write or callback occurs if timing affects application behavior.
- Link shared style/event/type contracts instead of copying huge type tables onto every page.
- Document browser requirements close to the APIs that need them.
- Keep unsupported behavior separate from a promise of future support.

For HTML, explain native semantics, explicit layout allocations, and overlay ordering. For Three, show normal Three resources and explicit disposal; do not invent CRC mesh components. For effects, distinguish changes to pixels from changes to hit geometry.

## Example outline for a signal page

Opening: “Creates a writable value that components can read and update.”

Show a small interaction where activating a control changes a signal and visibly changes a rectangle. The snippet demonstrates the read and write directly. Follow with signature, equality behavior, `get`, `set`, `update`, readonly views, and receiver-owned signal inputs. Link to the signals guide for dependency tracking and scheduler explanations.

This is a content outline, not proposed replacement code. During the rewrite, extract the exact runnable snippet from a public example and verify it against the current runtime.

## Review checklist

- Can a reader find the import, basic use, and important constraint without a long introduction?
- Does the reference cover the real public signature, default values, and return semantics?
- Does every runnable action open the code displayed, with the required environment?
- Does the snippet survive a meaningful edit rather than only its initial state?
- Are ownership and timing rules present where a mistake could leak or misbehave?
- Are links and anchors stable, and related types discoverable?
- Has public export coverage been checked so less glamorous APIs are not omitted?

Later implementation should typecheck and run snippets from their canonical source. Generated signatures can help prevent drift, but prose must still explain the contract. Do not turn this planning phase into a documentation generator project.
