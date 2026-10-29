import {  Group, Rectangle, Text } from "@pibbl/core";
import { pibblSync } from '@pibbl/core/sync';
import {
  backdropContrast,
  type PibblBackdropContrastFilterOptions,
} from "@pibbl/core/filters";
const colors: PibblBackdropContrastFilterOptions = {
  light: "white",
  dark: "black",
};
export function BackdropContrastExample() {
  return (
    <Group>
      <Rectangle style={{ width: 640, height: 300, fill: "#f8f6f0" }} />
      <Rectangle
        style={{ left: 200, width: 300, height: 300, fill: "#263d43" }}
      />
      <Text
        style={{
          left: 100,
          top: 100,
          font: "bold 44px sans-serif",
          fill: "black",
          filter: backdropContrast(colors),
        }}
      >
        Light meets dark
      </Text>
    </Group>
  );
}

// Minimal-runtime pages execute their module directly.
const canvas = document.createElement("canvas");
canvas.width = 640;
canvas.height = 300;
document.body.append(canvas);
const controller = pibblSync(canvas, <BackdropContrastExample />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
