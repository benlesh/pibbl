# Children, text, lists, and keys

CRC accepts recursive, synchronous child structures. Arrays and finite
synchronous iterables flatten recursively, so arbitrary interpolations can sit
beside ordinary elements:

```tsx
import { Fragment, Grid, Rectangle, Text, type CRCNode } from "@crc/core";

interface ResultsProps {
  items: readonly { id: number; label: string }[];
  showFooter: boolean;
}

function* extras(): Iterable<CRCNode> {
  yield (
    <Rectangle
      key="accent"
      style={{
        width: 20,
        height: 20,
        gridColumnStart: 1,
        gridRowStart: 1,
      }}
    />
  );
}

function Results({ items, showFooter }: ResultsProps): CRCNode {
  return (
    <Grid
      style={{
        width: 300,
        height: 200,
        gridTemplateColumns: [150, 150],
        gridTemplateRows: [50, 50, 50, 50],
      }}
    >
      {extras()}
      {items.slice(0, 4).map((item, index) => (
        <Text
          key={item.id}
          style={{
            gridColumnStart: (index % 2) + 1,
            gridRowStart: Math.floor(index / 2) + 2,
          }}
        >
          {item.label}
        </Text>
      ))}
      {showFooter && (
        <Text
          style={{ gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 4 }}
        >
          Done
        </Text>
      )}
    </Grid>
  );
}
```

Iterables must be finite. CRC materializes a receiving iterable once per render
or measurement operation so a generator is not consumed separately for layout
and paint. Arrays are the clearest reusable list form.

## Empty values and invalid container children

In a container or at the root, `false`, `true`, `null`, `undefined`, `""`,
`0`, and `-0` are empty and create no component slot. Non-empty strings and
nonzero numbers do not acquire an implicit Canvas position and are errors.

The contextual runtime form is:

```text
<Receiver> received <description> as a CRC child.
```

The complete invalid container categories are:

| Input                                       | Diagnostic description                 |
| ------------------------------------------- | -------------------------------------- |
| non-empty string                            | `a non-empty string`                   |
| nonzero number, including `NaN` or infinity | `a nonzero number`                     |
| function                                    | `a function`                           |
| symbol                                      | `a symbol`                             |
| Promise/thenable                            | `a Promise`                            |
| async iterable                              | `an async iterable`                    |
| unsupported primitive                       | `an unsupported <typeof> value`        |
| unsupported object                          | `an unsupported object`                |
| CRC element inside `Text`                   | `a CRC element inside textual content` |
| duplicate key after transparent flattening  | `duplicate CRC key "<key>"`            |

React-branded and other element-like objects receive the dedicated diagnostics
in [JSX troubleshooting](./jsx-troubleshooting.md). Unsupported categories
inside `Text` use the same contextual form.

## Text content

`Text` has a separate recursive content algebra. It accepts strings, numbers,
empty values, nested arrays, and finite synchronous iterables of those values,
then concatenates them exactly as JSX supplies them:

```tsx
const name = "Ada";
const greeting = (
  <Text style={{ x: 40, y: 80, fill: "black" }}>
    Hello {name} — {0} unread
  </Text>
);
```

Numeric zero renders as `"0"` inside `Text`, even though zero is empty in a
container. Booleans, `null`, and `undefined` add no text. Whitespace in literal
JSX text is compiler-controlled; use an explicit string when exact spacing
matters. A CRC element, Promise, async iterable, function, symbol, foreign
element, or unsupported object is invalid textual content. Text lives in
children, never in `TextStyle`.

`wrap`, `lineHeight`, optional `width`/`height`, and `fit` (`visible`,
`squish`, `ellipsis`, or `clip`) control layout and painting. Measurement and
paint share the same materialized content and text resolver.

## Fragments and keys

The shorthand `<>...</>` creates an unkeyed `Fragment`. Unkeyed fragments and
nested arrays are transparent: their children join the surrounding sibling
sequence and do not create a parent identity boundary.

Use the imported value for a keyed fragment:

```tsx
function groupSections(
  sections: readonly { id: string; elements: CRCNode }[],
): CRCNode {
  return sections.map((section) => (
    <Fragment key={section.id}>{section.elements}</Fragment>
  ));
}
```

A keyed fragment creates one identity scope for its descendants. Keys accept
strings and numbers, must be unique in the flattened sibling scope, and
preserve a same-parent component across reorder or insertion. Keys do not
preserve identity across parents. Unkeyed siblings of the same component type
use occurrence order.

Source order is paint order. Coordinate target selection walks that same order
in reverse, so the later overlapping target is topmost.

Executable coverage lives in
[`jsx-authoring.test.tsx`](../../packages/core/test/jsx-authoring.test.tsx) and
the learning catalog's mapped-list examples.
