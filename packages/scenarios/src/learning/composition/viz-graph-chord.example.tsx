import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { ChordDiagram } from "@pibbl/core/viz";

const districts = ["North", "Central", "East", "Harbor"].map((id) => ({ id }));

// Illustrative weekday trips captured at four district gateways.
const trips = [
  { id: "north-central", from: "North", to: "Central", trips: 1240 },
  { id: "central-north", from: "Central", to: "North", trips: 710 },
  { id: "north-east", from: "North", to: "East", trips: 460 },
  { id: "east-central", from: "East", to: "Central", trips: 390 },
  { id: "central-east", from: "Central", to: "East", trips: 320 },
  { id: "east-harbor", from: "East", to: "Harbor", trips: 280 },
  { id: "harbor-central", from: "Harbor", to: "Central", trips: 560 },
  { id: "central-harbor", from: "Central", to: "Harbor", trips: 190 },
];

const colors: Record<string, string> = {
  North: "#3b82a0",
  Central: "#1c7c70",
  East: "#b86a4d",
  Harbor: "#7661a8",
};
const totalTrips = trips.reduce((sum, trip) => sum + trip.trips, 0);

function Scene() {
  const selected = useSignal<string | null>(null);
  const selectedKey = selected.get();
  const active = trips.find(
    (trip) => `${trip.from} → ${trip.to}` === selectedKey,
  );
  const reverse = active
    ? trips.find((trip) => trip.from === active.to && trip.to === active.from)
    : undefined;
  return (
    <Group
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          selected.set(null);
          event.preventDefault();
        }
      }}
    >
      <Rectangle
        onClick={() => selected.set(null)}
        style={{ width: 900, height: 580, fill: "#f8f6f0" }}
      />
      <Text
        style={{
          left: 32,
          top: 26,
          font: "700 25px sans-serif",
          fill: "#202724",
        }}
      >
        District trips
      </Text>
      <Text
        style={{ left: 32, top: 58, font: "14px sans-serif", fill: "#59635d" }}
      >
        Illustrative weekday travel between four district gateways · each ribbon
        is one direction
      </Text>
      <Group style={{ translateX: 108, translateY: 116 }}>
        <ChordDiagram
          data={{ categories: districts, transfers: trips }}
          categoryKey="id"
          source="from"
          target="to"
          value="trips"
          unit="trips/day"
          label="id"
          style={{
            width: 438,
            height: 408,
            bandWidth: 28,
            padAngle: 5,
            startAngle: 0,
          }}
          labelStyle={{ textAlign: "center" }}
          bandStyle={(band) => ({ fill: colors[String(band.key)] })}
          ribbonStyle={(ribbon) => ({
            fill:
              selectedKey === `${ribbon.sourceKey} → ${ribbon.targetKey}`
                ? colors[String(ribbon.sourceKey)]
                : `${colors[String(ribbon.sourceKey)]}99`,
            opacity:
              selectedKey &&
              selectedKey !== `${ribbon.sourceKey} → ${ribbon.targetKey}`
                ? 0.18
                : 1,
            stroke:
              selectedKey === `${ribbon.sourceKey} → ${ribbon.targetKey}`
                ? "#f4b942"
                : "rgba(255,255,255,0.42)",
            strokeWidth:
              selectedKey === `${ribbon.sourceKey} → ${ribbon.targetKey}`
                ? 3
                : 1,
          })}
          onRibbonClick={(ribbon) =>
            selected.set(`${ribbon.sourceKey} → ${ribbon.targetKey}`)
          }
        />
      </Group>
      <Rectangle
        style={{
          left: 576,
          top: 138,
          width: 260,
          height: 282,
          fill: "#eef2ef",
          cornerRadius: 12,
        }}
      />
      <Text
        style={{
          left: 600,
          top: 162,
          font: "700 13px sans-serif",
          fill: "#69766e",
        }}
      >
        {active ? "SELECTED ROUTE" : "WEEKDAY TOTAL"}
      </Text>
      <Text
        style={{
          left: 600,
          top: 188,
          font: "700 21px sans-serif",
          fill: "#26342e",
        }}
      >
        {active ? `${active.from} → ${active.to}` : "All gateways"}
      </Text>
      <Text
        style={{
          left: 600,
          top: 236,
          font: "700 36px sans-serif",
          fill: "#1c7c70",
        }}
      >
        {(active?.trips ?? totalTrips).toLocaleString("en-US")}
      </Text>
      <Text
        style={{
          left: 600,
          top: 278,
          font: "13px sans-serif",
          fill: "#59635d",
        }}
      >
        trips per weekday
      </Text>
      <Text
        style={{
          left: 600,
          top: 321,
          width: 208,
          font: "13px sans-serif",
          fill: "#59635d",
          wrap: true,
          lineHeight: 18,
        }}
      >
        {reverse
          ? `${reverse.trips.toLocaleString("en-US")} return trips in the reverse direction`
          : "Select a ribbon to compare one route with its return trip."}
      </Text>
      {Object.entries(colors).map(([district, color], index) => (
        <Group key={district}>
          <Rectangle
            style={{
              left: 600 + (index % 2) * 112,
              top: 448 + Math.floor(index / 2) * 28,
              width: 10,
              height: 10,
              fill: color,
              cornerRadius: 5,
            }}
          />
          <Text
            style={{
              left: 616 + (index % 2) * 112,
              top: 446 + Math.floor(index / 2) * 28,
              font: "12px sans-serif",
              fill: "#59635d",
            }}
          >
            {district}
          </Text>
        </Group>
      ))}
      <Text
        style={{
          left: 600,
          top: 510,
          font: "600 11px sans-serif",
          fill: "#69766e",
        }}
      >
        Ribbon color = origin district
      </Text>
      <Text
        style={{
          left: 32,
          top: 545,
          font: "600 13px sans-serif",
          fill: "#305449",
        }}
      >
        {active
          ? "Click empty space or press Escape to clear the selection."
          : "Select a ribbon: outer bands show each district's total incoming and outgoing trips."}
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene />
    </FocusManagement>,
  );
}
