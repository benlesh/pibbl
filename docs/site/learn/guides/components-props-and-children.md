---
id: guide-components-props-children
title: Understand components, props, and children
summary: Compose synchronous Pibbl components with clear props, recursive children, fragments, lists, and stable keys.
kind: guide
slug: components-props-and-children
order: 30
keywords: [components, props, children, fragments, lists, keys]
---

# Understand components, props, and children

Pibbl components are ordinary synchronous TypeScript or JavaScript functions.
The function itself is runtime identity. No wrapper, registration call, class,
or JSX-specific component base is required.

```tsx
import { Group, Rectangle, Text, type PibblNode } from "@pibbl/core";

interface CardProps {
  title: string;
  selected: boolean;
  onSelect: () => void;
}

function Card({ title, selected, onSelect }: CardProps): PibblNode {
  return (
    <Group>
      <Rectangle
        style={{
          width: 180,
          height: 96,
          fill: selected ? "#f7c948" : "#1f4bd8",
          cursor: "pointer",
        }}
        onClick={onSelect}
      />
      <Text pointerEvents="none" style={{ left: 16, top: 20, fill: "white" }}>
        {title}
      </Text>
    </Group>
  );
}
```

`title`, `selected`, and `onSelect` are behavioral or application props.
`children` is declared only by components that accept it. `key` is construction
metadata: Pibbl normalizes strings and numbers to a string and never delivers it
in props.

Drawing components participate in coordinate targeting by default. The card's
decorative `Text` uses `pointerEvents="none"` so its glyph bounds do not hide
the clickable rectangle behind it.

Call a component through JSX or `createElement`; a direct JavaScript call does
not create a Pibbl element or establish render context. For the closed local
style language, drawing geometry, filters, and shape options used by built-ins,
see [Style and draw](#/learn/guides/style-and-draw).

## Signal-valued props belong to receivers

Pibbl-provided components accept `T | Signal<T>` at declared reactive input
positions. Passing the signal object makes the receiving component the
consumer; passing `signal.get()` makes the enclosing component the consumer.

Custom components opt in explicitly:

```tsx
import { resolveSignalValue, type SignalValue } from "@pibbl/core";

function CardTitle({ title }: { title: SignalValue<string> }) {
  const resolvedTitle = resolveSignalValue(title);
  return <Text>{resolvedTitle}</Text>;
}
```

`resolveSignalValue()` reads at most one signal. It does not inspect arbitrary
objects or arrays. If an API intentionally needs the signal object itself,
declare that exact type—for example `valueSignal: WritableSignal<number>`—and
do not resolve it.

## Recursive children

Pibbl accepts recursive, synchronous child structures. Arrays and finite
synchronous iterables flatten recursively, so ordinary elements, conditionals,
and mapped lists can sit beside one another. Iterables must be finite: Pibbl
materializes a receiving iterable once per render or measurement operation, and
does not promise to detect infinite iterables.

At the root or in a container, `false`, `true`, `null`, `undefined`, `""`,
`0`, and `-0` are empty and create no component slot. Non-empty strings and
nonzero numbers have no implicit Canvas position and are errors. Put textual
values inside `Text` instead.

## Text content

`Text` has a separate recursive content algebra. It accepts strings, numbers,
empty values, nested arrays, and finite synchronous iterables, then
concatenates them exactly as JSX supplies them. Numeric zero renders as `"0"`
inside `Text`, while booleans, `null`, and `undefined` add no text. A Pibbl
element, Promise, async iterable, function, symbol, foreign element, or
unsupported object is invalid textual content.

Text input also accepts signals at positions in that declared grammar:

```tsx
<Text>{["Value: ", valueSignal, " — ", labelSignal]}</Text>
```

Traversal resolves those direct entries. A signal whose value is itself an
array containing signals is resolved once; Pibbl does not recursively unwrap the
signals hidden inside the returned application value.

`wrap`, `lineHeight`, optional `width`/`height`, and `fit` (`visible`,
`squish`, `ellipsis`, or `clip`) control text layout and painting. Measurement
and paint share the same materialized content and text resolver.

## Fragments and keys

The shorthand `<>...</>` creates an unkeyed `Fragment`. Unkeyed fragments and
nested arrays are transparent, so their children join the surrounding sibling
sequence. Use the imported `Fragment` value for a keyed fragment:

```tsx
import { Fragment, type PibblNode } from "@pibbl/core";

function groupSections(
  sections: readonly { id: string; elements: PibblNode }[],
): PibblNode {
  return sections.map((section) => (
    <Fragment key={section.id}>{section.elements}</Fragment>
  ));
}
```

A keyed fragment creates an identity scope for its descendants. Keys accept
strings and numbers, must be unique in the flattened sibling scope, and
preserve a same-parent component across reorder or insertion. They do not
preserve identity across parents; unkeyed siblings of the same component type
use occurrence order.

Source order is paint order. Coordinate target selection walks that same order
in reverse, making a later overlapping target topmost. See [Manage state and
lifecycle](#/learn/guides/state-and-lifecycle) for the wider identity and
cleanup model.
