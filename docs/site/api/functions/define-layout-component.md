---
id: api-function-define-layout-component
title: defineLayoutComponent
summary: Defines reusable pure structure for intrinsic layout preparation.
kind: api
slug: define-layout-component
apiCategory: function
symbols: [defineLayoutComponent]
relatedTypes: [PibblComponent, PibblNodeInput]
---

# defineLayoutComponent

```ts
import { defineLayoutComponent } from "@pibbl/core";
```

`defineLayoutComponent(describe)` defines reusable pure structure that a layout
parent can inspect before allocating it. It returns a [PibblComponent](#/api/types/elements-components#pibblcomponent) for JSX
or `createElement`. Its result is [PibblNodeInput](#/api/types/elements-components#pibblnodeinput):

```tsx
import {
  Flex,
  Rectangle,
  Text,
  defineLayoutComponent,
  type FlexStyle,
} from "@pibbl/core";

type CardProps = { title: string; style: FlexStyle };
const Card = defineLayoutComponent(({ title, style }: CardProps) => (
  <Flex style={{ ...style, flexDirection: "column", padding: 8 }}>
    <Text style={{ minHeight: 0, flexShrink: 0, wrap: true }}>{title}</Text>
  </Flex>
));

export function CardExample() {
  return (
    <Flex style={{ width: 240, height: 220, flexDirection: "column", gap: 12 }}>
      <Card
        title="A reusable title that can wrap"
        style={{ width: 224, minHeight: 0, flexShrink: 0 }}
      />
      <Rectangle
        style={{
          width: 240,
          height: 24,
          minHeight: 0,
          flexShrink: 0,
          fill: "#426b61",
        }}
      />
    </Flex>
  );
}
```

The callback receives readonly authored props and returns one drawing or layout
primitive root, optionally inside transparent fragments. Forward a `style` prop
explicitly when your component exposes one. Existing signal reads are allowed;
hooks, Canvas access, allocation reads, signal writes and resource creation are
excluded. State and owned resources belong in an ordinary parent component.

One prepared description is shared by measurement and painting within the current
render transaction. Later transactions prepare again, so nested mutable props are
never assumed unchanged merely because their outer identity is stable. The Card
and its returned root retain their ordinary type/key identity and cleanup rules.
An ordinary component remains opaque to intrinsic measurement.

This initial capability uses existing measurement support: a finite-width nowrap
column containing wrapped Text is supported in the experimental layout lane.
Other intrinsic structures retain contextual unsupported-measurement diagnostics;
this does not enable general CSS sizing or switch the production layout engine.
