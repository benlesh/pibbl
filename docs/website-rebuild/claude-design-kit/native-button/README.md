# Native HTML button with a reaction-diffusion background

This is the implemented first recipe. Its live counterpart is `/guides/native-button/` on the documentation site. There are no private helper imports and no dependency on Astro, Starlight, or a particular UI framework.

## Run the exact source

The package manifest records the checkout's version (`@pibbl/core` 0.0.1); do not assume npm's same version has these APIs. From the Pibbl repository, build and pack the actual runtime:

```sh
corepack pnpm@11.21.0 --filter @pibbl/core build
corepack pnpm@11.21.0 --filter @pibbl/core pack --pack-destination /tmp/pibbl-pack
```

In a shared copy of this `native-button` folder, install the resulting package and the dev tool, then run:

```sh
npm install /tmp/pibbl-pack/pibbl-core-0.0.1.tgz
npm run dev
```

Use the actual tarball filename from the pack command if the version changes. To use a published release later, first verify that its declarations and runtime include every import in `ink-button.js`. Run `npm run build` to check the standalone bundle.

## Files and connection

- `index.html` defines the native button and a decorative sibling canvas. The button is the only interactive target.
- `button.css` positions the canvas to match the native button, prevents pointer interception, supplies fallback color, and preserves focus/disabled styling.
- `ink-button.js` exports application-owned `mountInkButton(button, canvas)`. It owns the Pibbl controller, state signal, media query listener, attribute observer, and intersection observer. Its return value exposes `update()` and idempotent `dispose()`.
- `main.js` wires the demonstration's ordinary click count and two checkboxes. Your real application keeps its existing action handler instead. It also shows page lifecycle and development cleanup.

The module runs after its DOM exists. State changes update one signal; `useReaction` sends pause/paint messages to the persistent hook-owned texture. No synthetic clicks, event cancellation, duplicate Canvas target, or extra animation loop is introduced.

## Sizing and effect details

The native button's padding and content determine its CSS size. Its positioned canvas fills that rectangle. `viewport: 'responsive'` lets Pibbl follow the CSS content box, and `useLayoutBox()` sizes the Rectangle. The initial backing density is capped at two; remount if your application needs a different density policy. Simulation resolution remains 128 by 48 cells independently of CSS size.

Seed 42 and preset `stripes` are deterministic inputs. The palette contains four supported hex colors. Pointer movement stirs the existing ink and paints a small trail. Clicking creates a ring-shaped burst with outward displacement; keyboard activation centers it. The ring uses texture-cell coordinates, and pointer positions are normalized against the button's CSS bounding rectangle. This is an evolving ink disturbance, not a physical water ripple. Hover/focus also seeds the field. The effect pauses when reduced motion, disabled state, document visibility, or intersection requires it. Reduced motion suppresses all interaction disturbances and shows a static field. Toggle Enable effect off to remove Canvas presentation altogether.

## Lifetime and fallback

Call `dispose()` before removing the host or moving it into a different fieldset ancestry. It aborts listeners, disconnects both observers, disposes Pibbl (which releases the texture), and hides the canvas. For a framework/router, use its normal unmount cleanup; the `pagehide` demonstration is not a replacement for route cleanup. Repeated disposal is safe. A fresh mount supports re-entry.

If mounting throws, the bridge cleans up what it owns and the host keeps its CSS fallback. Loading failure does not prevent an existing native form from submitting. This demonstration's click counter requires JavaScript, like any application handler; the decorative effect never owns that action.

The texture needs the actual runtime's WebAssembly/offscreen capabilities. Test your target browsers. No external images or fonts are required. One small field is appropriate for the proof; a grid of independent simulations needs measurement and a separate resource plan.
