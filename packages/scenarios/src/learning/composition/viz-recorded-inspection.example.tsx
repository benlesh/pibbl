import {
  Circle,
  FocusManagement,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { LinearScale, PointSeries, defineSeries } from "@pibbl/core/viz";
import {
  usePointInspection,
  nearestRecordedX,
  type NearestRecordedXHit,
} from "@pibbl/core/viz/inspection";

// Minutes after 09:30; deterministic simulated quotes, not market data.
const quotes = [
  { time: 0, price: 100, label: "09:30" },
  { time: 5, price: 103, label: "09:35" },
  { time: 10, price: 101, label: "09:40" },
];
const series = defineSeries({ data: quotes, x: "time", y: "price" });
const orders = [1, 6, 9];
const clock = (minute: number) => `09:${30 + minute}`;

function RecordedInspection() {
  const inspection = usePointInspection(series);
  const selection = useSignal<
    | {
        time: number;
        hit: NearestRecordedXHit<(typeof quotes)[number]> | undefined;
      }
    | undefined
  >(undefined);

  // An ordinary application action: no event adapter and no query in render.
  function inspect(time: number) {
    const rendered = inspection.rendered();
    if (!rendered) return;
    selection.set({ time, hit: nearestRecordedX(rendered, { domainX: time }) });
  }
  const chosen = selection.get();
  const hit = chosen?.hit;
  return (
    <>
      <Rectangle style={{ width: 340, height: 280, fill: "#f3f5ed" }} />
      <Text
        pointerEvents="none"
        style={{
          left: 20,
          top: 16,
          font: "bold 19px sans-serif",
          fill: "#173a35",
        }}
      >
        Price at an order time
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 20, top: 40, font: "11px sans-serif", fill: "#46675f" }}
      >
        Recorded quotes · deterministic simulation
      </Text>
      <Rectangle
        pointerEvents="none"
        style={{ left: 20, top: 55, width: 300, height: 98, fill: "#fffefa" }}
      />
      <Rectangle
        pointerEvents="none"
        style={{ left: 30, top: 145, width: 280, height: 1, fill: "#ccdbd2" }}
      />
      {chosen && (
        <Rectangle
          pointerEvents="none"
          style={{
            left: 40 + chosen.time * 26,
            top: 62,
            width: 1,
            height: 82,
            fill: "#d9674c",
          }}
        />
      )}
      <PointSeries
        data={series.data}
        x={series.x}
        y={series.y}
        xScale="time"
        yScale="price"
        inspection={inspection}
        style={{ radius: 5, fill: "#087f8c" }}
      />
      {quotes.map((quote) => (
        <>
          <Text
            pointerEvents="none"
            style={{
              left: 40 + quote.time * 26 - 16,
              top: 145 - (quote.price - 98) * 9 - 25,
              font: "bold 12px sans-serif",
              fill: "#173a35",
            }}
          >
            ${quote.price}
          </Text>
          <Text
            pointerEvents="none"
            style={{
              left: 40 + quote.time * 26 - 16,
              top: 157,
              font: "11px sans-serif",
              fill: "#46675f",
            }}
          >
            {quote.label}
          </Text>
        </>
      ))}
      {hit && (
        <Circle
          pointerEvents="none"
          style={{
            cx: hit.anchorRoot.x,
            cy: hit.anchorRoot.y,
            radius: 10,
            stroke: "#d9674c",
            strokeWidth: 2,
          }}
        />
      )}
      {orders.map((time, index) => (
        <>
          <Rectangle
            keyboardFocusable
            onClick={() => inspect(time)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inspect(time);
              }
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const current = orders.indexOf(chosen?.time ?? time);
                inspect(
                  orders[(current + (event.key === "ArrowRight" ? 1 : 2)) % 3]!,
                );
              }
            }}
            style={{
              left: 20 + index * 104,
              top: 179,
              width: 92,
              height: 32,
              fill: chosen?.time === time ? "#087f8c" : "#e1ece4",
              stroke: "#087f8c",
              cursor: "pointer",
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 43 + index * 104,
              top: 188,
              font: "bold 13px sans-serif",
              fill: chosen?.time === time ? "#ffffff" : "#173a35",
            }}
          >
            {clock(time)}
          </Text>
        </>
      ))}
      <Text
        pointerEvents="none"
        style={{
          left: 20,
          top: 221,
          font: "bold 14px sans-serif",
          fill: "#173a35",
        }}
      >
        {chosen && hit
          ? `Order ${clock(chosen.time)} → quote ${hit.datum.label}`
          : "Choose an order time"}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 20, top: 243, font: "12px sans-serif", fill: "#46675f" }}
      >
        {hit
          ? `$${hit.datum.price.toFixed(2)} · source row ${hit.sourceIndex} · ${hit.domainDelta} min away`
          : "The outlined dot will identify the quote"}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 20, top: 262, font: "11px sans-serif", fill: "#46675f" }}
      >
        Nearest recorded quote; no interpolation
      </Text>
    </>
  );
}

/** Mount the standalone recorded-query lesson; dispose the returned controller on removal. */
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <LinearScale id="time" domain={[0, 10]} range={[40, 300]}>
        <LinearScale id="price" domain={[98, 108]} range={[145, 55]}>
          <RecordedInspection />
        </LinearScale>
      </LinearScale>
    </FocusManagement>,
  );
}
