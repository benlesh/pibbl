import {
  Group,
  Rectangle,
  Text,
  crc,
  useSignal,
  type CRCController,
  type CRCNode,
} from "@crc/core";
import {
  PieLayout,
  PieSlice,
  PieLabel,
  HoverCard,
  type PieSliceGeometry,
  type PieLayoutSlice,
  type PieLayoutProps,
  type PieLabelPlacement,
} from "@crc/viz";
// Illustrative survey data, not real-world statistics. Both samples total 100.
const balanced = [
  { id: "walk", label: "Walk", value: 35, color: "#2878b5" },
  { id: "bike", label: "Bike", value: 25, color: "#b86619" },
  { id: "transit", label: "Transit", value: 30, color: "#357459" },
  { id: "car", label: "Car", value: 10, color: "#855896" },
];
const tiny = [
  { ...balanced[0], value: 46 },
  { ...balanced[1], label: "Bicycle share", value: 2 },
  { ...balanced[2], label: "Community shuttle", value: 1 },
  { ...balanced[3], value: 48 },
  { id: "ferry", label: "Local ferry", value: 2, color: "#496d89" },
  { id: "accessible", label: "Accessible transit", value: 1, color: "#986448" },
];
type Datum = (typeof balanced)[number];
const label = (slice: PieSliceGeometry<Datum>) =>
  `${slice.datum.label} · ${Math.round(slice.fraction * 100)}%`;
function LabelledPie({
  cards,
  data,
  placement,
  bounds,
  style,
  children,
}: {
  cards: boolean;
  data: PieLayoutProps<Datum>["data"];
  placement: PieLayoutProps<Datum>["placement"];
  bounds: PieLayoutProps<Datum>["bounds"];
  style: PieLayoutProps<Datum>["style"];
  children: (slice: PieLayoutSlice<Datum>) => CRCNode;
}) {
  return cards ? (
    <PieLayout
      data={data}
      value="value"
      keyBy="id"
      labelBox={() => ({ width: 120, height: 38 })}
      placement={placement}
      bounds={bounds}
      style={style}
    >
      {children}
    </PieLayout>
  ) : (
    <PieLayout
      data={data}
      value="value"
      keyBy="id"
      label={label}
      placement={placement}
      bounds={bounds}
      style={style}
    >
      {children}
    </PieLayout>
  );
}
function Button({
  x,
  y,
  width,
  text,
  action,
  active = false,
}: {
  x: number;
  y: number;
  width: number;
  text: string;
  action: () => void;
  active?: boolean;
}): CRCNode {
  return (
    <Group>
      <Rectangle
        style={{
          left: x,
          top: y,
          width,
          height: 34,
          cornerRadius: 4,
          fill: active ? "#182c42" : "#e9e9e3",
          cursor: "pointer",
        }}
        onClick={action}
      />
      <Text
        pointerEvents="none"
        style={{
          left: x + width / 2,
          top: y + 17,
          textAlign: "center",
          textBaseline: "middle",
          font: "13px sans-serif",
          fill: active ? "white" : "#182c42",
        }}
      >
        {text}
      </Text>
    </Group>
  );
}
function Scene() {
  const data = useSignal(balanced);
  const small = useSignal(false);
  const placement = useSignal<PieLabelPlacement>("auto");
  const narrow = useSignal(false);
  const donut = useSignal(false);
  const cards = useSignal(false);
  const hovered = useSignal<string | null>(null);
  const pinned = useSignal<string | null>(null);
  const active = pinned.get() ?? hovered.get();
  const inspected = data.get().find((d) => d.id === active);
  const toggle = (key: string) => pinned.set(pinned.get() === key ? null : key);
  const box = narrow.get()
    ? { x: 170, y: 115, width: 320, height: 310 }
    : { x: 20, y: 115, width: 620, height: 310 };
  const pieStyle = {
    cx: 330,
    cy: 270,
    radius: 112,
    innerRadius: donut.get() ? 58 : 0,
    labelFont: "13px sans-serif",
    labelGap: 10,
  };
  return (
    <Group>
      <Rectangle style={{ width: 1000, height: 570, fill: "#fcfbf8" }} />
      <Text
        style={{
          left: 28,
          top: 38,
          font: "bold 26px sans-serif",
          fill: "#182c42",
        }}
      >
        How we get around
      </Text>
      <Text
        style={{ left: 28, top: 67, font: "14px sans-serif", fill: "#62758b" }}
      >
        100 fictional responses · Labels share one layout; slices keep ordinary
        CRC events.
      </Text>
      <Rectangle
        pointerEvents="none"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          fill: "#f4f3ed",
          cornerRadius: 6,
        }}
      />
      <LabelledPie
        cards={cards.get()}
        data={data}
        placement={placement}
        bounds={box}
        style={pieStyle}
      >
        {(slice) => (
          <PieSlice
            slice={slice}
            style={{
              fill: slice.datum.color,
              opacity: active && active !== slice.key ? 0.78 : 1,
              stroke: "#fcfbf8",
              strokeWidth: 1,
            }}
            onPointerEnter={() => hovered.set(slice.key)}
            onPointerLeave={() => hovered.set(null)}
            onClick={() => toggle(slice.key)}
          >
            <PieLabel
              slice={slice}
              pointerEvents="auto"
              style={{
                fill:
                  slice.label?.status === "placed" &&
                  slice.label.placement === "inside"
                    ? "white"
                    : "#182c42",
                leaderStroke: slice.datum.color,
              }}
              onPointerEnter={() => hovered.set(slice.key)}
              onPointerLeave={() => hovered.set(null)}
              onClick={() => toggle(slice.key)}
            >
              {cards.get() && (
                <Group>
                  <Rectangle
                    pointerEvents="none"
                    style={{
                      width: 120,
                      height: 38,
                      cornerRadius: 5,
                      fill: "#fffdf8",
                      stroke: slice.datum.color,
                      strokeWidth: 1,
                    }}
                  />
                  <Text
                    pointerEvents="none"
                    style={{
                      left: 8,
                      top: 15,
                      font: "bold 12px sans-serif",
                      fill: "#182c42",
                    }}
                  >
                    {slice.datum.label}
                  </Text>
                  <Text
                    pointerEvents="none"
                    style={{
                      left: 8,
                      top: 30,
                      font: "11px sans-serif",
                      fill: "#62758b",
                    }}
                  >{`${slice.datum.value} of 100 responses`}</Text>
                </Group>
              )}
            </PieLabel>
          </PieSlice>
        )}
      </LabelledPie>
      <Text
        pointerEvents="none"
        style={{
          left: 700,
          top: 108,
          font: "bold 12px sans-serif",
          fill: "#62758b",
        }}
      >
        ALL CATEGORIES
      </Text>
      {data.get().map((datum, index) => (
        <Group
          key={datum.id}
          style={{ translateX: 690, translateY: 120 + index * 40 }}
        >
          <Rectangle
            style={{
              width: 282,
              height: 36,
              cornerRadius: 4,
              fill: active === datum.id ? "#eeede8" : "#fcfbf8",
              cursor: "pointer",
            }}
            onPointerEnter={() => hovered.set(datum.id)}
            onPointerLeave={() => hovered.set(null)}
            onClick={() => toggle(datum.id)}
          />
          <Rectangle
            pointerEvents="none"
            style={{
              left: 10,
              top: 12,
              width: 12,
              height: 12,
              fill: datum.color,
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 32,
              top: 18,
              textBaseline: "middle",
              font: "14px sans-serif",
              fill: "#182c42",
            }}
          >
            {datum.label}
          </Text>
          <Text
            pointerEvents="none"
            style={{
              left: 268,
              top: 18,
              textAlign: "right",
              textBaseline: "middle",
              font: "bold 14px sans-serif",
              fill: "#182c42",
            }}
          >{`${datum.value}%`}</Text>
        </Group>
      ))}
      <HoverCard
        anchor={{ x: 831, y: 366 }}
        gap={10}
        placement="below"
        bounds={{ x: 690, y: 366, width: 282, height: 80 }}
        style={{
          width: 258,
          height: 40,
          padding: 12,
          fill: "#eeede8",
          strokeWidth: 0,
          cornerRadius: 6,
        }}
      >
        <Text
          pointerEvents="none"
          style={{
            left: 129,
            top: 9,
            textAlign: "center",
            textBaseline: "middle",
            font: "bold 15px sans-serif",
            fill: "#182c42",
          }}
        >
          {inspected
            ? `${inspected.label} · ${inspected.value}%`
            : "Hover a slice, label, or category"}
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 129,
            top: 30,
            textAlign: "center",
            textBaseline: "middle",
            font: "12px sans-serif",
            fill: "#62758b",
          }}
        >
          {inspected
            ? `${inspected.value} of 100 responses${pinned.get() ? " · pinned" : ""}`
            : "Click to pin your selection"}
        </Text>
      </HoverCard>
      <Text
        pointerEvents="none"
        style={{ left: 28, top: 453, font: "12px sans-serif", fill: "#62758b" }}
      >
        Labels that cannot fit are omitted. Every category remains available in
        the key.
      </Text>
      {(["inside", "outside", "auto"] as const).map((mode, index) => (
        <Button
          key={mode}
          x={28 + index * 100}
          y={474}
          width={90}
          text={mode}
          active={placement.get() === mode}
          action={() => placement.set(mode)}
        />
      ))}
      <Button
        x={342}
        y={474}
        width={148}
        text={small.get() ? "Balanced sample" : "Try tiny slices"}
        action={() => {
          const next = !small.get();
          small.set(next);
          data.set(next ? tiny : balanced);
          hovered.set(null);
          pinned.set(null);
        }}
      />
      <Button
        x={502}
        y={474}
        width={138}
        text={narrow.get() ? "Restore label space" : "Limit label space"}
        action={() => narrow.set(!narrow.get())}
      />
      <Button
        x={502}
        y={438}
        width={138}
        text={cards.get() ? "Show text labels" : "Show label cards"}
        active={cards.get()}
        action={() => cards.set(!cards.get())}
      />
      <Button
        x={690}
        y={438}
        width={136}
        text={donut.get() ? "Show pie" : "Show donut"}
        active={donut.get()}
        action={() => donut.set(!donut.get())}
      />
      <Button
        x={690}
        y={474}
        width={136}
        text="Reverse slice order"
        action={() => data.set([...data.get()].reverse())}
      />
      <Button
        x={836}
        y={474}
        width={136}
        text="Clear pinned slice"
        action={() => pinned.set(null)}
      />
      <Text
        pointerEvents="none"
        style={{ left: 28, top: 545, font: "12px sans-serif", fill: "#62758b" }}
      >
        Compare inside, outside, and auto. Tiny categories sit on both sides;
        reversing preserves their identities.
      </Text>
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Scene />);
}
