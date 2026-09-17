import {
  crc,
  useLayoutBox,
  useState,
  Flex,
  Rectangle,
  Text,
  type BoxStyle,
  type CRCController,
  type FlexItemStyle,
} from "@crc/core";

interface FlexCardProps {
  onSelect: () => void;
  side: "left" | "right";
  style: BoxStyle & FlexItemStyle;
}

function FlexCard({ onSelect, side, style: _specifiedStyle }: FlexCardProps) {
  const box = useLayoutBox();

  return (
    <Rectangle
      style={{
        width: box.width,
        height: box.height,
        fill: side === "left" ? "#1f4bd8" : "#ff6b57",
        stroke: "#17211d",
        strokeWidth: 4,
        cursor: "pointer",
      }}
      onClick={onSelect}
    />
  );
}

function FlexStudy() {
  const [active, setActive] = useState<"left" | "right">("left");
  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Flex
      style={{
        width: 560,
        height: 260,
        padding: 80,
        gap: 18,
        alignItems: "center",
      }}
    >
      {(["left", "right"] as const).map((side) => (
        <FlexCard
          key={side}
          onSelect={() => setActive(side)}
          side={side}
          style={{
            width: 170,
            height: active === side ? 190 : 140,
            minWidth: 90,
            flexBasis: 170,
            flexGrow: active === side ? 2 : 1,
            flexShrink: 1,
          }}
        />
      ))}
    </Flex>,
    <Text
      style={{
        x: 360,
        y: 54,
        fill: "#17211d",
        font: "900 20px sans-serif",
        textAlign: "center",
      }}
    >
      {"GROW · SHRINK · ALIGN"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <FlexStudy />);
}
