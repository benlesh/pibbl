---
id: api-types-signal-inputs
title: Signal-valued inputs
summary: Plain-or-signal input types and the declared shallow resolution contract.
kind: api
slug: signal-inputs
apiCategory: types
typeDomain: signal-inputs
symbols: [SignalValue]
keywords: [signals, props, style, children, inputs, ownership]
---

# Signal-valued inputs

CRC-provided components accept signals wherever reactive replacement is
meaningful: drawing and layout geometry, style fields, text, animation inputs,
and applicable official WebGL, particles, physics, and visualization inputs.
Plain values take the same direct path as before.

## SignalValue

`SignalValue<T>` is `T | Signal<T>`. A receiving component resolves the input
and therefore owns its dependency:

```tsx
import {
  Rectangle,
  Text,
  resolveSignalValue,
  useSignal,
  type SignalValue,
} from "@crc/core";

const left = useSignal(10);
const color = useSignal("red");
const label = useSignal("Current");

<Rectangle style={{ left, fill: color, width: 50, height: 50 }} />;
<Text>{label}</Text>;
```

Passing `left.get()` remains valid. That explicit read intentionally makes the
enclosing component the consumer and passes a plain number downstream.

### Declared, shallow resolution

Resolution follows each component's published input schema. CRC can resolve a
whole-object signal such as `style={styleSignal}` or individual declared fields
such as `style={{ left: xSignal }}`. Text and structural child grammars resolve
signals encountered while walking their own declared arrays and finite
iterables.

CRC never recursively searches arbitrary application data. A signal inside a
dataset row, event payload, callback closure, custom metadata object, or nested
descriptor is ordinary application data unless that exact descriptor schema
explicitly opts into a shallow signal-valued field. A signal returned by
another signal is not unwrapped again.

Event handlers and callbacks are selected as values and are not invoked by
input resolution. APIs that intentionally require the signal object itself use
an exact prop such as `valueSignal: WritableSignal<T>` rather than
`SignalValue<WritableSignal<T>>`.

### Custom receivers

Use [`resolveSignalValue`](#/api/functions/resolve-signal-value) at the declared
boundary of an ordinary custom component:

```tsx
interface Point {
  readonly x: number;
  readonly y: number;
}

interface SeriesProps {
  data: SignalValue<readonly Point[]>;
}

function drawSeries(data: readonly Point[]) {
  return <Text>{data.length}</Text>;
}

function Series(props: SeriesProps) {
  const data = resolveSignalValue(props.data);
  return drawSeries(data);
}
```

The helper resolves exactly one plain-or-signal value. It performs no wrapper
allocation and no deep inspection. Call it while the receiving component is
evaluating so CRC attributes the dependency to that component.

Layout and pure measurement preserve the same ownership rule. Mounted layout
prepasses transfer declared reads to the eventual receiving child; standalone
`measureElement()` reads untracked and creates no persistent consumer.
