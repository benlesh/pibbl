# Responsive style queries — discussion draft

Status: exploratory; no API, implementation, or execution approval.
Started: 2026-09-28. Separate from the first-class visualization slice.

## Motivation

The CO₂ visualization is usable on desktop but compresses poorly on phones.
Casual mobile visitors need readable labels, controls that fit, and usable touch
targets. Recording this gap does not make a mobile redesign part of the current
visualization work. The broader opportunity is a general CRC styling mechanism
for adapting to available space and input capabilities.

## Direction to investigate

Support conditional local styles with a media-query-like authoring experience.
Prefer allocation-relative conditions for reusable components: a chart embedded
in a narrow Grid cell should adapt even on a wide desktop. Root viewport
conditions and input capabilities may be separate useful inputs. These are
recommendations to explore, not approved syntax or shipped behavior.

Candidate use cases:

- Stack controls or change Grid columns when the allocated width becomes small.
- Reduce label density and selectively hide secondary readouts.
- Increase interaction targets for coarse pointers without shrinking chart data.
- Adjust typography and spacing without hand-written breakpoint branches in
  every component.

## Decisions needed before an API proposal

1. What is queried: parent allocation, receiving element allocation, root
   logical viewport, CSS content box, or explicit named container?
2. Which initial conditions are worth supporting: width/height thresholds,
   aspect ratio, pointer precision, hover capability, reduced motion?
3. How are conditions authored and typed alongside closed, local styles?
   Avoid committing to CSS strings or a particular object syntax yet.
4. How do overlapping conditions compose, and which declaration wins?
5. When does evaluation happen relative to parent measurement and placement?
   A query must not create a cycle by changing the size it queries.
6. How do signal-valued styles, receiver-owned dependencies, and teardown work?
   Reuse the shared signal and scheduler contract.
7. Which conditions can be evaluated headlessly and in OffscreenCanvas/Layer
   contexts, and what deterministic defaults apply without a browser?
8. Does conditional structure belong in this facility or remain ordinary
   component code? Style queries alone will not solve all mobile interactions.

## Constraints

Preserve local styles, no cascade, pure measurement, allocation-relative layout,
and one scheduler. Do not introduce a browser-only layout authority or a second
reactive convention. Consult the implemented style, layout, signal, and canvas
surface contracts before proposing changes.

## Candidate first experiment (not authorized implementation)

Use one allocated component in a wide root, a narrow Grid cell, and a phone-sized
root. Demonstrate a change in control arrangement through the same public style
surface, then test both directions across a threshold, signal updates, and
cleanup. Use the CO₂ example as a motivating consumer, not a special case in the
styling API.

## Known visualization gap

The current desktop-first CO₂ example does not provide a satisfactory mobile
layout or a fully evaluated casual-touch experience. Readouts, controls, chart
height, brush handles, and endpoint labels need a dedicated mobile pass. This is
an accepted, deferred limitation of the visualization slice; responsive style
queries are one possible enabling tool, not a prerequisite that blocks it.
