# CRC (Canvas Rendering Components)

A lightweight component system for the HTML5 Canvas.

## Features

- 🎨 Component-based Canvas rendering
- ⚡️ Fast, optimized updates
- 📦 Small footprint (~XXXXkb gzipped)
- 🔄 Simple state management
- 🎯 Event handling
- 📐 Layout helpers

## Quick Start

```javascript
import { Canvas, Circle } from '@crc/core';

function App() {
  return (
    <Canvas width={400} height={400}>
      <Circle x={200} y={200} radius={50} fill="blue" />
    </Canvas>
  );
}
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [API Reference](docs/api.md)
- [Examples](docs/examples.md)

## Examples

- [Basic Shapes](examples/basic-shapes)
- [Interactive Components](examples/interactive)
- [Game Development](examples/game)
- [Data Visualization](examples/dataviz)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Your Name]
