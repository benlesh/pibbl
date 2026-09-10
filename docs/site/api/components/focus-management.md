---
id: api-component-focus-management
title: FocusManagement
summary: Opts a CRC subtree into logical Canvas focus management.
kind: api
slug: focus-management
apiCategory: component
symbols: [FocusManagement]
---

# FocusManagement

```ts
import { FocusManagement } from "@crc/core";
```

`FocusManagement` uses `FocusManagementProps` and wraps one recursive
`CRCNode` subtree. It installs the Canvas as the only native focus host and
adds logical focus events, source-order Tab traversal, press focus, activation,
and focus-visible modality. It does not generate semantic DOM or an
accessibility tree.

```tsx
<FocusManagement>
  <Button />
</FocusManagement>
```

Try [Focus and keyboard].
