# From concept to working Pibbl

## Implementation procedure

1. Mark the native HTML owner, Canvas region, optional external renderer, and all assets on the concept. Decide who owns layout and interaction before choosing an API.
2. Map each visual behavior to a verified public API and a complete working example. Label unsupported ideas as questions. A plausible function name is not evidence.
3. Start with this kit's native button unchanged. Confirm native behavior, resize, effect removal, and reduced motion before modifying its visual treatment.
4. Change one visible property at a time: palette, scale, wrapper size, then interaction response. Preserve public import paths and the lifecycle contract.
5. Keep semantic copy and controls in HTML. Use Pibbl only where it adds a visual behavior worth its resource cost.
6. Run the actual result and compare native state and geometry before evaluating screenshots. Report target browser, viewport, tested interactions, remaining uncertainty, and required assets.
7. Bring the first site and button back for feedback before adding roadmap recipes. Keep the original content relationships and Markdown exports intact throughout redesign.

## Review checklist

- Native interaction: pointer, Enter, and Space activate the original control exactly once. Submit buttons still submit their original form. Disabled buttons and disabled fieldsets prevent activation. No synthetic Canvas action duplicates the native action.
- Focus and readability: one focus target, a visible focus outline, a stable readable label, selectable article text, readable code, and sufficient text contrast over every animation state. Do not animate the label's legibility.
- Responsive sizing: no horizontal page overflow at narrow widths; canvas bounds match the intended host; logical coordinates, simulation cells, and backing pixels are not confused. Test resize and a zero-sized/hidden host.
- Motion: reduced motion is respected at startup and when the setting changes. Pause advancement when hidden/offscreen. Preserve a useful static state and an explicit effect-off path.
- Failure: remove/disable the canvas, block enhancement loading, and test unsupported capability behavior. Meaningful HTML, actions, captions, and images must remain useful.
- Performance: one bounded simulation for this proof, an explicit resolution and pixel-density policy, no second frame loop, and no unmeasured multiplication across cards. Qualitative cost is not a measured frame-rate claim.
- Cleanup: remove/remount repeatedly. Abort listeners, disconnect observers, dispose Pibbl, and dispose application-created external resources. A route change must not leave a simulation running.
- Composition: HTML is not captured or Canvas-filtered. HtmlBox remains above Canvas. A Three layer is one flattened boundary. Use full-page screenshots to capture HTML plus Canvas.
- Assets: list the exact images/fonts/models, rights, dimensions, load state, fallback, and cross-origin needs before implementation. Never label a concept image as a verified runtime screenshot.
- Documentation: ordinary URLs work without JavaScript; every published entry has useful content, source/related links, version context, and its Markdown counterpart. Unimplemented concepts remain visibly labeled.
