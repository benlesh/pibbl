# JSX troubleshooting

Start by checking that the file uses the automatic CRC runtime. Project-wide
TypeScript should set `"jsx": "react-jsx"` and
`"jsxImportSource": "@crc/core"`; a mixed project can put
`/** @jsxImportSource @crc/core */` before imports in a CRC file.

Development JSX records source filename, line, and column through `jsxDEV`.
When available, CRC appends that location to child, component, and style
diagnostics. Production descriptors omit it.

## Compile-time diagnostics

| Symptom                                                                  | Meaning and correction                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Cannot find `@crc/core/jsx-runtime` or `jsx-dev-runtime`                 | Install a current `@crc/core`, use package exports, and do not alias a private source path.                     |
| Lowercase tag is missing from `JSX.IntrinsicElements`                    | CRC has no intrinsic HTML tags. Import and use a descriptive uppercase component.                               |
| A Promise-returning or `async` component is not a valid JSX element type | CRC components are synchronous. Resolve data outside the render and schedule an ordinary update.                |
| A React element is not assignable to `CRCNode`                           | The file or value belongs to another renderer. Split the files or use the minority tree's explicit constructor. |
| Property `children` does not exist                                       | The drawing leaf rejects children. Put siblings in `Group`, another container, or a fragment.                   |
| A CRC element is not assignable to `CRCTextChild`                        | `Text` accepts scalar textual content, not components. Move the element outside `Text`.                         |
| Required `style` or a required style member is missing                   | Supply the component's closed local style.                                                                      |
| `key` or `style` makes custom program props invalid                      | Those names are reserved construction/primitive metadata; rename the application prop.                          |
| Percentage-capable primitive style requires `resolveStyle`               | `definePrimitive` must resolve allocation syntax to a finite resolved type.                                     |

CRC does not install a global JSX namespace. Editor types must resolve the
module-scoped namespace from the compiler entry. If an editor shows React
intrinsics in a CRC-only file, inspect that file's compiler configuration and
restart its TypeScript project after correcting it.

## Exact runtime diagnostics

### React runtime selected

```text
CRC received a React element. This file is using the React JSX runtime.
Set jsxImportSource to "@crc/core" or add /** @jsxImportSource @crc/core */.
Received by <receiver>.
```

This can occur at the root or in nested content. Correct the file's JSX runtime
or move the React and CRC JSX to separate files.

### Other foreign element descriptor

```text
<receiver> received an element-like object that was not created by @crc/core as a CRC child.
Check this file's JSX runtime and set jsxImportSource to "@crc/core".
```

Do not forge or spread a descriptor. Use JSX or `createElement`, both of which
install CRC's stable `Symbol.for("@crc/core.element")` runtime brand.

### Direct platform-component call

```text
Rectangle is a CRC component and was invoked outside the CRC renderer.
Use <Rectangle ... /> in a CRC JSX file or createElement(Rectangle, props).
```

The name changes to the invoked component. A platform component value describes
work only when used as an element type; it is not a callable factory.

### Invalid child

```text
<receiver> received <description> as a CRC child.
```

Descriptions are exact: `a non-empty string`, `a nonzero number`, `a function`,
`a symbol`, `a Promise`, `an async iterable`, `an unsupported <typeof> value`,
`an unsupported object`, `a CRC element inside textual content`, or
`duplicate CRC key "<key>"`. Put raw text/numbers inside `Text`, await outside
rendering, use finite synchronous lists, and give flattened siblings unique
keys.

### Policy child count and configuration

```text
FocusManagement requires exactly one CRC element child after empty values are removed; received <count>.
KeyboardNavigation requires exactly one CRC element child after empty values are removed; received <count>.
KeyboardNavigation mode must be "directional".
KeyboardNavigation requires an active FocusManagement focus manager.
```

Keep one component element beneath each transparent policy and nest
`KeyboardNavigation` inside `FocusManagement`. Duplicate applications also
report that the same policy cannot be applied more than once to one element.

### Render-context access

```text
CRC hooks can only be called while rendering a component.
crcCanvasContext() is available only during CRC rendering and cannot be used during pure measurement.
No CRC layout context is available
```

Create elements instead of directly invoking components. Keep hooks and render
accessors in synchronous component rendering, and keep primitive measurement
pure.

### Layout diagnostics

`LayoutDiagnostic` has this stable shape:

```text
<component>: property <property> received <value> during <algorithm>; constraints <constraints>; <reason>
```

The error object also exposes `component`, `property`, `suppliedValue`,
`algorithm`, and `constraints`. Correct the named non-finite, unsupported,
unresolved, or out-of-range value rather than coercing it after resolution.

Focused source and built coverage lives in
[`foreign-runtime-diagnostics.test.tsx`](../../packages/core/src/lib/element/foreign-runtime-diagnostics.test.tsx).
