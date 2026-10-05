---
id: api-function-degrees
title: degrees
summary: Converts finite degree angles to radians.
kind: api
slug: degrees
apiCategory: function
symbols: [degrees]
---

# degrees

`degrees(value)` converts a finite degree angle to radians. Manipulation rotation uses radians, while existing `Group.rotationDegrees` keeps its degree units.

```ts
import { degrees } from "@pibbl/core";

const angleStep = degrees(15);
```
