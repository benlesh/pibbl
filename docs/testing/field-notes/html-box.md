# HtmlBox implementation field notes

## 2026-10-02 — first public slice

Environment: Node 24.15.0 through fnm, pnpm 11.21.0, Playwright Chromium
151.0.7922.34 on macOS. Browser plugin not available; used the repository
Playwright/Vitest setup. Chromium requires sandbox escalation for its macOS
Mach port registration; the first sandboxed launch failed before executing tests.

Plan review questioned outgoing sentinel Tab and SVG clip definition intersection.
A real browser prototype proved both mechanisms: unprevented Tab from a keydown
that focuses the outgoing sentinel reaches the adjacent external control in one
key, forward and backward. A clipPath with its own clip-path reference restricts
hit testing to the intersection. Retain browser evidence for those mechanisms.

Initial public test failed because HtmlBox did not exist, before production code.
Parallel focus editing temporarily made the Studio documentation compile fail;
a temporary config outside the repository disabled only that docs plugin while
iterating. Final integrated checks below use the normal repository configuration.

`vitest run packages/core/test/html-box.test.tsx
packages/core/test/html-box-layers.test.tsx packages/core/test/html-box-focus.test.tsx
packages/core/src/lib/focus --browser.headless --browser.ui=false` passed 158 tests
in 15 files. This is first integrated evidence, not the final trust gate.

The copyable lesson runs at `#/examples/composition/html-box`. The local review
server is http://127.0.0.1:5176/. Desktop browser verification at 1440x1000 checked
page identity, meaningful content, no runtime/editor error overlay, zero page
errors, typed “Hello CRC”, clicked its native button, and rotated it through the
Canvas control. Text and click count survived. Screenshot evidence was inspected
at `/private/tmp/crc-html-box-working.png`, outside committed source.

Manual review: open the lesson; type in the labelled input; click the native
counter; press Rotate, Move and Scale; verify curved clipping and retained text.
Tab forward/backward across Canvas controls and both native controls. Native
arrows should edit text, not move CRC focus. Disposal restores the supplied canvas
and removes owned hosts/clips/listeners.

Tests initially exposed incorrect test assumptions: CRC explicit box dimensions
are content dimensions plus padding (100 + 10 yields a 110 border box), and blur
uses an options object. Those expectations were corrected to existing contracts.
The shared lesson is driven headlessly using an actual native click.

Final hardening, review dispositions, aggregate evidence and commit are pending.
