# Canvas accessibility guidance

CRC logical focus is not screen-reader semantics. Adding
`withFocusManagement` makes explicit Canvas targets operable through a shared
keyboard focus host; it does not give those targets DOM roles, accessible
names, states, relationships, text selection, or screen-reader announcements.
It does not make a Canvas application accessible by itself.

## What the application owns

When meaningful information or operations exist only in Canvas pixels, the
application must provide an equivalent semantic experience. Use the
application framework or DOM strategy already appropriate to the product. CRC
does not require a framework and does not prescribe a persistent DOM descendant
for every drawn target.

The application-owned experience should expose:

- meaningful names, roles, descriptions, states, values, and relationships;
- the same important data conveyed visually, not only a prose description of
  the drawing;
- equivalent operations for every meaningful Canvas action;
- native editable controls and text selection where editing is part of the
  task;
- announcements or status updates when users need them to understand change;
- an accessible name and concise usage instructions for the Canvas whenever it
  remains a keyboard interaction surface.

Canvas fallback content may be a useful host for the alternative DOM. A nearby
or mode-switched semantic view can also be appropriate. The right structure
depends on the application's information and workflow, not on CRC internals.

## Synchronize one product state

Treat the Canvas and semantic alternative as two presentations of the same
application model. Names, values, selected state, disabled state, ordering,
validation, results, and available operations must stay synchronized in both
directions. A change made through the Canvas should be observable through the
alternative, and an equivalent DOM action should update the Canvas.

Do not infer semantic state from pixels after painting. Keep that state in the
application model and render both experiences from it. Likewise, do not use
CRC's opaque logical target object as a semantic identifier; use stable
application-owned IDs and labels.

## Avoid duplicate keyboard paths

A Canvas focus host and a simultaneously tabbable semantic alternative can
create duplicate or invisible keyboard stops for the same operation. Decide
which surface participates in the active keyboard experience and make the
other representation noncompeting or clearly distinct. Do not leave hidden
interactive controls in the Tab order, and do not require users to traverse
the same logical operation twice.

This does not mean that only one representation may exist. A visual Canvas and
a semantic DOM view may coexist when their purpose and focus behavior are
clear. The application owns entry, exit, focus restoration, view switching,
and announcements across those surfaces; CRC does not silently merge
application DOM into its logical focus index.

## Prefer equivalent operations over a DOM mirror

A one-node-per-pixel-object mirror is rarely the goal. Build the semantic
structure users need to complete the task. A chart may need a heading, summary,
data table, and controls. A diagram may need a structured list of nodes and
relationships plus the same editing actions. A game or spatial editor may need
an alternative interaction mode. The useful semantic grouping may differ from
the Canvas paint tree while still representing the same information and
operations.

CRC intentionally does not generate persistent semantic descendants, assign
ARIA roles, maintain `aria-activedescendant`, mutate hidden Canvas text, or
repeatedly refocus generated DOM for announcements. Those choices require
application semantics that a general Canvas runtime cannot safely infer.

## Practical review checklist

Before shipping a focus-managed Canvas experience, verify that:

- the Canvas has an appropriate accessible name and instructions if keyboard
  users can enter it;
- every meaningful visual state and operation has a semantic equivalent;
- names, roles, values, relationships, and results are synchronized;
- DOM controls are used for editing, selection, and form behavior where native
  semantics matter;
- focus entry, exit, restoration, and visible indication are predictable;
- the Canvas and alternative do not expose duplicate keyboard paths;
- pointer-only gestures have keyboard and semantic alternatives;
- the experience works with the product's supported keyboard and assistive
  technology combinations.

The [focus and keyboard-navigation contract](./focus-and-keyboard-navigation-contract.md)
defines CRC's logical interaction behavior. Accessibility remains a product
responsibility shared by application design, semantics, content, and testing.
The Studio focus and editing-transport lessons make this boundary visible in
their code and Canvas copy; they are interaction examples, not substitutes for
application-specific semantic alternatives or assistive-technology testing.
