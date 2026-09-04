/** @jsxImportSource @crc/core */
import { Group, Rectangle, Text, crc } from "@crc/core";

function Poster() {
  return (
    <Group>
      <Rectangle style={{ width: 240, height: 120, fill: "#2563eb" }} />
      <Text style={{ x: 16, y: 20, fill: "white" }}>JavaScript + JSX</Text>
    </Group>
  );
}

export function mount(canvas) {
  return crc(canvas, <Poster />);
}
