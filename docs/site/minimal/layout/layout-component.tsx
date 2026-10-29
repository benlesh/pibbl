import {
  Flex,
  Rectangle,
  Text,
  defineLayoutComponent,
  pibbl,
  type FlexStyle,
} from "@pibbl/core";

type CardProps = { label: string; style: FlexStyle };
const Card = defineLayoutComponent(({ label, style }: CardProps) => (
  <Flex style={{ ...style, flexDirection: "column", padding: 8 }}>
    <Text style={{ minHeight: 0, flexShrink: 0, wrap: true }}>{label}</Text>
  </Flex>
));

const canvas = document.createElement("canvas");
canvas.width = 280;
canvas.height = 120;
document.body.append(canvas);
const controller = await pibbl(
  canvas,
  <Flex style={{ width: 280, height: 120, flexDirection: "column", gap: 8 }}>
    <Card
      label="Inspectable layout description"
      style={{ minHeight: 0, flexShrink: 0 }}
    />
    <Rectangle
      style={{
        width: 280,
        height: 24,
        minHeight: 0,
        flexShrink: 0,
        fill: "#426b61",
      }}
    />
  </Flex>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
